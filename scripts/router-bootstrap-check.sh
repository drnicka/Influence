#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "[router-bootstrap] ERROR: .env not found in $ROOT_DIR"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${VOICE_ROUTER_URL:-}" ]]; then
  echo "[router-bootstrap] ERROR: VOICE_ROUTER_URL missing"
  exit 1
fi

NORMALIZED_URL="${VOICE_ROUTER_URL%/}"
if [[ "$NORMALIZED_URL" =~ /v1$ ]]; then
  NORMALIZED_URL="${NORMALIZED_URL%/v1}"
  echo "[router-bootstrap] Normalizing VOICE_ROUTER_URL to base /router"
  sed -i "s#^VOICE_ROUTER_URL=.*#VOICE_ROUTER_URL=${NORMALIZED_URL}#" .env
  export VOICE_ROUTER_URL="$NORMALIZED_URL"
fi

required=(
  VOICE_ROUTER_URL
  VOICE_INSTANCE_ID
  VOICE_ROUTER_TOKEN
  VOICE_ROUTER_HMAC_KEY
  VOICE_INTERNAL_ROUTER_KEY
)

missing=()
for k in "${required[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    missing+=("$k")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "[router-bootstrap] ERROR: missing vars: ${missing[*]}"
  exit 1
fi

echo "[router-bootstrap] Config summary"
echo "  VOICE_INSTANCE_ID=$VOICE_INSTANCE_ID"
echo "  VOICE_ROUTER_URL=$VOICE_ROUTER_URL"

echo "[router-bootstrap] Checking router public health..."
set +e
PUBLIC_OUT=$(curl -sS -i -H "Authorization: Bearer $VOICE_ROUTER_TOKEN" "$VOICE_ROUTER_URL/v1/health" 2>&1)
PUBLIC_RC=$?
set -e
if [[ $PUBLIC_RC -ne 0 ]]; then
  echo "[router-bootstrap] ERROR: public health failed"
  echo "$PUBLIC_OUT"
  exit 1
fi
echo "$PUBLIC_OUT" | head -n 1

echo "[router-bootstrap] Checking local internal health..."
set +e
INTERNAL_OUT=$(curl -sS -H "X-Voice-Internal-Key: $VOICE_INTERNAL_ROUTER_KEY" "http://127.0.0.1:3001/internal/router/health" 2>&1)
INTERNAL_RC=$?
set -e
if [[ $INTERNAL_RC -ne 0 ]]; then
  echo "[router-bootstrap] ERROR: internal health failed"
  echo "$INTERNAL_OUT"
  exit 1
fi

echo "$INTERNAL_OUT"

echo "[router-bootstrap] OK"
