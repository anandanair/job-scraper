#!/usr/bin/env bash

# JobTrack Daily Launcher for macOS and Linux
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "web/package.json" ]; then
    if [ -f "job-scraper/web/package.json" ]; then
        cd job-scraper
    else
        echo -e "${RED}[ERROR] JobTrack directory not found!${NC}"
        echo "Please run ./install.sh first to set up the project."
        exit 1
    fi
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}      JobTrack: Autonomous Job Scraper & AI Studio          ${NC}"
echo -e "${BLUE}                     Daily Launcher                         ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed or not in PATH!${NC}"
    echo "Please install Node.js LTS from: https://nodejs.org"
    exit 1
fi

# Auto-check for updates from GitHub
if [ -d ".git" ] && command -v git &> /dev/null; then
    echo -e "${BLUE}[*] Checking for updates from GitHub...${NC}"
    git fetch origin main --quiet 2>/dev/null || true
    BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo 0)
    if [ "$BEHIND" -gt 0 ]; then
        echo -e "${GREEN}[*] Found $BEHIND new update(s) on GitHub! Pulling updates...${NC}"
        git pull origin main --quiet
        npm --prefix web install
        echo -e "${GREEN}[SUCCESS] JobTrack is now updated to the latest version!${NC}"
        echo ""
    else
        echo -e "    JobTrack is up to date."
        echo ""
    fi
fi

echo -e "${BLUE}[*] Starting JobTrack web server on http://localhost:3000...${NC}"
echo -e "    Press Ctrl+C in this terminal to stop the server."
echo ""

# Open browser asynchronously in background after 3 seconds
(
    sleep 3
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:3000" || true
    elif command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000" || true
    fi
) &

# Run dev server directly in the foreground of this terminal
cd web
npm run dev
