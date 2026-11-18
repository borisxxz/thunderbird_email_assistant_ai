# Thunderbird Email Assistant AI

English | **[中文](./README.md)**

![Thunderbird](https://img.shields.io/badge/Thunderbird-121%2B-%230F8FF?logo=thunderbird&logoColor=white)
![Version](https://img.shields.io/badge/version-0.0.27-indigo)
![License](https://img.shields.io/badge/license-MIT-green)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions%20%2B%20CNB-blue)

> AI mail assistant for Thunderbird — tag, file and summarize your inbox with any LLM (Ollama, OpenAI, Gemini, Claude, Mistral, DeepSeek or your own gateway). Fully bilingual 中文/English.

## Tribute

This project is a ground-up rewrite built on the ideas of [mcj-kr/thunderbird-email-ai-assistant](https://github.com/mcj-kr/thunderbird-email-ai-assistant). Full credit to the original author for the core concept — AI-powered mail tagging.

## Features

### Two AI surfaces

| Surface | Where | What it does |
|---|---|---|
| **Batch panel** | Toolbar button | Select messages → AI analysis → review/adjust suggested tags per message → apply |
| **AI summary** | Message toolbar button | Popup with summary, sender and suggested tags (one-click apply) |

Batch processing supports three action modes: **tag only / tag + move / move only**. Failures are skipped and retried at the end (attempts configurable); persistent failures get a "Processing Failed" marker tag.

### Filing

- Each tag can be bound to a target folder; by default a folder **named after the tag is auto-created** under the message's account (e.g. `Advertisement/`)
- Alternatively pick any existing folder, or disable moving for a tag
- The confirmation view shows where each message will go; adjust tags to change the destination

### More

- **Bilingual UI (中文 / English)** — one-click toggle in settings, summaries follow
- **Custom tags** — name / key / color / prompt with live validation; tags named exactly like existing Thunderbird tags are **reused automatically**; **JSON import & export**
- **7 LLM providers** — Custom gateway (default, optional API key), Ollama (local), OpenAI (Responses API), Google Gemini, Anthropic Claude, Mistral, DeepSeek
- **Custom endpoints** — any Base URL (scheme + host + port) and model per provider; point at local gateways like `http://127.0.0.1:8080/v1`; built-in "Fetch Models", "Test Connection" and a live full-endpoint preview
- **Advanced settings** — concurrency (1–8), temperature, max tokens, retry attempts (1–10)

## Install

1. Download `email_assistant-0.0.27.zip` from [Releases](https://github.com/borisxxz/thunderbird_email_assistant_ai/releases) (or the [CNB mirror](https://cnb.cool/boris007/thunderbird_email_assistant_ai))
2. Thunderbird → `Tools → Add-ons and Themes` → gear → **Debug Add-ons** → **Load Temporary Add-on…** → pick the zip

> Temporary add-ons are removed on Thunderbird restart; Remove the old version before loading an update.

## Quick start

1. Open the add-on options, pick a provider (local Ollama needs no config; cloud providers need an API key)
2. Custom provider: enter your gateway URL, hit **Fetch Models**, then **Test Connection**
3. For filing: bind target folders to your tags in "Custom Tags" (auto folder by default)
4. Select messages in the list → toolbar button → choose the action mode → Start → Confirm → Apply

## Build & Release

### One-time setup

1. Create a CNB access token: [cnb.cool](https://cnb.cool) → avatar → Settings → **Personal access tokens** → new token (repo write access)
2. Add it to GitHub secrets: repo **Settings → Secrets and variables → Actions → New repository secret**, name `CNB_TOKEN`, value = the token
3. Make sure the `github` remote uses SSH (a global git `insteadOf` rewrite may redirect GitHub HTTPS to a mirror, which breaks pushes):

```bash
git remote set-url github git@github.com:borisxxz/thunderbird_email_assistant_ai.git
```

### Routine release (checklist)

1. Bump `version` in `manifest.json` AND `package.json`
2. Add bilingual release notes for this version in `src/core/changelog.js` — users see them after updating
3. Verify the package locally with `npm run build` (`web-ext-artifacts/`)
4. Commit, tag, and push to both remotes

```bash
git add -A && git commit -m "v0.0.27: ..."
git tag -a v0.0.27 -m "v0.0.27"

git push origin main v0.0.27                                          # CNB
GIT_SSH_COMMAND="ssh -o BatchMode=yes" git push github main v0.0.27   # GitHub over SSH
```

Pushing the tag then does everything automatically:

1. **GitHub Actions** builds → GitHub Release (zip, `-github.xpi`, `-cnb.xpi`, `updates.json`)
2. Code + tag are mirrored to **CNB** → CNB `tag_push` pipeline builds → CNB Release (`-cnb.xpi` / `-cnb.zip`)
3. `updates-cnb.json` on CNB `main` is updated to the new version

### Two update channels

| Channel | Package | Update source | For |
|---|---|---|---|
| **CNB** | `email_assistant-*-cnb.xpi` | `updates-cnb.json` (CNB raw main) | Users in China |
| **GitHub** | `email_assistant-*.zip` / `-github.xpi` | `releases/latest/download/updates.json` | Users elsewhere |

- The channel is fixed by the package the user installed (Thunderbird does not route by IP)
- **After an update completes**, the extension compares versions at startup and opens a one-time "What's new" window; notes come from `src/core/changelog.js`, shown once per version (fresh installs get a one-time welcome note)
- Instances loaded via `Load Temporary Add-on` never check for updates; install the xpi permanently to test the update path
- After publishing, verify both update manifests report the new version and both releases serve their xpi

> Local build: `npm run build` → `web-ext-artifacts/`

## Development

- `doc/design-spec.md` — UI/UX design system spec
- `doc/thunderbird-addon-guide.md` — Thunderbird add-on development guide (workflow / permissions / debugging / publishing)
- Official docs: [webextension-api.thunderbird.net](https://webextension-api.thunderbird.net) / [developer.thunderbird.net](https://developer.thunderbird.net)

## License

[MIT](./LICENSE)
