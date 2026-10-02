import { analyzeMessage, processMessage } from './core/processor.js';
import { DEFAULTS, HARDCODED_TAGS, TAG_KEY_PREFIX } from './core/config.js';
import { ensureTagsExist } from './core/tags.js';
import { getLanguage, t } from './core/i18n.js';

console.log("Email Assistant: Background script loaded.");

// --- Automatic tagging on new mail ---
messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
  console.log("Email Assistant: New mail received in", folder.path);

  for (const message of messages.messages) {
    try {
      await processMessage(message);
    } catch (error) {
      console.error("Email Assistant: Error processing message ID:", message.id, error);
    }
  }
});

// --- Context menu: AI summary for a single message ---
async function rebuildMenus() {
  await getLanguage();
  await messenger.menus.removeAll();
  messenger.menus.create({
    id: 'ai-summary',
    title: t('menuSummarize'),
    contexts: ['message_list', 'message_display']
  });
  messenger.menus.create({
    id: 'ai-batch',
    title: t('menuBatch'),
    contexts: ['message_list']
  });
}

function notifyBasic(text) {
  messenger.notifications.create({
    type: 'basic',
    title: t('notifyTitle'),
    message: text,
    iconUrl: messenger.runtime.getURL('icons/icon-48.png')
  });
}

messenger.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'ai-batch') {
    if (info.selectedMessages) {
      const messages = await allListMessages(info.selectedMessages);
      if (messages.length) {
        await startBatchWith(messages.map(m => ({ id: m.id, subject: m.subject || '' })), true);
      }
    }
    return;
  }
  if (info.menuItemId !== 'ai-summary') return;

  let message = null;
  if (info.selectedMessages && info.selectedMessages.messages.length > 0) {
    message = info.selectedMessages.messages[0];
  } else if (info.displayedMessage) {
    message = info.displayedMessage;
  }
  if (!message) return;

  await openSummaryWindow(message.id);
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
    reviewItems: batch.reviewItems,
    catalog: batch.catalog
  };
}

async function tagCatalog() {
  const { customTags } = await messenger.storage.local.get({ customTags: DEFAULTS.customTags });
  const catalog = {};
  for (const tag of Object.values(HARDCODED_TAGS)) {
    catalog[TAG_KEY_PREFIX + tag.key] = { name: tag.name, color: tag.color, moveNone: true };
  }
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
    catalog[TAG_KEY_PREFIX + tag.key] = entry;
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

async function applyReview(items) {
  const { batchAction, maxAttempts } = await messenger.storage.local.get({
    batchAction: DEFAULTS.batchAction,
    maxAttempts: DEFAULTS.maxAttempts
  });
  const doTag = batchAction !== 'move';
  const doMove = batchAction !== 'tag';
  const FAIL_TAG = TAG_KEY_PREFIX + 'failed';
  const MAX_ATTEMPTS = Math.min(10, Math.max(1, Number(maxAttempts) || DEFAULTS.maxAttempts));

  batch = {
    ...batch,
    phase: 'applying',
    current: 0, total: items.length, ok: 0, fail: 0, moved: 0,
    lastSubject: '', lastError: null,
    failDetails: [],
    cancelRequested: false
  };
  autoFolderCache.clear();

  const applyOne = async (item) => {
    if (doTag) {
      const details = await messenger.messages.get(item.id);
      const merged = new Set([...(details.tags || []), ...item.tags]);
      await messenger.messages.update(item.id, { tags: Array.from(merged) });
    }
    if (doMove) {
      const target = moveTargetFor(item, batch.catalog);
      if (target) {
        const destId = target.folderAuto ? await autoFolderIdFor(item, target) : target.folderId;
        await messenger.messages.move([item.id], destId);
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
    try {
      const details = await messenger.messages.get(item.id);
      const merged = new Set([...(details.tags || []), FAIL_TAG]);
      await messenger.messages.update(item.id, { tags: Array.from(merged) });
    } catch (error) {
      console.error("Email Assistant: Could not apply failure tag to message ID:", item.id, error);
    }
  }

  if (batch.phase === 'applying') {
    batch.phase = batch.cancelRequested ? 'cancelled' : 'done';
  }
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
    case 'ea.batch.apply':
      return applyReview(msg.items || []);
    case 'ea.batch.status':
      return Promise.resolve(batchStatus());
    case 'ea.batch.cancel':
      if (['analyzing', 'applying'].includes(batch.phase)) batch.cancelRequested = true;
      else if (batch.phase === 'reviewing') batch = { ...batch, phase: 'idle', reviewItems: [] };
      return Promise.resolve(batchStatus());
    case 'ea.batch.reset':
      if (!['analyzing', 'applying'].includes(batch.phase)) {
        batch = { ...batch, phase: 'idle', current: 0, total: 0, ok: 0, fail: 0, moved: 0, lastSubject: '', lastError: null, failDetails: [], consecutiveFails: 0, reviewItems: [] };
      }
      return Promise.resolve(batchStatus());
    case 'refreshMenus':
      return rebuildMenus().then(() => true);
    default:
      return undefined;
  }
});

// --- Initialize ---
ensureTagsExist();
rebuildMenus();
