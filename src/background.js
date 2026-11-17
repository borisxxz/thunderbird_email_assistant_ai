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

// Toolbar button opens the batch panel as a tab inside the Thunderbird
// window it was clicked in: it stays visible when the user switches apps
// (unlike a popup) and lives inside Thunderbird (unlike a separate window).
// One panel per window; ?win= binds each panel to its source window.
const panelByWindow = new Map();

messenger.browserAction.onClicked.addListener(async (tab) => {
  const winId = tab.windowId;
  const existingId = panelByWindow.get(winId);
  if (existingId) {
    try {
      const t = await messenger.tabs.get(existingId);
      if (t) { await messenger.tabs.update(existingId, { active: true }); return; }
    } catch { /* stale id — create a new panel below */ }
  }
  const created = await messenger.tabs.create({
    url: messenger.runtime.getURL(`popup.html?win=${winId}`),
    windowId: winId,
    active: true
  });
  panelByWindow.set(winId, created.id);
});
messenger.tabs.onRemoved.addListener((tabId) => {
  for (const [win, id] of panelByWindow) if (id === tabId) panelByWindow.delete(win);
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

// --- Batch tagging state machine (driven by the toolbar panel) ---
// idle → analyzing → reviewing → applying → done/cancelled/error
function freshBatch(overrides = {}) {
  return {
    phase: 'idle',
    current: 0, total: 0, ok: 0, fail: 0, moved: 0,
    analysisFailed: 0,
    lastSubject: '', lastError: null,
    failDetails: [], skippedNotes: [],
    cancelRequested: false,
    consecutiveFails: 0,
    reviewItems: [],
    catalog: {},
    ...overrides
  };
}
let batch = freshBatch();
let runningPromise = null; // non-null while analyze/apply workers are alive
let tagsReady = null;      // resolves when initial tag migration finishes

function batchStatus() {
  return {
    phase: batch.phase,
    current: batch.current,
    total: batch.total,
    ok: batch.ok,
    fail: batch.fail,
    moved: batch.moved,
    analysisFailed: batch.analysisFailed,
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
  catalog[keyMap[FAILED_TAG.key] || FAILED_TAG.key] = {
    name: t('failedTagName'), color: FAILED_TAG.color, moveNone: true, reserved: true
  };
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
  const myBatch = freshBatch({
    phase: 'analyzing',
    total: messages.length,
    reviewItems: messages.map(m => ({ id: m.id, subject: m.subject || '', author: m.author || '', tags: [], failed: null })),
    catalog: await tagCatalog()
  });
  batch = myBatch;
  if (notify) notifyBasic(t('notifyStart', { count: messages.length }));
  armAbort();

  const concurrency = await batchConcurrency();
  let next = 0;
  const results = new Array(messages.length).fill(null);
  let failuresInOrder = 0;
  let stopped = false;
  const worker = async () => {
    while (!myBatch.cancelRequested && myBatch.phase === 'analyzing') {
      const i = next++;
      if (i >= messages.length) break;
      const m = messages[i];
      const item = myBatch.reviewItems[i];
      myBatch.lastSubject = m.subject || '';

      let reason = null;
      try {
        const result = await analyzeMessage({ id: m.id });
        if (result) item.tags = [...result.tagKeys];
        else reason = 'LLM analysis failed';
      } catch (error) {
        reason = String(error.message || error).slice(0, 120);
      }

      if (myBatch.cancelRequested) break; // cancelled requests are not failures
      results[i] = reason ? 'fail' : 'ok';
      myBatch.current += 1;
      if (!reason) {
        myBatch.ok += 1;
      } else {
        item.failed = reason;
        myBatch.fail += 1;
        myBatch.analysisFailed += 1;
        myBatch.failDetails.push({ n: i + 1, subject: m.subject || '', reason });
      }

      // Evaluate consecutive failures in message order, not completion order.
      // Scan the known prefix: a success resets the run, an unknown (pending)
      // slot stops the scan — a later success there could break the run.
      let run = 0;
      for (let j = 0; j < results.length; j++) {
        if (!results[j]) break;
        if (results[j] === 'fail') {
          run += 1;
          if (run >= 3) break;
        } else {
          run = 0;
        }
      }
      failuresInOrder = run;
      myBatch.consecutiveFails = run;
      if (run >= 3) {
        myBatch.phase = 'error';
        myBatch.lastError = reason;
        stopped = true;
        console.error("Email Assistant: Batch aborted after 3 consecutive failures.");
        break;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, messages.length) }, worker));

  if (myBatch.phase === 'analyzing') {
    myBatch.phase = myBatch.cancelRequested ? 'cancelled' : 'reviewing';
    if (myBatch.phase === 'reviewing' && notify) {
      notifyBasic(t('notifyReviewReady', { count: myBatch.ok }));
    }
  }
  myBatch.analysisFailDetails = myBatch.failDetails.slice();
  console.log(`Email Assistant: Analysis ${myBatch.phase} — ok: ${myBatch.ok}, fail: ${myBatch.fail}${stopped ? ', stopped early' : ''}`);
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
const withTimeout = (p, ms, what) => {
  let interval = null;
  let timer = null;
  const cleanup = () => {
    if (interval) { clearInterval(interval); interval = null; }
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return Promise.race([
    Promise.resolve(p).finally(cleanup),
    new Promise((_, reject) => {
      interval = setInterval(() => {
        if (batch.cancelRequested) { cleanup(); reject(new Error(`${what} cancelled`)); }
      }, 100);
      timer = setTimeout(() => { cleanup(); reject(new Error(`${what} timed out (${ms / 1000}s)`)); }, ms);
    })
  ]);
};
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
    const missing = [...want].filter(k => !have.has(k));
    if (!missing.length) return;
    await withTimeout(messenger.messages.update(list[0].id, { tags: Array.from(want) }), 10000, 'Relocate tag write');
    console.log(`Email Assistant: re-applied tags after move: ${missing.join(', ')}`);
  } catch (error) {
    console.warn('Email Assistant: post-move tag re-apply skipped:', error.message || error);
  }
}

const CANCELLED = Symbol('cancelled');
const checkCancel = () => { if (batch.cancelRequested) throw CANCELLED; };

async function applyReview(items, analysisStats = null) {
  const { batchAction, maxAttempts } = await messenger.storage.local.get({
    batchAction: DEFAULTS.batchAction,
    maxAttempts: DEFAULTS.maxAttempts
  });
  const doTag = batchAction !== 'move';
  const doMove = batchAction !== 'tag';
  const { noTagFailures = {} } = await messenger.storage.local.get({ noTagFailures: {} });
  const { noTagAccounts = [] } = await messenger.storage.local.get({ noTagAccounts: [] });

  // Built-in known-bad servers: QQ/Tencent mail and Gmail accept keyword
  // STOREs but silently drop them. Tag-only mode cannot help these accounts,
  // so treat it as a failure instead of a silent no-op.
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
  const { tagKeys: failKeyMap } = await messenger.storage.local.get({ tagKeys: {} });
  const failTag = failKeyMap[FAILED_TAG.key] || FAILED_TAG.key;
  const MAX_ATTEMPTS = Math.min(10, Math.max(1, Number(maxAttempts) || DEFAULTS.maxAttempts));

  const myBatch = freshBatch({
    phase: 'applying',
    current: 0, total: items.length,
    analysisFailed: analysisStats ? analysisStats.fail : 0,
    failDetails: analysisStats ? [...analysisStats.failDetails] : [],
    reviewItems: batch.reviewItems,
    catalog: batch.catalog
  });
  batch = myBatch;
  autoFolderCache.clear();
  await ensureTagDefinitions([...new Set(items.flatMap(i => i.tags || []))], myBatch.catalog);

  const sleep = sleepOrCancel;
  const IMAP_DELAY = 500; // breathing room around IMAP operations

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
        if (!doMove) {
          // No other action would touch this message — do not report success.
          throw new Error(t(builtinReason || 'tagUnsupportedNote'));
        }
        // Move-only fallback still archives the message.
        myBatch.skippedNotes.push(`#${item.idx} ${item.subject || ''} · ${accountEmail[account] || account} · ${t(builtinReason || 'tagUnsupportedNote')}`);
        myBatch.lastSubject = t('tagSkippedLine', { subject: item.subject || '' });
      } else {
        await sleep(IMAP_DELAY);
        checkCancel();
        const details = details0;
        const merged = new Set([...(details.tags || []), ...item.tags]);
        await withTimeout(messenger.messages.update(item.id, { tags: Array.from(merged) }), IMAP_TIMEOUT, "Tag write");
        // Verify the tags really landed. Thunderbird settles writes
        // asynchronously, so re-read with retries before failing.
        await sleep(IMAP_DELAY);
        checkCancel();
        let missing = [];
        let readBack = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const after = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Verify read");
          readBack = after.tags || [];
          missing = item.tags.filter(key => !readBack.includes(key));
          if (!missing.length) break;
          await sleep(1000);
          checkCancel();
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
        checkCancel();
      }
    }
    if (doMove) {
      const target = moveTargetFor(item, myBatch.catalog);
      if (target) {
        const destId = target.folderAuto ? await withTimeout(autoFolderIdFor(item, target), IMAP_TIMEOUT, "Folder resolve") : target.folderId;
        let hmid = item.hmid;
        if (!hmid) {
          const src = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Pre-move read");
          hmid = item.hmid = src.headerMessageId || src.headers && src.headers['message-id'] && src.headers['message-id'][0];
        }
        await sleep(IMAP_DELAY);
        checkCancel();
        try {
          await withTimeout(messenger.messages.move([item.id], destId), IMAP_TIMEOUT, "Move");
        } catch (error) {
          if (await messageGone(item.id)) { await reapplyTagsAtDestination(item, hmid, destId); myBatch.moved += 1; return; }
          throw error;
        }
        await reapplyTagsAtDestination(item, hmid, destId);
        await sleep(IMAP_DELAY);
        checkCancel();
        myBatch.moved += 1;
      } else if (!doTag) {
        throw new Error('No tag with a target folder');
      }
    }
  };

  let failed = [];
  items.forEach((item, idx) => { item.idx = Number.isFinite(Number(item.n)) && Number(item.n) > 0 ? Number(item.n) : idx + 1; });
  let cancelled = false;
  const markUnattempted = (fromIndex) => {
    for (const item of items.slice(fromIndex)) {
      failed.push({ item, reason: 'cancelled before processing', attempts: 0 });
    }
  };
  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    if (myBatch.cancelRequested) {
      cancelled = true;
      markUnattempted(k);
      break;
    }
    myBatch.current += 1;
    myBatch.lastSubject = item.subject || '';
    try {
      await applyOne(item);
      myBatch.ok += 1;
    } catch (error) {
      if (error === CANCELLED) {
        cancelled = true;
        markUnattempted(k); // this message and the rest were not completed
        break;
      }
      console.error("Email Assistant: Apply error for message ID:", item.id, error);
      failed.push({ item, reason: String(error.message || error).slice(0, 120), attempts: 1 });
    }
  }

  // Retries: up to MAX_ATTEMPTS tries per message in total.
  for (let attempt = 2; attempt <= MAX_ATTEMPTS && failed.length && !myBatch.cancelRequested; attempt++) {
    myBatch.lastSubject = t('retryingLabel', { attempt, total: failed.length });
    const still = [];
    for (let k = 0; k < failed.length; k++) {
      const entry = failed[k];
      if (myBatch.cancelRequested) {
        cancelled = true;
        // Entries not retried yet in this round are still failures.
        still.push(...failed.slice(k));
        break;
      }
      myBatch.lastSubject = entry.item.subject || '';
      try {
        await applyOne(entry.item);
        myBatch.ok += 1;
      } catch (error) {
        if (error === CANCELLED) {
          cancelled = true;
          still.push(...failed.slice(k)); // this entry and the rest were not completed
          break;
        }
        console.error(`Email Assistant: Apply attempt ${attempt} failed for message ID:`, entry.item.id, error);
        still.push({ ...entry, reason: String(error.message || error).slice(0, 120), attempts: attempt });
      }
    }
    // Commit this round's outcome even when cancelled: entries that succeeded
    // earlier in this round must be removed from `failed`, or they would be
    // counted twice; entries not reached must stay, or ok+fail < total.
    failed = still;
    if (cancelled) break;
  }

  // Every message that did not succeed is counted as failed — including
  // messages left in the retry queue when the user cancelled.
  for (const { item, reason } of failed) {
    myBatch.fail += 1;
    myBatch.failDetails.push({ n: item.idx, subject: item.subject || '', reason: cancelled && !/cancelled/i.test(reason) ? `${reason} (cancelled)` : reason });
    if (item.accountId && /Tag not applied/.test(reason)) {
      noTagFailures[item.accountId] = (noTagFailures[item.accountId] || 0) + 1;
      await messenger.storage.local.set({ noTagFailures });
      if (noTagFailures[item.accountId] >= 3 && !noTagAccounts.includes(item.accountId)) {
        noTagAccounts.push(item.accountId);
        await messenger.storage.local.set({ noTagAccounts });
        myBatch.skippedNotes.push(`${t('tagUnsupportedNote')} (${item.accountId})`);
      }
    }
    try {
      await sleep(IMAP_DELAY);
      checkCancel();
      const details = await withTimeout(messenger.messages.get(item.id), IMAP_TIMEOUT, "Fail-tag read");
      const merged = new Set([...(details.tags || []), failTag]);
      await withTimeout(messenger.messages.update(item.id, { tags: Array.from(merged) }), IMAP_TIMEOUT, "Tag write");
    } catch (error) {
      if (error !== CANCELLED) console.error("Email Assistant: Could not apply failure tag to message ID:", item.id, error);
    }
  }

  myBatch.phase = myBatch.cancelRequested ? 'cancelled' : 'done';
  try {
    await messenger.storage.local.set({ lastBatch: batchStatus() });
  } catch { /* diagnostic only */ }
  console.log(`Email Assistant: Apply ${myBatch.phase} — ok: ${myBatch.ok}, fail: ${myBatch.fail}, moved: ${myBatch.moved}`);
  notifyBasic(myBatch.phase === 'done'
    ? t('notifyApplied', { ok: myBatch.ok, fail: myBatch.fail, moved: myBatch.moved })
    : t('notifyCancelled', { ok: myBatch.ok, fail: myBatch.fail }));
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

