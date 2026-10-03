import { analyzeMessage } from './core/processor.js';
import { armAbort, triggerAbort } from './providers/utils.js';
import { DEFAULTS, FAILED_TAG } from './core/config.js';
import { ensureTagsExist } from './core/tags.js';
import { getLanguage, t } from './core/i18n.js';

console.log("Email Assistant: Background script loaded.");

function notifyBasic(text) {
  messenger.notifications.create({
    type: 'basic',
    title: t('notifyTitle'),
    message: text,
    iconUrl: messenger.runtime.getURL('icons/icon-48.png')
  });
}

// Toolbar button opens the batch panel as a standalone window: it stays
// visible when the user switches apps (popups auto-dismiss on click-away).
let batchWindowId = null;

messenger.browserAction.onClicked.addListener(async (tab) => {
  if (batchWindowId !== null) {
    try {
      await messenger.windows.update(batchWindowId, { focused: true });
      return;
    } catch {
      batchWindowId = null;
    }
  }
  // Remember which mail window the button was clicked in; the panel is its
  // own window and must scan that origin window's selection.
  const win = await messenger.windows.create({
    type: 'popup',
    url: messenger.runtime.getURL(`popup.html?win=${tab.windowId}`),
    width: 420, height: 640
  });
  batchWindowId = win.id;
});

messenger.windows.onRemoved.addListener((windowId) => {
  if (windowId === batchWindowId) batchWindowId = null;
});

// Button in the message display toolbar: summarize the currently displayed message.
messenger.messageDisplayAction.onClicked.addListener(async (tab) => {
  try {
    const message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
    if (message) await openSummaryWindow(message.id);
  } catch (error) {
    console.error('Email Assistant: no displayed message:', error);
  }
});

async function openSummaryWindow(messageId) {
  await messenger.windows.create({
    type: 'popup',
    url: messenger.runtime.getURL(`summary.html?id=${messageId}`),
    width: 440,
    height: 560
  });
}

// --- Batch tagging state machine (driven by the toolbar popup) ---
// idle → analyzing → reviewing → applying → done/cancelled/error
let batch = {
  phase: 'idle',
  current: 0, total: 0, ok: 0, fail: 0, moved: 0,
  lastSubject: '', lastError: null,
  failDetails: [],
  cancelRequested: false,
  consecutiveFails: 0,
  reviewItems: [],
  catalog: {}
};

function batchStatus() {
  return {
    phase: batch.phase,
    current: batch.current,
    total: batch.total,
    ok: batch.ok,
    fail: batch.fail,
    moved: batch.moved,
    lastSubject: batch.lastSubject,
    lastError: batch.lastError,
    failDetails: batch.failDetails.slice(0, 8),
    skippedNotes: (batch.skippedNotes || []).slice(0, 8),
    reviewItems: batch.reviewItems,
    catalog: batch.catalog
  };
}

async function tagCatalog() {
  await getLanguage();
  const { customTags, tagKeys: keyMap } = await messenger.storage.local.get({
    customTags: DEFAULTS.customTags,
    tagKeys: {}
  });
  const catalog = {};
  catalog[keyMap[FAILED_TAG.key] || FAILED_TAG.key] = { name: t('failedTagName'), color: FAILED_TAG.color, moveNone: true };
  for (const tag of customTags) {
    const entry = { name: tag.name, color: tag.color };
    const folder = tag.folder || 'auto'; // legacy '' behaves like auto
    if (folder === 'none') {
      entry.moveNone = true;
    } else if (folder === 'auto') {
      entry.folderAuto = true;
      entry.folderLabel = t('folderAutoLabel', { name: tag.name });
    } else {
      entry.folderId = folder;
      try {
        const target = await messenger.folders.get(folder);
        entry.folderLabel = target ? `${target.accountId}${target.path}` : folder;
      } catch {
        entry.folderLabel = folder;
      }
    }
    catalog[keyMap[tag.key] || tag.key] = entry;
  }
  return catalog;
}

async function batchConcurrency() {
  const { concurrency } = await messenger.storage.local.get({ concurrency: DEFAULTS.concurrency });
  return Math.min(8, Math.max(1, Number(concurrency) || 1));
}

