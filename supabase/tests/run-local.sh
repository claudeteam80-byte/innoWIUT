#!/usr/bin/env bash
# Applies all migrations to throwaway local Postgres clusters and runs the database tests.
#   1. all migrations → rls.test.sql + journey.test.sql
#   2. V1 migrations → V1-shaped fixture data → remaining migrations → compat.test.sql
#      (proves the V2.1 migrations keep existing production data intact)
# Requires Postgres server binaries (initdb, pg_ctl) on PATH or in PG_BIN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"
# First migration that is not part of the V1 schema.
V2_FIRST_VERSION="20261011000001"

stop_cluster() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK/data" "$WORK/log"
}
cleanup() {
  stop_cluster
  rm -rf "$WORK"
}
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Run as a non-root user (Postgres refuses to run as root)." >&2
  exit 1
fi

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)

start_cluster() {
  "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
  "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
  "${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stubs.sql"
}

apply() {
  echo "applying $(basename "$1")"
  "${PSQL[@]}" -f "$1"
}

echo "== Phase 1: schema, RLS and journey tests"
start_cluster
for migration in "$ROOT"/supabase/migrations/*.sql; do apply "$migration"; done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls.test.sql"
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/journey.test.sql"
stop_cluster

echo "== Phase 2: V1 data survives the V2.1 migrations"
start_cluster
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if [[ "$(basename "$migration")" < "$V2_FIRST_VERSION" ]]; then apply "$migration"; fi
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/compat/v1_fixture.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if [[ ! "$(basename "$migration")" < "$V2_FIRST_VERSION" ]]; then apply "$migration"; fi
done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/compat/compat.test.sql"
echo "database tests passed"
