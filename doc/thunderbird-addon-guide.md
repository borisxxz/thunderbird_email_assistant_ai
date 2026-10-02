# Thunderbird 邮件扩展完整制作指南（官方文档整理）

> 来源：developer.thunderbird.net 官方文档（2026-10 整理），配合本项目 `email-assistant` 的实现对照。
> 原文：
> - 总指南：https://developer.thunderbird.net/add-ons/mailextensions
> - Hello World 教程：https://developer.thunderbird.net/add-ons/hello-world
> - UI 元素：https://developer.thunderbird.net/add-ons/mailextensions/supported-ui-elements
> - 支持的 API：https://developer.thunderbird.net/add-ons/mailextensions/supported-webextension-api
> - API 参考（MV2）：https://webextension-api.thunderbird.net/en/mv2/
> - 官方示例仓库：https://github.com/thunderbird/webext-examples

## 一、完整开发流程总览

```
1. manifest.json（扩展声明）
2. UI 入口（browser_action / message_display_action / compose_action / menus）
3. background 脚本（常驻逻辑）
4. 扩展页面（options / popup / 独立窗口）
5. 调试（about:debugging / Debug Add-ons + Inspect）
6. 打包（web-ext build → .zip / .xpi）
7. 上架（addons.thunderbird.net，简称 ATN）
```

## 二、manifest.json 核心要点

| 键 | 说明 | 本项目 |
|---|---|---|
| `manifest_version` | 2 或 3（MV3 需 TB ≥128） | 2（兼容性最广）✓ |
| `browser_specific_settings.gecko.id` | 唯一 ID，上架必须；建议 `名称@你拥有的域名` | ✓ |
| `strict_min_version` | 最低支持的 TB 版本 | 102.0 ✓ |
| `icons` | 多尺寸（16/32/48/128），不定义则显示拼图图标 | ✓ |
| `permissions` | 安装时一次性展示，用户全部接受或拒绝安装 | http/https + 邮件权限 ✓ |
| `optional_permissions` | 运行时可申请；**临时加载的扩展无法弹授权窗（实测限制）** | 已弃用，改为内置 ✓ |
| `default_locale` + `_locales/<lang>/messages.json` | manifest 内文案（如按钮标题）本地化 | en + zh_CN ✓ |

## 三、UI 入口（官方 Supported UI Elements）

1. **browser_action** — 主窗口统一工具栏（unified toolbar）按钮，可带 popup。
   - ⚠️ 按钮不显示时：右键工具栏 → 自定义… 手动添加/拖出。
   - MV3 中更名为 `action`。
   - 本项目：批量打标面板 popup ✓
2. **message_display_action** — 邮件查看窗口工具条按钮（默认可见，最可靠的单封邮件入口）。
   本项目：AI 摘要按钮 ✓
3. **compose_action** — 写信窗口按钮（本项目未用）。
4. **menus**（右键菜单）— 关键 context：
   - `message_list`：邮件列表区右键（批量操作入口）✓ 本项目"批量 AI 打标"
   - `message_display`：邮件正文区右键 ✓ 本项目"AI 摘要"
   - `folder_pane` / `tab` / `tools_menu` 等其他 context 见官方表格

## 四、脚本模型

- **background page**：隐藏窗口常驻，可加载多个 JS；MV2 用 `background.page` + `<script>`（支持 `type="module"` 或 webpack 打包单文件）。长任务（批量处理）放这里，popup 关闭不中断。✓ 本项目
- **扩展页面**（options/popup/window）：完整 WebExtension API 权限，可用原生 fetch + host 权限访问外部 API。✓ 本项目
- **content scripts**：只能用受限 API 子集，通过 runtime messaging 与 background 通信（本项目未用）。

## 五、外部 API 访问（fetch）权限规则

- 页面/background fetch 外部地址需要对应 **host 权限**（match pattern，端口任意）。
- 权限要么在 `permissions`（安装时授予），要么 `optional_permissions`（运行时申请——**临时加载的扩展申请会静默失败，实测结论**；正式安装后才可靠）。
- 自定义本地网关（如 `http://127.0.0.1:8080`）场景：`localhost` 与 `127.0.0.1` 是**不同主机**，`http://localhost/*` 不覆盖 `127.0.0.1`。
- 本项目方案：`http://*/*` + `https://*/*` 内置权限，任何地址开箱即用（安装时会提示"访问所有网站数据"，工具类扩展常见做法）。

## 六、调试

1. 临时加载：`工具 → 附加组件 → 齿轮 → 调试附加组件 → Load Temporary Add-on…`（选 zip/xpi；重启 TB 后消失）。
2. 控制台：调试附加组件页面点 **Inspect**（background）/ 打开的扩展页面右下角开发者工具。
3. 改完代码：`webpack` → 重新临时加载（必须先 Remove 旧的，同 ID 冲突）。

## 七、打包与上架

- `web-ext build` 产出 zip（可改后缀 .xpi）；`web-ext lint` 上架前自检（Thunderbird 专有权限会以警告显示，正常）。
- 上架 ATN：https://addons.thunderbird.net/developer/ 提交 zip，需账号 + 版本说明；审核关注权限用途说明。
- 自用可不上架：TB 设置中允许"安装来自文件"的 xpi（需签名或使用开发者选项）。

## 八、本项目结构对照

```
manifest.json               §二
background.html/.js         §四（常驻：自动打标 / 批量状态机 / 右键菜单）
options.html (+popup/summary)§四（扩展页面：设置 / 批量面板 / 摘要窗）
src/providers/              外部 API 适配（§五 权限规则）
_locales/{en,zh_CN}/        manifest 文案本地化（§二）
```