async function runAnalysis(messages, notify) {
  batch = {
    phase: 'analyzing',
    current: 0, total: messages.length, ok: 0, fail: 0,
    lastSubject: '', lastError: null,
    failDetails: [],
    cancelRequested: false,
    consecutiveFails: 0,
    reviewItems: messages.map(m => ({ id: m.id, subject: m.subject || '', author: m.author || '', tags: [], failed: null })),
    catalog: await tagCatalog()
  };
  if (notify) notifyBasic(t('notifyStart', { count: messages.length }));
  armAbort();

  const concurrency = await batchConcurrency();
  let next = 0;
  const worker = async () => {
    while (!batch.cancelRequested && batch.phase === 'analyzing') {
      const i = next++;
      if (i >= messages.length) break;
      const m = messages[i];
      const item = batch.reviewItems[i];
      batch.lastSubject = m.subject || '';

      let reason = null;
      try {
        const result = await analyzeMessage({ id: m.id });
        if (result) item.tags = [...result.tagKeys];
        else reason = 'LLM analysis failed';
      } catch (error) {
        if (batch.cancelRequested) break; // aborted on purpose — not a failure
        console.error("Email Assistant: Batch error for message ID:", m.id, error);
        reason = String(error.message || error).slice(0, 120);
      }

      batch.current += 1;
      if (!reason) {
        batch.ok += 1;
        batch.consecutiveFails = 0;
      } else {
        item.failed = reason;
        batch.fail += 1;
        batch.consecutiveFails += 1;
        batch.failDetails.push({ n: i + 1, subject: m.subject || '', reason });
      }

      if (batch.consecutiveFails >= 3) {
        batch.phase = 'error';
        batch.lastError = reason;
        console.error("Email Assistant: Batch aborted after 3 consecutive failures.");
        break;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, messages.length) }, worker));

  if (batch.phase === 'analyzing') {
    batch.phase = batch.cancelRequested ? 'cancelled' : 'reviewing';
    if (batch.phase === 'reviewing' && notify) {
      notifyBasic(t('notifyReviewReady', { count: batch.ok }));
    }
  }
  console.log(`Email Assistant: Analysis ${batch.phase} — ok: ${batch.ok}, fail: ${batch.fail}`);
}

// First tag of the message (in tag-definition order) that has a move target.
function moveTargetFor(item, catalog) {
  for (const key of item.tags || []) {
    const meta = catalog[key];
    if (meta && !meta.moveNone && (meta.folderId || meta.folderAuto)) return meta;
  }
  return null;
}


const IMAP_TIMEOUT = 30000; // a hung IMAP call must not wedge the whole batch
const withTimeout = (p, ms, what) => Promise.race([
  p,
  new Promise((_, reject) => {
    const iv = setInterval(() => {
      if (batch.cancelRequested) { clearInterval(iv); reject(new Error(`${what} cancelled`)); }
    }, 100);
    setTimeout(() => { clearInterval(iv); reject(new Error(`${what} timed out (${ms / 1000}s)`)); }, ms);
  })
]);
// Cancelling during a delay takes effect immediately, not after the wait.
const sleepOrCancel = async (ms) => {
  let waited = 0;
  while (waited < ms && !batch.cancelRequested) {
    await new Promise(resolve => setTimeout(resolve, 100));
    waited += 100;
  }
};

// Per apply run: cache auto-created tag folders so each tag+account creates once.
const autoFolderCache = new Map();

async function autoFolderIdFor(item, meta) {
  const details = await messenger.messages.get(item.id);
  const accountId = details.accountId || (details.folder && details.folder.accountId);
  if (!accountId) throw new Error('Message has no account');
  const cacheKey = `${accountId}/${meta.name}`;
  if (autoFolderCache.has(cacheKey)) return autoFolderCache.get(cacheKey);

  const account = await messenger.accounts.get(accountId);
  const root = account && account.rootFolder;
  if (!root) throw new Error(`No root folder for account ${accountId}`);

  let subFolders = [];
  try {
    subFolders = await messenger.folders.getSubFolders(root.id);
  } catch (error) {
    console.warn("Email Assistant: Could not list account folders:", error);
  }
  const existing = subFolders.find(f => f.name === meta.name);
  if (existing) {
    autoFolderCache.set(cacheKey, existing.id);
    return existing.id;
  }

  if (!messenger.folders || typeof messenger.folders.create !== 'function') {
    throw new Error('Folder creation unavailable (accountsFolders permission missing)');
  }
  const created = await messenger.folders.create(root, meta.name);
  console.log(`Email Assistant: Created folder ${accountId}/${meta.name}`);
  autoFolderCache.set(cacheKey, created.id);
  return created.id;
}

