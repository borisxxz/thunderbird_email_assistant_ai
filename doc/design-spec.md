# Email Assistant · UI/UX 重设计规范

| 项 | 内容 |
|---|---|
| 版本 | v1.0（2026-10-02） |
| 适用范围 | `options.html`（设置页）、`popup.html`（工具栏批量打标面板，360×480）、`summary.html`（单封 AI 摘要窗，420×520） |
| 技术约束 | 纯 HTML + CSS + vanilla JS（webpack），运行于 Thunderbird MailExtension 内嵌页面；无前端框架、无外部字体/图标依赖（可用内联 SVG） |
| 阅读对象 | 实现本扩展 UI 的开发者 |
| 关联文件 | 现状参考：`D:\tem\99\email-assistant\options.html`、`options.css`、`src\options\options.js`、`src\core\config.js` |

---

## 1. 概述

### 1.1 产品背景

Email Assistant 在收到新邮件时调用 LLM（Ollama / OpenAI / Gemini / Claude / Mistral / DeepSeek，Base URL、端口、模型均可自定义）分析邮件并打分类标签（诈骗、SPF 失败、广告、账单等，标签可自定义增删改）。本次重设计覆盖三个界面：

1. **设置页**：提供商配置 + 自定义标签管理，在 Thunderbird 标签页中打开（宽幅）。
2. **工具栏 Popup**：对邮件列表中选中的邮件批量执行 AI 打标，约 360×480。
3. **摘要窗**：单封邮件的 AI 摘要，由右键菜单或邮件查看按钮触发，约 420×520。

### 1.2 设计气质

**专业、克制、工具感**。参考 Linear / Things 的界面语言，而非营销站：

- 单一主色（Indigo 系）承担品牌与交互引导；中性阶承担绝大部分面积；
- 颜色只做三件事：标识交互（主色）、传达语义（成功/警告/危险）、呈现用户自定义标签色；
- 无渐变横幅、无插画堆砌、无装饰性大标题；信息密度适中，层级靠字号/字重/留白而非色块;
- 圆角小（6–12px）、阴影浅、分割线细，整体接近"系统原生工具"而非 Web 营销页。

### 1.3 设计原则

1. **工具优先**：一切视觉服务于"配置 → 执行 → 反馈"的任务闭环，无冗余装饰。
2. **状态可预期**：任何长任务（批处理、摘要生成）都有明确的阶段、进度与结束反馈，异常有明确的解释与下一步。
3. **本地优先**：Ollama（本地、隐私）是默认推荐项，必须在视觉上获得"推荐 + 隐私"的一等表达；云端提供商必须显示隐私提示。
4. **亮暗同构**：亮色与暗色使用同一套语义 token，只换值不换结构；暗色为常用基调，按暗色先设计再反推亮色。
5. **键盘与读屏可用**：所有交互可 Tab 到达、可 Enter/Space 触发、焦点可见、状态变化可被读屏感知。
6. **双语文案即数据**：界面文案全部走 i18n 字典（中/英），语言由设置页顶部分段控件切换并持久化。

### 1.4 术语

| 术语 | 含义 |
|---|---|
| token | 设计令牌，以 CSS 自定义属性形式定义（`--ea-*` 之外的简短名，见 §3） |
| 主操作 | 界面当前阶段最期望用户点击的按钮（primary button） |
| 批处理 | 对选中邮件逐封执行「取信 → LLM 分析 → 打标签」的 background 流水线 |
| 阶段 | 批处理生命周期中的状态：`empty / idle / running / done / cancelled / error` |

---

## 2. 现状诊断

| # | 现状问题 | 影响 | 重设计对策 |
|---|---|---|---|
| 1 | 仅亮色主题，颜色硬编码（`#007bff` Bootstrap 蓝、`#28a745` 等） | 与 Thunderbird 常用暗色环境割裂，观感"外来网页" | 语义 token 双主题（§3、§10），主色换为 Indigo 系 |
| 2 | Provider 用 `<select>` 下拉 + 6 个隐藏配置块 | 选项与配置分离，切换后才能看到内容，认知负担高 | 6 张单选卡片网格（2×3），选中即展开该 provider 配置面板（§5.3） |
| 3 | Ollama 的"本地隐私"卖点无视觉表达 | 用户无从感知默认推荐理由 | 卡片右上「推荐 · 本地」徽标 + 展开面板内隐私说明行（§5.3） |
| 4 | 保存反馈是 3 秒后消失的斜体小字；权限请求原生弹窗出现前无预告 | 用户对"为什么弹权限"困惑，拒绝后只有一行小字 | 保存按钮上方常驻"将请求访问 {origin}"预告 + 权限结果 Toast（§5.5） |
| 5 | 标签删除用 `confirm()`、错误用 `alert()`，key 重复校验只在提交时弹窗 | 与整体 UI 割裂，打断感强 | 自绘确认对话框 + 行内校验（error 态输入框 + 下方错误文案）（§4.3、§4.11） |
| 6 | 700px 居中卡片未利用宽幅标签页 | 宽屏下大量留白、表单过长 | 顶栏 + 左侧导航 + 760px 内容列的双栏布局（§5.1） |
| 7 | 界面文案英文硬编码 | 中文用户不友好 | 顶栏中/英分段控件 + `data-i18n` 字典（§4.7、§11） |
| 8 | 无 focus-visible 样式、tabs 无键盘语义、无 aria | 键盘/读屏不可用 | 统一焦点环 + roving tabindex + aria 规范（§9） |
| 9 | 无 popup / summary 界面 | 批量打标与单封摘要缺少操作与展示载体 | 本规范新增两个界面的完整设计（§6、§7） |

---

## 3. 设计令牌（Design Tokens）

### 3.1 主题机制

- 默认**跟随系统**：`@media (prefers-color-scheme: dark)` 自动切换，不做用户手动开关（保持设置页简洁；token 结构已预留手动覆盖能力）。
- 结构三层：**原始色阶**（`--indigo-500` 等，界面不直接使用）→ **语义变量**（`--surface`、`--text-1`，组件只引用语义层）→ **组件变量**（个别组件的派生值）。
- 亮/暗两套语义值在同一个 `:root` 代码块内定义（亮色为默认值，暗色在媒体查询中覆盖），可直接整段粘贴到 `options.css`；建议抽为共享 `tokens.css`（见 §11）。

### 3.2 CSS 变量定义（可直接粘贴到 options.css 的 :root）

