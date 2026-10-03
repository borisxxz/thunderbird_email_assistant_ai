# Thunderbird Email Assistant AI

**[English](./README.en.md)** | 中文

![Thunderbird](https://img.shields.io/badge/Thunderbird-102%2B-%230F8FF?logo=thunderbird&logoColor=white)
![Version](https://img.shields.io/badge/version-0.0.4-indigo)
![License](https://img.shields.io/badge/license-MIT-green)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions%20%2B%20CNB-blue)

> Thunderbird 邮件 AI 助手：任意 LLM 提供商自动打标 · 批量处理（打标 / 移动归档）· 单封 AI 摘要 · 中英双语界面

## 致敬 Tribute

本项目基于开源项目 [mcj-kr/thunderbird-email-ai-assistant](https://github.com/mcj-kr/thunderbird-email-ai-assistant) 重构而来，感谢原作者的开源分享。本仓库在保留其核心思路（LLM 邮件自动打标）的基础上进行了全面重写：多提供商自定义端点、批量确认流程、移动归档、AI 摘要、双语界面与全新设计系统。

> This project is a ground-up rewrite built on the ideas of [mcj-kr/thunderbird-email-ai-assistant](https://github.com/mcj-kr/thunderbird-email-ai-assistant). Full credit to the original author for the core concept — AI-powered mail tagging.

## 功能

### 两个 AI 入口

| 入口 | 位置 | 说明 |
|---|---|---|
| **批量处理** | 工具栏按钮 | 选中多封邮件 → AI 分析 → 逐封确认/调整候选标签 → 应用 |
| **AI 摘要** | 邮件查看工具条按钮 | 弹窗显示摘要、发件人、建议标签（可一键应用） |

批量处理支持三种动作模式：**仅打标签 / 打标+移动 / 仅移动**；失败自动跳过并在最后统一重试（次数可配），多次失败打"处理失败 Processing Failed"标记。

### 移动归档

- 标签可绑定目标文件夹，默认**自动在邮件所在账户下创建与标签同名的文件夹**（如 `Advertisement/`）
- 也可指定任意已有文件夹，或设为"此标签不移动"
- 应用前的确认页会显示每封邮件将移往的文件夹，可随时调整标签改变去向

### 其他

- **双语界面（中文 / English）**：设置页顶栏一键切换，摘要语言跟随
- **自定义标签**：名称 / key / 颜色 / 提示词实时校验；与 Thunderbird 现有标签**同名自动复用**（不重名则新建）；标签支持 **JSON 导入导出**
- **7 个 LLM 提供商**：Custom 自定义网关（默认）、Ollama（本地）、OpenAI（现行 Responses API）、Google Gemini、Anthropic Claude、Mistral、DeepSeek、Custom（任意 OpenAI 兼容网关，API Key 可选）
- **自定义端点**：每个提供商支持任意 Base URL（协议+主机+端口）与模型，可指向本地网关（如 `http://127.0.0.1:8080/v1`）；内置"获取模型""测试连接"和完整请求地址实时预览
- **高级设置**：并发数（1–8）、Temperature、最大 Token 数、失败重试次数（1–10）

## 安装

1. 从 [Releases](https://github.com/borisxxz/thunderbird_email_assistant_ai/releases)（或 [CNB 镜像](https://cnb.cool/boris007/thunderbird_email_assistant_ai)）下载 `email_assistant-0.0.1.zip`
2. Thunderbird → `工具 → 附加组件和主题` → 齿轮 → **调试附加组件** → **Load Temporary Add-on…** → 选择 zip

> 临时加载重启 Thunderbird 后失效；升级时先 Remove 旧版再加载新版。

## 快速上手

1. 打开附加组件选项页，选择提供商（本地 Ollama 零配置；云端填 API Key）
2. Custom 提供商填网关地址，点 **获取模型** 拉取列表，点 **测试连接** 验证
3. 需要归档：在"自定义标签"里给标签设置目标文件夹（默认自动同名文件夹）
4. 邮件列表选中多封 → 工具栏按钮 → 选动作模式 → 开始 AI 打标 → 确认 → 应用

## 构建与发布

### 首次配置（一次性）

1. 创建 CNB 访问令牌：[cnb.cool](https://cnb.cool) → 头像 → 设置 → **个人访问令牌** → 新建（勾选仓库写权限）
2. 添加到 GitHub 仓库密钥：仓库 **Settings → Secrets and variables → Actions → New repository secret**，Name 填 `CNB_TOKEN`，Value 填令牌

### 日常发布（只需推一个 tag）

```bash
# 1. 同步修改 manifest.json 与 package.json 的 version（例如 0.0.2）
git add -A && git commit -m "release 0.0.2"

# 2. 打 tag 并推送
git tag v0.0.2
git push github main v0.0.2
```

推送 tag 后自动完成（无需其他操作）：

1. **GitHub Actions** 构建 → GitHub Release（zip 附件）
2. 自动镜像代码与 tag 到 **CNB** → CNB `tag_push` 流水线构建 → CNB Release（zip 附件）

> 国内网络推送 GitHub 失败时加代理：`git -c http.proxy=http://127.0.0.1:7897 push github main v0.0.2`
>
> 手动本地构建：`npm run build` → `web-ext-artifacts/`

## 开发

- `doc/design-spec.md` — UI/UX 设计规范（Indigo 语义 token、亮暗主题、ea- 前缀组件）
- `doc/thunderbird-addon-guide.md` — Thunderbird 官方开发指南整理（流程 / 权限 / 调试 / 上架）
- 官方 API 文档：[webextension-api.thunderbird.net](https://webextension-api.thunderbird.net) / [developer.thunderbird.net](https://developer.thunderbird.net)

## License

[MIT](./LICENSE)
