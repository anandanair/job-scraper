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

echo -e "${BLUE}[*] Starting JobTrack web server on http://localhost:3000...${NC}"
npm --prefix web run dev &
SERVER_PID=$!

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  [SUCCESS] JobTrack is running! (PID: $SERVER_PID)${NC}"
echo -e "${GREEN}  Opening http://localhost:3000 in your browser...${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

sleep 3

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000" || true
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000" || true
fi

wait $SERVER_PID

