# CLAUDE.md - Instructions for Claude Code & AI Assistants

## Monorepo Architecture Overview

This project is a **unified monorepo** merging the job scraper and web frontend/application:
- **`web/`**: Fullstack Next.js 16 app (React 19, TypeScript, Tailwind CSS v4). Contains all UI, API routes (`web/src/app/api/`), AI LLM integration (`web/src/lib/llm.ts`), ATS PDF generator (`web/src/lib/pdf.ts`), and CLI worker scripts (`web/scripts/`).
- **`backend/`**: Python 3.11 scraper engine **only** (`backend/scraper.py`, `backend/supabase_utils.py`, `backend/config.py`). There is **NO** Python web server (no Flask/FastAPI).
- **`supabase_setup/`**: Database SQL initialization schema (`init.sql`) and migrations.
- **`.github/workflows/`**: GitHub Actions workflows for automated scraping and batch tasks.

> **CRITICAL**: The legacy Python scripts for scoring (`score_jobs.py`), job management (`job_manager.py`), resume parsing (`resume_parser.py`), PDF generation (`pdf_generator.py`), and resume customization (`custom_resume_generator.py`) were deleted and migrated into TypeScript under `web/scripts/` and `web/src/lib/`. Do not recreate them in Python.

---

## Common Commands

All commands can be executed from the repository root:

```bash
# Web & Server
npm run dev              # Run Next.js local dev server on http://localhost:3000
npm run build            # Build Next.js application for production
npm run start            # Start production Next.js server
npm run install:web      # Install web dependencies (npm --prefix web install)

# Automation Tasks (TypeScript Workers)
npm run score            # Run AI job scoring worker (web/scripts/score-jobs.ts)
npm run customize        # Run AI resume tailoring worker (web/scripts/customize-resumes.ts)
npm run manage           # Run job manager / expiration worker (web/scripts/job-manager.ts)
npm run parse-resume     # Parse resume.pdf from Supabase (web/scripts/parse-resume.ts)

# Python Scraper
npm run scrape           # Run Python scraper (backend/scraper.py)
pip install -r backend/requirements.txt # Install Python scraper dependencies
```

---

## Configuration & Single Source of Truth

- **User preferences & AI credentials** are saved in the Supabase **`app_settings`** table.
- Users configure settings in the Web UI (`/setup` onboarding wizard and `/settings` page).
- The Python scraper loads these settings dynamically at runtime via `supabase_utils.load_and_apply_app_settings()`.
- LLM queries in `web/src/lib/llm.ts` query `app_settings` for the active model/key, falling back to environment variables.

---

## Key Development Rules

1. **Web UI & API**: Work inside `web/src/app/`. REST API endpoints belong in `web/src/app/api/`.
2. **AI Logic**: All AI prompts, scoring algorithms, and resume tailoring belong in `web/src/lib/llm.ts`. Supported providers: Google Gemini, Fireworks AI, OpenAI, Anthropic, Groq.
3. **PDF Generation**: ATS PDF resume typesetting is built in `web/src/lib/pdf.ts` using PDFKit.
4. **Scraping**: Platform scrapers (LinkedIn, CareersFuture) belong in `backend/scraper.py`.
5. **Path Aliases**: In `web/`, `@/*` maps to `web/src/*`.
