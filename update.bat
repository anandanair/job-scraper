@echo off
setlocal enabledelayedexpansion

title JobTrack Updater

:: Ensure we run in the repository directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

if not exist "web\package.json" (
    if exist "job-scraper\web\package.json" (
        cd /d "%SCRIPT_DIR%job-scraper"
    ) else (
        echo [ERROR] JobTrack directory not found!
        pause
        exit /b 1
    )
)

echo ============================================================
echo      JobTrack: Autonomous Job Scraper ^& AI Studio
echo                     System Updater
echo ============================================================
echo.

if exist ".git" (
    where git >nul 2>&1
    if %errorlevel% equ 0 (
        echo [*] Git repository detected. Checking for updates...
        git pull origin main
        echo.
        echo [*] Updating dependencies...
        call npm --prefix web install
        echo.
        echo ============================================================
        echo  [SUCCESS] JobTrack has been updated to the latest version!
        echo ============================================================
        echo.
        pause
        exit /b 0
    )
)

echo [*] Standalone archive installation detected. Fetching latest version from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading update...'; Invoke-WebRequest -Uri 'https://github.com/anandanair/job-scraper/archive/refs/heads/main.zip' -OutFile 'update-temp.zip'; Expand-Archive -Path 'update-temp.zip' -DestinationPath 'update-temp' -Force; Copy-Item -Path 'update-temp\job-scraper-main\*' -Destination . -Recurse -Force; Remove-Item -Path 'update-temp.zip', 'update-temp' -Recurse -Force"

echo.
echo [*] Updating project dependencies...
call npm --prefix web install

echo.
echo ============================================================
echo  [SUCCESS] JobTrack has been updated to the latest version!
echo ============================================================
echo.
pause
exit /b 0