// Thunderbird only renders tags whose key exists in its tag registry.
// If a mapped key lost its definition (migration accidents, manual edits),
// recreate it on the fly so tags are always visible after applying.
async function ensureTagDefinitions(keys, catalog) {
  const all = await messenger.messages.tags.list();
  const known = new Set(all.map(x => x.key));
  for (const key of keys) {
    if (known.has(key)) continue;
    const meta = catalog[key];
    try {
      await messenger.messages.tags.create(key, (meta && meta.name) || key, (meta && meta.color) || '#4f46e5');
      known.add(key);
      console.log(`Email Assistant: Recreated missing tag definition: ${key}`);
    } catch (error) {
      console.error(`Email Assistant: Could not recreate tag definition ${key}:`, error);
    }
  }
}

// After a move the message gets a new id; find it via its Message-ID header
// and rewrite the tags there (servers may drop keywords during IMAP MOVE).
async function reapplyTagsAtDestination(item, hmid, destId) {
  if (!hmid || !item.tags || !item.tags.length) return;
  try {
    const found = await withTimeout(
      messenger.messages.query({ folder: destId, headerMessageId: hmid }),
      10000, 'Relocate query');
    const list = found && found.messages;
    if (!list || !list.length) return;
    const fresh = await withTimeout(messenger.messages.get(list[0].id), 10000, 'Relocate read');
    const want = new Set([...(fresh.tags || []), ...item.tags]);
    const have = new Set(fresh.tags || []);
    let missing = [...want].filter(k => !have.has(k));
    if (!missing.length) return;
    await withTimeout(messenger.messages.update(list[0].id, { tags: Array.from(want) }), 10000, 'Relocate tag write');
    console.log(`Email Assistant: re-applied tags after move: ${missing.join(', ')}`);
  } catch (error) {
    console.warn('Email Assistant: post-move tag re-apply skipped:', error.message || error);
  }
}

