# Envoy

A personal executive-assistant application for managing communications, tasks, documents, and daily workflows — desktop first, with a full-featured mobile companion. Built with Electron, React, TypeScript, and React Native.

**Local-first.** Your data stays on your device. Optional opt-in telemetry (Sentry) only activates if you set a DSN environment variable.

---

## Apps

### Desktop (`apps/desktop`)
Electron + React + TypeScript. Runs on Windows, macOS, and Linux. Uses SQLite by default (better-sqlite3), with an optional MySQL backend.

### Mobile (`apps/mobile`)
React Native (bare workflow) for Android + iOS. Uses op-sqlite for on-device storage. Full CRUD screens for every core entity plus Notifee-powered local reminders and URL-scheme handoff for email / WhatsApp / Teams.

---

## Features

Feature parity is close between the two apps; a few desktop-only features are called out below.

### Communication
- **Compose** — Send via email (`mailto:`), WhatsApp (`wa.me`), or Teams deep link. Templates rendered live with contact data.
- **Templates** — Reusable Jinja2 / Nunjucks templates with per-channel targeting and tone tagging.
- **Snippets** — Quick-access text with `/shortcut` syntax and usage counters.
- **Scheduled** — Queue messages for later delivery *(desktop can auto-send in the background; mobile is view + cancel only for now)*.
- **History** — Every send lands in the audit log with template, recipient, timestamp, and status.

### Organization
- **Contacts** — CRUD with groups, tags, custom fields, timeline view *(desktop)*, and last-contacted tracking.
- **Calendar** — Event scheduling; desktop shows day / week / month, mobile shows a monthly agenda.
- **Tasks** — Kanban with statuses (todo / in_progress / done / archived), priorities, due dates, and recurring rules *(desktop board, mobile list)*.
- **Reminders** — Set-once and repeating reminders; local push notifications via Electron Notification (desktop) or Notifee (mobile).

### Tools
- **Notes** — Pinned / tagged plain-text notes.
- **Documents** — Rich-text editor *(desktop, TipTap)* / template-friendly full-screen editor *(mobile)* with placeholder extraction and Share.
- **Expenses** — Tracking, categorization, monthly totals; desktop adds period comparison and charts.
- **Calculator** — In-app.
- **Focus Timer** — Pomodoro sessions *(desktop only)*.
- **Automations** — If-then rules for workflow automation *(desktop only)*.

### Productivity
- **Dashboard** — Live stats + quick actions + previews of upcoming reminders, priority tasks, recent sends.
- **Command Palette** — `Ctrl+K` global search *(desktop)*.
- **Keyboard Shortcuts** — Full support *(desktop)*.
- **Feature Toggles** — Enable only what you use.
- **Themes** — Light / dark / system *(desktop)*.

---

## Tech Stack

| Layer | Desktop | Mobile |
|---|---|---|
| Framework | Electron 31 LTS | React Native 0.83 (bare) |
| UI | React 18 + Vite | React 19 + React Navigation 7 |
| Styling | Tailwind CSS 3 | NativeWind 4 + StyleSheet |
| State | Zustand + Context | Context |
| Database | better-sqlite3 11 (SQLite) / mysql2 | op-sqlite 9 |
| Template engine | Jinja2 via Python bridge | Nunjucks (Jinja2-compatible, in-JS) |
| Notifications | Electron `Notification` | Notifee |
| Crash reporting | @sentry/electron (opt-in via DSN) | @sentry/react-native (opt-in via DSN) |
| Auto-update | electron-updater (GitHub Releases) | Play/App Store |
| Tests | vitest (main-process helpers) | — |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
envoy/
  turbo.json                # Turborepo pipeline
  package.json              # Root workspace + scripts
  DEPLOYMENT.md             # Release / signing / auto-update guide

  packages/
    shared/                 # @envoy/shared — types & constants
    database-core/          # @envoy/database-core — IDatabase interface

  apps/
    desktop/                # Electron app
      engine/               # Python template engine (Jinja2)
      resources/            # App icons + default templates
      src/
        main/
          services/         # logger, security, secure-storage, updater,
                            #   sentry, database, email, scheduler, teams
          ipc-handlers.ts   # IPC handlers (sanitized before shell/file)
          index.ts          # Sandbox + CSP + navigation lockdown wiring
        preload/            # contextBridge-exposed window.envoy API
        renderer/           # React frontend (19 pages)
      vitest.config.ts      # Test runner
    mobile/                 # React Native app
      android/
        KEYSTORE.md         # Release keystore setup
      src/
        contexts/           # Database + Settings + Theme providers
        navigation/         # Bottom tabs + native stacks
        screens/            # 17 real CRUD screens
        services/           # MobileDatabaseService, TemplateEngine,
                            #   NotificationService, sentry
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.9+ *(desktop only, for the template engine)*
- **Git**
- *(mobile)* Android Studio / Xcode toolchains

