#!/usr/bin/env bash

# JobTrack One-Click Installer for macOS and Linux
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}    JobTrack: Autonomous Job Scraper & AI Resume Studio    ${NC}"
echo -e "${BLUE}                  One-Click Installer                       ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# 1. Check Node.js
echo -e "${BLUE}[*] Checking Node.js prerequisite...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed or not in PATH!${NC}"
    echo "Please install Node.js 24 (LTS) from: https://nodejs.org"
    exit 1
fi
echo -e "    Found Node.js $(node -v)"
echo ""

# 2. Check directory
if [ ! -f "web/package.json" ]; then
    if [ -f "job-scraper/web/package.json" ]; then
        cd job-scraper
    else
        echo -e "${BLUE}[*] Cloning repository from GitHub...${NC}"
        git clone https://github.com/anandanair/job-scraper.git
        cd job-scraper
    fi
fi

# 3. Install web & scraper dependencies
echo -e "${BLUE}[*] Step 1/2: Installing dependencies (Next.js, TypeScript Scraper, PDFKit)...${NC}"
npm --prefix web install

# 4. Launch dev server and open browser
echo -e "${BLUE}[*] Step 2/2: Starting JobTrack web server on http://localhost:3000...${NC}"
npm --prefix web run dev &
SERVER_PID=$!

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  [SUCCESS] JobTrack is running! (PID: $SERVER_PID)${NC}"
echo -e "${GREEN}  Opening http://localhost:3000/setup in your browser...${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

sleep 3

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000/setup" || true
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000/setup" || true
fi

wait $SERVER_PID