async function applyReview(items) {
  const { batchAction, maxAttempts } = await messenger.storage.local.get({
    batchAction: DEFAULTS.batchAction,
    maxAttempts: DEFAULTS.maxAttempts
  });
  const doTag = batchAction !== 'move';
  const doMove = batchAction !== 'tag';
  const { noTagFailures = {} } = await messenger.storage.local.get({ noTagFailures: {} });
  const { noTagAccounts = [] } = await messenger.storage.local.get({ noTagAccounts: [] });

  // Built-in known-bad servers: QQ/Tencent mail and Gmail accept keyword
  // STOREs but silently drop them, so tags vanish within seconds
  // (bugzilla.mozilla.org/1516177). Skip tagging for them up front and
  // archive by moving instead, with a clear reason shown to the user.
  const NO_TAG_DOMAINS = [
    { suffix: 'qq.com', reasonKey: 'skipReasonQQ' },
    { suffix: 'vip.qq.com', reasonKey: 'skipReasonQQ' },
    { suffix: 'foxmail.com', reasonKey: 'skipReasonQQ' },
    { suffix: 'gmail.com', reasonKey: 'skipReasonGmail' },
    { suffix: 'googlemail.com', reasonKey: 'skipReasonGmail' }
  ];
  const accountEmail = {};
  const builtinNoTag = {};
  try {
    for (const a of await messenger.accounts.list(false)) {
      const email = ((a.identities && a.identities[0] && a.identities[0].email) || a.name || '').toLowerCase();
      accountEmail[a.id] = email;
      const hit = NO_TAG_DOMAINS.find(d => email.endsWith('@' + d.suffix));
      if (hit) builtinNoTag[a.id] = hit.reasonKey;
    }
  } catch { /* detection is best-effort */ }
  const announcedSkip = new Set();
  const { tagKeys: failKeyMap } = await messenger.storage.local.get({ tagKeys: {} });
  const FAIL_TAG = failKeyMap[FAILED_TAG.key] || FAILED_TAG.key;
  const MAX_ATTEMPTS = Math.min(10, Math.max(1, Number(maxAttempts) || DEFAULTS.maxAttempts));

  batch = {
    ...batch,
    phase: 'applying',
    current: 0, total: items.length, ok: 0, fail: 0, moved: 0, skippedNotes: [],
    lastSubject: '', lastError: null,
    failDetails: [],
    cancelRequested: false
  };
  autoFolderCache.clear();
  await ensureTagDefinitions([...new Set(items.flatMap(i => i.tags || []))], batch.catalog);

  const sleep = sleepOrCancel;
  const IMAP_DELAY = 500; // breathing room around IMAP operations

  // A message id becomes invalid once the message has been moved.
  const messageGone = async (id) => {
    try {
      await messenger.messages.get(id);
      return false;
    } catch (e) {
      return /not found|nonexistent|does not exist|unable to find/i.test(String(e.message || e));
    }
  };

  const applyOne = async (item) => {
    if (doTag && !item.tagApplied) {
      const details0 = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Tag read");
      const account = details0.accountId || (details0.folder && details0.folder.accountId);
      if (account) item.accountId = account;
      const builtinReason = account && builtinNoTag[account];
      const learnedSkip = account && noTagAccounts.includes(account);
      if (builtinReason || learnedSkip) {
        // Tagging is skipped, but the move/archive below still runs.
        // The reason is shown for every skipped message.
        batch.skippedNotes.push(`#${item.idx} ${item.subject || ''} · ${accountEmail[account] || account} · ${t(builtinReason || 'tagUnsupportedNote')}`);
        batch.lastSubject = t('tagSkippedLine', { subject: item.subject || '' });
      } else {
      await sleep(IMAP_DELAY);
      const details = details0;
      const merged = new Set([...(details.tags || []), ...item.tags]);
      await withTimeout(messenger.messages.update(item.id, { tags: Array.from(merged) }), IMAP_TIMEOUT, "Tag write");
      // Verify the tags really landed. The write settles asynchronously in
      // Thunderbird, so re-read after a pause and retry before failing —
      // an immediate read can still see the stale pre-write state.
      await sleep(IMAP_DELAY);
      let missing = [];
      let readBack = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const after = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Verify read");
        readBack = after.tags || [];
        missing = item.tags.filter(key => !readBack.includes(key));
        if (!missing.length) break;
        await sleep(1000);
      }
      if (missing.length) {
        throw new Error(`Tag not applied: ${missing.join(', ')} (read back: [${readBack.join(', ')}])`);
      }
      const defs = await messenger.messages.tags.list();
      const defKeys = new Set(defs.map(x => x.key));
      const undefinedKeys = item.tags.filter(key => !defKeys.has(key));
      if (undefinedKeys.length) {
        throw new Error(`Tag key has no definition: ${undefinedKeys.join(', ')}`);
      }
      item.tagApplied = true; // retries must not tag again — the move loop owns them now
      await sleep(IMAP_DELAY);
      }
    }
    if (doMove) {
      const target = moveTargetFor(item, batch.catalog);
      if (target) {
        const destId = target.folderAuto ? await withTimeout(autoFolderIdFor(item, target), IMAP_TIMEOUT, "Folder resolve") : target.folderId;
        let hmid = item.hmid;
        if (!hmid) {
          const src = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Pre-move read");
          hmid = item.hmid = src.headerMessageId || src.headers && src.headers['message-id'] && src.headers['message-id'][0];
        }
        await sleep(IMAP_DELAY);
        try {
          await withTimeout(messenger.messages.move([item.id], destId), IMAP_TIMEOUT, "Move");
        } catch (error) {
          // Some servers move the message but still report an error (timeouts);
          // a vanished id means the move actually happened — don't fail (and
          // don't retry against a dead id, which would also drop the tags).
          if (await messageGone(item.id)) { await reapplyTagsAtDestination(item, hmid, destId); batch.moved += 1; return; }
          throw error;
        }
        // IMAP MOVE may drop custom keywords server-side; re-apply the tags
        // at the destination (best effort, once).
        await reapplyTagsAtDestination(item, hmid, destId);
        await sleep(IMAP_DELAY);
        batch.moved += 1;
      } else if (!doTag) {
        throw new Error('No tag with a target folder');
      }
    }
  };

  // First pass: skip failures and collect them for a retry at the end.
  let failed = [];
  items.forEach((item, idx) => { item.idx = idx + 1; });
  for (const item of items) {
    if (batch.cancelRequested) break;
    batch.current += 1;
    batch.lastSubject = item.subject || '';
    try {
      await applyOne(item);
      batch.ok += 1;
    } catch (error) {
      console.error("Email Assistant: Apply error for message ID:", item.id, error);
      failed.push({ item, reason: String(error.message || error).slice(0, 120), attempts: 1 });
    }
  }

  // Retries: up to MAX_ATTEMPTS tries per message in total.
  for (let attempt = 2; attempt <= MAX_ATTEMPTS && failed.length && !batch.cancelRequested; attempt++) {
      batch.lastSubject = t('retryingLabel', { attempt: attempt, total: failed.length });
    const still = [];
    for (const entry of failed) {
      if (batch.cancelRequested) break;
      batch.lastSubject = entry.item.subject || '';
      try {
        await applyOne(entry.item);
        batch.ok += 1;
      } catch (error) {
        console.error(`Email Assistant: Apply attempt ${attempt} failed for message ID:`, entry.item.id, error);
        still.push({ ...entry, reason: String(error.message || error).slice(0, 120), attempts: attempt });
      }
    }
    failed = still;
  }

  // Messages that failed all attempts get the failure marker tag.
  for (const { item, reason } of failed.filter(e => e.attempts >= MAX_ATTEMPTS)) {
    batch.fail += 1;
    batch.failDetails.push({ n: item.idx, subject: item.subject || '', reason });
    // Transient write failures happen (network hiccups, throttling); only
    // degrade an account after several independent failed messages.
    if (item.accountId && /Tag not applied/.test(reason)) {
      noTagFailures[item.accountId] = (noTagFailures[item.accountId] || 0) + 1;
      await messenger.storage.local.set({ noTagFailures });
      if (noTagFailures[item.accountId] >= 3 && !noTagAccounts.includes(item.accountId)) {
        noTagAccounts.push(item.accountId);
        await messenger.storage.local.set({ noTagAccounts });
        batch.skippedNotes.push(`${t('tagUnsupportedNote')} (${item.accountId})`);
      }
    }
    try {
      await sleep(IMAP_DELAY);
      const details = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Fail-tag read");
      const merged = new Set([...(details.tags || []), FAIL_TAG]);
      await withTimeout(messenger.messages.update(item.id, { tags: Array.from(merged) }), IMAP_TIMEOUT, "Tag write");
    } catch (error) {
      console.error("Email Assistant: Could not apply failure tag to message ID:", item.id, error);
    }
  }

  if (batch.phase === 'applying') {
    batch.phase = batch.cancelRequested ? 'cancelled' : 'done';
  }
  try {
    await messenger.storage.local.set({ lastBatch: batchStatus() });
  } catch { /* diagnostic only */ }
  console.log(`Email Assistant: Apply ${batch.phase} — ok: ${batch.ok}, fail: ${batch.fail}, moved: ${batch.moved}`);
  notifyBasic(batch.phase === 'done'
    ? t('notifyApplied', { ok: batch.ok, fail: batch.fail, moved: batch.moved })
    : t('notifyCancelled', { ok: batch.ok, fail: batch.fail }));
  return batchStatus();
}

