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
  const settings = await messenger.storage.local.get(DEFAULTS);
  const meta = PROVIDERS[settings.provider] || {};
  const { model: modelField } = providerSettings(settings.provider);
  $('foot-provider').textContent = meta.label || settings.provider;
  $('foot-model').textContent = settings[modelField] || '';
  $('foot-local').hidden = settings.provider !== 'ollama';
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
  if (status.phase === 'analyzing' || status.phase === 'applying' || status.phase === 'running') {
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
    $('fail-num').textContent = status.fail;
    $('done-moved').hidden = !status.moved;
    $('done-moved').textContent = status.moved ? t('movedStat', { count: status.moved }) : '';
    renderFailDetails(status);
    setPhase('done');
    setInlineStatus(status.fail > 0 ? 'warning' : 'success',
      status.fail > 0 ? t('popupStatusPartial', { fail: status.fail }) : t('popupStatusDone'));
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
        const existing = row.querySelector('.ea-tag-menu');
        closeTagMenu();
        if (existing) return;
        openTagMenu(row, item);
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

function openTagMenu(row, item) {
  const menu = document.createElement('div');
  menu.className = 'ea-tag-menu';
  for (const [key, meta] of Object.entries(reviewCatalog)) {
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
      renderReview();
    });
    menu.appendChild(opt);
  }
  row.appendChild(menu);
}

function closeTagMenu() {
  document.querySelectorAll('.ea-tag-menu').forEach(m => m.remove());
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.ea-tag-menu') && !e.target.closest('.ea-chip--add')) closeTagMenu();
});

function schedulePoll(delayMs) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delayMs);
}

async function poll() {
  try {
    const status = await send({ type: 'ea.batch.status' });
    if (['running', 'analyzing', 'applying', 'reviewing', 'done', 'cancelled', 'error'].includes(status.phase)) {
      renderBatch(status);
    } else {
      renderIdleOrEmpty();
    }
    schedulePoll(['running', 'analyzing', 'applying'].includes(status.phase) ? 1000 : 4000);
  } catch {
    schedulePoll(2000);
  }
}

async function rescan() {
  try {
    selection = await send({ type: 'scanSelection' }) || [];
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
  const resp = await send({ type: 'ea.batch.start' });
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
$('btn-retry').addEventListener('click', () => send({ type: 'ea.batch.start' }));
$('btn-error-settings').addEventListener('click', () => messenger.runtime.openOptionsPage());
$('btn-settings').addEventListener('click', () => messenger.runtime.openOptionsPage());
$('btn-apply').addEventListener('click', async () => {
  if (!reviewData) return;
  const items = reviewData.filter(i => !i.failed).map(({ id, subject, tags }) => ({ id, subject, tags }));
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
