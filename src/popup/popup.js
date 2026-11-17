import { DEFAULTS, PROVIDERS, providerSettings } from '../core/config.js';
import { getLanguage, t } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => messenger.runtime.sendMessage(msg);

let pollTimer = null;
let selection = [];

function applyTexts() {
  document.documentElement.lang = currentLang === 'zh-CN' ? 'zh-CN' : 'en';
  $('popup-title').textContent = t('brandTitle');
  $('empty-title').textContent = t('emptyTitle');
  $('empty-desc').textContent = t('emptyDesc');
  $('btn-refresh').textContent = t('refreshSelection');
  $('idle-desc').textContent = t('popupIdleDesc');
  $('btn-start-label').textContent = t('startBatch');
  $('btn-cancel').textContent = t('cancelRun');
  $('ok-label').textContent = t('okStat');
  $('fail-label').textContent = t('failStat');
  $('ok-label-2').textContent = t('okStat');
  $('fail-label-2').textContent = t('failStat');
  $('btn-rescan-done').textContent = t('rescan');
  $('btn-rescan-cancelled').textContent = t('rescan');
  $('cancelled-title').textContent = t('popupStatusCancelled');
  $('error-title').textContent = t('errorTitle');
  $('error-desc').textContent = t('errorHint');
  $('btn-retry').textContent = t('retry');
  $('btn-error-settings').textContent = t('openSettings');
  $('foot-local').textContent = t('localBadge');
  $('btn-settings').textContent = t('openSettings') + ' →';
  $('review-title').textContent = t('reviewTitle');
  $('review-desc').textContent = t('reviewDesc');
  $('btn-review-discard').textContent = t('reviewDiscard');
  $('action-label').textContent = t('batchActionLabel');
  $('action-tag').textContent = t('actionTagOnly');
  $('action-tagmove').textContent = t('actionTagMove');
  $('action-move').textContent = t('actionMoveOnly');
}

function setInlineStatus(kind, text) {
  const node = $('inline-status');
  node.className = kind ? `ea-status ea-status--${kind}` : 'ea-status';
  node.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'ea-status__dot';
  node.append(dot, document.createTextNode(text));
}

function setPhase(phase) {
  $('popup-body').dataset.phase = phase;
}

async function renderFooter() {
  // Only the provider label and model are needed here — reading DEFAULTS would
  // pull every provider's plaintext API key into this page context.
  const { provider } = await messenger.storage.local.get({ provider: DEFAULTS.provider });
  const meta = PROVIDERS[provider] || {};
  const { model: modelField } = providerSettings(provider);
  const model = (await messenger.storage.local.get({ [modelField]: '' }))[modelField] || '';
  $('foot-provider').textContent = meta.label || provider;
  $('foot-model').textContent = model;
  $('foot-local').hidden = provider !== 'ollama';
}

function renderSelectionCount() {
  $('idle-title').textContent = t('popupSelected', { count: selection.length });
}

function renderBatch(status) {
  if (status.phase === 'reviewing') {
    startReview(status);
  } else {
    inReview = false;
  }
  if (status.phase === 'analyzing' || status.phase === 'applying') {
    const label = status.phase === 'applying' ? t('applyingLabel') : t('runningLabel');
    $('run-label').textContent = `${label} ${status.current}/${status.total}`;
    const pct = status.total ? Math.round((status.current / status.total) * 100) : 0;
    $('run-pct').textContent = pct + '%';
    $('run-fill').style.width = pct + '%';
    $('run-progress').setAttribute('aria-valuenow', pct);
    $('run-subject').textContent = status.lastSubject || '';
    $('run-subject').title = status.lastSubject || '';
    setPhase(status.phase === 'applying' ? 'applying' : 'running');
    setInlineStatus('accent', status.phase === 'applying' ? t('applyingLabel') : t('popupStatusRunning'));
  } else if (status.phase === 'done') {
    $('ok-num').textContent = status.ok;
    $('fail-num').textContent = status.fail + (status.analysisFailed || 0);
  $('done-moved').hidden = !(status.moved || (status.skippedNotes || []).length);
    $('done-moved').textContent = [
      status.moved ? t('movedStat', { count: status.moved }) : '',
      ...(status.skippedNotes || []).map(n => n.split(' · ').pop())
    ].filter(Boolean).join('\n');
    if (status.analysisFailed) {
      status = { ...status, failDetails: [
        { n: 0, subject: '', reason: t('analysisFailedNote', { count: status.analysisFailed }) },
        ...(status.failDetails || [])
      ] };
      renderFailDetails(status);
    } else renderFailDetails(status);
    setPhase('done');
    const totalFail = status.fail + (status.analysisFailed || 0);
    setInlineStatus(totalFail > 0 ? 'warning' : 'success',
      totalFail > 0 ? t('popupStatusPartial', { fail: totalFail }) : t('popupStatusDone'));
  } else if (status.phase === 'cancelled') {
    $('cancelled-ok').textContent = status.ok;
    $('cancelled-fail').textContent = status.fail;
    $('cancelled-desc').textContent = `${t('okStat')} ${status.ok} · ${t('failStat')} ${status.fail}`;
    setPhase('cancelled');
    setInlineStatus('warning', t('popupStatusCancelled'));
  } else if (status.phase === 'error') {
    $('error-desc').textContent = `${status.lastError || t('errorHint')} — ${t('errorHint')}`;
    setPhase('error');
    setInlineStatus('danger', t('popupStatusError'));
  }
}

