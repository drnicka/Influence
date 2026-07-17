#!/usr/bin/env bash
# present.sh — run Voice for a room: public HTTPS tunnel + server with correct
# share-link base URL. Ctrl-C stops both.
#
#   ./scripts/present.sh [port]      (default 3001)
#
# Uses cloudflared if installed (brew install cloudflared), otherwise falls
# back to localhost.run over plain ssh (zero install, less stable).
set -euo pipefail
PORT="${1:-${VOICE_PORT:-3001}}"
LOG="$(mktemp -t voice-tunnel)"

cleanup() { kill "${TUNNEL_PID:-}" "${SERVER_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if command -v cloudflared >/dev/null 2>&1; then
  echo "▶ starting cloudflared quick tunnel → localhost:$PORT"
  cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate > "$LOG" 2>&1 &
  TUNNEL_PID=$!
  URL=""
  for _ in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
    [ -n "$URL" ] && break
    sleep 1
  done
else
  echo "▶ cloudflared not found — using localhost.run over ssh (brew install cloudflared for a steadier tunnel)"
  ssh -o StrictHostKeyChecking=accept-new -R "80:localhost:$PORT" nokey@localhost.run > "$LOG" 2>&1 &
  TUNNEL_PID=$!
  URL=""
  for _ in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9]+\.lhr\.life' "$LOG" | head -1 || true)
    [ -n "$URL" ] && break
    sleep 1
  done
fi

if [ -z "$URL" ]; then
  echo "✗ tunnel failed to start — see $LOG" >&2
  exit 1
fi

echo "✔ tunnel live: $URL"
echo "▶ starting Voice on :$PORT with VOICE_PUBLIC_BASE_URL=$URL"
echo
echo "  Presenter flow: New public vote → Publish → the QR on screen points at the tunnel."
echo
VOICE_PORT="$PORT" VOICE_PUBLIC_BASE_URL="$URL" node "$(dirname "$0")/../server/index.js" &
SERVER_PID=$!
wait "$SERVER_PID"
