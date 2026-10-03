import { DEFAULTS, PROVIDERS, providerSettings } from '../core/config.js';
import { ensureTagsExist } from '../core/tags.js';
import { listModels, testConnection } from '../core/connection.js';
import { getLanguage, setLanguage, t, LANGUAGES } from '../core/i18n.js';
import { icons } from '../ui/icons.js';

const COLOR_PRESETS = ['#FFC107', '#2196F3', '#4CAF50', '#F44336', '#9C27B0', '#FF7043', '#26A69A', '#8D6E63'];

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

let settings = null;
let customTags = [];
let editingIndex = -1;
let lastFocused = null;

// ---------- Toast ----------
function showToast(kind, message, sticky = false) {
  const wrap = $('toast-wrap');
  const toast = el('div', `ea-toast ea-toast--${kind}`);
  toast.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
  toast.appendChild(kind === 'success' ? icons.check() : (kind === 'warning' ? icons.warn() : icons.error()));
  toast.appendChild(el('span', null, message));
  wrap.appendChild(toast);
  const remove = () => toast.remove();
  if (!sticky) setTimeout(remove, 3500);
}

// ---------- Modal helpers ----------
function openModal(node, focusTarget) {
  lastFocused = document.activeElement;
  node.classList.add('is-open');
  (focusTarget || node.querySelector('button')).focus();
}
function closeModal(node) {
  node.classList.remove('is-open');
  if (lastFocused && lastFocused.isConnected) lastFocused.focus();
}
function trapTab(node, e) {
  const focusables = node.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ---------- 静态文案 ----------
function applyStaticTexts() {
  document.documentElement.lang = currentLang === 'zh-CN' ? 'zh-CN' : 'en';
  $('brand-title').textContent = t('brandTitle');
  $('nav-providers').textContent = t('navProviders');
  $('nav-tags').textContent = t('navTags');
  $('providers-title').textContent = t('providersTitle');
  $('providers-desc').textContent = t('providersDesc');
  $('tags-title').textContent = t('tagsTitle');
  $('tags-desc').textContent = t('tagsDesc');
  $('add-tag-btn').textContent = t('addTag');
  $('tags-empty-title').textContent = t('emptyTagsTitle');
  $('tags-empty-desc').textContent = t('emptyTagsDesc');
  $('add-first-tag-btn').textContent = t('addFirstTag');
  $('tag-modal-title').textContent = editingIndex >= 0 ? t('editTag') : t('addTag');
  $('tag-name-label').textContent = t('tagName');
  $('tag-key-label').textContent = t('tagKey');
  $('tag-color-label').textContent = t('tagColor');
  $('tag-prompt-label').textContent = t('tagPrompt');
  $('tag-prompt-help').textContent = t('tagPromptHelp');
  $('tag-folder-label').textContent = t('tagFolderLabel');
  $('tag-folder-help').textContent = t('tagFolderHelp');
  $('tag-form-cancel').textContent = t('cancel');
  $('tag-form-save').textContent = t('saveTag');
  $('confirm-cancel').textContent = t('cancel');
  $('confirm-ok').textContent = t('delete');
  $('btn-import-tags').textContent = t('importTags');
  $('btn-export-tags').textContent = t('exportTags');
  $('btn-diagnose').textContent = t('diagnoseTags');
}

// ---------- 语言切换 ----------
let currentLang = 'en';

function renderLanguageSeg() {
  const seg = $('language-seg');
  seg.innerHTML = '';
  for (const { code, label } of LANGUAGES) {
    const opt = el('button', 'ea-seg__opt', label);
    opt.type = 'button';
    opt.setAttribute('role', 'radio');
    opt.setAttribute('aria-checked', String(code === currentLang));
    opt.addEventListener('click', async () => {
      if (code === currentLang) return;
      currentLang = code;
      await setLanguage(code);
      renderAll();
    });
    seg.appendChild(opt);
  }
}

// ---------- 导航 ----------
function setupNav() {
  const tabs = [...document.querySelectorAll('.ea-nav__item')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateNav(tab.dataset.nav));
    tab.addEventListener('keydown', (e) => {
      const idx = tabs.indexOf(tab);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); activateNav(tabs[(idx + 1) % tabs.length].dataset.nav); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); activateNav(tabs[(idx - 1 + tabs.length) % tabs.length].dataset.nav); }
    });
  });
}
function activateNav(name) {
  for (const key of ['providers', 'tags']) {
    const tab = $(`nav-${key}`);
    const panel = $(`panel-${key}`);
    const active = key === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
    if (active) tab.focus();
  }
}

