import { DEFAULTS } from '../core/config.js';
import { findEmailParts } from '../core/analysis.js';
import { buildSummaryPrompt } from '../core/summary.js';
import { PROVIDER_ENGINES } from '../providers/index.js';
import { getLanguage, t } from '../core/i18n.js';
import { icons } from '../ui/icons.js';

const $ = (id) => document.getElementById(id);

const messageId = new URLSearchParams(location.search).get('id');
let summaryText = '';
let analysis = null;
let customTags = [];

function applyTexts() {
  document.documentElement.lang = currentLang === 'zh-CN' ? 'zh-CN' : 'en';
  document.title = t('summaryTitle');
  $('sum-title').textContent = t('summaryTitle');
  $('sum-from-label').textContent = t('from') + ':';
  $('sum-loading-hint').textContent = t('summaryLoadingHint');
  $('sum-error-title').textContent = t('summaryFailedTitle');
  $('sum-error-hint').textContent = t('summaryErrorHint');
  $('sum-retry').textContent = t('retry');
  $('sum-settings').textContent = t('openSettings');
  $('sum-tags-title').textContent = t('suggestedTags');
  $('sum-copy-label').textContent = t('copySummary');
  $('sum-close').setAttribute('aria-label', t('close'));
}

function setPhase(phase) {
  $('sum-body').dataset.phase = phase;
  $('sum-copy').disabled = phase !== 'success';
}

function parseFromHeader(value) {
  if (!value) return { name: '', addr: '' };
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), addr: match[2].trim() };
  return { name: '', addr: value.trim() };
}

function renderChips() {
  if (!analysis) return;
  const suggestions = [];

  for (const tag of customTags) {
    if (analysis[tag.key] === true) suggestions.push({ key: tag.key, name: tag.name, color: tag.color });
  }
  if (!suggestions.length) return;

  $('sum-tags-block').hidden = false;
  const wrap = $('sum-chips');
  wrap.innerHTML = '';

  for (const tag of suggestions) {
    const chip = document.createElement('button');
    chip.className = 'ea-chip';
    chip.type = 'button';
    chip.setAttribute('role', 'listitem');
    chip.dataset.key = tag.key;

    const dot = document.createElement('span');
    dot.className = 'ea-chip__dot';
    dot.style.background = tag.color;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(tag.name));

    chip.addEventListener('click', async () => {
      chip.classList.add('is-applied');
      const check = icons.check();
      check.classList.add('ea-chip__check');
      chip.appendChild(check);
      try {
        const details = await messenger.messages.get(Number(messageId));
        const tags = new Set(details.tags || []);
        const { tagKeys: keyMap } = await messenger.storage.local.get({ tagKeys: {} });
        tags.add(keyMap[tag.key] || tag.key);
        await messenger.messages.update(Number(messageId), { tags: Array.from(tags) });
      } catch (err) {
        console.error('Email Assistant: failed to apply tag:', err);
        chip.classList.remove('is-applied');
      }
    });
    wrap.appendChild(chip);
  }
}

function renderSuccess() {
  const wrap = $('sum-text');
  wrap.innerHTML = '';
  const paragraphs = summaryText.split(/\n{2,}/).filter(p => p.trim());
  for (const text of paragraphs) {
    const p = document.createElement('p');
    p.textContent = text.trim();
    wrap.appendChild(p);
  }
  renderChips();
  setPhase('success');
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function runSummary() {
  setPhase('loading');
  $('sum-copy').classList.remove('is-copied');

  try {
    const settings = await messenger.storage.local.get(DEFAULTS);
    ({ customTags } = await messenger.storage.local.get({ customTags: DEFAULTS.customTags }));
    const engine = PROVIDER_ENGINES[settings.provider];
    if (!engine) throw new Error(`No engine for provider: ${settings.provider}`);

    const full = await messenger.messages.getFull(Number(messageId));
    const { body, attachments } = findEmailParts(full.parts);
    const structured = { headers: full.headers, body, attachments };

    const langName = currentLang === 'zh-CN' ? 'Chinese (中文)' : 'English';
    const prompt = buildSummaryPrompt(full.headers, body, attachments, langName);

    const [summary, analysisResult] = await withTimeout(Promise.all([
      engine.summarize(settings, prompt),
      engine.analyze(settings, structured, settings.customTags).catch(() => null)
    ]), 60000);

    if (!summary) throw new Error(t('summaryErrorHint'));
    summaryText = summary;
    analysis = analysisResult;
    renderSuccess();
  } catch (err) {
    console.error('Email Assistant: summary failed:', err);
    setPhase('error');
  }
}

let currentLang = 'en';

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = await getLanguage();
  applyTexts();

  try {
    const full = await messenger.messages.getFull(Number(messageId));
    $('sum-subject').textContent = (full.headers.subject && full.headers.subject[0]) || '(no subject)';
    const { name, addr } = parseFromHeader(full.headers.from && full.headers.from[0]);
    $('sum-from-name').textContent = name;
    $('sum-from-addr').textContent = addr;
  } catch {
    $('sum-subject').textContent = '';
  }

  runSummary();
});

$('sum-retry').addEventListener('click', runSummary);
$('sum-settings').addEventListener('click', () => messenger.runtime.openOptionsPage());
$('sum-close').addEventListener('click', () => window.close());

$('sum-copy').addEventListener('click', async () => {
  if (!summaryText) return;
  try {
    await navigator.clipboard.writeText(summaryText);
    $('sum-copy').classList.add('is-copied');
    $('sum-copy-label').textContent = t('copied');
    setTimeout(() => {
      $('sum-copy').classList.remove('is-copied');
      $('sum-copy-label').textContent = t('copySummary');
    }, 1500);
  } catch (err) {
    console.error('Clipboard write failed:', err);
  }
});