```css
/* ============================================================
   Email Assistant 设计令牌 v1.0
   粘贴位置：options.css 顶部（建议抽为 tokens.css 供三页共享）
   ============================================================ */
:root {
  /* ---- 1. 原始色阶：主色 Indigo（界面不直接引用） ---- */
  --indigo-300: #A5ADF3;
  --indigo-400: #7B87E8;
  --indigo-500: #5E6AD2;
  --indigo-600: #4C5FD7;
  --indigo-700: #3F51C2;
  --indigo-800: #32419E;

  /* ---- 2. 原始色阶：中性 ---- */
  --gray-0:   #FFFFFF;
  --gray-50:  #F7F7F9;
  --gray-100: #F1F2F5;
  --gray-200: #E4E5EA;
  --gray-300: #CDD0DA;
  --gray-400: #A9ADBE;
  --gray-500: #8388A0;
  --gray-600: #6B7080;
  --gray-700: #4E5261;
  --gray-800: #2E303C;
  --gray-850: #24252F;
  --gray-900: #1D1E26;
  --gray-950: #15161C;

  /* ---- 3. 语义色（原始值，供暗亮覆盖引用） ---- */
  --green-600:  #1A7F37;
  --green-400:  #4CC38A;
  --amber-700:  #8A5A00;
  --amber-500:  #E3A008;
  --red-600:    #CF222E;
  --red-500:    #F85149;

  /* ---- 4. 字体 ---- */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI",
               "PingFang SC", "Microsoft YaHei UI", "Noto Sans SC",
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Cascadia Mono", "JetBrains Mono",
               Consolas, "Liberation Mono", Menlo, monospace;

  /* ---- 5. 字号阶（桌面 UI 基准 14px 正文） ---- */
  --text-xs:    11px;   /* 徽标、全大写小标签 */
  --text-sm:    12px;   /* 辅助说明、帮助文字 */
  --text-base:  13px;   /* 表格、次要正文 */
  --text-body:  14px;   /* 正文默认 */
  --text-md:    16px;   /* 卡片/弹窗标题 */
  --text-lg:    18px;   /* 摘要主题、区块标题 */
  --text-xl:    22px;   /* 页面标题（仅设置页顶栏） */
  --leading-tight:  1.25;
  --leading-normal: 1.45;
  --leading-loose:  1.65;
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;

  /* ---- 6. 间距阶（4px 基准） ---- */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ---- 7. 圆角 ---- */
  --radius-xs:   4px;
  --radius-sm:   6px;   /* 输入框、小按钮 */
  --radius-md:   8px;   /* 按钮、卡片内元素 */
  --radius-lg:   12px;  /* 卡片、弹窗 */
  --radius-full: 999px; /* chips、分段控件 */

  /* ---- 8. 控件尺寸 ---- */
  --control-h-sm:  28px;  /* 行内小按钮、图标按钮 */
  --control-h-md:  32px;  /* 输入框、常规按钮默认 */
  --control-h-lg:  40px;  /* 弹窗主按钮 */
  --control-h-xl:  44px;  /* popup 主操作大按钮 */

  /* ---- 9. 阴影（亮色基调，暗色在下方覆盖） ---- */
  --shadow-sm: 0 1px 2px rgba(23, 25, 35, 0.06);
  --shadow-md: 0 4px 12px rgba(23, 25, 35, 0.08);
  --shadow-lg: 0 12px 32px rgba(23, 25, 35, 0.16);

  /* ---- 10. 动效 ---- */
  --dur-fast: 120ms;   /* hover、按下 */
  --dur-base: 180ms;   /* 展开折叠、焦点 */
  --dur-slow: 240ms;   /* 弹窗、页面切换 */
  --ease-out:   cubic-bezier(0.2, 0.8, 0.3, 1);
  --ease-inout: cubic-bezier(0.6, 0.0, 0.4, 1);

  /* ---- 11. 层级 ---- */
  --z-sticky:   100;   /* 设置页顶栏 */
  --z-dropdown: 200;
  --z-toast:    900;
  --z-modal:    1000;

  /* ---- 12. 语义变量（默认 = 亮色） ---- */
  --bg:            var(--gray-50);    /* 页面底 */
  --surface:       var(--gray-0);     /* 卡片、面板 */
  --surface-2:     var(--gray-100);   /* 次级面：表格底、分段控件槽 */
  --surface-hover: #EDEEF3;           /* 可交互行 hover */
  --text-1:        var(--gray-900);   /* 主文本 */
  --text-2:        var(--gray-700);   /* 次要文本（标签、说明） */
  --text-3:        var(--gray-600);   /* 辅助文本（帮助、占位级，仍满足 AA） */
  --border-1:      var(--gray-200);   /* 常规分割线、输入框边 */
  --border-2:      var(--gray-300);   /* 强边框：输入框、卡片描边 */

  --accent:            var(--indigo-600);  /* 主色：主按钮、选中态 */
  --accent-hover:      var(--indigo-700);
  --accent-active:     var(--indigo-800);
  --accent-on:         #FFFFFF;            /* 主色上的文字 */
  --accent-subtle:     #EEF0FC;           /* 主色浅底：选中卡片、提示条 */
  --accent-subtle-text: #3A49B8;          /* 浅底上的主色文字 */
  --accent-border:     #B9C0EF;           /* 选中卡片描边 */

  --success:       var(--green-600);  /* 图标/文字用成功色 */
  --success-subtle: #E9F5EC;
  --warning:       var(--amber-700);
  --warning-subtle: #FBF1DC;
  --danger:        var(--red-600);    /* 图标/文字/危险按钮底 */
  --danger-hover:  #B62B36;
  --danger-subtle: #FDEBEC;

  --overlay:   rgba(23, 25, 35, 0.48);          /* 弹窗遮罩 */
  --focus-ring-color: var(--accent);
  --focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring-color);
}

/* ---- 13. 暗色主题（跟随系统） ---- */
@media (prefers-color-scheme: dark) {
  :root {
    --bg:            var(--gray-950);
    --surface:       var(--gray-900);
    --surface-2:     var(--gray-850);
    --surface-hover: #2B2D3A;
    --text-1:        #F2F3F7;
    --text-2:        #B3B7C6;
    --text-3:        var(--gray-500);
    --border-1:      var(--gray-800);
    --border-2:      #424454;

    --accent:            var(--indigo-500);
    --accent-hover:      var(--indigo-400);
    --accent-active:     var(--indigo-600);
    --accent-on:         #FFFFFF;
    --accent-subtle:     rgba(94, 106, 210, 0.18);
    --accent-subtle-text: var(--indigo-300);
    --accent-border:     #4A54A8;

    --success:        var(--green-400);
    --success-subtle: rgba(76, 195, 138, 0.14);
    --warning:        var(--amber-500);
    --warning-subtle: rgba(227, 160, 8, 0.14);
    --danger:         var(--red-500);
    --danger-hover:   #FA7A72;
    --danger-subtle:  rgba(248, 81, 73, 0.14);

    --overlay:   rgba(0, 0, 0, 0.62);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.45);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.50);
    --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.60);
  }
}

/* ---- 14. 手动覆盖（预留，当前不启用） ----
[data-theme="light"] { /* 与 §12 相同的一组值 */ }
[data-theme="dark"]  { /* 与 §13 相同的一组值 */ }
*/

/* ---- 15. 动效弱化 ---- */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms;
  }
}
```

### 3.3 排版规则

| 场景 | 规格 |
|---|---|
| 页面标题（设置页顶栏） | `--text-xl` / `--weight-semibold` / `--text-1` |
| 区块标题（卡片标题） | `--text-md` / `--weight-semibold` / `--text-1` |
| 区块描述 | `--text-sm` / `--weight-regular` / `--text-2`，位于标题下方 `--space-1` |
| 表单标签 | `--text-sm` / `--weight-medium` / `--text-2` |
| 正文/输入值 | `--text-body` / `--leading-normal` |
| 帮助文字 | `--text-sm` / `--text-3`，字段下方 `--space-1` |
| 徽标/全大写小标签 | `--text-xs` / `--weight-medium` / `letter-spacing: 0.4px` / `--text-3` |
| 代码类值（key、Base URL、模型名） | `--font-mono` / `--text-base` |

