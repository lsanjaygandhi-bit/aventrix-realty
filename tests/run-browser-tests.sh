#!/bin/bash
# One-shot: build local DB (live-equivalent + migrations) → PostgREST → static server → Chromium tests → teardown.
cd "$(dirname "$0")/.."
bash tests/setup-local-stack.sh >/dev/null
for i in $(seq 1 20); do curl -s -o /dev/null localhost:3000/ && curl -s -o /dev/null localhost:8080/ && break; sleep 0.5; done
python3 tests/browser_e2e.py; rc=$?
pkill -f "/tmp/postgrest" ; pkill -f "http.server 8080"
exit $rc
