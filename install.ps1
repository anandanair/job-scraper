# JobTrack One-Line Installer for Windows (PowerShell)
# Usage: irm https://raw.githubusercontent.com/anandanair/job-scraper/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "    JobTrack: Autonomous Job Scraper & AI Resume Studio    " -ForegroundColor Cyan
Write-Host "                  One-Line Quick Installer                  " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prerequisite: Check Node.js
Write-Host "[*] Checking Node.js prerequisite..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    Write-Host "[!] Node.js was not detected on your system." -ForegroundColor Yellow
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    
    if ($wingetCmd) {
        $installChoice = Read-Host "Would you like to install Node.js LTS automatically via winget? (Y/n)"
        if ($installChoice -eq "" -or $installChoice -match "^[yY]") {
            Write-Host "[*] Installing Node.js LTS via winget..." -ForegroundColor Cyan
            & winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            # Refresh Path for current session
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        }
    }

    if (-not $nodeCmd) {
        Write-Host ""
        Write-Host "[ERROR] Node.js is required to run JobTrack." -ForegroundColor Red
        Write-Host "Please download and install Node.js 20+ LTS from https://nodejs.org" -ForegroundColor White
        Write-Host "Then rerun this command."
        return
    }
}

$nodeVersion = (& node -v)
Write-Host "    Found Node.js $nodeVersion" -ForegroundColor Green
Write-Host ""

# 2. Determine Installation Directory
$targetDir = ""
if (Test-Path "web\package.json") {
    $targetDir = (Get-Location).Path
} elseif (Test-Path "$HOME\JobTrack\web\package.json") {
    $targetDir = "$HOME\JobTrack"
} else {
    $targetDir = "$HOME\JobTrack"
    Write-Host "[*] Setting up JobTrack in $targetDir..." -ForegroundColor Yellow

    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        Write-Host "    Cloning repository with Git..." -ForegroundColor Cyan
        & git clone https://github.com/anandanair/job-scraper.git "$targetDir"
    } else {
        Write-Host "    Git not found. Downloading repository archive..." -ForegroundColor Cyan
        $zipPath = "$env:TEMP\jobtrack-source.zip"
        $tempExtract = "$env:TEMP\jobtrack-extract"
        
        Invoke-WebRequest -Uri "https://github.com/anandanair/job-scraper/archive/refs/heads/main.zip" -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force
        
        if (Test-Path "$tempExtract\job-scraper-main") {
            New-Item -ItemType Directory -Path (Split-Path $targetDir -Parent) -Force -ErrorAction SilentlyContinue | Out-Null
            Move-Item -Path "$tempExtract\job-scraper-main" -Destination "$targetDir" -Force
        }
        
        Remove-Item -Path $zipPath, $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path "$targetDir\web\package.json")) {
    Write-Host "[ERROR] Failed to locate or download JobTrack project files." -ForegroundColor Red
    return
}

# 3. Install NPM Dependencies
Write-Host ""
Write-Host "[*] Step 1/3: Installing project dependencies (Next.js, TypeScript Scraper, PDFKit)..." -ForegroundColor Yellow
$webDir = Join-Path $targetDir "web"
Start-Process -FilePath "npm" -ArgumentList "install" -WorkingDirectory $webDir -NoNewWindow -Wait

# 4. Create Desktop Shortcut
Write-Host ""
Write-Host "[*] Step 2/3: Creating Desktop Shortcut..." -ForegroundColor Yellow
try {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    if (Test-Path $desktopPath) {
        $wsShell = New-Object -ComObject WScript.Shell
        $shortcut = $wsShell.CreateShortcut("$desktopPath\JobTrack.lnk")
        $shortcut.TargetPath = "$targetDir\start.bat"
        $shortcut.WorkingDirectory = $targetDir
        $shortcut.Description = "Launch JobTrack Job Scraper & AI Studio"
        $shortcut.Save()
        Write-Host "    Created 'JobTrack' shortcut on your Desktop!" -ForegroundColor Green
    }
} catch {
    Write-Host "    Notice: Could not automatically create Desktop shortcut." -ForegroundColor Gray
}

# 5. Start Dev Server & Open Setup Wizard
Write-Host ""
Write-Host "[*] Step 3/3: Launching JobTrack dev server..." -ForegroundColor Yellow
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$webDir`" && npm run dev"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [SUCCESS] JobTrack is running!" -ForegroundColor Green
Write-Host " Opening http://localhost:3000/setup in your browser..." -ForegroundColor Green
Write-Host ""
Write-Host " Tip: In the future, launch JobTrack anytime by:" -ForegroundColor White
Write-Host "   1. Double-clicking the 'JobTrack' shortcut on your Desktop" -ForegroundColor White
Write-Host "   2. Running $targetDir\start.bat" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 4
Start-Process "http://localhost:3000/setup"