// ---------- Provider 卡片与面板 ----------
function renderProviderGrid() {
  const grid = $('provider-grid');
  grid.innerHTML = '';
  const keys = Object.keys(PROVIDERS);

  keys.forEach((key, i) => {
    const meta = PROVIDERS[key];
    const card = el('div', 'ea-radio-card');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(key === settings.provider));
    card.dataset.provider = key;
    card.tabIndex = key === settings.provider ? 0 : -1;
    if (key === settings.provider) card.classList.add('is-selected');

    const head = el('div', 'ea-radio-card__head');
    head.appendChild(el('span', 'ea-radio-card__radio'));
    head.appendChild(el('span', 'ea-radio-card__label', meta.label));
    card.appendChild(head);
    if (key === 'ollama') {
      const badgeRow = el('div', null);
      badgeRow.appendChild(el('span', 'ea-badge ea-badge--accent', t('recommendedLocal')));
      card.appendChild(badgeRow);
    }

    card.addEventListener('click', () => selectProvider(key));
    card.addEventListener('keydown', (e) => {
      const deltas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in deltas) {
        e.preventDefault();
        const next = keys[(i + deltas[e.key] + keys.length) % keys.length];
        selectProvider(next);
        grid.querySelector(`[data-provider="${next}"]`).focus();
      }
    });
    grid.appendChild(card);
  });
}

function selectProvider(key) {
  settings.provider = key;
  renderProviderGrid();
  renderProviderPanel();
}

function setFieldError(input, errorEl, message) {
  const hasError = Boolean(message);
  input.classList.toggle('is-error', hasError);
  input.setAttribute('aria-invalid', String(hasError));
  if (errorEl) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('is-visible', hasError);
    if (hasError) input.setAttribute('aria-describedby', errorEl.id);
    else input.removeAttribute('aria-describedby');
  }
}

