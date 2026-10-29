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
if exist ".git" (
    where git >nul 2>&1
    if %errorlevel% equ 0 (
        echo [*] Checking for updates from GitHub...
        git fetch origin main --quiet 2>nul
        for /f %%i in ('git rev-list HEAD..origin/main --count 2^>nul') do set BEHIND=%%i
        if defined BEHIND (
            if !BEHIND! gtr 0 (
                echo.
                echo [*] Update available: !BEHIND! new update(s) found on GitHub!
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
        )
    )
)

echo [*] Starting JobTrack web server on http://localhost:3000...
echo [*] Dev server is running in this window (Press Ctrl+C to stop).
echo.

:: Asynchronously open the browser after a 3-second delay without creating a new window
start /b cmd /c "ping -n 4 127.0.0.1 >nul && start http://localhost:3000"

:: Run the dev server directly in THIS single window
cd /d "%CD%\web"
call npm run dev
