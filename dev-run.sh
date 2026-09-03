#!/usr/bin/env bash
#
# dev-run.sh — start the whole stack (Database + Backend + Frontend) with ONE command.
#
#   ./dev-run.sh          # start all services (Ctrl+C to stop)
#
# Data persists in ./secure-file-backend/.localdb/data across restarts.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/secure-file-backend"
FRONTEND="$ROOT/frontend"

PIDS=()

cleanup() {
  echo ""
  echo "Stopping all services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All services stopped."
  exit 0
}

trap cleanup INT TERM

echo "=============================================================="
echo "  VaultGuard — starting Database + Backend + Frontend"
echo "=============================================================="

# 1) Database (persistent embedded PostgreSQL)
echo ""
echo "[1/3] Starting database ..."
( cd "$BACKEND" && npm run db:local ) &
PIDS+=($!)

# Give the DB a moment to come up before the backend connects.
sleep 4

# 2) Backend API
echo ""
echo "[2/3] Starting backend API ..."
( cd "$BACKEND" && npm run dev ) &
PIDS+=($!)

# 3) Frontend (Vite)
echo ""
echo "[3/3] Starting frontend ..."
( cd "$FRONTEND" && npm run dev ) &
PIDS+=($!)

echo ""
echo "=============================================================="
echo "  All services launching. Press Ctrl+C to stop everything."
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:8000"
echo "=============================================================="

wait