function renderProviderPanel() {
  const key = settings.provider;
  const meta = PROVIDERS[key];
  const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings(key);
  const panel = $('provider-panel');
  panel.innerHTML = '';

  const form = el('form');
  form.noValidate = true;

  const rows = [];

  const urlRow = el('div', 'ea-form-row');
  urlRow.appendChild(el('label', null, t('baseUrlLabel'))).htmlFor = 'field-baseurl';
  const urlInput = el('input', 'ea-input ea-u-mono');
  urlInput.type = 'text';
  urlInput.id = 'field-baseurl';
  urlInput.value = settings[baseUrlField];
  urlInput.placeholder = meta.defaultBaseUrl;
  const urlHelp = el('p', 'ea-help', t('baseUrlHelp'));
  const endpointPreview = el('p', 'ea-help');
  const urlError = el('p', 'ea-error'); urlError.id = 'err-baseurl';
  urlRow.append(urlInput, urlError, urlHelp, endpointPreview);
  rows.push({ row: urlRow, input: urlInput, error: urlError, type: 'url' });

  const modelRow = el('div', 'ea-form-row');
  modelRow.appendChild(el('label', null, t('modelLabel'))).htmlFor = 'field-model';
  const modelWrap = el('div', 'ea-model-row');
  const modelInput = el('input', 'ea-input ea-u-mono');
  modelInput.type = 'text';
  modelInput.id = 'field-model';
  modelInput.setAttribute('list', 'model-options');
  modelInput.value = settings[modelField];
  modelInput.placeholder = meta.defaultModel;
  const modelDatalist = el('datalist');
  modelDatalist.id = 'model-options';
  const fetchModelsBtn = el('button', 'ea-btn ea-btn--secondary', t('fetchModels'));
  fetchModelsBtn.type = 'button';
  fetchModelsBtn.id = 'fetch-models-btn';
  modelWrap.append(modelInput, fetchModelsBtn);
  const modelHelp = el('p', 'ea-help', t('modelHelp'));
  const modelError = el('p', 'ea-error'); modelError.id = 'err-model';
  modelRow.append(modelWrap, modelDatalist, modelError, modelHelp);
  rows.push({ row: modelRow, input: modelInput, error: modelError, type: 'model' });

  let keyInput = null;
  let keyError = null;
  if (meta.needsApiKey || meta.optionalApiKey) {
    const keyRow = el('div', 'ea-form-row');
    keyRow.appendChild(el('label', null, t('apiKeyLabel'))).htmlFor = 'field-apikey';
    const wrap = el('div', 'ea-pw-wrap');
    keyInput = el('input', 'ea-input ea-u-mono');
    keyInput.type = 'password';
    keyInput.id = 'field-apikey';
    keyInput.value = settings[apiKeyField];
    const eye = el('button', 'ea-icon-btn ea-pw-toggle');
    eye.type = 'button';
    eye.setAttribute('aria-label', t('showPassword'));
    eye.appendChild(icons.eye());
    eye.addEventListener('click', () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', show ? t('hidePassword') : t('showPassword'));
    });
    wrap.append(keyInput, eye);
    const keyHelp = el('p', 'ea-help', meta.optionalApiKey ? t('apiKeyOptionalHelp') : t('apiKeyHelp'));
    keyError = el('p', 'ea-error'); keyError.id = 'err-apikey';
    keyRow.append(wrap, keyError, keyHelp);
    rows.push({ row: keyRow, input: keyInput, error: keyError, type: 'apikey' });
  }

  for (const { row } of rows) form.appendChild(row);

  // 提示区
  if (key === 'ollama') {
    const local = el('div', 'ea-note ea-note--local');
    local.appendChild(icons.check());
    const noteText = el('span', null, t('localPrivacyNote'));
    local.appendChild(noteText);
    form.appendChild(local);

    const details = el('details', 'ea-details');
    const summary = el('summary', null, t('ollamaHelpLink'));
    const p = el('p', null, t('ollamaHelpBody'));
    const code = el('pre', 'ea-code', "OLLAMA_ORIGINS='*' ollama serve");
    details.append(summary, p, code);
    form.appendChild(details);
  } else if (meta.privacyNote) {
    const privacy = el('div', 'ea-note ea-note--privacy');
    privacy.appendChild(icons.warn());
    privacy.appendChild(el('span', null, meta.privacyNote));
    form.appendChild(privacy);
  }

  // 高级设置（并发数 / Temperature / Max tokens）
  const adv = el('details', 'ea-details ea-advanced');
  const advSummary = el('summary', null, t('advSettings'));
  const advGrid = el('div', 'ea-adv-grid');

  const advFields = [];
  const addAdvField = (labelText, helpText, { id, type, value, min, max, step, placeholder }) => {
    const cell = el('div', 'ea-form-row');
    cell.appendChild(el('label', null, labelText)).htmlFor = id;
    const input = el('input', 'ea-input');
    input.type = type;
    input.id = id;
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    if (placeholder) input.placeholder = placeholder;
    cell.append(input, el('p', 'ea-help', helpText));
    advGrid.appendChild(cell);
    advFields.push({ input, kind: id.replace('field-', '') });
  };

  addAdvField(t('advConcurrency'), t('advConcurrencyHelp'), {
    id: 'field-concurrency', type: 'number', value: settings.concurrency, min: 1, max: 8, step: 1
  });
  addAdvField(t('advTemperature'), t('advTemperatureHelp'), {
    id: 'field-temperature', type: 'number', value: settings.temperature ?? '', min: 0, max: 2, step: 0.1, placeholder: t('placeholderDefault')
  });
  addAdvField(t('advMaxTokens'), t('advMaxTokensHelp'), {
    id: 'field-maxtokens', type: 'number', value: settings.maxTokens ?? '', min: 1, step: 1, placeholder: t('placeholderDefault')
  });
  addAdvField(t('advMaxAttempts'), t('advMaxAttemptsHelp'), {
    id: 'field-maxattempts', type: 'number', value: settings.maxAttempts, min: 1, max: 10, step: 1
  });

  adv.append(advSummary, advGrid);
  form.appendChild(adv);

  const readAdvanced = () => {
    const conc = parseInt(advFields[0].input.value, 10);
    const rawTemp = advFields[1].input.value.trim();
    const rawTokens = advFields[2].input.value.trim();
    const attempts = parseInt(advFields[3].input.value, 10);
    return {
      concurrency: Number.isFinite(conc) ? Math.min(8, Math.max(1, conc)) : DEFAULTS.concurrency,
      temperature: rawTemp === '' ? null : Math.min(2, Math.max(0, parseFloat(rawTemp))),
      maxTokens: rawTokens === '' ? null : Math.max(1, parseInt(rawTokens, 10) || 0) || null,
      maxAttempts: Number.isFinite(attempts) ? Math.min(10, Math.max(1, attempts)) : DEFAULTS.maxAttempts
    };
  };

  // 保存按钮区
  const saveRow = el('div', 'ea-save-row');
  const resetBtn = el('button', 'ea-btn ea-btn--secondary', t('reset'));
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', () => {
    urlInput.value = meta.defaultBaseUrl;
    modelInput.value = meta.defaultModel;
    if (keyInput) keyInput.value = '';
    advFields[0].input.value = DEFAULTS.concurrency;
    advFields[1].input.value = '';
    advFields[2].input.value = '';
    advFields[3].input.value = DEFAULTS.maxAttempts;
    updatePermPreview();
  });
  const saveBtn = el('button', 'ea-btn ea-btn--primary ea-btn--lg', t('saveSettings'));
  saveBtn.type = 'submit';
  saveBtn.id = 'save-btn';
  const testBtn = el('button', 'ea-btn ea-btn--secondary', t('testConnection'));
  testBtn.type = 'button';
  testBtn.id = 'test-btn';
  saveRow.append(testBtn, resetBtn, saveBtn);

  form.append(saveRow);
  panel.appendChild(form);

  const updateEndpointPreview = () => {
    endpointPreview.textContent = '';
    const base = urlInput.value.trim().replace(/\/+$/, '');
    if (!base || !meta.endpointSuffix) return;
    const model = modelInput.value.trim() || meta.defaultModel;
    const suffix = meta.endpointSuffix.replace('{model}', model);
    endpointPreview.appendChild(el('span', null, t('fullEndpoint') + ' '));
    const urlSpan = el('span', 'ea-u-mono', `${base}/${suffix}`);
    urlSpan.style.wordBreak = 'break-all';
    endpointPreview.appendChild(urlSpan);
  };
  urlInput.addEventListener('input', () => { setFieldError(urlInput, urlError, null); updateEndpointPreview(); });
  modelInput.addEventListener('input', updateEndpointPreview);

  const currentValues = () => {
    const values = { provider: key, ...readAdvanced() };
    values[baseUrlField] = urlInput.value.trim();
    values[modelField] = modelInput.value.trim();
    if (keyInput) values[apiKeyField] = keyInput.value.trim();
    return values;
  };

  fetchModelsBtn.addEventListener('click', async () => {
    fetchModelsBtn.classList.add('is-loading');
    try {
      const models = await listModels(currentValues());
      modelDatalist.textContent = '';
      for (const model of models) {
        const option = el('option');
        option.value = model;
        modelDatalist.appendChild(option);
      }
      modelHelp.textContent = t('modelsFetched', { count: models.length });
    } catch (err) {
      modelHelp.textContent = t('modelHelp');
      let msg = String(err.message || err);
      if (/NetworkError|Failed to fetch/i.test(msg)) {
        msg += ' ' + t('testHint');
      }
      showToast('danger', t('fetchModelsFailed', { message: msg }), true);
    } finally {
      fetchModelsBtn.classList.remove('is-loading');
    }
  });

  testBtn.addEventListener('click', async () => {
    testBtn.classList.add('is-loading');
    try {
      await testConnection(currentValues());
      showToast('success', t('testOk', { provider: meta.label }));
    } catch (err) {
      let msg = String(err.message || err);
      if (/NetworkError|Failed to fetch/i.test(msg)) {
        msg += ' ' + t('testHint');
      }
      showToast('danger', t('testFailed', { message: msg }), true);
    } finally {
      testBtn.classList.remove('is-loading');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let firstBad = null;
    const values = { provider: key, ...readAdvanced(), [baseUrlField]: urlInput.value.trim(), [modelField]: modelInput.value.trim() };
    if (keyInput) values[apiKeyField] = keyInput.value.trim();

    if (!isValidUrl(values[baseUrlField])) {
      setFieldError(urlInput, urlError, t('baseUrlInvalid'));
      firstBad = firstBad || urlInput;
    }
    if (!values[modelField]) {
      setFieldError(modelInput, modelError, t('modelRequired'));
      firstBad = firstBad || modelInput;
    }
    if (keyInput && !values[apiKeyField] && meta.needsApiKey) {
      setFieldError(keyInput, keyError, t('apiKeyRequired'));
      firstBad = firstBad || keyInput;
    }
    if (firstBad) {
      firstBad.classList.add('ea-shake');
      setTimeout(() => firstBad.classList.remove('ea-shake'), 300);
      firstBad.focus();
      return;
    }

    try {
      await messenger.storage.local.set(values);
      Object.assign(settings, values);
      showToast('success', t('toastSaved'));
    } catch (err) {
      showToast('danger', t('toastSaveFailed', { message: err.message }), true);
    }
  });

  updateEndpointPreview();
}

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------- 标签管理 ----------
function renderTagList() {
  const list = $('tag-list');
  const empty = $('tag-empty');
  list.innerHTML = '';
  $('tag-count').textContent = t('tagCount', { count: customTags.length });
  empty.hidden = customTags.length > 0;

  customTags.forEach((tag, index) => {
    const row = el('div', 'ea-tag-row');
    const dot = el('span', 'ea-tag-row__dot');
    dot.style.background = tag.color;

    const main = el('div', 'ea-tag-row__main');
    main.tabIndex = 0;
    main.setAttribute('role', 'button');
    main.setAttribute('aria-label', t('editTag'));
    const nameRow = el('div', 'ea-tag-row__name-row');
    nameRow.appendChild(el('span', 'ea-tag-row__name', tag.name));
    nameRow.appendChild(el('span', 'ea-tag-row__key', tag.key));
    const prompt = el('div', 'ea-tag-row__prompt', tag.prompt);
    prompt.title = tag.prompt;
    main.append(nameRow, prompt);

    const editBtn = el('button', 'ea-icon-btn');
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', t('editTag'));
    editBtn.appendChild(icons.edit());
    const delBtn = el('button', 'ea-icon-btn');
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', t('delete'));
    delBtn.appendChild(icons.trash());

    const openEditor = () => openTagModal(index);
    main.addEventListener('click', openEditor);
    main.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
    editBtn.addEventListener('click', openEditor);
    delBtn.addEventListener('click', () => confirmDeleteTag(index));

    row.append(dot, main, editBtn, delBtn);
    list.appendChild(row);
  });
}

