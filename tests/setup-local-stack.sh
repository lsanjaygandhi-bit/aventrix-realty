#!/bin/bash
# Rebuilds the local test stack: Postgres (live-equivalent schema +
# both migrations) → PostgREST :3000 → static site :8080.
set -e
cd "$(dirname "$0")/.."
pg_lsclusters 2>/dev/null | grep -q online || setsid service postgresql start >/dev/null 2>&1 < /dev/null || true; sleep 1
psql -X -q -d postgres -c "select 1" >/dev/null 2>&1 || su postgres -c "psql -q -c 'create role root superuser login'" >/dev/null 2>&1 || true
dropdb --force --if-exists aventrix_test; createdb aventrix_test
P="psql -X -q -v ON_ERROR_STOP=1 -d aventrix_test"
$P -f tests/db/00-supabase-stub.sql >/dev/null 2>&1
for f in schema schema-cms-extension schema-cms-extension-2 schema-quickview-extension schema-property-specs-extension schema-search-filter-extension schema-live-drift-capture-2026-09-25; do $P -f sql/$f.sql >/dev/null 2>&1; done
$P -f tests/db/10-live-policies-baseline.sql >/dev/null 2>&1
if [ "$1" != "baseline" ]; then
  $P -f sql/migration-2026-09-25-01-p0-security-roles.sql >/dev/null 2>&1
  $P -f sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql >/dev/null 2>&1
  $P -f sql/migration-2026-09-25-03-content-drafts.sql >/dev/null 2>&1
fi
[ "$2" != "noseed" ] && { $P -f tests/db/20-browser-seed.sql >/dev/null 2>&1 || true; }
pkill -f "postgrest" || true; pkill -f "http.server 8080" || true; sleep 1
setsid nohup /tmp/postgrest /tmp/pgrst.conf > /tmp/pgrst.log 2>&1 < /dev/null &
setsid nohup python3 -m http.server 8080 > /tmp/http.log 2>&1 < /dev/null &
sleep 2; echo "stack up"
