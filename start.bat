@echo off
setlocal enabledelayedexpansion

title JobTrack Launcher

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
echo                      Daily Launcher
echo ============================================================
echo.
echo [*] Checking Node.js prerequisite...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js LTS from: https://nodejs.org
    pause
    exit /b 1
)

echo [*] Starting JobTrack web server on http://localhost:3000...
echo [*] DEV SERVER WINDOW: Keep the server window open while using JobTrack.
echo.

:: Launch the dev server in a new dedicated window
start "JobTrack Dev Server" cmd /k "cd /d "%CD%\web" && npm run dev"

:: Wait briefly for server startup
echo [*] Opening JobTrack in your browser...
ping -n 4 127.0.0.1 >nul
start http://localhost:3000

echo.
echo ============================================================
echo  [SUCCESS] JobTrack is running!
echo  Web Dashboard: http://localhost:3000
echo ============================================================
echo.
echo You can close this launcher window now.
timeout /t 5 >nul
exit /b 0

