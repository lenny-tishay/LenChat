<div align="center">

<img src="assets/logo2.png" alt="LenChat logo" width="80" height="80">

# LenChat

**Drop your code. Ask your AI. Build with freedom.**

A free, open-source AI workspace for developers.<br>
Bring your own API keys, drop an entire project into the page, and talk to any model, with everything staying in your browser.

<br>

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-2b40f2?style=flat-square&labelColor=171717)](LICENSE)
[![Version 4.0.0](https://img.shields.io/badge/Version-4.0.0-0c8cfd?style=flat-square&labelColor=171717)](CHANGELOG.md)
[![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-022488?style=flat-square&labelColor=171717)](#installation--setup-guide)
[![Local-First](https://img.shields.io/badge/Local--First-yes-0dd4fe?style=flat-square&labelColor=171717)](#privacy--local-first-architecture)
[![BYOK](https://img.shields.io/badge/BYOK-Bring%20Your%20Own%20Key-b32cfd?style=flat-square&labelColor=171717)](#supported-ai-providers)

<a href="https://ko-fi.com/B5I529BI8K" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support LenChat on Ko-fi"></a>

<br>

<img src="assets/lenchat.jpg" alt="LenChat main workspace" width="100%">

</div>

<br>

<div align="center">

[Quick Start](#quick-start) &nbsp;&middot;&nbsp; [Features](#key-features) &nbsp;&middot;&nbsp; [Providers](#supported-ai-providers) &nbsp;&middot;&nbsp; [Installation](#installation--setup-guide) &nbsp;&middot;&nbsp; [Technology](#technology-stack) &nbsp;&middot;&nbsp; [Structure](#project-structure) &nbsp;&middot;&nbsp; [Privacy](#privacy--local-first-architecture) &nbsp;&middot;&nbsp; [License](#licensing--attribution) &nbsp;&middot;&nbsp; [Support](#support--donate)

</div>

---

## Overview

Most AI chat tools make you choose: pay a subscription, hand your code to someone else's server, or maintain a heavy self-hosted stack. LenChat takes a different route. It follows a **Bring Your Own Key (BYOK)** model. You add your own API keys for the providers you already use, pay them directly, and keep full control of cost and data. Add several keys per provider and swap between them when one hits its limit. Choose how much history each message carries, and delete any message to stop paying for it.

LenChat is built for real projects. Drag in a **ZIP archive**, a **whole folder**, or any number of files, and LenChat reads them **in your browser**, builds a directory tree, and attaches the result to your next prompt. The architecture is **local-first**: keys, history, snippets and files stay in your browser's storage. There is no database, no Node.js and no build step. If your host can run PHP, it can run LenChat, from a laptop to a free shared hosting account.

---

## Quick Start

```bash
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

Open **http://127.0.0.1:8000**, go to **Settings**, add an API key for any provider, and drop a project onto the page.

> [!TIP]
> PHP not installed yet? See **Prerequisites** and **Terminal Setup** in the [installation guide](#installation--setup-guide).

---

## Key Features

| Capability | What it does |
|---|---|
| **Multi-provider AI engine** | OpenAI, Anthropic, Gemini, Groq, DeepSeek, OpenRouter, local Ollama and any OpenAI-style endpoint, from one interface. |
| **Project context** | Drop ZIPs, folders or many files at once. LenChat attaches a directory tree and file-by-file context to your prompt. |
| **Document extraction and OCR** | Reads PDF, DOCX and XLSX in the browser. Images go to vision models, or are read with OCR for text-only models. |
| **Live sandbox preview** | HTML, CSS, JavaScript and SVG from the AI render live in a sandboxed iframe, next to an editable code canvas. |
| **Voice workspace** | Dictation, read-aloud replies and a hands-free mode that listens, sends, speaks and listens again. |
| **Workspace management** | Export and import sessions and settings, keep a snippet library, tag and search history, switch light and dark themes. |

Expand any section below for details.

<details>
<summary><b>Multi-Provider AI Engine</b></summary>

<br>

- One chat window, many providers. Switch provider, key and model from the chip in the top bar.
- **Multiple labelled keys per provider.** Rotate to a fresh key the moment one is rate-limited.
- **Your own models.** Use preset model lists or type any model ID, and point a custom endpoint at any OpenAI-compatible API.
- **Per-chat cost control.** Send the prompt and files only, the whole conversation, or just the last N messages. Turn off the system prompt to save tokens.
- **Max output tokens and temperature** are one setting away.
- **Errors stay in the interface.** Provider errors are shown to you and never fed back to the model.
- **Flexible transport.** Call providers directly from the browser, or route through the optional PHP relay.

</details>

<details>
<summary><b>Project Context and Codebase Analysis</b></summary>

<br>

- Drag files, folders or a ZIP anywhere on the page, or use the attach menu. Pasting screenshots works too.
- Everything is parsed client-side into clean markdown context blocks and listed in an **attachment tray**.
- **Show tree** displays the project structure so you can see exactly what the AI will receive. Select all, select none, or remove individual files before sending.
- Control how long attached files stay in context ("Keep files for last N messages") so you are not paying to resend a codebase on every turn.

</details>

<details>
<summary><b>Document Extraction and OCR</b></summary>

<br>

- Read **PDF**, **DOCX** and **XLSX** files in the browser.
- **Image handling is your choice:** always send the picture to vision models, always read it with OCR, or let LenChat decide based on the selected model.
- Generate images with `/imagine ...`, using Pollinations (free, no key) or your OpenAI key.

</details>

<details>
<summary><b>Live Web and UI Sandbox Preview</b></summary>

<br>

- Ask for HTML, CSS, JavaScript or SVG and get a **live preview** in a sandboxed iframe.
- Open the clickable, editable **code canvas**, copy with syntax awareness, and download generated files.
- **Fix with AI.** If a preview throws an error, LenChat can offer a one-click fix, or retry automatically (up to two tries).
- **File Generation Skill.** The AI delivers multi-file output with one download button per generated file.

</details>

<details>
<summary><b>Interactive Voice Workspace</b></summary>

<br>

- **Dictation (speech to text)** with the browser's Web Speech engine or a transcription endpoint you configure.
- **Voice commands while dictating:** "send it", "clear the text", "stop listening" and "new chat".
- **Read aloud (text to speech)** with browser voices or ElevenLabs. Adjust voice, speed and pitch, or read every finished reply automatically.
- **Hands-free conversation:** send after a pause, read the reply, then listen again.

</details>

<details>
<summary><b>Workspace Management</b></summary>

<br>

- **Local history** with tags and instant search, plus a **snippet library** for code you reuse.
- **Export and import** sessions and configuration. API keys are included only if you choose to.
- **Prompt starters** and examples, editable in Settings.
- **Light and dark themes**, with a mobile-first layout built for touch.
- **Update checker.** Compare with GitHub from Settings, then update by re-uploading, or enable one-click auto-update on your own server.

</details>

<br>

<div align="center">

<img src="assets/tree.png" alt="Dropping a project folder into LenChat and viewing the attachment tree" width="100%">

<sub>Upload files, folders and ZIP archives. Review the project tree before anything is sent.</sub>

<br><br>

<img src="assets/canva.png" alt="Live sandbox preview next to the code canvas" width="100%">

<sub>Render generated HTML live in the sandboxed canvas.</sub>

</div>

---

## Supported AI Providers

| Provider | Notes |
|---|---|
| **OpenAI** | Chat, vision, and image generation with your own key |
| **Anthropic (Claude)** | Direct API support |
| **Google Gemini** | Chat and vision models |
| **Groq** | Fast open-model inference |
| **DeepSeek** | Chat and reasoning models |
| **OpenRouter** | One key for many hosted models |
| **Ollama (local)** | Run models on your own machine, no key needed |
| **Custom endpoint** | Any OpenAI-style API, with your own model IDs |

> [!NOTE]
> You pay each provider directly. LenChat does not mark up or resell your usage.

---

## Installation & Setup Guide

Open the section that matches your environment.

<details>
<summary><b>Prerequisites</b></summary>

<br>

| Requirement | Details |
|---|---|
| **PHP 7.4 or newer** | Serves the app and the optional streaming relay |
| **cURL extension** | Required only if you use the server relay |
| **A modern browser** | Chrome, Edge, Firefox or Safari. Voice features depend on browser support. |

Check your PHP version and extensions:

```bash
php -v
php -m | grep -i curl
```

</details>

<details>
<summary><b>Terminal Setup (Windows, macOS, Linux, WSL)</b></summary>

<br>

**Windows PowerShell**

```powershell
winget install PHP.PHP
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

**Windows CMD**

```bat
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

**Git Bash**

```bash
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

**macOS** (with [Homebrew](https://brew.sh))

```bash
brew install php
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

**Linux** (Debian / Ubuntu)

```bash
sudo apt update && sudo apt install php-cli php-curl git
git clone https://github.com/lenny-tishay/LenChat.git
cd LenChat
php -S 127.0.0.1:8000
```

**WSL**

Run the Linux commands inside your WSL distribution, then open `http://127.0.0.1:8000` in your Windows browser.

</details>

<details>
<summary><b>Step-by-Step Server Setup</b></summary>

<br>

1. **Clone the repository**

   ```bash
   git clone https://github.com/lenny-tishay/LenChat.git
   ```

2. **Enter the project folder**

   ```bash
   cd LenChat
   ```

3. **Start the built-in PHP server**

   ```bash
   php -S 127.0.0.1:8000
   ```

4. **Open the app** at [http://127.0.0.1:8000](http://127.0.0.1:8000)

5. **Add a key.** Open **Settings**, choose a provider, paste your API key and save.

</details>

<details>
<summary><b>Deploy to Shared Hosting (cPanel, InfinityFree and similar)</b></summary>

<br>

LenChat needs no database and no build step, so deployment is a file upload.

1. Download the repository as a ZIP.
2. Upload and extract it into `public_html` (or a subfolder) using your host's file manager or FTP.
3. Visit your domain.

Server options such as the relay, update checker and security headers live in `config.php`. If you enable the relay on a public site, set a relay access token and keep it private.

</details>

<details>
<summary><b>Troubleshooting</b></summary>

<br>

| Problem | Fix |
|---|---|
| `php: command not found` | PHP is not installed or not on your `PATH`. Install it (see Terminal Setup), then reopen your terminal. |
| `Failed to listen on 127.0.0.1:8000` (port in use) | Use another port: `php -S 127.0.0.1:8080` |
| `Call to undefined function curl_init()` | Enable the cURL extension: `sudo apt install php-curl` on Linux, or uncomment `extension=curl` in `php.ini` on Windows and macOS. |
| Provider request fails from the browser | Some providers block direct browser calls. Switch **Transport** to the server relay in Settings. |
| Microphone does not work | Browsers allow voice input only on `localhost` or HTTPS. |

</details>

---

## Project Structure

```text
LenChat/
├── index.php          # App shell and client configuration
├── config.php         # Providers, defaults, relay, security and update settings
├── preview.php        # Sandboxed live-preview host
├── api/
│   ├── stream.php     # Optional streaming relay (SSE)
│   └── update.php     # GitHub update checker / updater
├── assets/
│   ├── css/style.css  # Custom design system, no framework
│   └── js/            # Vanilla ES6+ modules (storage, reader, provider, engine, app...)
├── remote/            # Remote configuration and branding
├── CHANGELOG.md       # Release notes
├── UPDATING.md        # How to update an existing install
├── NOTICE.md          # Attribution requirements (AGPL Section 7)
└── LICENSE            # GNU AGPL-3.0
```

---

## Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Server** | PHP 7.4+ | App shell, configuration and an optional cURL server relay |
| **Front end** | HTML5, CSS3, vanilla JavaScript | Responsive UI and SSE streaming with no heavy framework dependencies |
| **Storage** | Browser LocalStorage | Client-side keys, state and session management |
| **File processing** | In-browser parsers | PDF, DOCX and XLSX extraction, plus OCR for images |

No Node.js. No database. No build pipeline.

---

## Privacy & Local-First Architecture

- **Keys stay in your browser.** They are stored locally and sent only to the provider you choose, directly or through your own relay.
- **Files are read client-side.** ZIPs, folders, PDFs and images are parsed in the page before anything is sent.
- **No accounts, no tracking, no database.** History, tags and snippets live in your browser, and you can export or erase them at any time from Settings.
- **Sandboxed previews.** Generated HTML runs in a sandboxed iframe, isolated from the app.
- **Secure defaults.** The app ships with a Content Security Policy, `X-Frame-Options`, `nosniff` and a no-referrer policy.
- **Optional relay on your own server.** If you use the PHP relay, it runs on your host and can be protected with an access token.

> [!IMPORTANT]
> Prompts and attached content are sent to the AI provider you select, under that provider's terms. Choose Ollama to keep everything on your own machine.

---

## Licensing & Attribution

LenChat is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)** with **additional attribution requirements under Section 7**. Read [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md) before redistributing or hosting a modified version. In short: you may use, study, modify and share LenChat, you must keep the required attribution, and modified versions served over a network must offer their source.

**Commercial licensing.** If you need to build LenChat into a closed-source product, a commercial license without AGPL obligations is available from LENTECH DIGIWORKS: [lentech.co.ke/lenchat-enterprise](https://lentech.co.ke/lenchat-enterprise)

Copyright &copy; 2026 Leonard Muia t/a LENTECH DIGIWORKS.

---

## Support & Donate

LenChat is created and maintained by **Leonard Muia** and is free for everyone. If it saves you time or money, you can help it keep growing.

| | |
|---|---|
| **Ko-fi** | <a href="https://ko-fi.com/B5I529BI8K" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" height="32"></a> |
| **PayPal** | `leonardlentech@gmail.com` |
| **More ways to give** | [leonard.lentech.co.ke/donate](https://leonard.lentech.co.ke/donate) |

Starring the repository, sharing it and opening well-written issues all help too.

---

<div align="center">

**[LENTECH DIGIWORKS](https://lentech.co.ke)** &nbsp;|&nbsp; **[Personal Portfolio](https://leonard.lentech.co.ke)**

<sub>Open source project by LENTECH DIGIWORKS. Drop your code. Ask your AI. Build with freedom.</sub>

</div>
