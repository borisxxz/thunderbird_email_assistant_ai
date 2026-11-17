// Release notes shown once after an upgrade. Add an entry for each version;
// the changelog window reads the entry matching the running manifest version.
export const CHANGELOG = {
  '0.0.25': {
    en: [
      'Release notes now appear once after each update — including this one.',
      'Brings all fixes from v0.0.24: more reliable batch processing and cancellation, a working Gemini provider, a tag menu that is never clipped, and accurate result counts.'
    ],
    'zh-CN': [
      '更新完成后会显示一次发行说明（即本窗口）。',
      '包含 v0.0.24 的全部修复：批量处理与取消更可靠、Gemini 提供商可用、标签选择菜单不再被页面裁切、结果统计更准确。'
    ]
  }
};

export function notesFor(version, lang) {
  const entry = CHANGELOG[version];
  if (!entry) return null;
  return entry[lang] || entry.en || null;
}