function renderFailDetails(status) {
  const wrap = $('fail-details');
  wrap.innerHTML = '';
  const details = status.failDetails || [];
  const shown = details.slice(0, 2);
  for (const d of shown) {
    const line = document.createElement('div');
    line.textContent = `#${d.n} ${d.subject ? d.subject + ' · ' : ''}${d.reason || ''}`;
    line.title = line.textContent;
    wrap.appendChild(line);
  }
  if (details.length > 2) {
    wrap.appendChild(document.createElement('div')).textContent = t('failDetailMore', { count: details.length - 2 });
  }
}

// idle/empty 由本地 selection 驱动；其余阶段由 background 驱动
function renderIdleOrEmpty() {
  if (selection.length === 0) {
    setPhase('empty');
    setInlineStatus(null, t('popupStatusEmpty'));
  } else {
    renderSelectionCount();
    setPhase('idle');
    setInlineStatus(null, t('popupStatusReady'));
  }
}

// ---------- Review（标签确认）视图 ----------
let reviewData = null;
let reviewCatalog = {};
let inReview = false;

function startReview(status) {
  // 已在确认视图中时不要重建列表，否则会清掉用户正在编辑的标签。
  if (inReview && reviewData) return;
  reviewData = (status.reviewItems || []).map(item => ({ ...item, tags: [...(item.tags || [])] }));
  reviewCatalog = status.catalog || {};
  inReview = true;
  renderReview();
  setPhase('reviewing');
  setInlineStatus('accent', t('reviewTitle'));
}

function applyTagCount() {
  return reviewData ? reviewData.filter(i => !i.failed).length : 0;
}

// Keep the background's review snapshot in sync so edits survive closing
// and reopening the panel before Apply.
function syncReviewDraft() {
  if (!reviewData) return;
  send({
    type: 'ea.batch.review',
    items: reviewData.map(({ id, tags }) => ({ id, tags }))
  }).catch(() => {});
}

function renderReview() {
  const wrap = $('review-list');
  wrap.replaceChildren();
  if (!reviewData) return;

  for (const item of reviewData) {
    const row = document.createElement('div');
    row.className = 'ea-review-item' + (item.failed ? ' ea-review-item--failed' : '');

    const subject = document.createElement('div');
    subject.className = 'ea-review-item__subject';
    subject.textContent = item.subject || `#${item.id}`;
    subject.title = subject.textContent;
    row.appendChild(subject);

    const target = item.tags
      .map(key => reviewCatalog[key])
      .find(meta => meta && !meta.moveNone && (meta.folderId || meta.folderAuto));
    if (target) {
      const moveLine = document.createElement('div');
      moveLine.className = 'ea-review-item__move';
      moveLine.textContent = `→ ${target.folderLabel || target.folderId}`;
      moveLine.title = moveLine.textContent;
      row.appendChild(moveLine);
    }

    const tags = document.createElement('div');
    tags.className = 'ea-review-item__tags';

    if (item.failed) {
      tags.appendChild(makeChip(t('reviewFailed'), item.failed, 'ea-chip--failed'));
    } else if (!item.tags.length) {
      tags.appendChild(makeChip(t('noTags'), '', 'ea-chip--none'));
    } else {
      for (const key of item.tags) {
        const meta = reviewCatalog[key] || { name: key, color: '' };
        const chip = makeChip(meta.name, key, '', meta.color);
        chip.addEventListener('click', () => {
          item.tags = item.tags.filter(k => k !== key);
          closeTagMenu();
          syncReviewDraft();
          renderReview();
        });
        tags.appendChild(chip);
      }
    }

    if (!item.failed) {
      const add = document.createElement('button');
      add.className = 'ea-chip ea-chip--add';
      add.type = 'button';
      add.textContent = '+ ' + t('addTagShort');
      add.setAttribute('aria-label', t('addTagShort'));
      add.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = document.querySelector('.ea-tag-menu');
        closeTagMenu();
        if (existing) return;
        openTagMenu(item, add);
      });
      tags.appendChild(add);
    }

    row.appendChild(tags);
    wrap.appendChild(row);
  }

  const n = applyTagCount();
  $('btn-apply').textContent = t('reviewApplyCount', { count: n });
  $('btn-apply').disabled = n === 0;
}

