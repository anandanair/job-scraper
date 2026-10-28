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

:: 1. Check Node.js
echo [*] Checking Node.js prerequisite...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in your PATH!
    echo Please install Node.js v20+ from: https://nodejs.org
    echo After installing, reopen this script.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo     Found Node.js %NODE_VERSION%

:: 2. Check Python
echo [*] Checking Python prerequisite...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not found in your PATH!
    echo Please install Python v3.10+ from: https://www.python.org
    echo Ensure you check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYTHON_VERSION=%%v
echo     Found %PYTHON_VERSION%
echo.

:: 3. Determine if running inside the repository directory
if not exist "web\package.json" (
    if exist "job-scraper\web\package.json" (
        cd /d "%~dp0job-scraper"
    ) else (
        echo [*] Repository not found locally. Cloning from GitHub...
        git clone https://github.com/anandanair/job-scraper.git
        if %errorlevel% neq 0 (
            echo [ERROR] Failed to clone repository. Ensure git is installed or download repository as ZIP.
            pause
            exit /b 1
        )
        cd /d "%~dp0job-scraper"
    )
)

:: 4. Install web dependencies
echo.
echo [*] Step 1/3: Installing web application dependencies...
call npm --prefix web install
if %errorlevel% neq 0 (
    echo [WARNING] npm install reported warnings or errors. Continuing...
)

:: 5. Install python dependencies
echo.
echo [*] Step 2/3: Installing scraper python packages...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] pip install reported warnings or errors. Continuing...
)

:: 6. Launch web server and browser
echo.
echo [*] Step 3/3: Starting JobTrack web server on http://localhost:3000...
start "JobTrack Dev Server" cmd /k "cd /d ""%~dp0web"" && npm run dev"

echo.
echo ============================================================
echo  [SUCCESS] JobTrack is starting up!
echo  Opening http://localhost:3000/setup in your browser...
echo ============================================================
echo.

:: Brief pause to let Next.js initialize before launching browser
ping -n 4 127.0.0.1 >nul
start http://localhost:3000/setup

echo Press any key to close this installer window (the dev server will stay open).
pause >nul
exit /b 0