中文与英文混排：不使用全大写样式（除徽标小标签）；中文字重用 medium(500) 替代 semibold 的场景（弹窗标题中文可 600）。

### 3.4 间距与栅格

- 设置页：左侧导航宽 `220px`，与内容区间距 `--space-10`；内容列最大宽 `760px`，左右 padding `--space-8`。
- Popup：内边距 `--space-4`（16px）；区块间垂直间距 `--space-4`。
- 摘要窗：内边距 `--space-5`；头部与正文以 `--border-1` 分割线相隔。
- 表单行（label + 控件 + 帮助文字）垂直堆叠，行间距 `--space-5`。
- 卡片内边距统一 `--space-5`（20px）。

### 3.5 层级与阴影使用

- 卡片常驻 `--shadow-sm` + `1px solid var(--border-1)`（暗色下主要靠边框区分，阴影只加深背景层次）。
- 悬浮元素（下拉、Toast、弹窗）才用 `--shadow-md` / `--shadow-lg`。
- 不叠加多层阴影，不用彩色阴影。

---

## 4. 通用组件规范

类名统一 `ea-` 前缀 + BEM。所有组件只引用语义 token，禁止组件内写死色值。

### 4.1 按钮 `.ea-btn`

**变体与用途**

| 变体 | 类名 | 外观 | 用途 |
|---|---|---|---|
| 主按钮 | `.ea-btn--primary` | 背景 `--accent`，文字 `--accent-on`，无边框 | 每屏至多 1 个：保存设置、开始打标、重新扫描 |
| 次按钮 | `.ea-btn--secondary` | 背景 `--surface`，边框 `1px --border-2`，文字 `--text-1` | 编辑、取消、重置、添加标签 |
| 危险按钮 | `.ea-btn--danger` | 背景 `--danger`，文字 `#fff` | 删除确认（弹窗内） |
| 危险次按钮 | `.ea-btn--danger-subtle` | 背景 `--danger-subtle`，文字 `--danger` | 列表行的删除入口 |
| 幽灵按钮 | `.ea-btn--ghost` | 透明背景，文字 `--text-2`，hover 背景 `--surface-hover` | 图标操作、次级链接式操作 |

**尺寸**：sm `--control-h-sm`（padding 0 10px，字号 `--text-sm`）；md `--control-h-md`（padding 0 12px，`--text-body`）；lg `--control-h-lg`；xl 仅 popup 主操作 `--control-h-xl` 全宽。

**状态**（全部变体共用）：
- hover：背景切换对应 hover 色，`--dur-fast`；
- active：`--accent-active` / 视觉下沉（`transform: translateY(0.5px)`，reduced-motion 下取消）；
- focus-visible：`box-shadow: var(--focus-ring)`，`outline: none`；键盘到达时必须可见；
- disabled：`opacity: 0.45`，`cursor: not-allowed`，无 hover 变化、无阴影；
- loading：左侧显示 14px 旋转 spinner（当前变体配色），文字保留或替换为「处理中…」，`pointer-events: none` + `aria-busy="true"`。

**主按钮带箭头**（popup「开始 AI 打标」）：文字右侧 14px 内联 SVG 箭头（chevron-right），按钮内 gap `--space-2`。

### 4.2 图标按钮 `.ea-icon-btn`

- 尺寸 `28×28`，图标 16px 内联 SVG，`stroke: currentColor`，颜色 `--text-2`；
- hover：背景 `--surface-hover`、图标 `--text-1`；focus 同 §4.1；
- 必须带 `aria-label`（如「编辑标签」「关闭」）。关闭按钮用 16px X 图标，不用 `&times;` 字符。

### 4.3 输入类控件 `.ea-input` / `select` / `textarea`

- 高度 `--control-h-md`，padding `0 10px`，圆角 `--radius-sm`，背景 `--surface`，边框 `1px solid --border-2`，文字 `--text-1`，字号 `--text-body`；
- placeholder：`--text-3`；
- focus：边框 `--accent` + `box-shadow: 0 0 0 3px var(--accent-subtle)`；
- **error 态** `.is-error`：边框 `--danger` + `box-shadow: 0 0 0 3px var(--danger-subtle)`；控件下方 `--space-1` 出现错误行（12px 12px 警示图标 + `--danger` 文字，`--text-sm`）；错误出现时控件获得 `aria-invalid="true"`，错误文字用 `aria-describedby` 关联；
- disabled：背景 `--surface-2`、文字 `--text-3`、`cursor: not-allowed`；
- 帮助文字（非错误）位于控件下方：`--text-sm` / `--text-3`，同样 `aria-describedby` 关联；
- 密码框：右侧内嵌 16px「眼睛」图标按钮（ghost），切换 `type`，不撑高控件；
- 单行值较长的字段（Base URL）：等宽字体 `--font-mono`；
- `select`：右侧 14px chevron-down SVG，原生下拉列表样式交由主题；
- `textarea`：min-height 76px（约 3 行），`--leading-normal`，可纵向拉伸；
- 原生 `<input type="color">` 外包一个 28×28 圆角色块按钮（见 §5.4）。

### 4.4 分组卡片 `.ea-card`

- 背景 `--surface`，边框 `1px solid --border-1`，圆角 `--radius-lg`，阴影 `--shadow-sm`，内边距 `--space-5`；
- 结构：标题（`--text-md` semibold）+ 可选描述（`--text-sm` `--text-2`）+ 内容区（上边距 `--space-4`）；
- 卡片间垂直间距 `--space-6`；
- 页面级背景 `--bg` 与卡片 `--surface` 的对比即层次来源，不使用大标题色块。

### 4.5 单选卡片 `.ea-radio-card`（提供商选择专用）

- 网格布局：`repeat(auto-fill, minmax(200px, 1fr))`，间距 `--space-3`；6 张默认 2 行 × 3 列；
- 结构：左上 16px radio 圆点（描边 `--border-2`；选中时内芯 `--accent`）+ 提供商名（`--text-body` medium）；右上可选徽标（Ollama：「推荐 · 本地」）；
- 卡片本体即为点击目标（`role="radio"`，容器 `role="radiogroup"`）；
- 状态：
  - 默认：同 `.ea-card` 但内边距 `--space-4`；
  - hover：边框 `--border-2` 加深为 `--text-3` 级灰、背景 `--surface-hover`；
  - 选中 `.is-selected`：边框 `--accent-border` 1.5px + 背景 `--accent-subtle` + `box-shadow: 0 0 0 1px var(--accent-border) inset`；
  - focus-visible：radio 卡片获得焦点环（外描边式）；
  - 键盘：组内 `Arrow Up/Down/Left/Right` 移动选中（roving tabindex）。

### 4.6 页面导航 Tabs `.ea-nav`（设置页）

- 宽屏（≥1100px）：左侧竖向导航列表，项高 32px，文字 `--text-body` / `--text-2`；
- 选中项：文字 `--text-1` + 左侧 3px `--accent` 竖条 + 背景 `--accent-subtle` 圆角 `--radius-sm`；
- hover：文字 `--text-1`，无背景；
- 窄屏（<1100px）：退化为顶部横向下划线 tabs（文字 `--text-body`，选中项下边框 2px `--accent` + 文字 `--text-1` semibold）；
- ARIA：容器 `role="tablist"`，项 `role="tab"` + `aria-selected`，面板 `role="tabpanel"`；键盘 Home/End/左右（上下）切换，tab 选中后焦点移入面板第一控件（遵循 WAI-ARIA Tabs 模式）。

