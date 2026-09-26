#!/bin/bash
# DB-level RLS tests: 1) prove the live vulnerabilities on a live-equivalent
# baseline, 2) apply both migrations and run the full security matrix.
cd "$(dirname "$0")/.."
bash tests/setup-local-stack.sh baseline noseed >/dev/null; pkill -f /tmp/postgrest; pkill -f "http.server 8080"
python3 tests/db/run_tests.py baseline || exit 1
bash tests/setup-local-stack.sh migrated noseed >/dev/null; pkill -f /tmp/postgrest; pkill -f "http.server 8080"
python3 tests/db/run_tests.py p1
