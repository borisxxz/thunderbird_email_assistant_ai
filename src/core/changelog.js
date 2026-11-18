// Release notes shown once after an upgrade. Add an entry for each version;
// the changelog window reads the entry matching the running manifest version.
export const CHANGELOG = {
  '0.0.27': {
    en: [
      'Corrected the minimum supported Thunderbird version to 121 — releases 0.0.24-0.0.26 wrongly declared 102.',
      'Summary and translation failures now show the real error; the cancelled view also counts analysis failures.'
    ],
    'zh-CN': [
      '最低 Thunderbird 版本修正为 121——0.0.24 至 0.0.26 曾错误声明支持 102。',
      '摘要与翻译失败现在显示具体原因；取消页统计同样包含分析失败数。'
    ]
  },
  '0.0.26': {
    en: [
      'After every future update, a release-notes window will appear once automatically — including this update.',
      'Includes all fixes from v0.0.24: reliable batch processing and cancellation, a working Gemini provider, an unclipped tag-selection menu and accurate result counts.'
    ],
    'zh-CN': [
      '从本次更新起，每次更新完成后会自动弹出一次更新说明窗口。',
      '包含 v0.0.24 的全部修复：批量处理与取消更可靠、Gemini 可用、标签菜单不再被裁切、结果统计更准确。'
    ]
  },
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
