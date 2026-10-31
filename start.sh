#!/usr/bin/env bash

# JobTrack Daily Launcher for macOS and Linux
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# Auto-check for updates from GitHub upstream.
# Every step is best-effort: a failed update must never prevent the app from starting.
if [ -d ".git" ] && command -v git &> /dev/null; then
    echo -e "${BLUE}[*] Checking for updates from upstream repository...${NC}"
    export GIT_TERMINAL_PROMPT=0
    git remote get-url upstream &>/dev/null || git remote add upstream https://github.com/anandanair/job-scraper.git 2>/dev/null || true

    if git fetch upstream main --quiet 2>/dev/null; then
        BEHIND=$(git rev-list HEAD..upstream/main --count 2>/dev/null || echo 0)
        if [ "$BEHIND" -gt 0 ]; then
            echo -e "${GREEN}[*] Found $BEHIND new update(s) on upstream!${NC}"
            if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
                echo -e "${YELLOW}[WARNING] Uncommitted local changes detected - skipping update.${NC}"
                echo -e "${YELLOW}          Commit or stash them, then run ./update.sh.${NC}"
            elif git merge --ff-only upstream/main --quiet 2>/dev/null; then
                # Push to the user's own fork so its cloud automation runs the
                # same code as this clone. Best-effort: many users have no push
                # credentials configured.
                ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
                if [[ "$ORIGIN_URL" != *"anandanair/job-scraper"* ]]; then
                    if git push origin HEAD:main --quiet 2>/dev/null; then
                        echo -e "${GREEN}[*] Synced your GitHub fork with the latest code.${NC}"
                    else
                        echo -e "${YELLOW}[NOTICE] Could not push the update to your GitHub fork.${NC}"
                        echo -e "${YELLOW}         Your local copy is current, but cloud automation on your fork${NC}"
                        echo -e "${YELLOW}         may still run older code. Open your fork on GitHub and click${NC}"
                        echo -e "${YELLOW}         \"Sync fork\" > \"Update branch\" to fix it.${NC}"
                    fi
                fi
                npm --prefix web install || echo -e "${YELLOW}[WARNING] Dependency install reported errors.${NC}"
                echo -e "${GREEN}[SUCCESS] JobTrack is now updated to the latest version!${NC}"
            else
                echo -e "${YELLOW}[WARNING] Could not fast-forward - your branch has diverged from upstream.${NC}"
                echo -e "${YELLOW}          Run ./update.sh for details, or reset with: git reset --hard upstream/main${NC}"
            fi
        else
            echo -e "    JobTrack is up to date."
        fi
    else
        echo -e "${YELLOW}    Could not reach GitHub. Starting with the current local version.${NC}"
    fi
    echo ""
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
