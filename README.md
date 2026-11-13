# FlashX — Production-Ready AI Git Branch Generator

> **From Jira to Git. In a flash.**

FlashX is a production-ready Chrome browser extension (Manifest V3) that automatically detects Jira tickets in your browser, interprets the actual engineering task intent, and generates standardized, clean Git branch names using your choice of AI model (Google Gemini, OpenAI, or Anthropic Claude).

---

## ⚡ Key Highlights

- **Automatic Jira Cloud Detection**: Automatically detects Jira tickets on `https://*.atlassian.net/*` (and custom enterprise Jira domains). Observes Single Page Application (SPA) transitions without excessive polling.
- **True Engineering Intent Classification**: A Jira Story refactoring authentication is classified as `refactor/`, not `feat/`. A Jira Bug or Story fixing CVEs or sanitizing inputs is classified as `security/`. A Task setting up CI pipelines is classified as `ci/`, not `chore/`. An urgent production fix is classified as `hotfix/`, not a generic bugfix. New capabilities use modern `feat/` rather than legacy verbose `feature/`.
- **Provider-Agnostic BYOK (Bring Your Own Key)**:
  - **Google Gemini**: Latest models from Google AI Studio — `gemini-3.8-flash` (recommended default, free tier eligible), `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-4-carbon`, `gemini-4-argon`. Features dynamic model discovery and automatic multi-model failover with transparent fallback to the offline rule engine.
  - **OpenAI**: `gpt-4o-mini` (recommended), `gpt-4o`, `gpt-4-turbo`.
  - **Anthropic Claude**: `claude-3-5-haiku-20241022` (recommended), `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229` (configured with client-side direct browser access).