### 4.7 分段控件与语言切换器 `.ea-seg`

- 槽：背景 `--surface-2`，圆角 `--radius-full`，padding 3px；选项高 26px，padding 0 12px，圆角 `--radius-full`，文字 `--text-sm` / `--text-2`；
- 选中项：背景 `--surface` + `--shadow-sm`，文字 `--text-1` medium；切换时选中底 `transform` 位移（`--dur-base`，reduced-motion 直接切换）；
- 语言切换器内容固定两项：`中文` | `EN`；`role="radiogroup"` + `aria-label="界面语言 / UI language"`，选项 `role="radio"` + `aria-checked`，左右键切换；
- 语言切换即时生效：更新 `<html lang>`、全部 `data-i18n` 文案，并写入 `storage.local.uiLanguage`（`"zh" | "en"`，缺省按 `navigator.language` 是否 `zh*` 判定）。

### 4.8 进度条 `.ea-progress`

- 轨道：高 6px，圆角 `--radius-full`，背景 `--surface-2`；
- 填充：背景 `--accent`，圆角 `--radius-full`，宽度过渡 `width .4s var(--ease-out)`；
- 不确定态 `.ea-progress--indeterminate`：填充为 30% 宽色块循环平移（`@keyframes` 平移动画 1.4s，reduced-motion 时改为 6px 微弱呼吸透明度）；
- 标签行（进度条上方 `--space-2`）：左「第 4/10 封 · 正在分析」`--text-sm` `--text-2`，右「40%」`--text-sm` `--font-mono` `--text-2`；
- ARIA：`role="progressbar"` + `aria-valuemin/max/now`；不确定态省略 value 并置 `aria-label`。

### 4.9 标签 Chips `.ea-chip`

- 高 24px，padding 0 10px 0 8px，圆角 `--radius-full`，背景 `--surface`，边框 `1px solid --border-1`，文字 `--text-sm` / `--text-2`；
- 色点：8px 圆点，背景为标签色（用户自定义色直出；暗色下不做颜色反转，靠白底 chip 保证可读）；
- 可点击态（摘要窗建议标签）：hover 背景 `--surface-hover`、边框 `--border-2`；点击后 `.is-applied`：背景 `--accent-subtle`、文字 `--accent-subtle-text`、边框 `--accent-border`，右侧出现 12px 对勾；
- 纯展示态（设置页标签列表预览）：`cursor: default`；
- 组容器 `role="list"`，chip `role="listitem"`（可点击 chip 为 `role="button"` + `tabindex="0"` + Space/Enter 触发）。

### 4.10 徽标 `.ea-badge`

- 高 18px，padding 0 6px，圆角 `--radius-xs`，字号 `--text-xs` medium，`letter-spacing: 0.4px`；
- 变体：accent（背景 `--accent-subtle` 文字 `--accent-subtle-text`，用于「推荐 · 本地」）、success、warning、danger、neutral（背景 `--surface-2` 文字 `--text-3`）。

### 4.11 弹窗 `.ea-modal` 与确认对话框

- 遮罩：`position: fixed; inset: 0; background: var(--overlay); backdrop-filter: blur(2px)`（reduced-motion 无碍）；
- 面板：宽 `min(480px, calc(100vw - 48px))`，背景 `--surface`，圆角 `--radius-lg`，阴影 `--shadow-lg`，边框 `1px solid --border-1`；
- 结构：头部（标题 `--text-md` semibold + 右上 28px 关闭图标按钮）、正文（表单或说明）、底部（右对齐按钮组：取消 secondary + 主/danger primary）；
- 动画：遮罩 fade `--dur-base`；面板 `scale(0.97) → 1` + `translateY(8px) → 0`，`--dur-slow` `--ease-out`；关闭反向 `--dur-fast`；
- 交互约束：打开时焦点移入面板（表单弹窗聚焦第一个输入框，确认框聚焦主按钮）；Tab 在面板内循环（焦点陷阱）；Esc 关闭；关闭后焦点返回触发元素；
- ARIA：`role="dialog"` `aria-modal="true"` `aria-labelledby`（标题 id）；
- **确认对话框**（替代 `confirm()`）：正文为一句确认文案（如「删除标签“账单”？该标签不会再被用于新邮件分析。」）+ 标签名用 semibold；底部「取消」secondary +「删除」danger；不得用系统原生弹窗。

### 4.12 Toast `.ea-toast`（设置页状态反馈）

- 位置：固定右下角，距边 `--space-6`，堆叠间距 `--space-2`，`z-index: var(--z-toast)`；
- 外观：背景 `--surface`，边框 `1px solid --border-1`，圆角 `--radius-md`，阴影 `--shadow-lg`，padding `10px 14px`，左侧 16px 语义图标，文字 `--text-body` `--text-1`，最长 380px；
- 变体：success / warning / danger（图标与图标色用对应语义色）；
- 自动消失 3.5s（danger 6s + 不自动消失，需手动关闭）；入场：右侧滑入 `--dur-base`；
- ARIA：`role="status"`（danger 用 `role="alert"`）。

### 4.13 内联状态 `.ea-status`（popup / 摘要窗用）

小窗口内不使用 Toast，改用固定占位的内联状态行（高度恒定 24px，避免布局跳动）：
- 语义色小圆点（8px）+ 文字 `--text-sm` `--text-2`；
- `aria-live="polite"`，供读屏播报执行结果。

### 4.14 空状态 `.ea-empty`

- 垂直居中，padding `--space-10` `--space-6`，最大宽 280px；
- 图标：48px 内联 SVG 线性图标，颜色 `--text-3`；
- 标题：`--text-body` semibold `--text-2`；描述：`--text-sm` `--text-3`，`--leading-normal`；
- 可选一个 secondary 操作按钮（如「添加第一个标签」）；
- 不使用插画图片。

### 4.15 加载态

- **Spinner** `.ea-spinner`：14/16/20px 三档，`border: 2px solid var(--surface-2); border-top-color: var(--accent); border-radius: 50%`，旋转 0.8s linear infinite；配文字时置于文字左侧；
- **骨架屏** `.ea-skeleton`（摘要窗正文）：3–4 行 `--surface-2` 圆角条（高 14px，宽 100%/90%/70%），错峰 shimmer（`--dur` 1.4s）；reduced-motion 时为静态色块；
- **按钮内**：见 §4.1 loading 态；
- 区域级加载配一行说明文字（如「正在分析第 1 封邮件…」），`--text-sm` `--text-3`。

---

## 5. 界面一：设置页 options.html

### 5.1 信息架构与布局

左侧导航（提供商 / 标签管理）+ 右侧内容列（760px）。宽屏用侧导航，窄屏折叠为顶部 tabs。顶栏 sticky，含扩展标识与语言切换。