function makeChip(text, key, extra, color) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'ea-chip' + (extra ? ' ' + extra : '');
  chip.textContent = text;
  if (key) chip.dataset.tagKey = key;
  if (extra === 'ea-chip--failed') chip.title = key;
  if (color) chip.style.setProperty('--chip-color', color);
  return chip;
}

function openTagMenu(item, anchor) {
  const menu = document.createElement('div');
  menu.className = 'ea-tag-menu ea-tag-menu--floating';
  for (const [key, meta] of Object.entries(reviewCatalog)) {
    if (meta.reserved) continue; // failure marker is background-managed only
    const picked = item.tags.includes(key);
    const opt = document.createElement('button');
    opt.type = 'button';
    if (picked) opt.classList.add('is-picked');
    const dot = document.createElement('span');
    dot.className = 'ea-tag-menu__dot';
    dot.style.background = meta.color || 'var(--border-1)';
    opt.append(dot, document.createTextNode(meta.name || key));
    opt.addEventListener('click', () => {
      if (!item.tags.includes(key)) item.tags.push(key);
      closeTagMenu();
      syncReviewDraft();
      renderReview();
    });
    menu.appendChild(opt);
  }
  // Render as a fixed overlay on <body>: an absolutely positioned menu inside
  // the scrollable review list gets clipped by the scroll container, which is
  // exactly why the menu appeared "below the page" until the list was scrolled.
  document.body.appendChild(menu);
  positionTagMenu(menu, anchor);
}

// Place the floating menu using viewport coordinates: open below the anchor,
// flip above when it would overflow the bottom, and always keep it fully
// inside the window.
function positionTagMenu(menu, anchor) {
  const margin = 8;
  const gap = 4;
  const a = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const maxHeight = window.innerHeight - margin * 2;
  if (m.height > maxHeight) menu.style.maxHeight = `${maxHeight}px`;
  const height = Math.min(m.height, maxHeight);
  const left = Math.min(Math.max(margin, a.right - m.width), window.innerWidth - m.width - margin);
  let top = a.bottom + gap;
  if (top + height > window.innerHeight - margin) {
    const above = a.top - gap - height;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - height);
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeTagMenu() {
  document.querySelectorAll('.ea-tag-menu').forEach(m => m.remove());
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.ea-tag-menu') && !e.target.closest('.ea-chip--add')) closeTagMenu();
});
// A fixed menu would detach from its row while the list scrolls — close it.
document.addEventListener('scroll', (e) => {
  const target = e.target;
  if (target && target.nodeType === 1 && target.closest('.ea-tag-menu')) return;
  closeTagMenu();
}, true);
window.addEventListener('resize', () => closeTagMenu());

function schedulePoll(delayMs) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delayMs);
}

async function poll() {
  try {
    const status = await send({ type: 'ea.batch.status' });
    if (['analyzing', 'applying', 'reviewing', 'done', 'cancelled', 'error'].includes(status.phase)) {
      renderBatch(status);
    } else {
      renderIdleOrEmpty();
    }
    schedulePoll(['analyzing', 'applying'].includes(status.phase) ? 1000 : 4000);
  } catch {
    schedulePoll(2000);
  }
}

