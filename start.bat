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

:: Never block the launcher on a credential prompt
set GIT_TERMINAL_PROMPT=0

:: Ensure 'upstream' remote points to the primary repository
git remote get-url upstream >nul 2>&1
if %errorlevel% neq 0 (
    git remote add upstream https://github.com/anandanair/job-scraper.git >nul 2>&1
)

echo [*] Checking for updates from upstream repository...
git fetch upstream main --quiet 2>nul
if %errorlevel% neq 0 (
    echo     Could not reach GitHub. Starting with the current local version.
    echo.
    goto :eof
)

set BEHIND=0
for /f %%i in ('git rev-list HEAD..upstream/main --count 2^>nul') do set BEHIND=%%i

if not "%BEHIND%" gtr "0" (
    echo     JobTrack is up to date.
    echo.
    goto :eof
)

echo.
echo [*] Update available: %BEHIND% new commit^(s^) found on upstream repository.

:: Refuse to touch a dirty working tree - a merge would clobber local edits
set DIRTY=0
for /f %%i in ('git status --porcelain 2^>nul') do set DIRTY=1
if "%DIRTY%"=="1" (
    echo [WARNING] You have uncommitted local changes, so the update was skipped.
    echo           Commit or stash them, then run update.bat to update.
    echo.
    goto :eof
)

echo [*] Pulling latest updates...
git merge --ff-only upstream/main --quiet 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Could not fast-forward to the latest version.
    echo           Your local branch has diverged from upstream.
    echo           Run update.bat for details, or reset manually with:
    echo             git reset --hard upstream/main
    echo.
    goto :eof
)

:: Push the new commits to the user's own fork so its cloud automation
:: (scraping, scoring, resume tailoring) runs the same code as this clone.
:: Best-effort: many users have no push credentials configured.
call :PUSH_TO_FORK

echo [*] Updating dependencies...
call npm --prefix web install
if %errorlevel% neq 0 (
    echo [WARNING] Dependency installation reported errors. JobTrack may not run correctly.
    echo.
    goto :eof
)

echo [SUCCESS] JobTrack is now updated to the latest version!
echo.
goto :eof

:PUSH_TO_FORK
:: Skip when origin is the upstream repository itself (developer clone)
for /f %%i in ('git remote get-url origin 2^>nul') do set ORIGIN_URL=%%i
echo %ORIGIN_URL% | findstr /i "anandanair/job-scraper" >nul
if %errorlevel% equ 0 goto :eof

git push origin HEAD:main --quiet 2>nul
if %errorlevel% neq 0 (
    echo [NOTICE] Could not push the update to your GitHub fork.
    echo          Your local copy is current, but cloud automation on your fork
    echo          may still run older code. To fix it, open your fork on GitHub
    echo          and click "Sync fork" ^> "Update branch".
    echo.
) else (
    echo [*] Synced your GitHub fork with the latest code.
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
