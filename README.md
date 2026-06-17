# CPCC Degree Explorer Kiosk

An offline-first touchscreen web app for exploring Central Piedmont's 14 IT degree programs. Runs on a Raspberry Pi via balenaCloud at recruitment events (open houses, advising days, career fairs).

Students walk through a guided "Find Your Path" funnel — interest world → specialization → program match — and land on a program detail card with three convert actions:

- **QR degree sheet** — scan with your own phone to get the PDF (no venue Wi-Fi needed)
- **Sign up for an info session** — QR to the CPCC Microsoft Form
- **Email this** — on-screen keyboard captures email, queued in outbox, delivered when the Pi is back online

---

## Data flow

Content comes from two sources that share a single build step:

| Source | What it provides |
|---|---|
| `../build/sheets.json` | Program data (titles, descriptions, courses, credits, color families) |
| `careers.json` | BLS salary and employment-outlook data per program |

`node generate.js` reads both, produces `public/kiosk-data.json`, and copies hero photos, logos, and QR PNG assets into `public/assets/`.

`node gen-qr.js` generates the QR PNGs for each program's degree-sheet PDF and info-session form.

`../build/sheets.json` is the **single source of truth** shared with the print degree sheets — edit it there, not here.

---

## Commands

```bash
# Install dependencies (qrcode, nodemailer)
npm install

# Regenerate kiosk-data.json, QR PNGs, and asset copies
npm run build

# Run the local dev server (then point Chromium at http://localhost:8080)
npm start

# Run the full test suite (node:test, ~30 tests)
npm test
```

`npm run build` runs `node generate.js && node gen-qr.js`. Re-run it any time `../build/sheets.json` or `careers.json` changes.

---

## Architecture

### Build / server files

| File | Purpose |
|---|---|
| `world-map.js` | 5-world taxonomy: maps interest areas to degree families |
| `derive.js` | Field helpers: derives display fields (salary range, world label, color family, etc.) from raw JSON |
| `generate.js` | Build script: reads `sheets.json` + `careers.json`, emits `public/kiosk-data.json`, copies assets |
| `gen-qr.js` | Generates one QR PNG per program (degree-sheet PDF URL + info-session form URL) into `public/assets/qr/` |
| `outbox.js` | Lead-capture queue: appends email capture events to `data/outbox.jsonl` |
| `mailer.js` | Renders lead-capture emails (HTML + plain text) and drains the outbox via SMTP |
| `server.js` | Static file server on `PORT`; handles `POST /email` (writes to outbox) and runs the SMTP drain loop |
| `careers.json` | BLS salary and employment-outlook data (one object per program ID) |

### Front-end (`public/`)

| File | Purpose |
|---|---|
| `index.html` | Single-page shell; all UI is injected by `app.js` |
| `state.js` | Funnel state machine: `IDLE → WORLD → PROGRAM → DETAIL`; manages auto-reset timer |
| `app.js` | Renderers for each funnel state + idle-reset logic; reads `kiosk-data.json` |
| `keyboard.js` | On-screen keyboard for email capture (no physical keyboard at the kiosk) |
| `styles.css` | Central Piedmont brand: typography, track colors, touch-target sizing, idle overlay |

### Test files (`test/`)

Seven `node:test` suites cover `world-map`, `derive`, `generate`, `outbox`, `mailer`, `server`, and `state` (~30 assertions total). Run with `npm test`.

---

## The three convert actions

Each program detail card offers:

1. **Degree sheet QR** — encodes `https://frazier-at-cpcc.github.io/cpcc-it-degree-sheets/sheets/<id>.pdf`. Students scan with their own phone; no venue Wi-Fi required because the PDF lives on GitHub Pages.

2. **Information session sign-up QR** — encodes the CPCC Microsoft Form URL for that program. Stored in `careers.json` per program.

3. **Email this** — opens the on-screen keyboard. The captured address and program ID are POSTed to `POST /email`, appended to `data/outbox.jsonl`, and emailed when the Pi next has internet access.

---

## Environment variables

Set these in the balena fleet dashboard (or a local `.env` for dev). The server reads them at startup.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port the server listens on |
| `KIOSK_DATA_DIR` | `./data` (`/data` in container) | Directory for `outbox.jsonl` lead captures |
| `SMTP_HOST` | _(unset)_ | SMTP server hostname; **when unset, email drain is disabled** — leads queue safely |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | _(unset)_ | SMTP auth username |
| `SMTP_PASS` | _(unset)_ | SMTP auth password |
| `MAIL_FROM` | `no-reply@cpcc.edu` | From address on outbound lead-capture emails |

