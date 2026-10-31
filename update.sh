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
    echo -e "${BLUE}[*] Pulling latest updates from upstream with Git...${NC}"
    export GIT_TERMINAL_PROMPT=0
    git remote get-url upstream &>/dev/null || git remote add upstream https://github.com/anandanair/job-scraper.git 2>/dev/null || true

    if ! git fetch upstream main --quiet; then
        echo -e "${RED}[ERROR] Could not reach GitHub. Check your internet connection and try again.${NC}"
        exit 1
    fi

    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${RED}[ERROR] You have uncommitted local changes.${NC}"
        echo "        Commit or stash them first, then run this updater again."
        exit 1
    fi

    if ! git merge --ff-only upstream/main --quiet; then
        echo -e "${RED}[ERROR] Could not fast-forward to the latest version.${NC}"
        echo "        Your local branch has diverged from upstream."
        echo "        To discard local commits and match upstream exactly, run:"
        echo "            git reset --hard upstream/main"
        exit 1
    fi

    # Push the new commits to the user's own fork so its cloud automation runs
    # the same code as this clone.
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
