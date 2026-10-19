#!/usr/bin/env bash
# Encrypted backup of PostgreSQL (pg_dump custom format) + mirror of the S3 file
# bucket to an off-site S3-compatible store (Scaleway Object Storage in production).
#
# Usage:   scripts/backup.sh              (reads variables from the environment or .env.backup)
# Cron:    0 3 * * * /opt/sna/scripts/backup.sh >> /var/log/sna-backup.log 2>&1
#
# Required:
#   DATABASE_URL            postgresql://user:pass@host:port/db  (or PG_CONTAINER for docker exec)
#   BACKUP_DIR              local staging directory (default ./backups)
# Encryption (one of):
#   BACKUP_AGE_RECIPIENT    age public key (recommended; private key stays offline)
#   BACKUP_PASSPHRASE       passphrase for openssl enc -aes-256-cbc -pbkdf2
# Off-site (optional but expected in production):
#   BACKUP_S3_ALIAS_URL     https://s3.fr-par.scw.cloud   (or http://minio:9000 locally)
#   BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET_KEY
#   BACKUP_S3_BUCKET        destination bucket (default sna-backups)
#   S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET   source file bucket to mirror
# Tooling:
#   PG_CONTAINER            name of a docker container with pg_dump (used when pg_dump is not in PATH)
#   MC_BIN                  path to the MinIO client; falls back to `docker run minio/minio mc` on DOCKER_NETWORK
#   BACKUP_RETENTION_DAYS   local retention (default 14); off-site retention is a bucket lifecycle rule
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f .env.backup ]; then set -a; . ./.env.backup; set +a; fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-sna-backups}"
DOCKER_NETWORK="${DOCKER_NETWORK:-sous-nos-ailes_default}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# ── 1. pg_dump ───────────────────────────────────────────────────────────────
dump_cmd() {
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL:?DATABASE_URL required}"
  elif [ -n "${PG_CONTAINER:-}" ]; then
    docker exec "$PG_CONTAINER" pg_dump --format=custom --no-owner --no-privileges -U "${PG_USER:-sna}" "${PG_DB:-sna}"
  else
    docker run --rm --network "$DOCKER_NETWORK" postgres:17-alpine pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL:?DATABASE_URL required}"
  fi
}

# ── 2. encrypt ───────────────────────────────────────────────────────────────
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null 2>&1 || { echo "age not installed" >&2; exit 1; }
  OUT="$BACKUP_DIR/sna-db-$STAMP.dump.age"
  dump_cmd | age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT"
elif [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  OUT="$BACKUP_DIR/sna-db-$STAMP.dump.enc"
  dump_cmd | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"
else
  echo "Refusing to write an unencrypted backup: set BACKUP_AGE_RECIPIENT or BACKUP_PASSPHRASE" >&2
  exit 1
fi
( cd "$BACKUP_DIR" && { sha256sum "$(basename "$OUT")" 2>/dev/null || shasum -a 256 "$(basename "$OUT")"; } > "$(basename "$OUT").sha256" )
log "database dump written: $OUT ($(du -h "$OUT" | cut -f1))"

# ── 3. off-site copy (dump + mirror of the files bucket) ─────────────────────
mc_run() {
  if [ -n "${MC_BIN:-}" ]; then "$MC_BIN" "$@"
  elif command -v mc >/dev/null 2>&1; then mc "$@"
  else
    docker run --rm --network "$DOCKER_NETWORK" -v "$(cd "$BACKUP_DIR" && pwd):/backup" -v "${MC_CONFIG_DIR:-$HOME/.mc-sna}:/cfg" --entrypoint mc minio/minio --config-dir /cfg "$@"
  fi
}

if [ -n "${BACKUP_S3_ALIAS_URL:-}" ]; then
  mkdir -p "${MC_CONFIG_DIR:-$HOME/.mc-sna}"
  mc_run alias set offsite "$BACKUP_S3_ALIAS_URL" "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}" >/dev/null
  mc_run mb --ignore-existing "offsite/$BACKUP_S3_BUCKET" >/dev/null
  # Inside the mc container the staging dir is mounted at /backup; on the host it is $BACKUP_DIR.
  if [ -n "${MC_BIN:-}" ] || command -v mc >/dev/null 2>&1; then SRC_DIR="$BACKUP_DIR"; else SRC_DIR="/backup"; fi
  mc_run cp "$SRC_DIR/$(basename "$OUT")" "offsite/$BACKUP_S3_BUCKET/db/" >/dev/null
  mc_run cp "$SRC_DIR/$(basename "$OUT").sha256" "offsite/$BACKUP_S3_BUCKET/db/" >/dev/null
  log "dump copied to offsite/$BACKUP_S3_BUCKET/db/"
  if [ -n "${S3_ENDPOINT:-}" ]; then
    mc_run alias set source "$S3_ENDPOINT" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}" >/dev/null
    mc_run mirror --overwrite --quiet "source/${S3_BUCKET:-sna-files}" "offsite/$BACKUP_S3_BUCKET/files" >/dev/null
    log "files bucket mirrored to offsite/$BACKUP_S3_BUCKET/files"
  fi
else
  log "BACKUP_S3_ALIAS_URL not set: off-site copy skipped (local backup only)"
fi

# ── 4. local retention ───────────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'sna-db-*.dump.*' -mtime +"$BACKUP_RETENTION_DAYS" -delete
log "done"