// Selection is queried locally so `currentWindow` means exactly the window
// this popup belongs to — a second window resting on another account can
// never leak its selection into the batch again.
async function scanSelectionHere() {
  // The panel runs in its own window; scan the mail window it was opened
  // from (?win=…). currentWindow would be the panel itself — always empty.
  // The panel tab itself is the active tab of its window once opened, so
  // never filter mail tabs by "active" — take the mail tabs of the origin
  // window directly.
  const originWindow = Number(new URLSearchParams(location.search).get('win'));
  let tabs = Number.isFinite(originWindow) && originWindow > 0
    ? await messenger.mailTabs.query({ windowId: originWindow })
    : await messenger.mailTabs.query({});
  if (!tabs.length) tabs = await messenger.mailTabs.query({});
  if (!tabs.length) return [];

  const list = await messenger.mailTabs.getSelectedMessages(tabs[0].id);
  if (!list) return [];

  const messages = [...(list.messages || [])];
  while (list.id) {
    try {
      list = await messenger.messages.continueList(list.id);
      messages.push(...(list.messages || []));
    } catch {
      break;
    }
  }
  return messages.map(m => ({ id: m.id, subject: m.subject || '', author: m.author || '' }));
}

async function rescan() {
  try {
    selection = await scanSelectionHere();
  } catch {
    selection = [];
  }
  const status = await send({ type: 'ea.batch.status' });
  if (['analyzing', 'applying', 'reviewing'].includes(status.phase)) {
    if (status.phase !== 'reviewing') renderBatch(status);
    return;
  }
  if (status.phase !== 'idle') await send({ type: 'ea.batch.reset' });
  renderIdleOrEmpty();
}

let currentLang = 'en';
let batchAction = 'tag';

function renderActionSeg() {
  for (const btn of document.querySelectorAll('#action-seg button')) {
    const active = btn.dataset.action === batchAction;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = await getLanguage();
  applyTexts();
  renderFooter();
  const stored = await messenger.storage.local.get({ batchAction: DEFAULTS.batchAction });
  batchAction = stored.batchAction;
  renderActionSeg();
  for (const btn of document.querySelectorAll('#action-seg button')) {
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', async () => {
      batchAction = btn.dataset.action;
      renderActionSeg();
      await messenger.storage.local.set({ batchAction });
    });
  }
  await rescan();
  poll();

  // Thunderbird 121+: refresh the selection count live while the popup is open.
  if (messenger.mailTabs && messenger.mailTabs.onSelectedMessagesChanged) {
    messenger.mailTabs.onSelectedMessagesChanged.addListener(async () => {
      const status = await send({ type: 'ea.batch.status' });
      if (!['analyzing', 'applying', 'reviewing'].includes(status.phase)) await rescan();
    });
  }
});

$('btn-start').addEventListener('click', async () => {
  const messages = await scanSelectionHere().catch(() => []);
  const resp = await send({ type: 'ea.batch.startWith', messages });
  if (resp && resp.alreadyRunning) {
    $('popup-body').classList.add('ea-shake');
    setTimeout(() => $('popup-body').classList.remove('ea-shake'), 300);
    setInlineStatus('warning', t('popupStatusAlreadyRunning'));
  } else if (resp && resp.selectionEmpty) {
    selection = [];
    renderIdleOrEmpty();
  } else {
    schedulePoll(200);
  }
});

$('btn-cancel').addEventListener('click', () => send({ type: 'ea.batch.cancel' }));
$('btn-refresh').addEventListener('click', rescan);
$('btn-rescan-done').addEventListener('click', rescan);
$('btn-rescan-cancelled').addEventListener('click', rescan);
$('btn-retry').addEventListener('click', async () => {
  // Use the same source-window scan as Start; background's global active scan
  // would pick a different window's messages in multi-window setups.
  const messages = await scanSelectionHere().catch(() => []);
  const resp = await send({ type: 'ea.batch.startWith', messages });
  if (resp && resp.selectionEmpty) { selection = []; renderIdleOrEmpty(); }
  else schedulePoll(200);
});
$('btn-error-settings').addEventListener('click', () => messenger.runtime.openOptionsPage());
$('btn-settings').addEventListener('click', () => messenger.runtime.openOptionsPage());
$('btn-apply').addEventListener('click', async () => {
  if (!reviewData) return;
  const items = reviewData
    .map((item, idx) => ({ item, n: idx + 1 }))
    .filter(({ item }) => !item.failed)
    .map(({ item, n }) => ({ id: item.id, subject: item.subject, tags: item.tags, n }));
  closeTagMenu();
  reviewData = null;
  inReview = false;
  await send({ type: 'ea.batch.apply', items });
  schedulePoll(200);
});
$('btn-review-discard').addEventListener('click', async () => {
  reviewData = null;
  inReview = false;
  await send({ type: 'ea.batch.reset' });
  await rescan();
});
