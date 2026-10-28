# Backend: Multi-Source Job Scraper Engine

The `backend/` directory houses the Python-based job scraping engine for **LinkedIn** and **CareersFuture**.

> [!NOTE]
> This folder contains **ONLY** the scraper engine.
> - There is **no** web server, Flask, or FastAPI app here.
> - Job scoring, resume customization, PDF generation, and resume parsing were migrated to TypeScript and live under [`web/`](../web/).
> - Application API endpoints live in [`web/src/app/api/`](../web/src/app/api/).

---

## Files Overview

- **[`scraper.py`](scraper.py)**: The core scraping engine for LinkedIn and CareersFuture.
  - Features user-agent rotation, randomized jitter, exponential backoff on HTTP 429, and automatic pagination.
  - Converts job descriptions from HTML to Markdown locally using `markdownify` with zero LLM API cost.
  - Stores scraped jobs directly into the Supabase `jobs` table.
- **[`supabase_utils.py`](supabase_utils.py)**: Supabase client connection, duplicate checking, and dynamic configuration loader.
  - Dynamically loads search queries, target locations, workplace filters, and active sources from the Supabase `app_settings` table.
- **[`config.py`](config.py)**: Scraper network parameters, request timeouts, retry settings, and fallback variables.
- **[`user_agents.py`](user_agents.py)**: Curated list of realistic browser user-agents for request rotation.
- **[`requirements.txt`](requirements.txt)**: Lightweight Python dependencies (`requests`, `beautifulsoup4`, `python-dotenv`, `supabase`, `markdownify`).

---

## Installation & Setup

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are defined in `backend/.env` or the root `.env`.

---

## CLI Usage

The scraper can be invoked from the monorepo root via npm or directly via Python:

```bash
# From root directory:
npm run scrape

# Directly from backend/:
python scraper.py

# Scrape only LinkedIn:
python scraper.py --source linkedin

# Scrape only CareersFuture:
python scraper.py --source careers_future

# Run a specific search query with custom limit:
python scraper.py --source linkedin --query "Data Engineer" --limit 15
```

---

## How Dynamic Configuration Works

All search preferences (queries, locations, job types, date ranges, sources) are configured through the **Web App / Setup Wizard** (`/setup` or `/settings`) and stored in the Supabase `app_settings` table.

When `scraper.py` executes:
1. It calls `supabase_utils.load_and_apply_app_settings()`.
2. It fetches the latest active configuration from Supabase.
3. It executes the scrapers according to those dynamic preferences without requiring manual edits to code.
