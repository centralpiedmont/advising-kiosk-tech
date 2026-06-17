#!/bin/bash
# Auto-refresh the Continuing Education catalog and redeploy the kiosk if it changed.
#  1. scrape-ce.mjs re-pulls the live CE catalog (prices, hours, descriptions, new/removed
#     courses). It is fail-safe: a bad scrape aborts without touching ce.json.
#  2. If ce.json changed: rebuild public/, commit + push, and `balena push` the fleet.
# Schedule it with the launchd plist in this folder (see kiosk/README.md).
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:$PATH"

cd "$(dirname "$0")" || exit 1           # kiosk/
REPO="$(cd .. && pwd)"
LOG="$REPO/ce-refresh.log"
FLEET="cpcc-degree-kiosk"
echo "===== CE refresh $(date) =====" >> "$LOG"

before="$(md5 -q ce.json 2>/dev/null || true)"
if ! node scrape-ce.mjs >> "$LOG" 2>&1; then
  echo "scrape aborted/failed — ce.json unchanged, nothing deployed" >> "$LOG"
  exit 0
fi
after="$(md5 -q ce.json 2>/dev/null || true)"
if [ "$before" = "$after" ]; then
  echo "no catalog changes — nothing to deploy" >> "$LOG"
  exit 0
fi

echo "catalog changed — rebuilding + deploying" >> "$LOG"
npm run build >> "$LOG" 2>&1 || { echo "build failed — aborting deploy" >> "$LOG"; exit 1; }
git -C "$REPO" add kiosk/ce.json >> "$LOG" 2>&1 || true
git -C "$REPO" commit -q -m "chore(kiosk): auto-refresh CE catalog" >> "$LOG" 2>&1 || true
git -C "$REPO" push -q >> "$LOG" 2>&1 || true
if balena push "$FLEET" >> "$LOG" 2>&1; then
  echo "deployed $(date)" >> "$LOG"
else
  echo "balena push failed (check login / network)" >> "$LOG"
  exit 1
fi