// A MessageList only holds one page of messages; keep pulling until exhausted.
async function allListMessages(list) {
  const messages = [...(list.messages || [])];
  while (list && list.id) {
    try {
      list = await messenger.messages.continueList(list.id);
      messages.push(...(list.messages || []));
    } catch {
      break;
    }
  }
  return messages;
}

async function scanSelection() {
  let tabs = await messenger.mailTabs.query({ active: true });
  if (!tabs.length) {
    tabs = await messenger.mailTabs.query({});
  }
  if (!tabs.length) return [];

  const list = await messenger.mailTabs.getSelectedMessages(tabs[0].id);
  if (!list) return [];

  const messages = await allListMessages(list);
  return messages.map(m => ({
    id: m.id,
    subject: m.subject || '',
    author: m.author || ''
  }));
}

async function startBatchWith(messages, notify) {
  if (batch.phase === 'analyzing' || batch.phase === 'applying') {
    return { alreadyRunning: true, ...batchStatus() };
  }
  if (!messages.length) {
    return { selectionEmpty: true, ...batchStatus() };
  }
  runAnalysis(messages, notify).catch(err => {
    console.error("Email Assistant: Analysis crashed:", err);
    batch.phase = 'error';
    batch.lastError = String(err.message || err);
  });
  return batchStatus();
}

async function startBatch() {
  const messages = await scanSelection();
  return startBatchWith(messages, false);
}

messenger.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.type) {
    case 'scanSelection':
      return scanSelection();
    case 'ea.batch.start':
      return startBatch();
    case 'ea.batch.startWith':
      return startBatchWith(msg.messages || [], false);
    case 'ea.batch.apply':
      return applyReview(msg.items || []);
    case 'ea.batch.status':
      return Promise.resolve(batchStatus());
    case 'ea.batch.cancel':
      if (['analyzing', 'applying'].includes(batch.phase)) {
        batch.cancelRequested = true;
        triggerAbort(); // kill in-flight LLM requests right away
      }
      else if (batch.phase === 'reviewing') batch = { ...batch, phase: 'idle', reviewItems: [] };
      return Promise.resolve(batchStatus());
    case 'ea.batch.reset':
      if (!['analyzing', 'applying'].includes(batch.phase)) {
        batch = { ...batch, phase: 'idle', current: 0, total: 0, ok: 0, fail: 0, moved: 0, lastSubject: '', lastError: null, failDetails: [], consecutiveFails: 0, reviewItems: [] };
      }
      return Promise.resolve(batchStatus());
    default:
      return undefined;
  }
});

// --- Initialize ---
ensureTagsExist();