function openTagModal(index) {
  editingIndex = index;
  applyStaticTexts();
  const tag = index >= 0 ? customTags[index] : null;
  $('tag-name').value = tag ? tag.name : '';
  $('tag-key').value = tag ? tag.key : '';
  $('tag-color').value = tag ? tag.color : COLOR_PRESETS[1];
  $('tag-prompt').value = tag ? tag.prompt : '';
  for (const type of ['name', 'key', 'prompt']) setFieldError($(`tag-${type}`), $(`tag-${type}-error`), null);
  renderColorPresets();
  fillFolderSelect(tag ? tag.folder || '' : '');
  openModal($('tag-modal'), $('tag-name'));
}

let folderCache = null;

async function loadFolders() {
  if (folderCache) return folderCache;
  const options = [];
  try {
    const accounts = await messenger.accounts.list(true);
    for (const account of accounts) {
      const walk = (folder, depth) => {
        if (!folder) return;
        options.push({ id: folder.id, label: `${' '.repeat(depth * 2)}${account.name}${folder.path}` });
        for (const sub of folder.subFolders || []) walk(sub, depth + 1);
      };
      walk(account.rootFolder, 0);
    }
  } catch (err) {
    console.error('Email Assistant: Could not list folders:', err);
  }
  folderCache = options;
  return options;
}

