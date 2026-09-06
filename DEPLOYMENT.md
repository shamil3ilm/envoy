# Envoy Deployment

How to build, sign, and distribute Envoy to third-party users.

## Prerequisites

- Node 18+ and npm
- For Windows signing: a code-signing certificate (.pfx or EV token)
- For macOS signing: an Apple Developer account, a Developer ID Application cert, and a notarization app-specific password
- For Android signing: a release keystore (see `apps/mobile/android/KEYSTORE.md`)

## Desktop — Release builds

### Environment variables

Set these in your CI or local shell BEFORE running `npm run dist`. Never commit them.

| Variable | Purpose |
|----------|---------|
| `WIN_CSC_LINK` | Path or base64-encoded `.pfx` for Windows signing |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` |
| `CSC_LINK` | Path or base64-encoded `.p12` for macOS signing |
| `CSC_KEY_PASSWORD` | Password for the `.p12` |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_ID_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Team ID for notarization |
| `GH_TOKEN` | GitHub token with `repo` scope for publishing releases |

electron-builder reads these automatically. Signing is skipped only when the relevant vars are absent (unsigned local builds).

### Build commands

```
cd apps/desktop
npm run build          # compile TS + Vite
npm run dist           # produce signed installer + push to publish target
```

Output lands in `apps/desktop/release/`.

### Windows signing notes

- For consumer-grade certs, keep the `.pfx` off shared disks. Use CI secrets.
- For EV code-signing tokens (SafeNet, YubiKey), you must build on a host with the token attached. Cloud CI won't work unless you use a signing service (SignPath, Azure Trusted Signing).
- SmartScreen reputation builds over time even for signed apps — expect early users to see "unrecognized publisher" the first weeks.

### macOS signing + notarization

- Hardened runtime is required for notarization. electron-builder enables it by default.
- Notarization can take 5–30 minutes. Bake this into the release timeline.

## Desktop — Auto-update

- `electron-updater` is wired up in `src/main/services/updater.ts`.
- On app start (production only) it checks GitHub Releases for a newer version, downloads in the background, and installs on next quit.
- Update the `owner`/`repo` fields in `apps/desktop/package.json` → `build.publish` before your first release.
- Every release MUST be signed. Unsigned updates will fail with a signature mismatch error and leave users stuck on the old version.

## Mobile — Android release

See `apps/mobile/android/KEYSTORE.md` for keystore generation.

```
cd apps/mobile/android
./gradlew bundleRelease
```

Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` — upload this AAB to Play Console.

## Mobile — iOS release

TODO: iOS provisioning + Fastlane setup. Not yet wired.

## Secrets checklist before a release

- [ ] No `.env`, `keystore.properties`, `.jks`, `.pfx`, or `.p12` files staged in git
- [ ] `git ls-files | grep -iE '\.(env|jks|pfx|p12|keystore)$'` returns nothing
- [ ] CI secrets rotated after any suspected exposure
- [ ] `package.json` version bumped for both desktop and mobile

## Post-release monitoring

- Log file locations (once launched by a user):
  - Windows: `%APPDATA%/Envoy/logs/main.log`
  - macOS: `~/Library/Logs/Envoy/main.log`
  - Linux: `~/.config/Envoy/logs/main.log`
- Crash telemetry: wire Sentry (see `TODO: Sentry setup`) before wide distribution.
