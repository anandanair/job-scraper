@echo off
setlocal enabledelayedexpansion

title JobTrack (Press Ctrl+C to Stop)

:: Resolve directory containing this script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Check if running inside repo or in parent directory
if not exist "web\package.json" (
    if exist "job-scraper\web\package.json" (
        cd /d "%SCRIPT_DIR%job-scraper"
        set "SCRIPT_DIR=%CD%\"
    ) else (
        echo [ERROR] JobTrack files not found!
        echo Please run install.bat first to set up the project.
        pause
        exit /b 1
    )
)

echo ============================================================
echo       JobTrack: Autonomous Job Scraper ^& AI Studio
echo ============================================================
echo.

:: 1. Check Node.js prerequisite
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js LTS from: https://nodejs.org
    pause
    exit /b 1
)

:: 2. Auto-Check for updates from GitHub (if Git is installed)
if exist ".git" call :CHECK_UPDATES
goto :LAUNCH_APP

:CHECK_UPDATES
where git >nul 2>&1
if %errorlevel% neq 0 goto :eof

echo [*] Checking for updates from GitHub...
git fetch origin main --quiet 2>nul
set BEHIND=0
for /f %%i in ('git rev-list HEAD..origin/main --count 2^>nul') do set BEHIND=%%i

if "%BEHIND%" gtr "0" (
    echo.
    echo [*] Update available: %BEHIND% new commit^(s^) found on GitHub.
    echo [*] Pulling latest updates...
    git pull origin main --quiet
    echo [*] Updating dependencies...
    call npm --prefix web install
    echo [SUCCESS] JobTrack is now updated to the latest version!
    echo.
) else (
    echo     JobTrack is up to date.
    echo.
)
goto :eof

:LAUNCH_APP
echo [*] Starting JobTrack server on http://localhost:3000...
echo [*] Opening http://localhost:3000 in your browser...
echo [*] Keep this window open while using JobTrack.
echo     (Press Ctrl+C anytime to stop).
echo ------------------------------------------------------------
echo.

:: Asynchronously open the browser after a 4-second delay without creating a new console window
start /b cmd /c "ping -n 5 127.0.0.1 >nul && start http://localhost:3000"

:: Run the dev server directly in THIS single window
cd /d "%SCRIPT_DIR%web"
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The JobTrack dev server stopped with an error code: %errorlevel%
    pause
)