async function fillFolderSelect(selectedId) {
  const select = $('tag-folder');
  const folders = await loadFolders();
  select.replaceChildren();

  const auto = el('option', null, t('tagFolderAuto'));
  auto.value = 'auto';
  select.appendChild(auto);

  const none = el('option', null, t('tagFolderNone'));
  none.value = 'none';
  select.appendChild(none);

  for (const folder of folders) {
    const option = el('option', null, folder.label);
    option.value = folder.id;
    if (folder.id === selectedId) option.selected = true;
    select.appendChild(option);
  }
  select.value = ['auto', 'none'].includes(selectedId) || folders.some(f => f.id === selectedId) ? selectedId : 'auto';
}

function renderColorPresets() {
  const wrap = $('tag-color-presets');
  wrap.innerHTML = '';
  for (const color of COLOR_PRESETS) {
    const dot = el('button');
    dot.type = 'button';
    dot.style.background = color;
    dot.setAttribute('aria-label', color);
    if (color.toLowerCase() === $('tag-color').value.toLowerCase()) dot.classList.add('is-active');
    dot.addEventListener('click', () => {
      $('tag-color').value = color;
      renderColorPresets();
    });
    wrap.appendChild(dot);
  }
}

function validateTagForm() {
  const name = $('tag-name').value.trim();
  const key = $('tag-key').value.trim();
  const prompt = $('tag-prompt').value.trim();
  let ok = true;

  if (!name) { setFieldError($('tag-name'), $('tag-name-error'), t('tagNameRequired')); ok = false; }
  else setFieldError($('tag-name'), $('tag-name-error'), null);

  const keyValid = /^[a-z0-9_]+$/.test(key);
  const keyDup = customTags.some((tag, i) => tag.key === key && i !== editingIndex);
  if (!keyValid || keyDup) { setFieldError($('tag-key'), $('tag-key-error'), t('tagKeyInvalid')); ok = false; }
  else setFieldError($('tag-key'), $('tag-key-error'), null);

  if (!prompt) { setFieldError($('tag-prompt'), $('tag-prompt-error'), t('tagPromptRequired')); ok = false; }
  else setFieldError($('tag-prompt'), $('tag-prompt-error'), null);

  return ok ? { name, key, prompt, color: $('tag-color').value, folder: $('tag-folder').value || 'auto' } : null;
}