**Offline-safe by design:** when `SMTP_HOST` is unset, the drain loop simply does not run. Leads accumulate in `data/outbox.jsonl` and are sent in batch once the device reconnects and the env var is set. This is an open item — fill in real SMTP credentials before deploying to a production fleet.

---

## balena deploy

The kiosk runs as two containers on the Pi: the Node server (`kiosk`) and the [`balenalabs/browser`](https://github.com/balena-io-experimental/browser) block (Chromium in kiosk mode, pointed at `http://kiosk:8080`). The compose image is `bh.cr/balenalabs/browser-<arch>` — `aarch64` for the Raspberry Pi 5.

```bash
# 1. Authenticate and create the fleet (one-time)
balena login
balena fleet create cpcc-degree-kiosk --type raspberrypi4-64

# 2. Set environment variables on the fleet
balena env add SMTP_HOST     smtp.example.org   --fleet cpcc-degree-kiosk
balena env add SMTP_PORT     587                --fleet cpcc-degree-kiosk
balena env add SMTP_USER     kiosk@cpcc.edu     --fleet cpcc-degree-kiosk
balena env add SMTP_PASS     <secret>           --fleet cpcc-degree-kiosk
balena env add MAIL_FROM     no-reply@cpcc.edu  --fleet cpcc-degree-kiosk

# 3. Push and build (from the kiosk/ directory)
cd kiosk && balena push cpcc-degree-kiosk
```

**Provisioning a device:**

1. Download balenaOS for the `raspberrypi4-64` fleet and flash to a microSD card (use Etcher).
2. Boot the Pi — it registers automatically with the fleet.
3. Attach the 27" touchscreen. Set landscape orientation via the fleet display config variables in the balena dashboard (`BALENA_HOST_CONFIG_display_rotate`, `RESIN_HOST_CONFIG_display_rotate`).
4. The two containers (`kiosk` and `browser`) start automatically on every boot.

**Architecture note:** the `browser` block image tag in `docker-compose.yml` ends in `-aarch64` — this must match the Pi's architecture. If you switch Pi models, update that tag.

**Lead retrieval:** leads in `data/outbox.jsonl` are either drained automatically via SMTP when the Pi has internet, or you can download the file directly from the balena device dashboard (Terminal → `cat /data/outbox.jsonl`).

---

## Offline behavior

The app runs entirely offline at events. The Pi does not require venue Wi-Fi to function:

- All program data, images, and front-end assets are bundled on-device.
- Degree-sheet QR codes encode GitHub Pages URLs — students scan them with their own phones on cellular.
- Info-session QR codes work the same way.
- Email captures queue to disk and are drained the next time the device is online (e.g., back on campus).

The only things that require internet: balena OTA updates (pull updates when on campus before each event) and outbound SMTP for lead capture.

---

## Design spec

`docs/superpowers/specs/2026-06-09-degree-explorer-kiosk-design.md`

## Keeping the Continuing Education catalog fresh

CE prices, dates, descriptions, and the course list change as new sections post. Two pieces keep the kiosk current:

- **`scrape-ce.mjs`** — re-pulls the live CE catalog (via `curl`; the site blocks Node's fetch) and rewrites `ce.json`. It is **fail-safe**: it preserves the curated category grouping + short display names, drops courses no longer offered, files brand-new courses under "More IT Training" for you to recategorize, and **aborts without writing** if the live listing returns fewer than 70% of the courses it already has (so a flaky scrape can never wipe the catalog).
- **`refresh.sh`** — runs the scrape; if `ce.json` changed it rebuilds `public/`, commits/pushes, and `balena push`es the fleet. Run it manually any time, or on a schedule.

Scheduled weekly via launchd (`com.cpcc.kiosk-ce-refresh.plist`, Mondays 6 AM):

```bash
cp kiosk/com.cpcc.kiosk-ce-refresh.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.cpcc.kiosk-ce-refresh.plist   # enable
launchctl unload ~/Library/LaunchAgents/com.cpcc.kiosk-ce-refresh.plist # disable
```

Logs: `ce-refresh.log` (and `ce-refresh.out/err.log`). Requires the Mac to be on and `balena` logged in.

---

## Live preview (GitHub Pages)

The prebuilt static frontend in `public/` is published to GitHub Pages on every
push to `main` via `.github/workflows/pages.yml`:

**https://centralpiedmont.github.io/advising-kiosk-tech/**

The guided funnel, QR degree sheets, and info-session links work as static
content. The **"Email this"** capture POSTs to the Node `server.js` `/email`
endpoint, which Pages does not run — that feature works only on the Raspberry Pi
deployment. `public/` is generated by `node generate.js` (which reads
`../build/sheets.json`); the built output is committed so Pages can serve it.
