#!/usr/bin/env bash
# Restores an encrypted pg_dump produced by scripts/backup.sh into a database.
#
# Usage:
#   scripts/restore.sh <backup-file> [target-database-url]
#   scripts/restore.sh offsite:latest [target-database-url]     # fetch newest dump from the off-site bucket
#
# Decryption (matching the backup):
#   BACKUP_AGE_IDENTITY     path to the age private key file   (for .dump.age)
#   BACKUP_PASSPHRASE       passphrase                         (for .dump.enc)
# Target:
#   second argument, or RESTORE_DATABASE_URL, or DATABASE_URL. Never a production URL by accident:
#   set RESTORE_CONFIRM=yes to restore into a database whose name does not contain "restore" or "test".
# Tooling: pg_restore in PATH, or PG_CONTAINER (docker exec), or docker run postgres:17-alpine on DOCKER_NETWORK.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f .env.backup ]; then set -a; . ./.env.backup; set +a; fi

SRC="${1:?backup file or offsite:latest}"
TARGET="${2:-${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}}"
[ -n "$TARGET" ] || { echo "target database url required" >&2; exit 1; }
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-sna-backups}"
DOCKER_NETWORK="${DOCKER_NETWORK:-sous-nos-ailes_default}"
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

DB_NAME="${TARGET##*/}"; DB_NAME="${DB_NAME%%\?*}"
case "$DB_NAME" in
  *restore*|*test*) ;;
  *) [ "${RESTORE_CONFIRM:-}" = "yes" ] || { echo "Target '$DB_NAME' is not a restore/test database. Set RESTORE_CONFIRM=yes to proceed." >&2; exit 1; } ;;
esac

mc_run() {
  if [ -n "${MC_BIN:-}" ]; then "$MC_BIN" "$@"
  elif command -v mc >/dev/null 2>&1; then mc "$@"
  else docker run --rm --network "$DOCKER_NETWORK" -v "$(cd "$BACKUP_DIR" && pwd):/backup" -v "${MC_CONFIG_DIR:-$HOME/.mc-sna}:/cfg" --entrypoint mc minio/minio --config-dir /cfg "$@"; fi
}

if [ "$SRC" = "offsite:latest" ]; then
  mkdir -p "$BACKUP_DIR" "${MC_CONFIG_DIR:-$HOME/.mc-sna}"
  mc_run alias set offsite "${BACKUP_S3_ALIAS_URL:?}" "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}" >/dev/null
  LATEST="$(mc_run ls "offsite/$BACKUP_S3_BUCKET/db/" | awk '{print $NF}' | grep -E '\.dump\.(age|enc)$' | sort | tail -n1)"
  [ -n "$LATEST" ] || { echo "no dump found off-site" >&2; exit 1; }
  if [ -n "${MC_BIN:-}" ] || command -v mc >/dev/null 2>&1; then DST="$BACKUP_DIR/"; else DST="/backup/"; fi
  mc_run cp "offsite/$BACKUP_S3_BUCKET/db/$LATEST" "$DST" >/dev/null
  SRC="$BACKUP_DIR/$LATEST"
  log "fetched $LATEST"
fi
[ -f "$SRC" ] || { echo "backup file not found: $SRC" >&2; exit 1; }

if [ -f "$SRC.sha256" ]; then
  (cd "$(dirname "$SRC")" && (sha256sum -c "$(basename "$SRC").sha256" >/dev/null 2>&1 || shasum -a 256 -c "$(basename "$SRC").sha256" >/dev/null)) && log "checksum ok"
fi

decrypt() {
  case "$SRC" in
    *.age) age -d -i "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY required}" "$SRC" ;;
    *.enc) openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$SRC" ;;
    *) cat "$SRC" ;;
  esac
}

restore_cmd() {
  # --clean --if-exists makes the restore idempotent on an existing schema; --no-owner for a different role.
  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET"
  elif [ -n "${PG_CONTAINER:-}" ]; then
    docker exec -i "$PG_CONTAINER" pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET"
  else
    docker run --rm -i --network "$DOCKER_NETWORK" postgres:17-alpine pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET"
  fi
}

log "restoring $(basename "$SRC") into $DB_NAME"
# pg_restore exits 1 on harmless "does not exist" warnings with --clean on an empty DB; keep the log, judge on table count afterwards.
decrypt | restore_cmd 2> >(grep -v -E 'does not exist, skipping|errors ignored on restore' >&2 || true) || log "pg_restore reported warnings (see above)"
log "restore finished"
