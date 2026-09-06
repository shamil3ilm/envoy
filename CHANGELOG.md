# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **LAN sync MVP** — desktop hosts a token-authenticated HTTP endpoint
  (`GET /envoy/v1/ping` unauthenticated + `GET|POST /envoy/v1/envelope`
  authenticated). Ctrl+K → "Enable LAN Sync Server" generates a token,
  binds `0.0.0.0:47828`, and copies the URLs + token to the clipboard.
  Mobile Settings → 🔗 LAN Sync has URL + token inputs and Ping / Pull /
  Push buttons. Constant-time token compare; 100 MB body cap; every
  pull/push writes an audit-log entry with peer IP and counts. Reuses
  the existing backup envelope + additive `restoreEnvelope` merge, so
  no separate protocol to maintain.
- Desktop **DB VACUUM** command — Ctrl+K → "Compact Database (VACUUM)".
  Reclaims unused space from the SQLite file. New `vacuum()` method on
  `IDatabase`; desktop measures freed bytes via `fs.statSync`, mobile
  approximates via `PRAGMA page_count * page_size`.
- Desktop **Copy Debug Info** command — Ctrl+K → assembles version /
  platform / DB size / integrity result / last 40 log lines into a
  paste-ready blob and copies to clipboard. No credentials or user data
  included.
- Mobile **Diagnostics parity** — Settings → Diagnostics now has three
  buttons: Run integrity check, Compact database (VACUUM), Copy debug
  info. Same shape as desktop, minus the log tail (Notifee/Sentry own
  mobile logging).
- Desktop **shutdown backup** — if auto-backup is enabled and the
  interval has elapsed, `before-quit` runs one final catch-up backup
  with a hard 3-second timeout so quit stays responsive even if the DB
  is locked.
- Desktop **audit log entries** for every backup lifecycle event
  (`backup_exported` / `backup_restored` / `backup_auto_run` /
  `backup_auto_enabled` / `backup_auto_disabled`). Mobile writes
  matching entries for its manual export/restore paths.
- Desktop **auto-backup scheduler** with restore-latest-auto one-click
  recovery — every N hours writes `userData/backups/auto-<ts>.json`,
  keeps N newest. Toggle from Ctrl+K; runs on next start if the machine
  was asleep.
- Desktop **diagnostics suite** — DB integrity check on `IDatabase`,
  storage stats (userData / DB / backups / logs sizes), open backups
  folder via `shell.openPath()`, startup integrity check that logs
  warnings if the DB is unhealthy.
- Desktop **JSON data export** — Ctrl+K → "Export All Data" writes a
  versioned envelope of every user entity (contacts, templates, tasks,
  notes, snippets, calendar, reminders, scheduled, audit, expenses, rich
  documents, settings) via `envoy.backup.export()`. Atomic `.tmp`+rename
  write. Email credentials deliberately excluded — the safeStorage cipher
  can't be decrypted on a different OS profile.
- Desktop **backup inspect + restore** — Ctrl+K → "Inspect Backup File"
  previews an export without touching data; "Restore From Backup" merges
  by id (upsert, never delete) after a required confirmation dialog and
  a mandatory pre-restore snapshot to `userData/backups/`. Restore covers
  contacts / templates / snippets / tasks / notes / expenses / rich
  documents / reminders / calendar events / contact groups / scheduled
  messages / note groups / settings. Audit logs are permanently excluded
  since duplicating them breaks provenance.
- New `getNoteGroup(id)` on the shared IDatabase interface + both DB
  implementations. Enables note-group upsert in the restore path.
- Mobile **backup export + restore** — Settings → Data & Backup exports
  via the RN Share sheet and restores by pasting the JSON back in with a
  preview step. Envelopes exported from either platform interoperate.
- Mobile **global search modal** — Dashboard 🔍 button opens a full-screen
  search that fans out to 8 entity types in parallel, groups matches by
  type, and taps route into the owning tab+stack. 200 ms debounce, `<2`
  chars skipped, in-flight cancellation on new query.
