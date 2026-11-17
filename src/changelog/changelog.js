import { getLanguage, t } from '../core/i18n.js';
import { notesFor } from '../core/changelog.js';

const $ = (id) => document.getElementById(id);

function render(lang) {
  const version = messenger.runtime.getManifest().version;
  document.title = t('whatsNewTitle');
  $('wn-title').textContent = t('whatsNewTitle');
  $('wn-version').textContent = t('whatsNewVersion', { version });

  const list = $('wn-list');
  const notes = notesFor(version, lang) || [t('whatsNewFallback')];
  for (const note of notes) {
    const item = document.createElement('li');
    item.textContent = note;
    list.appendChild(item);
  }

  const ok = $('wn-ok');
  ok.textContent = t('whatsNewOk');
  ok.addEventListener('click', () => window.close());
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = await getLanguage();
  document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
  render(lang);
});