async function scanSelection(windowId) {
  let tabs = [];
  if (Number.isFinite(windowId) && windowId > 0) {
    tabs = await messenger.mailTabs.query({ windowId });
  }
  if (!tabs.length) tabs = await messenger.mailTabs.query({ active: true });
  if (!tabs.length) tabs = await messenger.mailTabs.query({});
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
  if (tagsReady) await tagsReady;
  if (['analyzing', 'applying'].includes(batch.phase) || runningPromise) {
    return { alreadyRunning: true, ...batchStatus() };
  }
  if (!messages.length) {
    return { selectionEmpty: true, ...batchStatus() };
  }
  const promise = runAnalysis(messages, notify)
    .catch(err => {
      console.error("Email Assistant: Analysis crashed:", err);
      batch.phase = 'error';
      batch.lastError = String(err.message || err);
    })
    .finally(() => { runningPromise = null; });
  runningPromise = promise;
  return batchStatus();
}

async function startBatch(windowId) {
  const messages = await scanSelection(windowId);
  return startBatchWith(messages, false);
}

function guardApply(promise) {
  // Same top-level convergence for apply as for analysis: a pre-flight
  // exception must never leave the state machine stuck in 'applying'.
  runningPromise = promise
    .catch(err => {
      console.error("Email Assistant: Apply crashed:", err);
      batch.phase = 'error';
      batch.lastError = String(err.message || err);
      return batchStatus();
    })
    .finally(() => { runningPromise = null; });
  return runningPromise;
}

