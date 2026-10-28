# AI Agent & Pair Programming Instructions: JobTrack Monorepo

> [!IMPORTANT]
> **READ BEFORE WRITING ANY CODE OR RUNNING SCRIPTS**
> This repository is a **unified monorepo** that merges the previously separate backend and frontend codebases.
> Read the architectural boundaries below to avoid confusing the old split repositories or obsolete Python scripts with the modern TypeScript architecture.

---

## 1. Architectural Overview & Boundaries

### 🚨 Critical Distinctions
1. **NO Python Web Server / REST API**:
   - There is **NO** Flask, FastAPI, Django, or Python HTTP server anywhere in this project.
   - All application APIs, server routes, and backend endpoints are **Next.js Route Handlers** located under [`web/src/app/api/`](web/src/app/api/).
2. **Python is SOLELY for Scraping**:
   - The [`backend/`](backend/) directory contains **only** the job scraping engine ([`backend/scraper.py`](backend/scraper.py)) and its helper utilities ([`backend/supabase_utils.py`](backend/supabase_utils.py), [`backend/config.py`](backend/config.py), [`backend/user_agents.py`](backend/user_agents.py)).
   - It scrapes LinkedIn and CareersFuture into Supabase. It uses `markdownify` to convert HTML to Markdown locally without LLM overhead.
3. **Migrated Python Scripts -> TypeScript**:
   - Historical Python scripts (`backend/score_jobs.py`, `backend/job_manager.py`, `backend/custom_resume_generator.py`, `backend/resume_parser.py`, `backend/pdf_generator.py`, `backend/llm_client.py`, `backend/models.py`) **have been permanently retired and deleted**.
   - Their modern replacements are **TypeScript** scripts in [`web/scripts/`](web/scripts/) and TypeScript modules in [`web/src/lib/`](web/src/lib/):
     - Job Scoring: [`web/scripts/score-jobs.ts`](web/scripts/score-jobs.ts) (run via `npm run score`)
     - Resume Customization: [`web/scripts/customize-resumes.ts`](web/scripts/customize-resumes.ts) (run via `npm run customize`)
     - Job Expiration / Active Manager: [`web/scripts/job-manager.ts`](web/scripts/job-manager.ts) (run via `npm run manage`)
     - Resume Parsing: [`web/scripts/parse-resume.ts`](web/scripts/parse-resume.ts) (run via `npm run parse-resume`)
     - LLM Operations: [`web/src/lib/llm.ts`](web/src/lib/llm.ts)
     - ATS PDF Generation: [`web/src/lib/pdf.ts`](web/src/lib/pdf.ts) (PDFKit)
   - **DO NOT** attempt to recreate or look for scoring, PDF generation, or resume tailoring in Python.
4. **Single Source of Truth for Configuration**:
   - All user preferences (search queries, locations, LinkedIn filters, scraping sources) and AI settings (provider, model, API keys, RPM limits, budget) are stored in the Supabase **`app_settings`** table.
   - Users configure these via the Web UI ([`web/src/app/setup`](web/src/app/setup) and [`web/src/app/settings`](web/src/app/settings)).
   - The Python scraper dynamically fetches these settings at startup via `supabase_utils.load_and_apply_app_settings()`. Do not rely on hardcoded search queries in `backend/config.py`.

---

## 2. Directory Structure

