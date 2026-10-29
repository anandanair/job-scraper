#!/usr/bin/env bash

# JobTrack System Updater for macOS and Linux
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "web/package.json" ]; then
    if [ -f "job-scraper/web/package.json" ]; then
        cd job-scraper
    else
        echo -e "${RED}[ERROR] JobTrack directory not found!${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}      JobTrack: Autonomous Job Scraper & AI Studio          ${NC}"
echo -e "${BLUE}                     System Updater                         ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if [ -d ".git" ] && command -v git &> /dev/null; then
    echo -e "${BLUE}[*] Pulling latest updates with Git...${NC}"
    git pull origin main
else
    echo -e "${BLUE}[*] Standalone installation detected. Fetching latest release...${NC}"
    curl -fsSL https://github.com/anandanair/job-scraper/archive/refs/heads/main.tar.gz | tar -xz --strip-components 1
fi

echo ""
echo -e "${BLUE}[*] Updating project dependencies...${NC}"
npm --prefix web install

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  [SUCCESS] JobTrack has been updated to the latest version!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