messenger.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.type) {
    case 'ea.batch.start':
      return startBatch(msg.windowId);
    case 'ea.batch.startWith':
      return startBatchWith(msg.messages || [], false);
    case 'ea.batch.apply':
      return guardApply(applyReview(msg.items || [], {
        fail: batch.analysisFailed || 0,
        failDetails: batch.analysisFailDetails || []
      }));
    case 'ea.batch.review':
      // Persist the user's tag edits for the open review; the panel may be
      // closed before Apply, and reopening it must not lose those edits.
      if (batch.phase === 'reviewing') {
        const tagsById = new Map((msg.items || []).map(i => [i.id, i.tags || []]));
        for (const item of batch.reviewItems) {
          if (tagsById.has(item.id)) item.tags = [...tagsById.get(item.id)];
        }
      }
      return Promise.resolve(batchStatus());
    case 'ea.batch.status':
      return Promise.resolve(batchStatus());
    case 'ea.batch.cancel':
      if (['analyzing', 'applying'].includes(batch.phase)) {
        batch.cancelRequested = true;
        triggerAbort();
      } else if (batch.phase === 'reviewing') {
        batch = freshBatch();
      }
      return Promise.resolve(batchStatus());
    case 'ea.batch.reset':
      // Force-reset is always allowed once no worker is alive. A stale
      // 'applying' phase from a crash must not lock the extension forever.
      if (!runningPromise) batch = freshBatch();
      return Promise.resolve(batchStatus());
    case 'ea.tags.ensure':
      return (tagsReady || Promise.resolve()).then(() => ensureTagsExist());
    default:
      return undefined;
  }
});

// --- Initialize ---
// Wait for migration before batches can start; tagKeys must be ready.
tagsReady = ensureTagsExist().catch(err => console.error('Email Assistant: tag init failed:', err));
// ea.tags.ensure from other contexts must wait for the initial migration too.
