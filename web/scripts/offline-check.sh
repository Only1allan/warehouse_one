#!/usr/bin/env bash
# Proves the app works with no network at all.
#
# 1. Builds the app (needs no network).
# 2. Starts it inside a Linux network namespace that has ONLY a loopback interface:
#    no Wi-Fi, no Ethernet, no DNS, no internet. Nothing can leave the machine.
# 3. Runs the full backend check, including every AI feature, against it.
#
# Run "Prepare offline" (Readiness page) once, with the network on, before this.
# Usage: npm run offline:check
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3102
export NEXT_DIST_DIR=.next-offline
export NEXT_TELEMETRY_DISABLED=1
export WAREHOUSE_DB_PATH="$PWD/data/offline-check.db"

echo "Building..."
npx next build > /tmp/offline-check-build.log 2>&1 || { tail -30 /tmp/offline-check-build.log; exit 1; }

echo "Starting the app in a namespace with no network..."
unshare --user --map-root-user --net bash -c "
  set -e
  ip link set lo up
  if curl -s -m 3 -o /dev/null https://example.com; then echo 'Network is still reachable, aborting'; exit 1; fi
  echo 'Confirmed: no network in this namespace.'
  npx next start -p $PORT > /tmp/offline-check-server.log 2>&1 &
  for i in \$(seq 1 60); do curl -s -o /dev/null http://localhost:$PORT/ && break; sleep 1; done
  npx tsx scripts/smoke-api.mts --base http://localhost:$PORT --ai
"
