# LAN Sync

Envoy's mobile app can pull and push data against the desktop app over the local network, no cloud roundtrip. This doc covers the security posture, the setup flow, and troubleshooting.

## Design

**One-way host, two-way flow.** The desktop hosts an HTTP endpoint bound to `0.0.0.0:47828` on the LAN. The mobile app initiates every sync: it either **pulls** the desktop's envelope and merges it into its own DB, or **pushes** the mobile envelope for the desktop to merge. There is no ambient background sync.

**Same envelope shape.** Sync reuses the same JSON envelope format as manual backup export. The receive side reuses the same `restoreEnvelope` / `restoreMobileBackup` merge (additive upsert by id — never deletes).

**Off by default.** New installs do not run the sync server. It only starts when the user explicitly enables it via `Ctrl+K → Enable LAN Sync Server`, and it stops when the app quits.

## Security posture

| Concern | Mitigation |
|---|---|
| Anyone on the LAN can hit `:47828` | `X-Envoy-Token` header required on every route except `/ping`. Constant-time compare guards against timing side-channels. |
| Ping is unauthenticated | Deliberate — mobile needs it to distinguish "wrong IP" from "wrong token." Ping only returns `{ ok, appVersion }`, no data. |
| Token pasted in mobile could leak in logs | Mobile input uses `secureTextEntry`; RN redacts on screen recording. Rotate any time via `Ctrl+K → Rotate LAN Sync Token`. |
| Envelope contains user data | Traffic is on the LAN only. Not encrypted at transport (no HTTPS). Treat the LAN as trusted. If it isn't, don't enable sync. |
| Client hammering / DoS | In-memory rate limit — 60 requests per minute per source IP. Returns `429` once the budget is exhausted. |
| Body size DoS | `POST /envelope` body capped at 100 MB. Larger uploads are refused and the connection destroyed. |
| Token stored in the DB | Same at-rest protection as everything else on desktop — `safeStorage` on the SQLite file's sensitive fields. The sync token specifically is stored plain in `AppSettings.sync.token` because losing access to it means losing the ability to configure the server, which is a bigger problem than a leaked token (which can be rotated instantly). |

**What this does NOT protect against:**
- **A compromised host on the same LAN.** If someone else's laptop on your Wi-Fi is malicious, they can attempt token guesses at 60/min. With a 32-char hex token (128 bits of entropy) this is not a realistic attack, but rotate the token if you suspect the LAN is hostile.
- **Traffic sniffing on the LAN.** HTTP not HTTPS. On a shared network (café Wi-Fi, hotel, coworking) the envelope contents will be readable by anyone running tcpdump. Do not enable sync on untrusted networks.
- **Man-in-the-middle.** No cert pinning. If your router is compromised (rare), a MITM could serve a spoofed envelope.

## Setup

### On desktop

1. `Ctrl+K → Enable LAN Sync Server`
   - Generates a token if you don't have one yet
   - Starts the HTTP server on port `47828`
   - Copies the endpoint URLs + token to the clipboard as a summary

2. `Ctrl+K → Show LAN Sync QR Code`
   - Writes a 512 px PNG to `userData/sync-qr.png` and opens it with the OS image viewer
   - Encodes `envoy://sync?url=<endpoint>&token=<token>` — every modern phone camera reads this

3. Alternative — `Ctrl+K → Copy LAN Sync Pairing URL`
   - Copies the same pairing string to the clipboard so you can email or message it to yourself

### On mobile

1. Open **Settings → 🔗 LAN Sync**
2. Paste the pairing URL into the URL field
   - Both URL and token auto-fill and a toast confirms
   - Manual entry still works if you'd rather type
3. Tap **Ping** to confirm reachability
   - Success toast: "Desktop reachable — Envoy 1.0.0"
   - Failure: check that your phone and desktop are on the same subnet and that `47828` isn't blocked
4. **Pull** to fetch the desktop's envelope and merge it into the phone
5. **Push** to send the phone's envelope to the desktop

## Firewall notes

- **Windows Defender Firewall**: on first launch, Windows will prompt to allow Node's HTTP server to accept incoming connections. Approve for Private networks only.
- **macOS**: same prompt via the built-in application firewall.
- **Linux**: `ufw allow 47828/tcp` if you have UFW enabled.
- **Corporate networks**: some managed networks block peer-to-peer traffic entirely. If Ping fails, your admin probably has intra-subnet blocking enabled. Move to a home network or hotspot.

## Rotating the token

- `Ctrl+K → Rotate LAN Sync Token`
- Generates a fresh 32-char hex token
- Restarts the server so the new token takes effect immediately
- Every previously-paired mobile device will start getting `401 Unauthorized` and needs to be re-paired

## Troubleshooting

**Mobile Ping succeeds but Pull returns 401**
Wrong token. Copy it again from the desktop side (Ctrl+K → Show LAN Sync Info) or rotate.

**Ping fails with "Network error"**
Not reachable at all. Confirm both devices are on the same subnet (`ipconfig` on Windows, `ifconfig` on macOS/Linux). Confirm the desktop server is actually running via Ctrl+K → Show LAN Sync Info.

**Pull returns 429**
Rate limited. Wait 60 seconds. If this happens without you triggering many pulls, something on your LAN is hitting `47828` — investigate.

**Push returns 400 with a body error**
Body larger than 100 MB. Your DB has grown huge — VACUUM it (Ctrl+K → Compact Database) or split the sync by disabling entities you don't need.

**Restore result says X applied and Y skipped**
Skipped rows are usually rows without an id or rows whose shape didn't match what the DB expected. Check `main.log` (userData/logs/) for the specific reason. The rest of the sync did land.

## What's NOT in the MVP

Reserved for future work — not planned near-term:
- **Discovery.** No mDNS/Bonjour advertising. Users type IPs or scan QR.
- **Delta sync.** Every sync sends the full envelope. Fine for MBs, painful for GBs.
- **Conflict resolution UI.** Last-writer-wins by `updatedAt` on the merge. If both sides edit the same row, the newer one wins silently.
- **HTTPS.** Transport is HTTP. On a trusted LAN this is acceptable; on a shared network it isn't.
- **Multi-peer sync.** Only one desktop at a time. If you have two, the mobile has to reconfigure between them.
