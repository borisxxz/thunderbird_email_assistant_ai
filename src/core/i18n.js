export const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh-CN', label: '中文' }
];

export const MESSAGES = {
  'en': {
    // Options page — chrome
    brandTitle: 'Email Assistant',
    navProviders: 'Providers',
    navTags: 'Custom Tags',
    languageAria: 'UI language',

    // Options page — providers
    providersTitle: 'Provider Settings',
    providersDesc: 'Choose the LLM used for email analysis. Select a provider to expand its connection settings.',
    recommendedLocal: 'Recommended · Local',
    localBadge: 'Local',
    localPrivacyNote: 'Runs locally: email content never leaves your computer.',
    baseUrlLabel: 'API Base URL (host and port)',
    baseUrlHelp: 'Scheme + host + port, e.g. http://localhost:8080/v1. Keep the default for the official cloud API.',
    baseUrlInvalid: 'Enter a valid URL including the scheme, e.g. http://',
    modelLabel: 'Model',
    modelHelp: 'Model name sent to the provider.',
    modelRequired: 'Model name is required.',
    apiKeyLabel: '接口密钥（API Key）',
    apiKeyHelp: 'Stored on this machine only, never uploaded.',
    apiKeyOptionalHelp: 'Optional — fill in only if your gateway requires a key.',
    apiKeyRequired: 'Cloud providers require an API key.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    ollamaHelpLink: 'Installation & startup help',
    ollamaHelpBody: 'Ollama runs open-source LLMs locally. Install it from ollama.com, then start the server so Thunderbird can reach it. To connect on a custom host/port, change the Base URL (e.g. http://192.168.1.10:11434).',
    reset: 'Reset',
    saveSettings: 'Save Settings',
    toastSaved: 'Settings saved.',
    toastSaveFailed: 'Save failed: {message}',

    // Options page — tags
    tagsTitle: 'Custom Tags',
    tagsDesc: 'Define your own categories. Tags named exactly like existing Thunderbird tags are reused.',
    tagCount: '{count} tags',
    emptyTagsTitle: 'No custom tags yet',
    emptyTagsDesc: 'Tags let the AI sort your mail into your own categories.',
    addFirstTag: 'Add first tag',
    addTag: 'Add Tag',
    editTag: 'Edit Tag',
    tagName: 'Tag Name',
    tagNameRequired: 'Name is required.',
    tagKey: 'Tag Key',
    tagKeyInvalid: 'Lowercase letters, numbers and underscores only; must be unique.',
    tagColor: 'Tag Color',
    tagPrompt: 'LLM Prompt Instruction',
    tagPromptRequired: 'Prompt is required.',
    tagPromptHelp: 'Tell the LLM when to apply this tag. English prompts tend to work best.',
    tagFolderLabel: 'Move to folder',
    tagFolderHelp: 'Where messages go when the batch action includes moving. "Auto" creates a folder named after this tag under the message\'s account.',
    tagFolderAuto: 'Auto — folder named after the tag',
    tagFolderNone: 'Do not move for this tag',
    folderAutoLabel: '{name} (auto)',
    saveTag: 'Save Tag',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    deleteTagTitle: 'Delete tag',
    deleteTagConfirm: 'Delete tag "{name}"? It will no longer be applied to new messages.',

    // Tag import / export
    importTags: 'Import',
    exportTags: 'Export',
    exportEmpty: 'No custom tags to export.',
    exportDone: 'Exported {count} tags.',
    importResult: 'Imported — added {added}, updated {updated}, skipped {skipped}.',
    importFailed: 'Import failed: {message}',

    // Popup
    popupSelected: '{count} message(s) selected',
    popupIdleDesc: 'Each message will be analyzed and tagged with your current tag set.',
    popupStatusReady: 'Ready',
    popupStatusEmpty: 'No messages selected',
    popupStatusRunning: 'Analyzing',
    popupStatusDone: 'Done',
    popupStatusPartial: 'Done, {fail} failed',
    popupStatusCancelled: 'Cancelled',
    popupStatusError: 'Failed',
    popupStatusAlreadyRunning: 'Already running',
    startBatch: 'Run AI Tagging',
    cancelRun: 'Cancel',
    rescan: 'Rescan',
    refreshSelection: 'Refresh selection',
    emptyTitle: 'No messages selected',
    emptyDesc: 'Select one or more messages in the message list, then come back.',
    runningLabel: 'Analyzing',
    okStat: 'Succeeded',
    failStat: 'Failed',
    failDetailMore: '+ {count} more failed',
    errorTitle: 'Batch failed',
    errorHint: 'Check that your provider is reachable and the API key is valid.',
    retry: 'Retry',
    openSettings: 'Settings',

    // Summary window
    summaryTitle: 'AI Summary',
    summaryLoadingHint: 'Analyzing message…',
    summaryFailedTitle: 'Analysis failed',
    summaryErrorHint: 'Check your provider settings and connection.',
    suggestedTags: 'Suggested tags',
    copySummary: 'Copy summary',
    copied: 'Copied!',
    from: 'From',

    // Menus
    notifyTitle: 'AI Mail Assistant',
    notifyStart: 'Analyzing {count} message(s)…',
    notifyReviewReady: 'Analyzed {count} message(s) — open the toolbar panel to confirm tags.',
    notifyApplied: 'Done — {ok} processed, {moved} moved, {fail} failed.',
    notifyCancelled: 'Cancelled — tagged {ok}, {fail} failed.',
    fullEndpoint: 'Full request endpoint:',
    placeholderDefault: 'default',
    failedTagName: 'Processing Failed',

    // Batch action mode
    batchActionLabel: 'Action',
    actionTagOnly: 'Tag only',
    actionTagMove: 'Tag + move',
    actionMoveOnly: 'Move only',

    // Review (confirm tags) view
    reviewTitle: 'Confirm tags',
    reviewDesc: 'Adjust the suggested tags, then apply them to the selected messages.',
    reviewApplyCount: 'Apply tags ({count})',
    reviewDiscard: 'Discard',
    reviewFailed: 'Analysis failed',
    noTags: 'No tags',
    addTagShort: 'Add',
    applyingLabel: 'Applying',
    movedStat: 'Moved {count} message(s) to folders',

    // Advanced settings
    advSettings: 'Advanced settings',
    advConcurrency: 'Concurrency',
    advConcurrencyHelp: 'How many messages to analyze in parallel during batch tagging (1–8).',
    advTemperature: 'Temperature',
    advTemperatureHelp: 'Leave empty to use the provider default (0–2). Lower is more deterministic.',
    advMaxTokens: 'Max tokens',
    advMaxTokensHelp: 'Leave empty to use the provider default.',
    advMaxAttempts: 'Retry attempts',
    advMaxAttemptsHelp: 'Times a message is tried before it gets the failure tag (1–10).',

    // Connection tools
    fetchModels: 'Fetch Models',
    modelsFetched: 'Loaded {count} models — click the model field to pick one.',
    fetchModelsFailed: 'Failed to load models: {message}',
    testConnection: 'Test Connection',
    testOk: 'Connection OK — {provider} is reachable and the model responded.',
    testFailed: 'Connection failed: {message}',
    testHint: 'The server could not be reached — check that it is running at this address.',
  },

  'zh-CN': {
    brandTitle: 'Email Assistant',
    navProviders: '提供商',
    navTags: '自定义标签',
    languageAria: '界面语言',

    providersTitle: '提供商设置',
    providersDesc: '选择用于邮件分析的 LLM。选中一个提供商以展开其连接配置。',
    recommendedLocal: '推荐 · 本地',
    localBadge: '本地',
    localPrivacyNote: '本地运行：邮件内容不会离开你的电脑。',
    baseUrlLabel: '接口地址（主机与端口）',
    baseUrlHelp: '协议 + 主机 + 端口，例如 http://localhost:8080/v1。使用官方云端 API 时保持默认即可。',
    baseUrlInvalid: '请输入合法 URL（需包含协议，如 http://）',
    modelLabel: '模型',
    modelHelp: '发送给提供商的模型名称。',
    modelRequired: '请填写模型名称。',
    apiKeyLabel: '接口密钥（API Key）',
    apiKeyHelp: '仅存储在本机，不会上传。',
    apiKeyOptionalHelp: '可选——仅当你的网关需要密钥时填写。',
    apiKeyRequired: '云端提供商需要 API Key。',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    ollamaHelpLink: '安装与启动帮助',
    ollamaHelpBody: 'Ollama 在本地运行开源大模型。请从 ollama.com 安装并启动服务，使 Thunderbird 可以访问。如需连接自定义主机/端口，请修改 Base URL（例如 http://192.168.1.10:11434）。',
    reset: '重置',
    saveSettings: '保存设置',
    toastSaved: '设置已保存。',
    toastSaveFailed: '保存失败：{message}',

    tagsTitle: '自定义标签',
    tagsDesc: '在此定义你自己的分类。与 Thunderbird 现有标签同名的会被直接复用，不重名则新建。',
    tagCount: '共 {count} 个标签',
    emptyTagsTitle: '还没有自定义标签',
    emptyTagsDesc: '标签让 AI 按你的分类规则整理邮件。',
    addFirstTag: '添加第一个标签',
    addTag: '添加标签',
    editTag: '编辑标签',
    tagName: '标签名称',
    tagNameRequired: '请填写名称。',
    tagKey: '标签 Key',
    tagKeyInvalid: '仅小写字母、数字、下划线，且不能重复。',
    tagColor: '标签颜色',
    tagPrompt: 'LLM 提示词',
    tagPromptRequired: '请填写提示词。',
    tagPromptHelp: '告诉 LLM 在什么条件下应用该标签。用英文撰写效果更稳定。',
    tagFolderLabel: '移动到文件夹',
    tagFolderHelp: '批量动作为”打标+移动”或”仅移动”时，命中该标签的邮件的去向。”自动”会在邮件所在账户下创建与标签同名的文件夹。',
    tagFolderAuto: '自动——与标签同名的文件夹',
    tagFolderNone: '此标签不移动',
    folderAutoLabel: '{name}（自动创建）',
    saveTag: '保存标签',
    cancel: '取消',
    delete: '删除',
    close: '关闭',
    deleteTagTitle: '删除标签',
    deleteTagConfirm: '删除标签「{name}」？该标签不会再被用于新邮件分析。',

    // 标签导入 / 导出
    importTags: '导入',
    exportTags: '导出',
    exportEmpty: '还没有可导出的自定义标签。',
    exportDone: '已导出 {count} 个标签。',
    importResult: '导入完成——新增 {added}，更新 {updated}，跳过 {skipped}。',
    importFailed: '导入失败：{message}',

    popupSelected: '已选中 {count} 封邮件',
    popupIdleDesc: '将使用当前标签配置，对选中邮件逐封分析并打标。',
    popupStatusReady: '就绪',
    popupStatusEmpty: '未选中邮件',
    popupStatusRunning: '分析中',
    popupStatusDone: '完成',
    popupStatusPartial: '完成，{fail} 封失败',
    popupStatusCancelled: '已取消',
    popupStatusError: '失败',
    popupStatusAlreadyRunning: '已在执行中',
    startBatch: '开始 AI 打标',
    cancelRun: '取消执行',
    rescan: '重新扫描',
    refreshSelection: '刷新选中数',
    emptyTitle: '还没有选中邮件',
    emptyDesc: '先在邮件列表中选择一封或多封邮件，再回到这里。',
    runningLabel: '正在分析',
    okStat: '成功',
    failStat: '失败',
    failDetailMore: '另有 {count} 封失败',
    errorTitle: '批量执行失败',
    errorHint: '请检查提供商是否可达、API Key 是否有效。',
    retry: '重试',
    openSettings: '设置',

    summaryTitle: 'AI 摘要',
    summaryLoadingHint: '正在分析这封邮件…',
    summaryFailedTitle: '分析失败',
    summaryErrorHint: '请检查提供商设置与连接。',
    suggestedTags: '建议标签',
    copySummary: '复制摘要',
    copied: '已复制！',
    from: '发件人',

    notifyTitle: 'AI 邮件助手',
    notifyStart: '正在分析 {count} 封邮件…',
    notifyReviewReady: '{count} 封邮件分析完成——打开工具栏面板确认标签。',
    notifyApplied: '完成——处理 {ok} 封，移动 {moved} 封，失败 {fail} 封。',
    notifyCancelled: '已取消——成功 {ok} 封，失败 {fail} 封。',
    fullEndpoint: '完整请求地址：',
    placeholderDefault: '默认',
    failedTagName: '处理失败',

    // 批量动作模式
    batchActionLabel: '动作',
    actionTagOnly: '仅打标签',
    actionTagMove: '打标+移动',
    actionMoveOnly: '仅移动',

    // Review（标签确认）视图
    reviewTitle: '确认标签',
    reviewDesc: '调整建议的标签，然后应用到所选邮件。',
    reviewApplyCount: '应用标签（{count} 封）',
    reviewDiscard: '放弃',
    reviewFailed: '分析失败',
    noTags: '无标签',
    addTagShort: '添加',
    applyingLabel: '正在应用',
    movedStat: '已移动 {count} 封邮件到文件夹',

    // 高级设置
    advSettings: '高级设置',
    advConcurrency: '并发数',
    advConcurrencyHelp: '批量分析时同时处理的邮件数（1–8）。',
    advTemperature: '生成温度',
    advTemperatureHelp: '控制生成的随机性，留空使用默认值（0–2），越低越确定。',
    advMaxTokens: '最大令牌数',
    advMaxTokensHelp: '单次生成的最大令牌（Token）数，留空使用默认值。',
    advMaxAttempts: '失败重试次数',
    advMaxAttemptsHelp: '单封邮件处理失败时的最大尝试次数，超过后打处理失败标签（1–10）。',

    // Connection tools
    fetchModels: '获取模型',
    modelsFetched: '已获取 {count} 个模型，点击模型框即可选择。',
    fetchModelsFailed: '获取模型失败：{message}',
    testConnection: '测试连接',
    testOk: '连接成功——{provider} 可达，模型响应正常。',
    testFailed: '连接失败：{message}',
    testHint: '无法连接服务器——请确认服务正在该地址运行。',
  }
};

let currentLang = null;

export async function getLanguage() {
  if (currentLang) return currentLang;
  const stored = await messenger.storage.local.get({ language: '' });
  if (stored.language && MESSAGES[stored.language]) {
    currentLang = stored.language;
  } else {
    const ui = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    currentLang = ui.startsWith('zh') ? 'zh-CN' : 'en';
  }
  return currentLang;
}

export async function setLanguage(code) {
  if (!MESSAGES[code]) return;
  currentLang = code;
  await messenger.storage.local.set({ language: code });
}

export function t(key, params) {
  const lang = currentLang || 'en';
  const table = MESSAGES[lang] || MESSAGES['en'];
  let text = table[key] !== undefined ? table[key] : (MESSAGES['en'][key] !== undefined ? MESSAGES['en'][key] : key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll('{' + name + '}', String(value));
    }
  }
  return text;
}

export function languageName(lang) {
  return lang === 'zh-CN' ? 'Chinese (中文)' : 'English';
}
