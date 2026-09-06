# Contributing to Envoy

Envoy is currently a private personal project by Mohamed Shamil, but if you have access to the repo and want to make a change, please follow the process below.

## Ground rules

- **Runs locally, ships securely.** Any change that reaches an IPC handler, a shell command, or a file path must sanitize the input at the boundary. See `apps/desktop/src/main/services/security.ts` and `apps/desktop/src/main/services/ipc-validation.ts` for the existing helpers.
- **No new secrets in git.** `.env`, `keystore.properties`, `.jks`, `.pfx`, `.p12` are already gitignored — do not commit any of them. See `DEPLOYMENT.md` and `apps/mobile/android/KEYSTORE.md` for how to feed them in through CI secrets instead.
- **No `console.log` in main-process production code.** Use `logger` from `apps/desktop/src/main/services/logger.ts`. There's a lint sweep in the PR checklist for this.
- **Renderer and mobile error boundaries must not leak `error.message`.** Show a generic recovery message and log the detail.

## Development loop

```bash
# Install
npm install

# Run
npm run dev:desktop
# then in a second terminal:
cd apps/desktop && npm run start

# Or, for mobile:
npm run dev:mobile
# then in a second terminal:
cd apps/mobile && npm run android    # or npm run ios
```

## Before opening a PR

```bash
npm run verify    # runs typecheck + tests across every workspace
```

The `verify` workflow also runs in GitHub Actions on every push and PR; PRs blocked on a red run cannot merge.

## Testing

- **Desktop main process:** `vitest` in `apps/desktop/src/**/*.test.ts`. Mock `electron` via `vi.hoisted({ ... })` when the module under test imports it — see `secure-storage.test.ts` for the pattern.
- **Coverage focus:** sanitizers, IPC validation, credential encryption, and any pure helper you add. Don't chase coverage on Electron main-process wiring code that has no reasonable unit-test surface.

## Commit / PR style

- **Small, focused commits.** One conceptual change per commit; multi-file OK when the change is one concept.
- **Conventional-commit-ish subjects** — `feat:`, `fix:`, `chore:`, `docs:`, `build:`, `ci:`, `test:`, `refactor:`. Scope in parentheses when it clarifies (`feat(desktop): ...`, `fix(mobile): ...`).
- **Explain the *why* in the body.** The diff explains the *what*.
- Fill in the PR template.

## Security responsible-disclosure

If you spot a security issue, do NOT open a public issue. Message the maintainer privately and give them time to ship a fix before public disclosure.
