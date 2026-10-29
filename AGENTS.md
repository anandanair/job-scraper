# AI Agent & Pair Programming Protocol: JobTrack

> [!IMPORTANT]
> **READ BEFORE WRITING ANY CODE OR EXECUTING TASKS**
> This repository uses a **Memory Bank system** located in [`memory/`](memory/).
> Follow the protocol below for all AI coding agents, GenAI tools, and pair-programming assistants.

---

## 1. Operating Protocol for AI Agents

Every AI assistant working in this repository MUST follow these three operational rules:

1. **Step 1: Read System Context First**:
   - Before planning, writing code, or running scripts, read [`memory/context.md`](memory/context.md).
   - This file contains the complete, up-to-date architecture, API endpoints, database schema, tech stack, and conventions.

2. **Step 2: Maintain Context Integrity**:
   - If your changes introduce new routes, modify database tables, alter environment variables, or update business logic, you **MUST update [`memory/context.md`](memory/context.md)** to keep it 100% current.

3. **Step 3: Log Progress in the Flight Recorder**:
   - After completing a ticket, bug fix, or feature, append a single table row to [`memory/progress_latest.md`](memory/progress_latest.md):
     `| YYYY-MM-DD | Task / Ticket | Status | 1-Sentence Summary | Key Files |`
   - Keep entries strictly to one concise table row to preserve context window efficiency.
   - If you need historical context on past decisions or recent changes, consult [`memory/archive/`](memory/archive/).

---

## 2. Non-Negotiable Architectural Guardrails

### 🚨 Critical Boundaries
1. **NO Python Web Server / REST API**:
   - There is **no** Flask, FastAPI, Django, or Python HTTP server anywhere in this project.
   - All application APIs and server routes are **Next.js Route Handlers** in [`web/src/app/api/`](web/src/app/api/).
2. **Python is SOLELY for Scraping**:
   - The [`backend/`](backend/) directory contains **only** the job scraping engine ([`backend/scraper.py`](backend/scraper.py)) and its helper utilities ([`backend/supabase_utils.py`](backend/supabase_utils.py), [`backend/config.py`](backend/config.py), [`backend/user_agents.py`](backend/user_agents.py)).
   - It scrapes LinkedIn and CareersFuture into Supabase. It uses `markdownify` to convert HTML to Markdown locally with zero LLM API cost.
3. **TypeScript for Workers & Business Logic**:
   - Automation workers are TypeScript scripts in [`web/scripts/`](web/scripts/) executed via `tsx`:
     - Job Scoring: [`web/scripts/score-jobs.ts`](web/scripts/score-jobs.ts) (`npm run score`)
     - Resume Customization: [`web/scripts/customize-resumes.ts`](web/scripts/customize-resumes.ts) (`npm run customize`)
     - Job Expiration / Status Manager: [`web/scripts/job-manager.ts`](web/scripts/job-manager.ts) (`npm run manage`)
     - Resume Parsing: [`web/scripts/parse-resume.ts`](web/scripts/parse-resume.ts) (`npm run parse-resume`)
4. **Single Source of Truth for Configuration**:
   - All user preferences (search queries, locations, filters, active sources) and AI settings (provider, model, API keys, RPM limits, budget) are stored in the Supabase **`app_settings`** table.
   - The Python scraper dynamically fetches these settings at startup via `supabase_utils.load_and_apply_app_settings()`.
   - The LLM caller in `web/src/lib/llm.ts` reads `app_settings` as the exclusive source of truth for AI configuration.
5. **ATS PDF Generation**:
   - ATS-compliant PDF generation is implemented in TypeScript using **PDFKit** in [`web/src/lib/pdf.ts`](web/src/lib/pdf.ts).
   - Do not introduce Python PDF libraries (no ReportLab or Weasyprint).
6. **Frontend Stack**:
   - Next.js 16 (App Router), React 19, Tailwind CSS v4.
   - Client components must start with `'use client';`.
   - Path alias: `@/*` maps to `web/src/*`.

---

## 3. Standard Commands

Always run commands from the project root:

| Command | Action | Implementation |
| :--- | :--- | :--- |
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` | `npm --prefix web run dev` |
| `npm run build` | Builds the Next.js production bundle | `npm --prefix web run build` |
| `npm run start` | Starts Next.js production server | `npm --prefix web run start` |
| `npm run install:web` | Installs dependencies for the `web/` application | `npm --prefix web install` |
| `npm run scrape` | Runs Python scraper for active sources | `python backend/scraper.py` |
| `npm run score` | Scores pending unscored jobs with AI | `npm --prefix web run score` |
| `npm run customize` | Tailors resumes for top-matching jobs | `npm --prefix web run customize` |
| `npm run manage` | Checks job availability & expires inactive jobs | `npm --prefix web run manage` |
| `npm run parse-resume` | Parses `resume.pdf` into structured JSON | `npm --prefix web run parse-resume` |

---

## 4. Environment Variables Reference

- `web/.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  *(Note: All AI settings, API keys, and job preferences reside exclusively in the Supabase `app_settings` table)*
- `backend/.env` (or root `.env`):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

For in-depth details on database schemas, types, and component architectures, see [`memory/context.md`](memory/context.md).