function saveTagForm() {
  const tag = validateTagForm();
  if (!tag) {
    const firstError = document.querySelector('#tag-form .is-error');
    if (firstError) { firstError.classList.add('ea-shake'); setTimeout(() => firstError.classList.remove('ea-shake'), 300); firstError.focus(); }
    return;
  }
  if (editingIndex >= 0) customTags[editingIndex] = tag;
  else customTags.push(tag);
  persistTags();
  closeModal($('tag-modal'));
}

async function persistTags() {
  await messenger.storage.local.set({ customTags });
  renderTagList();
  ensureTagsExist();
}

// ---------- 诊断导出 ----------
async function copyDiagnosis() {
  const manifest = messenger.runtime.getManifest();
  const { tagKeys } = await messenger.storage.local.get({ tagKeys: {} });
  const tbTags = await messenger.messages.tags.list();
  const { noTagAccounts = [] } = await messenger.storage.local.get({ noTagAccounts: [] });
  const lines = [
    '[Email Assistant tag diagnosis]',
    `accounts with tagging auto-skipped: ${noTagAccounts.length ? noTagAccounts.join(', ') : '(none)'}`,
    `version: ${manifest.version}`,
    `language: ${currentLang}`,
    '',
    'custom tag definitions:',
    ...customTags.map(x => `  def key=${x.key}  name=${x.name}`),
    '',
    'stored key map (def key -> real key):',
    ...Object.entries(tagKeys).map(([k, v]) => `  ${k} -> ${v}`),
    '',
    'Thunderbird tag list:',
    ...tbTags.map(x => `  key=${x.key}  name=${x.tag}`),
    '',
    'mapped keys missing from Thunderbird:',
    ...Object.entries(tagKeys)
      .filter(([, v]) => !tbTags.some(x => x.key === v))
      .map(([k, v]) => `  def ${k} -> ${v} (MISSING)`),
    '',
    'unmapped custom tags:',
    ...customTags
      .filter(x => !tagKeys[x.key])
      .map(x => `  def ${x.key} (no mapping, would write raw key)`),
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast('success', t('diagnoseCopied'));
  } catch (err) {
    showToast('danger', t('diagnoseFailed', { message: err.message || err }), true);
  }
}