```
.
├── .github/workflows/          # GitHub Actions CI/CD workflows
│   ├── scrape_jobs.yml         # Python scraper (runs 7:00 PM SGT daily)
│   ├── score_jobs.yml          # Node.js job scorer (runs every 4 hours)
│   ├── hourly_resume_customization.yml # Node.js resume tailor (runs every 4 hours)
│   └── job_manager.yml         # Node.js job manager & status checker (runs daily)
├── backend/                    # Python Job Scraping Engine ONLY
│   ├── scraper.py              # LinkedIn & CareersFuture scraper
│   ├── supabase_utils.py       # Supabase client & dynamic app_settings loader
│   ├── config.py               # Scraper network timeouts, retries, and fallback vars
│   ├── user_agents.py          # Browser user agent rotation pool
│   └── requirements.txt        # Minimal Python dependencies (requests, bs4, supabase, markdownify, dotenv)
├── supabase_setup/             # Database Schemas & Migrations
│   ├── init.sql                # Complete DB schema (tables, triggers, RPC, storage buckets)
│   ├── add_app_settings.sql    # App settings schema reference
│   └── resume_style_settings.sql # Resume style configuration table reference
├── web/                        # Next.js 16 Fullstack Web Application
│   ├── scripts/                # TypeScript CLI batch worker scripts (run with tsx)
│   │   ├── score-jobs.ts       # Scores unscored jobs against base resume
│   │   ├── customize-resumes.ts # Tailors ATS resumes for top-scored jobs
│   │   ├── job-manager.ts      # Checks job availability & expires old jobs
│   │   └── parse-resume.ts     # Parses resume.pdf into base_resume table
│   ├── src/
│   │   ├── app/                # App Router: Pages & API Route Handlers
│   │   │   ├── api/            # Server-side API routes (setup, settings, jobs, resumes, pdf)
│   │   │   ├── jobs/           # Job views (new, top matches, applied, details)
│   │   │   ├── resume-studio/  # Master Dual-Mode Resume Studio
│   │   │   ├── resume-style/   # ATS visual styling & theme controls
│   │   │   ├── settings/       # AI provider & job preferences configuration
│   │   │   └── setup/          # 5-Step interactive onboarding wizard
│   │   ├── components/         # React components (setup, jobs, resume-studio, etc.)
│   │   ├── lib/                # Core utilities: llm.ts, pdf.ts, resumeParser.ts, setup/
│   │   ├── utils/supabase/     # Server & client Supabase helpers
│   │   └── types.ts            # Shared TypeScript interfaces & types
│   ├── package.json            # Web app dependencies & CLI worker scripts
│   └── tsconfig.json
├── install.bat                 # 1-Click installer for Windows
├── install.sh                  # 1-Click installer for macOS/Linux
├── package.json                # Root monorepo scripts delegating to web and backend
├── vercel.json                 # Vercel deployment configuration
└── README.md                   # Human-facing project documentation
```

---

## 3. Standard Commands & Scripts

Always run commands from the project root using `npm run <script>`:

| Command | Action | Implementation |
| :--- | :--- | :--- |
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` | `npm --prefix web run dev` |
| `npm run build` | Builds the Next.js production bundle | `npm --prefix web run build` |
| `npm run start` | Starts Next.js production server | `npm --prefix web run start` |
| `npm run install:web` | Installs dependencies for the `web/` application | `npm --prefix web install` |
| `npm run scrape` | Runs Python scraper for active sources | `python backend/scraper.py` |
| `npm run score` | Scores pending unscored jobs with AI | `tsx web/scripts/score-jobs.ts` |
| `npm run customize` | Tailors resumes for top-matching jobs | `tsx web/scripts/customize-resumes.ts` |
| `npm run manage` | Checks job availability & expires inactive jobs | `tsx web/scripts/job-manager.ts` |
| `npm run parse-resume` | Parses `resume.pdf` into structured JSON | `tsx web/scripts/parse-resume.ts` |

### Installing Python Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

---

## 4. Key Implementation Rules for Agents

### 1. Modifying Frontend & Web UI
- All UI is built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS v4**.
- Keep components modular under `web/src/components/<feature>/`.
- Client components must start with `'use client';`.
- Path aliases: `@/*` maps to `web/src/*`.

### 2. Modifying API Endpoints
- API endpoints belong in `web/src/app/api/<route>/route.ts`.
- Use `NextRequest` and `NextResponse` from `next/server`.
- For database operations inside server routes, use `createSupabaseServerClient()` or `createSupabaseStaticClient()` from `@/utils/supabase/server`.

### 3. Modifying AI & LLM Logic
- Universal LLM caller is located in [`web/src/lib/llm.ts`](web/src/lib/llm.ts).
- Supported providers: Google Gemini, Fireworks AI, OpenAI, Anthropic, Groq.
- It dynamically reads provider credentials and model choices from `app_settings` in Supabase first, falling back to environment variables (`LLM_API_KEY`, `GEMINI_API_KEY`, `FIREWORKS_API_KEY`, `OPENAI_API_KEY`, etc.).
- Never hardcode model names or API keys in application code.

### 4. Modifying Resume PDF Generation
- ATS-compliant PDF generation is implemented in TypeScript using **PDFKit** in [`web/src/lib/pdf.ts`](web/src/lib/pdf.ts).
- Do not introduce Python ReportLab or Weasyprint.
- Page budgeting, typography scales, line spacing, margins, and orphan heading prevention are managed in `web/src/lib/pdf.ts`.

### 5. Modifying Job Scraping Logic
- Web scraping logic resides in [`backend/scraper.py`](backend/scraper.py).
- Keep rate-limiting delays and user agent rotation intact to prevent IP blocking.
- Scraper reads job preferences dynamically from Supabase `app_settings` at execution time.
- Scraping uses `markdownify` for clean HTML-to-Markdown conversion without LLM cost.

### 6. Environment Variables
- `web/.env.local` or `.env` in root:
  - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `LLM_API_KEY` (or provider-specific keys: `GEMINI_API_KEY`, `FIREWORKS_API_KEY`, `OPENAI_API_KEY`, etc.)
- `backend/.env` or `.env` in root:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

---