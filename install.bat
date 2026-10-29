@echo off
setlocal enabledelayedexpansion

title JobTrack Installer

:: Ensure we are running in the directory containing this script
cd /d "%~dp0"

echo ============================================================
echo     JobTrack: Autonomous Job Scraper ^& AI Resume Studio
echo                   One-Click Local Installer
echo ============================================================
echo.

:: 1. Check Node.js Prerequisite
echo [*] Checking Node.js prerequisite...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [NOTICE] Node.js is not installed or not found in your PATH.
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        echo.
        set /p INSTALL_NODE="Would you like to install Node.js LTS automatically via winget? (Y/N): "
        if /i "!INSTALL_NODE!"=="Y" (
            echo [*] Installing Node.js LTS...
            winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            echo [*] Please close this window and run install.bat again to continue with the updated PATH.
            pause
            exit /b 0
        )
    )
    echo.
    echo [ERROR] Node.js is required to run JobTrack.
    echo Please download and install Node.js LTS from: https://nodejs.org
    echo After installation completes, re-run this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo     Found Node.js %NODE_VERSION%
echo.

:: 2. Determine project directory (clone/download if running standalone)
if not exist "web\package.json" (
    if exist "job-scraper\web\package.json" (
        cd /d "%~dp0job-scraper"
    ) else (
        echo [*] Project files not found locally. Fetching repository...
        where git >nul 2>&1
        if %errorlevel% equ 0 (
            echo [*] Cloning via Git...
            git clone https://github.com/anandanair/job-scraper.git
        ) else (
            echo [*] Git not found. Downloading repository archive via PowerShell...
            powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading repository...'; Invoke-WebRequest -Uri 'https://github.com/anandanair/job-scraper/archive/refs/heads/main.zip' -OutFile 'job-scraper.zip'; Expand-Archive -Path 'job-scraper.zip' -DestinationPath 'temp_extract' -Force; Move-Item -Path 'temp_extract\job-scraper-main' -Destination 'job-scraper'; Remove-Item -Path 'job-scraper.zip', 'temp_extract' -Recurse -Force"
        )
        if not exist "job-scraper\web\package.json" (
            echo [ERROR] Failed to obtain project files. Ensure an internet connection is available.
            pause
            exit /b 1
        )
        cd /d "%~dp0job-scraper"
    )
)

:: 3. Install dependencies
echo.
echo [*] Step 1/3: Installing project dependencies (Next.js, TypeScript Scraper, PDFKit)...
call npm --prefix web install
if %errorlevel% neq 0 (
    echo [WARNING] npm install reported warnings or errors. Continuing...
)

:: 4. Create Desktop Shortcut for daily usage
echo.
echo [*] Step 2/3: Creating Desktop Shortcut...
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
if exist "%DESKTOP_DIR%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_DIR%\JobTrack.lnk'); $s.TargetPath = '%CD%\start.bat'; $s.WorkingDirectory = '%CD%'; $s.Description = 'Launch JobTrack Dashboard'; $s.Save()" >nul 2>&1
    if exist "%DESKTOP_DIR%\JobTrack.lnk" (
        echo     Created 'JobTrack' shortcut on your Desktop!
    )
)

:: 5. Launch web server and browser
echo.
echo ============================================================
echo  [SUCCESS] JobTrack installation is complete!
echo  Desktop shortcut created: JobTrack
echo ============================================================
echo.
echo [*] Starting JobTrack on http://localhost:3000...
echo [*] Opening http://localhost:3000/setup in your browser...
echo [*] Dev server is running in this window (Press Ctrl+C to stop).
echo.

title JobTrack Server (Press Ctrl+C to stop)

:: Open browser asynchronously without opening a second console window
start /b cmd /c "ping -n 4 127.0.0.1 >nul && start http://localhost:3000/setup"

:: Run dev server directly in THIS window
cd /d "%CD%\web"
call npm run dev
