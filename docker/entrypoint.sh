#!/bin/sh
# Generates the local session secret on first launch (persisted in the
# app-secrets volume, mode 600) and starts the server.
set -eu

SECRETS_DIR="${SECRETS_DIR:-/app/.secrets}"
KEY_FILE="$SECRETS_DIR/session.key"

if [ -z "${SESSION_SECRET:-}" ]; then
  if [ ! -f "$KEY_FILE" ]; then
    mkdir -p "$SECRETS_DIR"
    umask 077
    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo "[entrypoint] generated session secret at $KEY_FILE"
  fi
  SESSION_SECRET="$(cat "$KEY_FILE")"
  export SESSION_SECRET
fi

exec "$@"
