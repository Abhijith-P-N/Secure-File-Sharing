@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title VaultGuard - Secure File Sharing Setup (Windows)

echo ==============================================================
echo   VaultGuard - Secure File Sharing Platform
echo   Windows all-in-one setup: checks, installs, configures,
echo   and launches the full stack.
echo ==============================================================
echo.

REM ---------------------------------------------------------------
REM 0) Pre-flight: require Node.js / npm
REM ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo.
    echo Download Node.js 20+ (LTS) from:  https://nodejs.org/
    echo After installing, close and reopen this terminal.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -p "process.versions.node"') do set NODE_VER=%%v
echo [OK] Node.js detected : v%NODE_VER%

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found. Reinstall Node.js and ensure npm is on PATH.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK] npm detected     : v%NPM_VER%
echo.

REM PowerShell available for key generation (used later)
where powershell >nul 2>nul
if errorlevel 1 (
    echo [WARN] PowerShell not found - will use Node.js for key generation.
)

REM ---------------------------------------------------------------
REM 1) Root .env (used by docker-compose only; keep in sync)
REM ---------------------------------------------------------------
if not exist "%~dp0.env" (
    echo [SETUP] Creating root .env from .env.example ...
    copy "%~dp0.env.example" "%~dp0.env" >nul
) else (
    echo [INFO] Root .env already exists - skipping.
)

REM ---------------------------------------------------------------
REM 2) Backend: install deps + create secure .env
REM ---------------------------------------------------------------
echo.
echo [1/4] Installing backend dependencies (secure-file-backend)...

pushd "%~dp0secure-file-backend"
call npm install

if errorlevel 1 (
    echo [ERROR] Backend npm install failed.
    popd
    pause
    exit /b 1
)

if not exist ".env" (
    echo [SETUP] Creating secure-file-backend/.env with generated keys ...
    copy ".env.example" ".env" >nul

    REM Generate random hex keys with Node
    for /f "delims=" %%j in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT_SECRET=%%j
    for /f "delims=" %%k in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set FILE_KEY=%%k

    REM Fill the keys
    powershell -NoProfile -Command ^
        "$f='.env'; $c=Get-Content $f; $c=$c -replace '(?m)^JWT_SECRET=.*$', 'JWT_SECRET=%JWT_SECRET%'; $c=$c -replace '(?m)^FILE_ENCRYPTION_KEY=.*$', 'FILE_ENCRYPTION_KEY=%FILE_KEY%'; Set-Content $f $c"

    echo [OK] Keys generated into secure-file-backend/.env
) else (
    echo [INFO] secure-file-backend/.env already exists - skipping.
)

popd

REM ---------------------------------------------------------------
REM 3) Frontend: install deps
REM ---------------------------------------------------------------
echo.
echo [2/4] Installing frontend dependencies (frontend)...

pushd "%~dp0frontend"
call npm install

if errorlevel 1 (
    echo [ERROR] Frontend npm install failed.
    popd
    pause
    exit /b 1
)

popd

REM ---------------------------------------------------------------
REM 4) Security module
REM ---------------------------------------------------------------
echo.
echo [3/4] Security module (security) - zero runtime deps, nothing to install.

REM ---------------------------------------------------------------
REM 5) Start everything
REM ---------------------------------------------------------------
echo.
echo [4/4] Starting services...
echo.

REM Start embedded PostgreSQL
echo   - Starting database (first run may download PostgreSQL binaries)...
start "VaultGuard - Database" cmd /k "cd /d %~dp0secure-file-backend && npm run db:local"

REM Give the DB time to initialise / download before backend connects
timeout /t 15 /nobreak >nul

REM Start backend API
echo   - Starting backend API  (http://localhost:8000)...
start "VaultGuard - Backend" cmd /k "cd /d %~dp0secure-file-backend && npm run dev"

REM Start frontend (Vite)
echo   - Starting frontend     (http://localhost:5173)...
start "VaultGuard - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ==============================================================
echo   Setup complete.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo ==============================================================
echo.
echo Opening the browser in a moment...
start "" http://localhost:5173

echo.
echo Each service runs in its own window. Close those windows to stop.
echo.
pause
endlocal