# Progress Tracker (October 2026)

Active development log. Each entry must be a single concise table row.  
At the end of each month, move to `memory/archive/progress_YYYY_MM.md` and start fresh.

| Date | Task / Ticket | Status | Summary | Key Files |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-29 | Monorepo Docs & Memory Bank | Done | Consolidated root README, removed legacy sub-READMEs, setup `memory/` knowledge bank | `README.md`, `memory/*`, `AGENTS.md`, `CLAUDE.md` |
| 2026-10-29 | Fix Setup Pipeline & Model/Limit Overwrite Bugs | Done | Fixed Next.js reload overlay, preserved AI model/tier and daily scoring/tailoring limits into Supabase app_settings without .env.local file mutation | `web/src/app/api/setup/*`, `web/src/components/setup/*`, `web/src/proxy.ts`, `web/src/app/page.tsx` |
| 2026-10-29 | Resolve 12 npm audit Vulnerabilities | Done | Removed unused axios, upgraded Next.js to 16.4.3, and pinned transitive build dependencies via npm overrides achieving 0 vulnerabilities | `web/package.json`, `web/package-lock.json` |
| 2026-10-29 | Migrate AI & App Config Strictly to app_settings | Done | Removed all process.env fallbacks for LLM keys/models/delays and cleaned legacy Python functions, ensuring app_settings is the single source of truth | `web/src/lib/llm.ts`, `web/scripts/*`, `web/src/app/*`, `backend/supabase_utils.py` |
| 2026-10-29 | TypeScript Scraper Migration | Done | Implemented pure TypeScript scraping engine using impit (Rust browser TLS impersonation), cheerio, and node-html-markdown with CI/CD and diagnostics | `web/src/lib/scraper/*`, `web/scripts/scrape-jobs.ts`, `.github/workflows/scrape_jobs.yml` |
| 2026-10-29 | Multi-Stage Agentic Resume Tailoring Pipeline | Done | Upgraded tailoring to 3-call pipeline (Strategist Curation + Google XYZ Copywriter + ATS Rescorer) with 429 exponential backoff and timeline healing | `web/src/lib/llm.ts`, `web/src/types.ts`, `web/scripts/customize-resumes.ts`, `web/src/app/api/jobs/[job_id]/customize-resume/route.ts` |
| 2026-10-29 | Existing User Migration & Schema Verification | Done | Added full-table schema verification to setup endpoints to prevent premature Step 1 bypass, pre-fill legacy API keys, and auto-prompt missing tables | `web/src/app/api/setup/*`, `web/src/app/setup/page.tsx`, `web/src/components/setup/*`, `web/src/lib/supabase/queries.ts` |
| 2026-10-29 | Pure Node/TS Installer & Docs Cleanup | Done | Removed Python prerequisite from install scripts, updated workflow badges, setup tips, and README for pure TypeScript stack | `install.bat`, `install.sh`, `README.md`, `web/src/components/*` |
