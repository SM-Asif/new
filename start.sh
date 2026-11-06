#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"

echo "==> Installing server dependencies"
(cd "$SERVER" && npm install --silent)

echo "==> Installing client dependencies"
(cd "$CLIENT" && npm install --silent)

echo "==> Starting API server (http://localhost:4000)"
(cd "$SERVER" && npm run dev > /tmp/hunter-server.log 2>&1 &)
echo $! > /tmp/hunter-server.pid

echo "==> Starting UI dev server (http://localhost:5173)"
(cd "$CLIENT" && npm run dev > /tmp/hunter-client.log 2>&1 &)
echo $! > /tmp/hunter-client.pid

sleep 3
echo ""
echo "==> News Domain Hunter is running"
echo "    UI:        http://localhost:5173"
echo "    API:       http://localhost:4000"
echo "    Server log: /tmp/hunter-server.log"
echo "    Client log: /tmp/hunter-client.log"
echo ""
echo "To stop: kill \$(cat /tmp/hunter-server.pid) \$(cat /tmp/hunter-client.pid)"