### Install

```bash
git clone https://github.com/shamil3ilm/envoy.git
cd envoy
npm install
```

Native modules are rebuilt for Electron automatically via `postinstall`.

### Desktop dev

```bash
npm run dev:desktop
# Then, in a separate terminal:
cd apps/desktop && npm run start
```

### Mobile dev

```bash
npm run dev:mobile
# Then in another terminal:
cd apps/mobile && npm run android   # or: npm run ios
```

### Python engine *(optional)*

Only needed for the desktop app if you want Jinja2 rendering. Mobile uses in-JS Nunjucks and needs no Python.

```bash
cd apps/desktop/engine
pip install -r requirements.txt
```

### Verification

```bash
npm run typecheck   # tsc --noEmit across all workspaces
npm test            # vitest (security helpers, 14 tests)
npm run verify      # typecheck + test together
```

---

## Building

### Desktop

```bash
cd apps/desktop
npm run build       # tsc + vite build
npm run pack        # unpacked dir
npm run dist        # signed installer (needs signing env vars — see DEPLOYMENT.md)
```

Output lands in `apps/desktop/release/`.

### Mobile

```bash
cd apps/mobile
npm run build:android   # AAB via Gradle (needs keystore — see android/KEYSTORE.md)
npm run build:ios       # xcodebuild archive
```

---

## Deploying

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:
- Windows / macOS code-signing env vars
- macOS notarization
- Auto-update publish target (GitHub Releases by default)
- Android release keystore setup (see `apps/mobile/android/KEYSTORE.md`)
- CI secret handling checklist

Auto-update is already wired via `electron-updater`; every packaged build checks GitHub Releases on start and every 4 hours.

---

## Security posture

The desktop app is hardened for third-party distribution:

- Electron `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webviewTag: false`
- Strict CSP via `session.webRequest.onHeadersReceived` (+ `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
- Off-app navigation blocked; new windows routed through `shell.openExternal` after URL sanitization
- Custom `app://` protocol rejects path traversal outside the renderer dir
- SMTP passwords and OAuth tokens encrypted at rest via Electron `safeStorage` (`enc:v1:` prefix); startup pass re-encrypts any legacy plaintext rows
- All shell / URL / mailto handoffs go through explicit sanitizers (`sanitizeEmail`, `sanitizePhone`, `isSafeUwpFamilyName`, `isSafeExternalUrl`, `buildMailtoUrl`)
- Database migrations backed up to `userData/backups/` before every batch, with recoverable error messaging
- Structured logging via `electron-log` — no `console.log` in the main process
- 14 vitest tests cover the sanitizer helpers (URL scheme rejection, shell-metacharacter email rejection, phone / UWP normalization, mailto URL encoding)

---

## Privacy

- Runs locally; no cloud sync
- No analytics
- Sentry crash reporting is opt-in: activates **only** when `ENVOY_SENTRY_DSN` (main), `VITE_SENTRY_DSN` (renderer), or `SENTRY_DSN` (mobile) is set. Sentry `beforeSend` redacts anything matching `/password|token|secret|apiKey|api_key/i` before it leaves the device.
- Auto-update: `electron-updater` fetches release metadata from your configured GitHub Releases repo — you can point this elsewhere or disable it.

---

## License

Private project by Mohamed Shamil.
