# ATN 上架与签名准备（addons.thunderbird.net）

> 目的：让普通用户能在 Thunderbird 正式版上**永久安装**（正式版默认要求签名扩展；
> 临时加载仅适合开发测试）。两条路线选其一。

## 路线选择

| | A. Listed（上架商店） | B. Unlisted（自托管签名） |
|---|---|---|
| 分发方式 | ATN 商店页搜索安装 | 继续用 GitHub / CNB Release 分发 |
| 自动更新 | **ATN 托管**（覆盖现有双渠道机制） | 保持现有 `update_url` 双渠道机制 |
| `update_url` | **必须删除**（web-ext lint 的 `MANIFEST_UPDATE_URL` 错误即此原因） | 允许保留 |
| 审核 | 公开审核，首轮较慢 | 仅签名检查，较快 |

> **B 路线的双渠道说明**：ATN 对提交的固定 zip 签名，而两个渠道的 xpi 差异恰在
> `update_url`。要保持 CNB/GitHub 双渠道自动更新，需要**分别提交两个 flavor 各签一次**
> （同版本可重复提交 unlisted），签名后按 `-github.xpi` / `-cnb.xpi` 命名替换 Release 中
> **更新清单实际引用的 xpi**（只换 zip 不影响自动更新）。若只签一次，则退化为单渠道。

**建议**：若目标是"现有用户继续走 CNB/GitHub 自动更新"，选 **B（unlisted）**。
若想进商店获得曝光，选 A，并接受更新机制切换到 ATN。

## 提交前自查（当前状态）

- `web-ext lint`：8 条 `MANIFEST_PERMISSIONS` 警告——web-ext 不认识 Thunderbird
  专属权限，**ATN 审核器认识，可忽略**；选 A 路线需先移除 `update_url` 消除那条 error
- MV2 + `strict_min_version: 121`：ATN 接受（Thunderbird 当前主流版本 ≥ 121）
- 扩展 ID：manifest `browser_specific_settings.gecko.id`（保持不变，签名与更新都绑定它）

## 数据披露（审核问卷照此填写）

- **发送给第三方的数据**：用户邮件的正文、头字段（主题/发件人/收件人/日期等）与附件
  **文件名**会发送到**用户自行配置**的 LLM 端点（提供商、地址、模型均由用户选择；
  可配置本地 Ollama，此时数据不离开本机）
- **开发者收集的数据**：无。无遥测、无统计、无上报
- **本地存储**：LLM API Key（storage.local，仅发往用户配置的端点作为鉴权头）、
  标签定义与映射、批次统计、界面语言、版本标记
- **不发送**：邮件内容不会发送给本扩展作者或任何固定服务器

## 权限说明（审核备注可照抄）

| 权限 | 代码用途 |
|---|---|
| `messagesRead` | 读取选中邮件全文用于 AI 分析与摘要 |
| `messagesUpdate` | 将 AI 建议的标签写入邮件 |
| `messagesMove` | 按标签配置将邮件归档到目标文件夹 |
| `messagesTags` / `messagesTagsList` | 创建/列出/更新 Thunderbird 标签定义 |
| `accountsRead` | 列出账户：识别 QQ/Gmail 等不支持标签的服务器、定位账户根文件夹 |
| `accountsFolders` | 按标签名自动创建归档文件夹 |
| `mailTabs` | 读取邮件窗口的选中邮件（批处理入口） |
| （无 `tabs`） | 打开/聚焦面板标签页用的 `tabs.create/update/get/onRemoved` 不需要该权限，故未声明 |
| `storage` | 保存设置、标签定义、API Key（仅本地） |
| `notifications` | 批处理开始/完成通知 |
| `http://*/*`、`https://*/*` | LLM 端点完全由用户配置（任意主机/端口，含本地网关），无法预列域名 |

## 操作步骤

1. 注册开发者账号：<https://addons.thunderbird.net/developers/>
2. `npm run build` 产出 `web-ext-artifacts/email_assistant-<版本>.zip`
   （选 A 路线：先删 manifest 的 `update_url` 再构建，并同步调整 release 流水线）
3. Submit a New Add-on → 上传 zip → 选 Listed / Unlisted
4. 填写数据披露问卷（照上文）与权限说明（照上表）
5. 等待签名/审核；Unlisted 通常几分钟到数小时
6. 下载**签名后的 xpi**，替换 Release 中更新清单引用的 `-github.xpi` / `-cnb.xpi`（或改用 ATN 托管更新）
7. 用签名 xpi 在 Thunderbird 正式版验证永久安装与自动更新

> 注意：签名版与非签名版不能混装（同 ID 需先卸载再装）。现有用户若从
> 自托管 xpi 迁移到 ATN 托管更新，需在 Release 里说明一次迁移步骤。
