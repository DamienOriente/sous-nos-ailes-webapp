#!/usr/bin/env bash
# Restore drill: takes a fresh encrypted backup, restores it into a throwaway
# database `sna_restore_test` on the local Postgres, and compares the number of
# tables (and a few row counts) with the source. Run it monthly and keep the
# output in docs/backup-restore.md.
#
# Usage: scripts/test-restore.sh            (local docker compose stack)
#   PG_CONTAINER  docker container running Postgres (default sous-nos-ailes-db-1)
#   KEEP_TEST_DB=1 keeps sna_restore_test afterwards for inspection
set -euo pipefail
cd "$(dirname "$0")/.."

PG_CONTAINER="${PG_CONTAINER:-sous-nos-ailes-db-1}"
PG_USER="${PG_USER:-sna}"
PG_DB="${PG_DB:-sna}"
TEST_DB="sna_restore_test"
export PG_CONTAINER PG_USER PG_DB
export BACKUP_DIR="${BACKUP_DIR:-./backups}"
export BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-restore-drill-local-only}"
unset BACKUP_AGE_RECIPIENT BACKUP_AGE_IDENTITY
# The drill only exercises the database path; off-site copy is tested by backup.sh itself.
unset BACKUP_S3_ALIAS_URL

psql_src() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "$1"; }
psql_test() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$TEST_DB" -tAc "$1"; }
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "1/4 backup"
scripts/backup.sh
LATEST="$(ls -t "$BACKUP_DIR"/sna-db-*.dump.enc | head -n1)"
log "using $LATEST"

log "2/4 recreate $TEST_DB"
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -tAc "drop database if exists $TEST_DB with (force);" >/dev/null
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -tAc "create database $TEST_DB;" >/dev/null

log "3/4 restore"
scripts/restore.sh "$LATEST" "postgresql://$PG_USER:${PG_PASSWORD:-sna}@localhost:5432/$TEST_DB"

log "4/4 compare"
SRC_TABLES="$(psql_src "select count(*) from information_schema.tables where table_schema='public'")"
DST_TABLES="$(psql_test "select count(*) from information_schema.tables where table_schema='public'")"
printf 'tables: source=%s restored=%s\n' "$SRC_TABLES" "$DST_TABLES"
STATUS=0
for t in users professional_categories plans configuration_settings professionals events; do
  s="$(psql_src "select count(*) from $t")"; d="$(psql_test "select count(*) from $t")"
  printf 'rows %-24s source=%-6s restored=%-6s %s\n' "$t" "$s" "$d" "$([ "$s" = "$d" ] && echo ok || { echo MISMATCH; STATUS=1; })"
done
[ "$SRC_TABLES" = "$DST_TABLES" ] || STATUS=1

if [ "${KEEP_TEST_DB:-0}" != "1" ]; then
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -tAc "drop database if exists $TEST_DB with (force);" >/dev/null
  log "dropped $TEST_DB"
fi
if [ "$STATUS" = "0" ]; then log "RESTORE DRILL OK"; else log "RESTORE DRILL FAILED"; fi
exit "$STATUS"