**宽屏布局（≥1100px）**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ◆ Email Assistant                                        ( 中文 | EN )     │ 顶栏 56px, sticky
│  ──────────────────────────────────────────────────────────────────────── │
├──────────────┬─────────────────────────────────────────────────────────────┤
│  导航 220px   │  内容列 max-width 760px                                     │
│              │                                                             │
│  ▌提供商      │  ┌─ 提供商设置 ──────────────────────────────────────────┐  │
│   标签管理    │  │ 选择用于邮件分析的 LLM。选中后展开该服务的连接配置。        │  │
│              │  │                                                         │  │
│              │  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │  │
│              │  │ │ ◉ Ollama     │ │ ○ OpenAI     │ │ ○ Gemini     │     │  │
│              │  │ │ 推荐 · 本地   │ │              │ │              │     │  │
│              │  │ └──────────────┘ └──────────────┘ └──────────────┘     │  │
│              │  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │  │
│              │  │ │ ○ Claude     │ │ ○ Mistral    │ │ ○ DeepSeek   │     │  │
│              │  │ └──────────────┘ └──────────────┘ └──────────────┘     │  │
│              │  │                                                         │  │
│              │  │ ┌─ Ollama 连接（选中卡片展开面板）───────────────────┐   │  │
│              │  │ │ API Base URL                                    │   │  │
│              │  │ │ [ http://localhost:11434                     ]    │   │  │
│              │  │ │ 包含协议、主机和端口，例如 http://192.168.1.10:11434 │   │  │
│              │  │ │ 模型名称                                         │   │  │
│              │  │ │ [ gemma3:27b                                ]    │   │  │
│              │  │ │ ⓘ 本地运行：邮件内容不会离开你的电脑                │   │  │
│              │  │ │ ▸ Ollama 安装与启动帮助（折叠）                    │   │  │
│              │  │ └─────────────────────────────────────────────────┘   │  │
│              │  │                                                         │  │
│              │  │ ⚿ 保存时将请求访问 http://localhost:11434 的权限         │  │
│              │  │                                        [ 重置 ] [ 保存 ] │  │
│              │  └─────────────────────────────────────────────────────┘  │
│              │                                                             │
│              │  ┌─ 标签管理（切到该导航时显示）────────────────────────┐   │
│              │  │ …见 §5.4 …                                          │   │
│              │  └─────────────────────────────────────────────────────┘  │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

**窄屏布局（<1100px）**

```
┌──────────────────────────────────────────────┐
│ ◆ Email Assistant                  ( 中文|EN ) │
│ ──────────────────────────────────────────── │
│  提供商        标签管理                         │ ← 下划线 tabs
│ ──────────────────────────────────────────── │
│  （单列卡片，radio-card 网格降为 2 列 → 1 列）    │
└──────────────────────────────────────────────┘
```

### 5.2 顶栏

- 高 56px，背景 `--surface`，底部 `1px --border-1`，sticky；
- 左：16px 菱形/信封线性图标（`--accent` 描边）+ 「Email Assistant」（`--text-md` semibold）+ `v2.x` neutral 徽标；
- 右：语言切换分段控件（§4.7）；
- 顶栏下方页面留 `--space-8` 再进入内容。

### 5.3 提供商设置区

**选择**：§4.5 单选卡片网格，6 个 provider 来自 `PROVIDERS` 元数据；Ollama 卡片右上 accent 徽标「推荐 · 本地」，其余无徽标。

**展开面板**：选中卡片下方 `--space-3` 处渲染该 provider 的配置面板（`.ea-card`，背景 `--surface`，内边距 `--space-5`，左侧 2px `--accent` 边线）。切换 provider 时面板内容交叉淡入（`--dur-fast`），已填写的其他 provider 值保留在 storage 提交值中（行为与现状一致）。

**字段**（依 `needsApiKey` 动态增减）：

| 字段 | 控件 | 字体 | 帮助文字 | 校验 |
|---|---|---|---|---|
| API Base URL | text（等宽） | `--font-mono` | 「包含协议、主机和端口…」 | 失焦时尝试 `new URL()`，非法则 error 态 + 「请输入合法 URL（含协议，如 http://）」 |
| 模型名称 | text（等宽） | `--font-mono` | 「发送给提供商的模型名」 | 非空 |
| API Key（仅云端） | password + 眼睛切换 | `--font-mono` | 「仅存储在本机，不会上传」 | 非空（保存时校验，见 §5.5） |

**面板内提示区**：
- 隐私提示（云端 provider）：warning 图标 + `--warning` 文字，背景 `--warning-subtle`，圆角 `--radius-sm`，内容为 `privacyNote`；
- 本地提示（Ollama）：success 图标 + 「本地运行：邮件内容不会离开你的电脑」，背景 `--success-subtle`；
- Ollama 帮助：`<details>` 折叠块（「安装与启动帮助」），展开后含 `OLLAMA_ORIGINS='*' ollama serve` 等宽代码块（背景 `--surface-2`，圆角 `--radius-sm`，padding `--space-2 --space-3`）。

**保存区**：面板下方右对齐按钮组：「重置」（secondary，恢复该 provider 默认值，点击后需再次「保存」生效）+「保存」（primary xl→lg）。保存按钮上方一行权限预告（`--text-sm` `--text-3` + 14px 锁图标）：「保存时将请求访问 {origin} 的权限」，origin 实时取当前 Base URL 的 origin；URL 非法时该行变为 danger 文字提示。

### 5.4 自定义标签管理

**列表** `.ea-tag-row`（容器为无边框列表，行间 `1px --border-1` 分割）：

```
┌────────────────────────────────────────────────────────────────────────┐
│ ● 账单        is_bill                                   [✎ 编辑] [🗑 删除] │
│   (橙) key: is_bill (mono)                                             │
│   检查邮件是否包含账单或发票信息…（--text-sm --text-3，单行截断）            │
├────────────────────────────────────────────────────────────────────────┤
│ ● 广告        is_advertise                              [✎] [🗑]         │
└────────────────────────────────────────────────────────────────────────┘
＋ 添加标签                                    共 9 个标签（--text-sm --text-3）
```

- 行结构：16px 色点（标签色）+ 名称（`--text-body` medium `--text-1`）+ key（`--font-mono` `--text-sm` `--text-3`，第二行）+ prompt 摘要（第三行，`--text-sm` `--text-3`，单行 ellipsis，`title` 提示全文）+ 右侧编辑/删除图标按钮（ghost，24px）；
- 行 hover：背景 `--surface-hover`；行本身不可点击（点击整行=编辑，避免误删相邻按钮）；
- 删除：弹确认对话框（§4.11），删除后行收起动画 `--dur-fast`；
- 「添加标签」secondary 按钮 + 次级按钮样式放在列表上方右侧（与区块标题同行）；
- 空状态：无自定义标签时显示 §4.14 空状态（「还没有自定义标签」+「添加第一个标签」）；
- 内置标签（`HARDCODED_TAGS`）不在此列表中展示与编辑，仅在区块描述中说明「诈骗/SPF/DKIM 等内置标签自动生效」。

**编辑弹窗**（§4.11，480px）：

| 字段 | 控件 | 校验（输入时实时） |
|---|---|---|
| 名称 | text | 非空 |
| Key | text（等宽） | `^[a-z0-9_]+$` + 与现有 key 不重复；违规即时 error 态 + 「仅小写字母、数字、下划线，且不能重复」 |
| 颜色 | 28×28 色块按钮（内嵌原生 color input，视觉上只露出色块）+ 右侧 8 个预设色点（`#FFC107 #2196F3 #4CAF50 #F44336 #9C27B0 #FF7043 #26A69A #8D6E63`） | — |
| 提示词 | textarea（3 行） | 非空；下方帮助文字「告诉 LLM 判定该标签的条件，英文撰写效果更稳定」 |

底部按钮：「取消」secondary +「保存标签」primary；表单任一字段 error 时保存按钮仍可点但提交被拦截并晃动首个错误控件（`--dur-fast` 抖动 4px，reduced-motion 仅聚焦不晃动）。

### 5.5 保存与权限请求流程

**工程约束（必须遵守）**：`messenger.permissions.request()` 必须在**保存按钮点击的同一用户手势调用栈内**执行，因此**不得**在点击「保存」后先弹自绘确认框再请求权限（手势会失效）。权限确认使用 Thunderbird 原生弹窗。

流程：

1. 点击「保存」→ 前置校验：Base URL 可解析（否则该输入框 error 态 + inline 错误，流程终止）、云端 provider 的 API Key 非空（否则 API Key 框 error 态）；
2. 按钮进入 loading 态（「请求授权…」）→ 直接调用 `permissions.request({ origins: [origin + "/*"] })`（原生弹窗出现，UI 上权限预告行同时高亮为 accent）；
3. 授权成功 → 写入 storage → 按钮 loading 结束 → **success Toast「设置已保存」**，权限预告行恢复常规；
4. 拒绝 → **danger Toast「未授权访问 {origin}，设置未保存」**（6s 不自动消失），Base URL 输入框上方出现 warning 提示行；
5. storage 写入异常 → danger Toast「保存失败：{err.message}」。

### 5.6 尺寸适配

| 宽度 | 行为 |
|---|---|
| ≥1100px | 侧导航 + 760px 内容列 |
| 768–1100px | 顶部 tabs，radio-card 2 列 |
| <768px | 单列；radio-card 1 列；按钮组折行为上下堆叠（保存全宽） |

---

## 6. 界面二：工具栏 Popup（批量打标面板，360×480 固定）

### 6.1 布局线框

上下三段式：Header（品牌行）→ 主内容区（随状态切换）→ Footer（provider 状态 + 设置入口）。同一容器内以状态切换内容，不做页面滚动（内容极端超长时仅主内容区内部滚动）。

```
┌────────────────────────────────────────┐ 360px
│ ◆ Email Assistant                       │ Header 44px
├────────────────────────────────────────┤
│ 【状态 A · idle：已选中邮件】              │
│   已选中 3 封邮件 (--text-md)             │
│   将使用当前标签配置逐封分析并打标           │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │        开始 AI 打标            ▸ │  │ primary xl 全宽 44px
│  └──────────────────────────────────┘  │
│                                        │
│ 【状态 B · running】                     │
│   正在分析        第 4/10 封     40%      │
│   ████████████░░░░░░░░░░░░░░░░░░  │ 6px 进度条
│   ✉ FW: Q3 报表请确认…   (--text-sm 截断) │
│                        [ 取消执行 ]      │ secondary
│                                        │
│ 【状态 C · done】                        │
│   ┌───────────────┬───────────────┐   │
│   │ ✓ 成功 8 封     │ ✕ 失败 2 封     │   │ 两格统计卡
│   └───────────────┴───────────────┘   │
│   ✕ 失败: 第3封(连接超时) 第7封(…) hover展开│
│  ┌──────────────────────────────────┐  │
│  │          重新扫描               │  │ primary lg
│  └──────────────────────────────────┘  │
│                                        │
│ 【状态 D · empty（未选中邮件）】           │
│         ┌────┐                         │
│         │ ✉  │  48px 图标               │
│         └────┘                         │
│      还没有选中邮件                      │
│   在邮件列表中选择一封或多封邮件后重试       │
│           [ 刷新选中数 ]                 │
├────────────────────────────────────────┤
│ ● Ollama · gemma3:27b · 本地    设置 →   │ Footer 40px
└────────────────────────────────────────┘ 480px
```

### 6.2 状态机与视觉定义

状态来自 background（权威），popup 打开时拉取并轮询（§6.3）。

| 状态 | 进入条件 | 主内容 | 主按钮 | 内联状态行 |
|---|---|---|---|---|
| `empty` | 选中 0 封 | 空状态（图标+文案+「刷新选中数」secondary）；「刷新」重新调用 `getSelectedMessages` | 无 | 「未选中邮件」neutral |
| `idle` | 选中 n>0 且无进行中任务 | 「已选中 n 封邮件」+ 一行说明文案 | 「开始 AI 打标 ▸」primary xl | 「就绪」neutral 点 |
| `running` | 批处理进行中 | 进度标签行 + 6px 进度条 + 当前邮件主题（`title` 全文） | 隐藏主按钮，显示「取消执行」secondary（hover 时变 danger-subtle 样式） | 「分析中」accent 旋转点 + `aria-live` 每 3 封播报一次 |
| `done` | 全部完成（含部分失败） | 统计卡两格（成功 = success 图标+数字+「封」，失败 = danger）；失败明细最多 2 行内显示（`第 n 封 · 错误摘要`），超过 2 条显示「等 n 条失败」+ hover/点击展开完整列表（主内容区内部滚动） | 「重新扫描」primary lg（重新拉取选中数 → idle→start） | 全成功「完成」success；部分失败「完成，2 封失败」warning |
| `cancelled` | 用户取消 | 同 `done` 布局，标题「已取消」+ 已完成部分统计 | 「重新扫描」 | 「已取消」warning |
| `error` | 系统性失败（如权限缺失、provider 不可达且 0 成功） | danger 空状态：错误图标 + 「{错误摘要}」+ 常见原因一行（「请检查 {provider} 是否可达 / API Key 是否有效」） | 「重试」primary lg + 「打开设置」secondary | 「失败」danger |

**执行中再次打开 popup**：打开时读到 `running`，直接恢复状态 B；进度与统计由轮询驱动，无本地残留状态。

**执行中再次点击（主按钮已隐藏的兜底语义）**：若任何入口在 running 期间再次触发 start 消息，background 返回 `already_running`，popup 抖动当前进度区（4px，`--dur-fast`）+ 内联状态行短暂显示「已在执行中」，不重启任务、不重置进度。

### 6.3 保活与状态轮询协议（设计约定）

- popup 打开即发送 `runtime.sendMessage({ type: "ea.batch.status" })`；background 返回：

```json
{ "phase": "running", "current": 4, "total": 10,
  "lastSubject": "FW: Q3 报表请确认", "ok": 3, "fail": 0, "lastError": null }
```

- 之后 popup 每 **1000ms** 轮询同一消息：既驱动 UI 进度，也持续产生事件唤醒 background 页，达到保活目的（MV2 background page 在 Thunderbird 中常驻，轮询主要保证状态同步与鲁棒性）；
- 「开始」→ `{ type: "ea.batch.start" }`（background 内部自行取 `getSelectedMessages`，以服务端选中数为准，避免 popup 与实际不一致）；「取消」→ `{ type: "ea.batch.cancel" }`，background 在当前邮件完成后停止；
- phase 进入 `done / cancelled / error` 后轮询降至 4s（仅探测新任务），popup 关闭时停止轮询；
- 单封 LLM 调用失败：计入 `fail`，继续下一封（失败原因保留在结果数组，截断展示）；**连续 3 封失败**判定系统性故障 → phase 置 `error` 并停止。

### 6.4 Header / Footer 细节

- Header：16px 图标（`--accent`）+ 「Email Assistant」（`--text-body` semibold）；无语言控件（跟随设置页）；
- Footer：高 40px，背景 `--surface-2`，顶部 `1px --border-1`；左侧 8px 状态点（`--success`，provider 为 Ollama 时）+ `provider 标签 · 模型名`（`--text-sm` `--text-2`，等宽字体渲染模型名）+ Ollama 追加「本地」neutral 徽标；右侧「设置 →」ghost 文字按钮（`--text-sm` `--accent-subtle-text`），点击 `runtime.openOptionsPage()`；
- provider 未配置/上次调用失败时状态点转 `--warning` / `--danger`，点击 Footer 弹出小型解释气泡（可选实现，非必须）。

---

## 7. 界面三：AI 摘要窗 summary.html（420×520 独立小窗）

### 7.1 布局线框

```
┌──────────────────────────────────────────┐ 420px
│ AI 摘要                              [✕]  │ Header 48px
├──────────────────────────────────────────┤
│ Q3 报表请确认（主题，--text-lg semibold）    │ 邮件头
│ 张伟 zhangwei@corp.com · 10-02 14:23      │ 发件人(等宽) + 时间(--text-3)
│ ──────────────────────────────────────── │
│                                          │
│ 【加载中】                                  │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 100%            │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 90%             │ 骨架屏 4 行
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒ 70%                      │ + 「正在分析邮件…」
│                                          │
│ 【成功】                                    │
│   这是一封工作往来邮件。发件人请求你确认       │
│   Q3 报表中的三处数据……（正文 --text-body    │
│   --leading-loose，区域内部滚动）            │
│                                          │
│   建议标签                                  │
│   (● 业务) (● 账单) (● 个人)  ← 可点击 chips │
│                                          │
│ 【失败】                                    │
│   ⚠ 分析失败                                │
│   连接超时：无法访问 http://localhost:11434   │
│   [ 重试 ]  [ 打开设置 ]                    │
├──────────────────────────────────────────┤
│ [ ⧉ 复制摘要 ]                            │ Footer 52px
└──────────────────────────────────────────┘ 520px
```

### 7.2 状态与规范

- **窗口**：`windows.create({ type: "popup", width: 420, height: 520 })`；页面禁止整体滚动，仅摘要正文区 `overflow-y: auto`；
- **Header**：标题「AI 摘要 / AI Summary」`--text-body` semibold + 右上关闭图标按钮；
- **邮件头**：主题最多 2 行（`-webkit-line-clamp: 2`）；发件人行：显示名 `--text-2` + 地址 `--font-mono --text-sm --text-3` + 日期时间 `--text-sm --text-3`，一行 ellipsis；整块不可编辑、不可选中（复制目标仅摘要正文）；
- **loading**：骨架屏（§4.15）+ 底部说明「正在分析邮件…」；打开即请求 `summary.generate`，背景超时 60s 转失败；
- **success**：摘要正文按 LLM 输出段落渲染（纯文本段落，段间距 `--space-3`，不渲染 HTML）；「建议标签」小节标题（`--text-xs` 全大写风格改为普通 12px medium `--text-3`）+ chips 行（可点击，布局 `flex-wrap`，间距 `--space-2`），点击 chip = 在 Thunderbird 中为该邮件应用对应标签，应用后 chip 进入 `.is-applied`（§4.9）；chips 依据 LLM 返回的判定结果生成；
- **error**：warning 大图标（32px `--danger`）+「分析失败」`--text-body` semibold + 错误细节 `--text-sm` `--text-2`（最多 3 行）+ 按钮行：「重试」primary lg、「打开设置」secondary；
- **Footer**：52px，背景 `--surface`，顶部 `1px --border-1`；左：「复制摘要」secondary（16px 复制图标 + 文案），复制成功后 1.5s 内变为「已复制 ✓」（success 色 + 对勾），再还原；按钮 `disabled` 当处于 loading/error 态；快捷键 Alt+C 触发（Footer 按钮上标注 kbd 提示，可选实现）。

### 7.3 语言跟随

- 打开时读 `storage.local.uiLanguage`（缺省按 `navigator.language` 判定），设置 `<html lang>` 并渲染全部文案；摘要正文语言由 LLM 提示词控制（提示词按 uiLanguage 生成中文/英文摘要），此为数据层约定，UI 仅展示。

---

## 8. 关键交互流程

### 8.1 批量打标主流程

```
打开 popup ──► 读取 getSelectedMessages + batch.status
   │
   ├─ 选中 0 封 ─────────────────────► 【empty】禁用主操作，引导去邮件列表选择
   │
   └─ 选中 n 封 ────────────────────► 【idle】显示 n + 主按钮
                                            │ 点击「开始 AI 打标」
                                            ▼
                              background 开始批处理（n 封）
                                            │ popup 每 1s 轮询 status
              ┌─────────────────────────────┼──────────────────────────────┐
              ▼                             ▼                              ▼
        单封 LLM 失败                  用户点「取消执行」                  正常完成
        fail+1，继续下一封              当前封结束后停止                   phase=done
              │                             │                              ▼
              │                        【cancelled】                 【done】统计 + 重新扫描
              ├─ 连续 3 封失败 ─────────────► phase=error（系统性故障）
              │                             ▼
              │                        【error】错误摘要 + 重试/打开设置
              ▼
        【done】成功 x 封 / 失败 y 封 + 失败明细 + 重新扫描
```

执行中再次打开 popup：初始 status 即 `running` → 直接渲染进度视图（无本地状态）。

### 8.2 异常态矩阵

| 异常 | 出现界面 | 界面反馈 | 用户出路 |
|---|---|---|---|
| 未选中邮件 | popup | empty 空态，主操作不存在 | 「刷新选中数」或去邮件列表选择 |
| Base URL 非法 | 设置页 | 输入框 error 态 + 行内错误，不触发权限请求 | 修正 URL 再保存 |
| 权限被拒 | 设置页 | danger Toast「未授权访问 {origin}，设置未保存」（不自动消失） | 重新保存再次触发授权 |
| 云端 provider 缺 API Key | 设置页 | API Key 输入框 error 态 + 「云端服务需要 API Key」 | 填写后保存 |
| 单封 LLM 调用失败 | popup | 不中断：fail 计数 +，完成后明细展示 `第 n 封 · 原因` | 「重新扫描」只处理（可选实现：失败子集） |
| 连续 3 封失败 | popup | phase=error：danger 空态 + 错误摘要 + 常见原因提示 | 「重试」或「打开设置」 |
| 执行中再次触发 start | popup | 进度区 4px 抖动 + 内联状态「已在执行中」，任务不重启 | 等待完成或取消 |
| 摘要生成超时/失败 | 摘要窗 | error 态：错误图标 + 摘要 + 原因（如 localhost 不可达） | 「重试」「打开设置」 |
| 标签 key 重复/非法 | 设置页弹窗 | key 输入框实时 error 态 + 行内说明，提交被拦截并聚焦 | 修改 key |

### 8.3 设置保存流程

见 §5.5；要点：校验失败留在本页行内提示（不弹窗），权限请求在保存按钮手势内直接调原生弹窗，结果一律以 Toast 反馈，成功后按钮 loading ≤300ms 即释放。

### 8.4 标签编辑流程

点「编辑/添加」→ 弹窗打开并聚焦第一字段 → 实时校验（key 格式/重复）→ 「保存标签」全部通过 → 写 storage → 弹窗关闭 → 列表行淡入更新（`--dur-fast`）→ focus 返回触发行。删除：确认对话框（danger 主按钮）→ 行收起 → focus 返回列表容器。

---

## 9. 可访问性

### 9.1 对比度（WCAG 2.1 AA，正文 ≥4.5:1，大字/组件边界 ≥3:1）

实测（关键组合，实现后需复测）：

| 组合 | 亮色 | 暗色 |
|---|---|---|
| text-1 / bg | ≈17:1 | ≈16:1 |
| text-2 / surface | ≈7:1 | ≈8.7:1 |
| text-3 / surface | ≈4.9:1 | ≈4.9:1 |
| accent-on / accent（主按钮） | ≈5.3:1 | ≈4.7:1 |
| danger / surface | ≈5.4:1 | ≈6.3:1 |
| success / surface | ≈5.1:1 | ≈7.8:1 |
| accent-subtle-text / accent-subtle | ≈5:1 | ≈7:1 |

规则：`--text-3` 只用于帮助文字等辅助信息，不用作可操作元素的唯一文字；语义色（success/warning/danger）不作为唯一区分手段，必须伴随图标或文字。

### 9.2 焦点

- 全局统一：`:focus-visible { outline: none; box-shadow: var(--focus-ring); }`（描边色 `--accent`，双环设计在任意背景上可见）；
- 模态打开时焦点入 trap，关闭返回触发元素；popup 主按钮默认 autofocus；
- 不移除原生焦点样式，除非替换为上述更强样式。

### 9.3 键盘映射

| 界面 | 键 | 行为 |
|---|---|---|
| 设置页 | Tab / Shift+Tab | 表单与导航遍历（DOM 顺序 = 视觉顺序） |
| 设置页导航 | ←/→（竖导航用 ↑/↓）、Home/End | 切换导航项（roving tabindex） |
| provider 卡片组 | ↑↓←→ | 移动选中 |
| 弹窗 | Esc | 关闭；Tab 循环 |
| 表单 | Enter | 提交（表单弹窗）/触发聚焦按钮 |
| popup | Enter/Space | 触发主按钮（autofocus） |
| 摘要窗 | Alt+C（可选） | 复制摘要 |

### 9.4 ARIA / 读屏

- tabs：`role="tablist/tab/tabpanel"` + `aria-selected`；radio 卡片组：`role="radiogroup/radio"` + `aria-checked`；
- 进度：`role="progressbar"` + `aria-valuenow`；批处理进度播报节流（每 3 封或 10s 一次，`aria-live="polite"`），避免读屏刷屏；
- Toast `role="status"`（danger 用 `role="alert"`）；内联状态行 `aria-live="polite"`；
- 弹窗 `role="dialog" aria-modal="true" aria-labelledby`；输入错误 `aria-invalid` + `aria-describedby`；图标按钮一律 `aria-label`；装饰性 SVG `aria-hidden="true"`。

### 9.5 动效偏好

`prefers-reduced-motion: reduce` 下：所有过渡时长置 0（token 层已处理）、骨架 shimmer 改静态、按钮抖动改为仅聚焦、进度条填充改为无过渡跳变。

---

## 10. 主题适配细则

- 组件样式零色值硬编码，全部经语义 token（§3.2）取色 → 亮暗自动成立；
- 暗色设计要点：阴影弱化、边框承担分层（`--border-1` 分割、`--border-2` 强调）；`--surface-hover` 与 `--surface` 保持可感知但 ≤6% 亮度差；accent 按钮在暗色用 `--indigo-500` 而非加深；
- 亮色设计要点：`--bg` ≠ `--surface`（灰底白卡），卡片阴影 `--shadow-sm` 补充层次；
- 用户自定义标签色不做主题变换：chips 恒定 `--surface` 底 + 色点，保证任意色可读；
- 骨架屏、遮罩、focus ring 均走 token，两主题无需额外规则。

---

## 11. 实现与文件组织建议

**CSS 拆分**（不引入预处理器）：

```
src/styles/
  tokens.css      ← §3.2 整段（三页共享）
  base.css        ← reset、字体、.ea-btn/.ea-input/.ea-card 等通用组件（三页共享）
  options.css     ← 设置页专属（.ea-topbar/.ea-nav/.ea-radio-card/.ea-tag-row…）
  popup.css       ← popup 专属（360×480、状态区）
  summary.css     ← 摘要窗专属（420×520）
```

各页 `<link>` 依次引入 tokens → base → 页面样式；现有 `options.css` 中的硬编码色全部替换为 token 引用。

**类命名**：BEM（`.ea-block__el--mod`）；状态类 `.is-selected/.is-error/.is-applied/.is-open`；JS 钩子用 `data-*`（`data-tab`、`data-provider`、`data-index`）而非类名。

**i18n**：字典对象 `{ zh: {...}, en: {...} }`，键名按界面分段：`options.providers.*`、`options.tags.*`、`popup.states.*`、`summary.*`、`common.*`；HTML 元素 `data-i18n="key"`、`data-i18n-attr="placeholder:key,aria-label:key"`；切换即重渲染并写 `storage.local.uiLanguage`。

**popup / summary DOM 骨架**（示意）：

```html
<body class="ea-page ea-page--popup" style="width:360px;height:480px">
  <header class="ea-popup__head">…</header>
  <main class="ea-popup__body" data-phase="idle">
    <section data-view="empty">…</section>
    <section data-view="idle">…</section>
    <section data-view="running">…</section>
    <section data-view="done">…</section>
    <section data-view="error">…</section>
    <p class="ea-status" aria-live="polite">…</p>
  </main>
  <footer class="ea-popup__foot">…</footer>
</body>
```

（`data-phase` 驱动 `[data-phase="x"] [data-view]` 显隐，避免 JS 拼节点时主题闪烁。）

---

## 12. 验收清单

**主题**：[ ] 三个界面在亮/暗系统主题下均无硬编码色、无对比度回退 [ ] 切换系统主题即时生效

**设置页**：[ ] 顶栏语言切换即时生效并持久化 [ ] 6 个 provider 卡片网格可选、键盘可达 [ ] Ollama 有「推荐 · 本地」徽标与本地隐私提示，云端有隐私提示 [ ] 选中 provider 展开对应字段，Ollama 无 API Key [ ] Base URL 非法行内报错不触发权限 [ ] 权限请求发生在保存手势内，结果以 Toast 反馈 [ ] 标签增删改走弹窗与确认框（无 alert/confirm）[ ] key 实时校验

**popup**：[ ] 显示真实选中数，0 封时空态 [ ] 执行中显示 第 n/N、进度条、当前主题 [ ] 完成显示成功/失败统计与明细 [ ] 重新扫描/取消/重试可用 [ ] 1s 轮询保活且 phase 恢复正确（执行中重开 popup 恢复进度）[ ] footer 显示 provider·模型 + 设置入口

**摘要窗**：[ ] 加载骨架 → 摘要 → 错误三态完备 [ ] 头部主题/发件人/时间 [ ] 建议标签 chips 可点击应用 [ ] 复制按钮成功反馈 [ ] 文案语言跟随设置

**可访问性**：[ ] 全键盘可完成三界面主流程 [ ] focus-visible 焦点环全程可见 [ ] 进度与结果可被读屏播报（节流）[ ] reduced-motion 下无强制动画

（完）