// ---------- 标签导入 / 导出 ----------
function exportTags() {
  if (!customTags.length) {
    showToast('warning', t('exportEmpty'));
    return;
  }
  const data = JSON.stringify({ app: 'email-assistant', version: 1, tags: customTags }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'email-assistant-tags.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('success', t('exportDone', { count: customTags.length }));
}

// Thunderbird tag colors are 6-digit hex; normalize common variants, else fall back.
function normalizeTagColor(value) {
  if (typeof value !== 'string') return COLOR_PRESETS[1];
  const c = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) return '#' + c.slice(1).split('').map(ch => ch + ch).join('');
  if (/^#[0-9a-fA-F]{8}$/.test(c)) return c.slice(0, 7).toLowerCase();
  return COLOR_PRESETS[1];
}

function normalizeImportedTag(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  let folder = typeof raw.folder === 'string' ? raw.folder.trim() : '';
  if (folder !== 'none' && folder !== 'auto') folder = folder || 'auto'; // plain '' (legacy) → auto
  if (!name || !prompt || !/^[a-z0-9_]+$/.test(key)) return null;
  return { name, key, prompt, color: normalizeTagColor(raw.color), folder };
}

async function importTags(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast('danger', t('importFailed', { message: 'Invalid JSON' }), true);
    return;
  }
  const tags = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.tags) ? parsed.tags : null);
  if (!tags) {
    showToast('danger', t('importFailed', { message: 'No tags array found' }), true);
    return;
  }

  let added = 0, updated = 0, skipped = 0;
  for (const raw of tags) {
    const tag = normalizeImportedTag(raw);
    if (!tag) {
      skipped += 1;
      continue;
    }
    const idx = customTags.findIndex(existing => existing.key === tag.key);
    if (idx >= 0) {
      customTags[idx] = tag;
      updated += 1;
    } else {
      customTags.push(tag);
      added += 1;
    }
  }

  if (added || updated) await persistTags();
  const kind = (added || updated) ? 'success' : 'warning';
  showToast(kind, t('importResult', { added, updated, skipped }));
}

let pendingDeleteIndex = -1;
function confirmDeleteTag(index) {
  pendingDeleteIndex = index;
  $('confirm-title').textContent = t('deleteTagTitle');
  $('confirm-text').textContent = t('deleteTagConfirm', { name: customTags[index].name });
  openModal($('confirm-modal'), $('confirm-ok'));
}

// ---------- 全量渲染 ----------
function renderAll() {
  applyStaticTexts();
  renderLanguageSeg();
  renderProviderGrid();
  renderProviderPanel();
  renderTagList();
}

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', async () => {
  currentLang = await getLanguage();
  const stored = await messenger.storage.local.get(DEFAULTS);
  settings = stored;
  const { customTags: tags } = await messenger.storage.local.get({ customTags: DEFAULTS.customTags });
  customTags = tags;

  setupNav();
  renderAll();
  ensureTagsExist();

  $('add-tag-btn').addEventListener('click', () => openTagModal(-1));
  $('add-first-tag-btn').addEventListener('click', () => openTagModal(-1));
  $('btn-export-tags').addEventListener('click', exportTags);
  $('btn-diagnose').addEventListener('click', copyDiagnosis);
  $('btn-import-tags').addEventListener('click', () => $('import-tags-file').click());
  $('import-tags-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importTags(file);
    e.target.value = '';
  });
  $('tag-form-save').addEventListener('click', saveTagForm);
  $('tag-form').addEventListener('submit', (e) => { e.preventDefault(); saveTagForm(); });
  $('tag-form-cancel').addEventListener('click', () => closeModal($('tag-modal')));
  $('tag-modal-close').addEventListener('click', () => closeModal($('tag-modal')));
  $('tag-color').addEventListener('input', renderColorPresets);
  $('tag-key').addEventListener('input', () => {
    const key = $('tag-key').value.trim();
    const valid = /^[a-z0-9_]+$/.test(key);
    const dup = customTags.some((tag, i) => tag.key === key && i !== editingIndex);
    setFieldError($('tag-key'), $('tag-key-error'), (valid && !dup) || !key ? null : t('tagKeyInvalid'));
  });

  $('confirm-cancel').addEventListener('click', () => closeModal($('confirm-modal')));
  $('confirm-close').addEventListener('click', () => closeModal($('confirm-modal')));
  $('confirm-ok').addEventListener('click', () => {
    if (pendingDeleteIndex >= 0) {
      customTags.splice(pendingDeleteIndex, 1);
      pendingDeleteIndex = -1;
      persistTags();
    }
    closeModal($('confirm-modal'));
  });

  for (const modalId of ['tag-modal', 'confirm-modal']) {
    $(modalId).addEventListener('click', (e) => { if (e.target === $(modalId)) closeModal($(modalId)); });
    $(modalId).addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal($(modalId));
      if (e.key === 'Tab') trapTab($(modalId), e);
    });
  }
});
