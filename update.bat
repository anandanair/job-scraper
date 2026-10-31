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
        set GIT_TERMINAL_PROMPT=0
        echo [*] Git repository detected. Checking for updates from upstream...
        git remote get-url upstream >nul 2>&1 || git remote add upstream https://github.com/anandanair/job-scraper.git >nul 2>&1

        git fetch upstream main --quiet 2>nul
        if %errorlevel% neq 0 (
            echo [ERROR] Could not reach GitHub. Check your internet connection and try again.
            pause
            exit /b 1
        )

        set DIRTY=0
        for /f %%i in ('git status --porcelain 2^>nul') do set DIRTY=1
        if "!DIRTY!"=="1" (
            echo [ERROR] You have uncommitted local changes.
            echo         Commit or stash them first, then run this updater again.
            pause
            exit /b 1
        )

        git merge --ff-only upstream/main --quiet 2>nul
        if %errorlevel% neq 0 (
            echo [ERROR] Could not fast-forward to the latest version.
            echo         Your local branch has diverged from upstream.
            echo         To discard local commits and match upstream exactly, run:
            echo             git reset --hard upstream/main
            pause
            exit /b 1
        )

        :: Push the new commits to the user's own fork so its cloud automation
        :: runs the same code as this clone.
        for /f %%i in ('git remote get-url origin 2^>nul') do set ORIGIN_URL=%%i
        echo !ORIGIN_URL! | findstr /i "anandanair/job-scraper" >nul
        if !errorlevel! neq 0 (
            git push origin HEAD:main --quiet 2>nul
            if !errorlevel! neq 0 (
                echo.
                echo [NOTICE] Could not push the update to your GitHub fork.
                echo          Your local copy is current, but cloud automation on your fork
                echo          may still run older code. Open your fork on GitHub and click
                echo          "Sync fork" ^> "Update branch" to fix it.
            ) else (
                echo [*] Synced your GitHub fork with the latest code.
            )
        )

        echo.
        echo [*] Updating dependencies...
        call npm --prefix web install
        if %errorlevel% neq 0 (
            echo [ERROR] Dependency installation failed. See the output above.
            pause
            exit /b 1
        )
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
