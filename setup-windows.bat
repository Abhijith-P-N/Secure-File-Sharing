@echo off
setlocal EnableExtensions DisableDelayedExpansion

title VaultGuard - Secure File Sharing Setup

echo ==============================================================
echo   VaultGuard - Secure File Sharing Platform
echo   Windows Setup
echo ==============================================================
echo.

REM ==============================================================
REM 0. Determine project directory
REM ==============================================================

set "ROOT=%~dp0"

echo [INFO] Project directory:
echo        %ROOT%
echo.

REM ==============================================================
REM 1. Check Node.js
REM ==============================================================

where.exe node >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo.
    echo Install Node.js LTS from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected.

node --version
echo.

REM ==============================================================
REM 2. Check npm
REM ==============================================================

where.exe npm.cmd >nul 2>&1

if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo.
    echo Reinstall Node.js and make sure npm is added to PATH.
    echo.
    pause
    exit /b 1
)

echo [OK] npm detected.

call npm.cmd --version
echo.

REM ==============================================================
REM 3. Check project folders
REM ==============================================================

if not exist "%ROOT%secure-file-backend\" (
    echo [ERROR] Backend folder not found:
    echo        %ROOT%secure-file-backend
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\" (
    echo [ERROR] Frontend folder not found:
    echo        %ROOT%frontend
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%secure-file-backend\package.json" (
    echo [ERROR] Backend package.json not found.
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\package.json" (
    echo [ERROR] Frontend package.json not found.
    echo.
    pause
    exit /b 1
)

echo [OK] Project structure detected.
echo.

REM ==============================================================
REM 4. Root .env
REM ==============================================================

echo [SETUP] Checking root .env...

if not exist "%ROOT%.env" (
    if exist "%ROOT%.env.example" (
        copy /Y "%ROOT%.env.example" "%ROOT%.env" >nul

        if errorlevel 1 (
            echo [ERROR] Could not create root .env.
            pause
            exit /b 1
        )

        echo [OK] Root .env created.
    ) else (
        echo [WARN] .env.example not found.
        echo        Skipping root .env creation.
    )
) else (
    echo [INFO] Root .env already exists.
)

echo.

REM ==============================================================
REM 5. Backend dependencies
REM ==============================================================

echo ==============================================================
echo [1/4] Installing backend dependencies
echo ==============================================================

pushd "%ROOT%secure-file-backend"

if errorlevel 1 (
    echo [ERROR] Could not enter backend directory.
    pause
    exit /b 1
)

call npm.cmd install

if errorlevel 1 (
    echo.
    echo [ERROR] Backend npm install failed.
    popd
    pause
    exit /b 1
)

echo.
echo [OK] Backend dependencies installed.
echo.

REM ==============================================================
REM 6. Backend .env
REM ==============================================================

if not exist ".env" (

    echo [SETUP] Creating backend .env...

    if not exist ".env.example" (
        echo [ERROR] secure-file-backend\.env.example not found.
        popd
        pause
        exit /b 1
    )

    copy /Y ".env.example" ".env" >nul

    if errorlevel 1 (
        echo [ERROR] Could not create backend .env.
        popd
        pause
        exit /b 1
    )

    echo [SETUP] Generating JWT secret...

    for /f "delims=" %%A in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "JWT_SECRET=%%A"

    echo [SETUP] Generating file encryption key...

    for /f "delims=" %%A in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "FILE_KEY=%%A"

    if not defined JWT_SECRET (
        echo [ERROR] Failed to generate JWT_SECRET.
        popd
        pause
        exit /b 1
    )

    if not defined FILE_KEY (
        echo [ERROR] Failed to generate FILE_ENCRYPTION_KEY.
        popd
        pause
        exit /b 1
    )

    echo [SETUP] Writing generated secrets...

    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
        "$p='.env';" ^
        "$c=Get-Content -Raw $p;" ^
        "$c=[regex]::Replace($c,'(?m)^JWT_SECRET=.*$','JWT_SECRET=%JWT_SECRET%');" ^
        "$c=[regex]::Replace($c,'(?m)^FILE_ENCRYPTION_KEY=.*$','FILE_ENCRYPTION_KEY=%FILE_KEY%');" ^
        "[System.IO.File]::WriteAllText($p,$c)"

    if errorlevel 1 (
        echo [ERROR] Failed to update backend .env.
        popd
        pause
        exit /b 1
    )

    echo [OK] Backend .env created with generated secrets.

) else (
    echo [INFO] Backend .env already exists.
)

popd

echo.

REM ==============================================================
REM 7. Frontend dependencies
REM ==============================================================

echo ==============================================================
echo [2/4] Installing frontend dependencies
echo ==============================================================

pushd "%ROOT%frontend"

if errorlevel 1 (
    echo [ERROR] Could not enter frontend directory.
    pause
    exit /b 1
)

call npm.cmd install

if errorlevel 1 (
    echo.
    echo [ERROR] Frontend npm install failed.
    popd
    pause
    exit /b 1
)

echo.
echo [OK] Frontend dependencies installed.

popd

echo.

REM ==============================================================
REM 8. Security module
REM ==============================================================

echo ==============================================================
echo [3/4] Security module
echo ==============================================================

if exist "%ROOT%security\" (
    echo [OK] Security module found.
    echo [INFO] No separate dependencies required.
) else (
    echo [WARN] Security folder not found.
)

echo.

REM ==============================================================
REM 9. Start services
REM ==============================================================

echo ==============================================================
echo [4/4] Starting VaultGuard
echo ==============================================================

echo.

REM --------------------------------------------------------------
REM Start local PostgreSQL
REM --------------------------------------------------------------

echo [START] Starting local PostgreSQL...

start "VaultGuard - Database" cmd /k "cd /d ""%ROOT%secure-file-backend"" && call npm.cmd run db:local"

echo [INFO] Waiting for database initialization...

timeout /t 15 /nobreak >nul

REM --------------------------------------------------------------
REM Apply database migrations
REM --------------------------------------------------------------

echo [START] Applying database migrations...
pushd "%ROOT%secure-file-backend"
call npm.cmd run db:migrate
if errorlevel 1 (
    echo.
    echo [ERROR] Database migration failed.
    popd
    pause
    exit /b 1
)
popd
echo [OK] Database migrations applied.

REM --------------------------------------------------------------
REM Start backend
REM --------------------------------------------------------------

echo [START] Starting backend API...

start "VaultGuard - Backend" cmd /k "cd /d ""%ROOT%secure-file-backend"" && call npm.cmd run dev"

REM --------------------------------------------------------------
REM Start frontend
REM --------------------------------------------------------------

echo [START] Starting frontend...

start "VaultGuard - Frontend" cmd /k "cd /d ""%ROOT%frontend"" && call npm.cmd run dev"

echo.

REM ==============================================================
REM 10. Complete
REM ==============================================================

echo ==============================================================
echo   VaultGuard startup initiated successfully!
echo ==============================================================
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo.
echo   Three separate windows should now be running:
echo.
echo     1. VaultGuard - Database
echo     2. VaultGuard - Backend
echo     3. VaultGuard - Frontend
echo.
echo   Database migrations are applied automatically before the backend starts.
echo.
echo   Keep those windows open while using VaultGuard.
echo.
echo ==============================================================
echo.

timeout /t 3 /nobreak >nul

REM Open browser
start "" "http://localhost:5173"

echo [OK] Browser launched.
echo.
echo Press any key to close this setup window.
pause >nul

endlocal
exit /b 0