- Consolidated `sanitizePhone` / `sanitizeEmail` / `buildMailtoUrl` into
  `@envoy/shared/sanitize` for mobile; desktop keeps inline copies with a
  header comment pointing at the canonical source (main-process tsc
  build's `rootDir: src` refuses out-of-tree resolutions).
- Desktop **auto-backup scheduler** — opt-in via Ctrl+K → "Enable
  Auto-Backup (Daily)". Writes a JSON envelope to
  `userData/backups/auto-<timestamp>.json` on a configurable interval
  (default 24h) and rotates to the newest N (default 7). Ships with a
  matching Disable action and an `autoStatus()` IPC surface.
- CI: GitHub Actions `verify` workflow (typecheck + tests on push/PR to `main`).
- CI: Dependabot for weekly npm bumps (grouped minor/patch, ignored majors on Electron/RN).
- CI: PR template with a testing / secret-hygiene / IPC-boundary checklist.
- Root scripts: `npm test` and `npm run verify` wired through Turborepo.
- Full-screen mobile `DocumentEditor` with edit/preview toggle, per-contact
  live template render (Nunjucks), page-color picker, `isTemplate` switch,
  RN `Share` handoff, and placeholder extraction on save.
- Mobile Phase 2 & Phase 3 screens: Dashboard, Contacts, Notes, Tasks,
  Snippets, Templates, Calendar, Expenses, Reminders (with Notifee push),
  Compose (URL-scheme handoff + audit log), History, Scheduled,
  ActivityLog, Calculator, Documents.
- Desktop Command Palette (`Ctrl+K`) now covers Reminders and Rich
  Documents alongside contacts / templates / tasks / notes / snippets / expenses.
- Zod-based IPC input validation for file-taking handlers:
  `CONTACT_IMPORT` / `CONTACT_EXPORT` / `SOUND_UPLOAD` / `DIALOG_OPEN_FILE`
  / `DIALOG_SAVE_FILE` / `DOCX_TEMPLATE_UPLOAD`. Rejects control-byte paths,
  wrong extensions, and non-existent sources; logs each rejection.
- Vitest suite grew from 14 → 52 (added ipc-validation + secure-storage
  coverage with `vi.hoisted` mocks for the electron `safeStorage` module).
- Electron hardening: `sandbox: true`, contextIsolation on, strict CSP via
  `session.webRequest.onHeadersReceived`, `will-navigate` /
  `windowOpenHandler` / `will-attach-webview` lockdown, path-traversal
  defense inside the `app://` protocol handler, security helper suite
  (`isSafeExternalUrl`, `sanitizeEmail`, `sanitizePhone`,
  `isSafeUwpFamilyName`, `buildMailtoUrl`).
- Shell injection eliminated in the desktop mail-app launcher — Thunderbird
  and UWP apps now route through `shell.openExternal(mailto:)` with
  sanitizers; UWP family name regex-gated; no more `{ shell: true }` execs.
- Encrypted-at-rest SMTP passwords and OAuth tokens via Electron
  `safeStorage` (`enc:v1:` prefix); startup pass re-encrypts any legacy
  plaintext rows idempotently.
- Safe migration runner: pre-run DB backup to `userData/backups/`, each
  migration wrapped in try/catch with a recoverable error message pointing
  at the backup file.
- Structured logging via `electron-log` — all 35 `console.log/error/warn`
  swept from the main process.
- Renderer + mobile error boundaries no longer leak `error.message`.
- Sentry wired in main / renderer / mobile — activates only when
  `ENVOY_SENTRY_DSN` / `VITE_SENTRY_DSN` / `SENTRY_DSN` is set. `beforeSend`
  redacts anything matching `/password|token|secret|apiKey|api_key/i`.
- Auto-update via `electron-updater` — checks on start and every 4 hours;
  publishes to GitHub Releases.
- Env-driven code signing for Windows and macOS (electron-builder reads
  `WIN_CSC_LINK`, `CSC_LINK`, `APPLE_ID`, etc.).
- Android release now requires `apps/mobile/android/keystore.properties`
  (gitignored); build fails safe if missing unless
  `ENVOY_ALLOW_UNSIGNED_RELEASE=true`.
- `DEPLOYMENT.md`, `apps/mobile/android/KEYSTORE.md`, and updated
  `.env.example` covering every runtime + release env var.
- Mobile settings now persist to the on-device DB (was a TODO).

### Changed
- Rewrote README to reflect real state (mobile shipped, Electron 31,
  RN 0.83, better-sqlite3 11, opt-in Sentry, no more "no telemetry"
  overclaim).
- Bumped Electron 28 → 31 LTS; better-sqlite3 9 → 11 (rebuilt for Electron
  31 ABI).
- Mobile `SettingsProvider` moved inside `DatabaseProvider` so
  `useDatabase()` resolves before Settings tries to hydrate.

### Fixed
- Mobile Phase 1 marked "done" but `MobileDatabaseService` was actually
  broken — every one of 119 `db.execute` call sites was missing `await`
  and used the removed `.rows._array` shape from an older op-sqlite. Bulk
  migrated to the async API.
- 15 pre-existing renderer TypeScript errors (ContactTimeline unknown
  ReactNode, DocumentEditor node-view attr mismatches, ReminderPanel
  Lucide title prop, ActivityLog missing category entries, misc null vs
  undefined coercions). Renderer now compiles clean under `tsc --noEmit`
  so it can gate CI.
- Broken `postinstall` in `apps/desktop/package.json` (invalid `--project`
  flag on `electron-builder install-app-deps`).

### Security
- Sandbox + CSP + navigation lockdown close the standard Electron escape
  vectors.
- All shell / mail / URL handoffs pass through explicit sanitizers with
  vitest coverage.
- SMTP + OAuth secrets are no longer stored in plaintext.
- IPC file-taking handlers reject control-byte paths and mismatched
  extensions before hitting `fs`.
- Migrations always take a backup before touching data.
