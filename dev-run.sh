#!/usr/bin/env bash

# ==============================================================
# VaultGuard - Linux Development Launcher
#
# Starts:
#   1. Local PostgreSQL database
#   2. Backend API
#   3. Frontend (Vite)
#
# Usage:
#   ./dev-run.sh
#
# Press Ctrl+C to stop everything.
# ==============================================================

set -Eeuo pipefail

# --------------------------------------------------------------
# Project directories
# --------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/secure-file-backend"
FRONTEND="$ROOT/frontend"

# --------------------------------------------------------------
# Process IDs
# --------------------------------------------------------------

PIDS=()

# --------------------------------------------------------------
# Cleanup
# --------------------------------------------------------------

cleanup() {
    echo
    echo "=============================================================="
    echo "  Stopping VaultGuard..."
    echo "=============================================================="

    for pid in "${PIDS[@]:-}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping process $pid..."
            kill "$pid" 2>/dev/null || true
        fi
    done

    # Wait for children to exit
    wait 2>/dev/null || true

    echo
    echo "All VaultGuard services stopped."
    exit 0
}

trap cleanup INT TERM EXIT

# --------------------------------------------------------------
# Header
# --------------------------------------------------------------

echo "=============================================================="
echo "  VaultGuard - Secure File Sharing Platform"
echo "  Starting Database + Backend + Frontend"
echo "=============================================================="
echo

# --------------------------------------------------------------
# Check Node.js
# --------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed."
    echo
    echo "Install Node.js 20+ and try again."
    exit 1
fi

echo "[OK] Node.js: $(node --version)"

# --------------------------------------------------------------
# Check npm
# --------------------------------------------------------------

if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm is not installed."
    exit 1
fi

echo "[OK] npm: $(npm --version)"
echo

# --------------------------------------------------------------
# Check directories
# --------------------------------------------------------------

if [[ ! -d "$BACKEND" ]]; then
    echo "[ERROR] Backend directory not found:"
    echo "        $BACKEND"
    exit 1
fi

if [[ ! -d "$FRONTEND" ]]; then
    echo "[ERROR] Frontend directory not found:"
    echo "        $FRONTEND"
    exit 1
fi

if [[ ! -f "$BACKEND/package.json" ]]; then
    echo "[ERROR] Backend package.json not found."
    exit 1
fi

if [[ ! -f "$FRONTEND/package.json" ]]; then
    echo "[ERROR] Frontend package.json not found."
    exit 1
fi

echo "[OK] Project structure detected."
echo

# --------------------------------------------------------------
# Start Database
# --------------------------------------------------------------

echo "=============================================================="
echo "[1/3] Starting local PostgreSQL database"
echo "=============================================================="
echo

(
    cd "$BACKEND"
    npm run db:local
) &

DB_PID=$!
PIDS+=("$DB_PID")

echo "[OK] Database process started: PID $DB_PID"
echo

# --------------------------------------------------------------
# Wait for database
# --------------------------------------------------------------

echo "[INFO] Waiting for database to initialize..."

sleep 5

# --------------------------------------------------------------
# Start Backend
# --------------------------------------------------------------

echo
echo "=============================================================="
echo "[2/3] Starting backend API"
echo "=============================================================="
echo

(
    cd "$BACKEND"
    npm run dev
) &

BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

echo "[OK] Backend process started: PID $BACKEND_PID"
echo "     http://localhost:8000"
echo

# --------------------------------------------------------------
# Start Frontend
# --------------------------------------------------------------

echo "=============================================================="
echo "[3/3] Starting frontend"
echo "=============================================================="
echo

(
    cd "$FRONTEND"
    npm run dev
) &

FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")

echo "[OK] Frontend process started: PID $FRONTEND_PID"
echo "     http://localhost:5173"
echo

# --------------------------------------------------------------
# Startup complete
# --------------------------------------------------------------

echo "=============================================================="
echo "  VaultGuard is starting!"
echo "=============================================================="
echo
echo "  Database : Local PostgreSQL"
echo "  Backend  : http://localhost:8000"
echo "  Frontend : http://localhost:5173"
echo
echo "  Press Ctrl+C to stop all services."
echo "=============================================================="
echo

# --------------------------------------------------------------
# Keep script running
# --------------------------------------------------------------

wait