- **Offline Rule Engine Fallback**: Can generate standard Git branch names offline without an active LLM connection.
- **Strict Git Ref Standards**: Built-in `git-check-ref-format` sanitizer prevents illegal characters (`~`, `^`, `:`, `?`, `*`, `[`, `\`, `..`, `//`, trailing dots, `.lock`, spaces, etc.).
- **BYOK Privacy & Security**:
  - Keys are stored locally in `chrome.storage.local`.
  - Never synced to the cloud via Chrome Sync.
  - Zero telemetry, zero analytics, zero middleman proxy servers.
  - API requests travel directly from browser to provider endpoints.
- **Sleek Developer UI**: Inspired by Linear, Raycast, and GitHub. Includes dark/light themes, keyboard accessibility, one-click copy with feedback, inline branch quick-edit, live template preview, and local generation history.

---

## 📦 What's Included

```
flashx/
├── dist/                         # Compiled production bundle
├── flashx-extension.zip          # Ready-to-load Chrome extension ZIP
├── public/
│   ├── manifest.json             # Chrome Extension Manifest V3
│   └── icons/                    # Crisp 16px, 32px, 48px, 128px PNG icons
├── src/
│   ├── background/               # Service worker
│   │   └── index.ts
│   ├── content/                  # Content script with SPA navigation observer
│   │   └── index.ts
│   ├── popup/                    # Main extension popup interface
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── options/                  # Full-featured settings & preferences page
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── components/               # Accessible UI components (JiraCard, ResultCard, etc.)
│   ├── features/
│   │   ├── jira/                 # Jira parser, adapters, and DOM extractors
│   │   ├── branch-generator/     # Prompt builder, Zod schemas, fallback engine
│   │   ├── ai-providers/         # Gemini, OpenAI, and Claude provider adapters
│   │   ├── settings/             # Settings schema and defaults
│   │   └── history/              # History management
│   ├── storage/                  # Storage abstractions (BYOK credentials, settings, history)
│   ├── utils/                    # Git validator, template engine, clipboard, safe logger
│   └── styles/                   # Tailwind CSS v4 styling
├── tests/                        # 10 test suites / 70 automated tests (Vitest + Testing Library)
├── scripts/
│   ├── generate-icons.js         # Pure Node.js PNG icon generator
│   └── package-extension.js      # Production ZIP packaging script
├── vite.config.ts                # Main Vite build config
├── vite.content.config.ts        # Standalone IIFE content script build config
└── vitest.config.ts              # Vitest test configuration
```

---

## 🚀 Installation & Loading into Chrome

### Option A: Load from Pre-built `dist/` Folder (Recommended)

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. In the top-right corner, turn on **Developer mode**.
3. In the top-left corner, click **Load unpacked**.
4. Select the `dist` directory located inside this repository:
   ```
   /Users/sonal-aot/Documents/GitHub/flashx/dist
   ```
5. The **FlashX** extension will appear in your extensions list and toolbar!

### Option B: Using `flashx-extension.zip`

1. Open Chrome and navigate to `chrome://extensions`.
2. Ensure **Developer mode** is enabled.
3. Unzip `flashx-extension.zip` into a folder.
4. Click **Load unpacked** and select the unzipped folder.

---

## 🛠️ Development & Building

### Prerequisites

- Node.js >= 18 (Tested on v26.7.0)
- npm >= 9 (Tested on v11.19.0)

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Automated Tests

Run all 10 test suites (76 tests covering Jira extraction, Git ref validation, AI providers, storage, clipboard, templates, etc.):

```bash
npm test
```

### 3. Type Checking & Linting

```bash
npm run lint
```

### 4. Build Production Bundle & Package ZIP

```bash
npm run build
```

This compiles:
1. Popup and Options UI with Vite & Tailwind CSS.
2. Background Service Worker (`background.js`).
3. Standalone IIFE Content Script (`content.js`).
4. Copies Manifest V3 and extension icons to `dist/`.
5. Packages `flashx-extension.zip` ready for Chrome Web Store distribution.

---

## 📖 User Guide

### 1. First-Time Setup (Onboarding)
- When opening FlashX for the first time, an onboarding wizard guides you through:
  1. Selecting your preferred AI provider (**Google Gemini**, **OpenAI**, or **Anthropic Claude**).
  2. Entering your API key (with show/hide and **Test Connection** button).
  3. Clicking **Get Started**.
- You can also skip onboarding and use the local **Offline Mode**.

### 2. Generating a Git Branch
1. Navigate to any Jira Cloud issue (e.g. `https://your-company.atlassian.net/browse/PROJ-123`).
2. Click the **FlashX** icon in the Chrome toolbar.
3. The open Jira issue is automatically detected:
   - Issue Key (e.g. `PAY-123`)
   - Issue Type badge (e.g. `Bug`, `Story`, `Task`, `Epic`)
   - Issue Title & Description Preview
4. Click **Generate Git Branch**.
5. FlashX analyzes the issue intent and generates:
   - **Recommended Branch Name**: formatted with proper prefix and kebab-case.
   - **Alternative Suggestions**: 2 distinct variations.
   - **Rationale**: An explanation of why the prefix was selected.
6. Click the **Copy** button on any branch to copy it directly to your clipboard.
7. Click the **Edit** icon to make quick inline adjustments before copying.
8. Click the **Regenerate** icon to request fresh suggestions.

### 3. Customizing Branch Naming Rules
Open **Settings** (gear icon) to customize:
- **Naming Template**:
  - `{type}/{ticket}-{description}` (Default)
  - `{ticket}/{type}-{description}`
  - `{type}/{description}-{ticket}`
  - Or any custom pattern using `{type}`, `{ticket}`, `{description}` tokens.
- **Word Separator**: Hyphen (`-`), Underscore (`_`), or Slash (`/`).
- **Casing Style**: `All lowercase` or `Uppercase ticket (preserve PROJ-123)`.
- **Max Branch Length**: Adjustable from 30 to 100 characters.
- **Prefix Manager**: Add, toggle, or remove allowed branch prefixes (`feat/`, `bugfix/`, `fix/`, `security/`, `hotfix/`, `refactor/`, `docs/`, `test/`, `perf/`, `ci/`, `chore/`).

### 4. Generation History
- All generated branches are stored locally in the **History** tab.
- Search history by issue key or title.
- One-click copy past branch names.
- Clear history at any time.

---

## 🔒 Security & Privacy Architecture

- **Zero Middleware**: FlashX has no backend servers. API requests travel directly from the user's browser to the chosen AI provider API.
- **Storage Isolation**: Keys are stored exclusively in `chrome.storage.local`. They are never passed to `chrome.storage.sync`.
- **Masked Logging**: Built-in safe logging automatically redacts API keys and authorization headers.
- **Prompt Injection Defense**: Untrusted content inside Jira summaries and descriptions is isolated from the system prompt to prevent jailbreaks or override attacks.
- **Storage Limitations Disclosure**: `chrome.storage.local` is isolated to the extension sandbox within Chrome, but is not encrypted at rest with hardware-backed keys. If unauthorized actors have administrative access to your workstation, browser profiles could be inspected. Users can delete stored keys in FlashX at any time.

---

## 🧪 Automated Test Coverage

The test suite includes 76 tests across 10 suites:

| Test Suite | Purpose | Tests |
|---|---|---|
| `jiraParser.test.ts` | URL parsing, key extraction, document title fallback, text sanitization | 11 |
| `jiraCloudAdapter.test.ts` | Domain matching, DOM selectors, breadcrumbs, fallback extraction | 6 |
| `gitBranchValidator.test.ts` | Git ref specifications (`~`, `^`, `:`, `?`, `*`, `[`, `\`, `..`, `//`, trailing dots, `.lock`, spaces, length) | 15 |
| `templateEngine.test.ts` | Custom templates, casing styles, token replacement, branch parsing | 7 |
| `aiResponseSchema.test.ts` | Zod schema validation, markdown block stripping, error handling | 4 |
| `promptBuilder.test.ts` | Engineering intent classification rules, injection defense, prompt assembly | 2 |
| `aiProviders.test.ts` | Gemini, OpenAI, and Claude adapters (mocked 200, 401, 429, 503 failover, headers) | 10 |
| `storage.test.ts` | BYOK credential storage, settings migration (`feature/` to `feat/`), history limits | 10 |
| `fallbackGenerator.test.ts` | Offline rule engine classification across 9 intent categories (`feat/`, `security/`, etc.) | 9 |
| `clipboard.test.ts` | Clipboard writeText and fallback error handling | 2 |
| **Total** | | **76 passing** |

---

## 📄 License

MIT License. Built for engineering teams who value speed, consistency, and privacy.
