import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# =================================================================
# 1. SUPABASE CREDENTIALS & TABLES
# =================================================================
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_TABLE_NAME: str = "jobs"
SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME: str = "customized_resumes"
SUPABASE_BASE_RESUME_TABLE_NAME: str = "base_resume"
SUPABASE_RESUME_STYLE_TABLE_NAME: str = "resume_style_settings"

# =================================================================
# 2. SCRAPER ENGINE NETWORK & RATE LIMIT SETTINGS
# Note: All user search queries, locations, filters, and scraping sources
# are stored in and dynamically loaded from the Supabase 'app_settings'
# table (configured in the Web App / Setup Wizard).
# =================================================================
LINKEDIN_MAX_START = 25 
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 60              # Base cool-down on HTTP 429
DETAIL_FETCH_MIN_DELAY = 12.0         # Delay between detail requests (seconds)
DETAIL_FETCH_MAX_DELAY = 22.0
SEARCH_QUERY_MIN_DELAY = 15.0         # Delay between search queries in standalone runs (seconds)
SEARCH_QUERY_MAX_DELAY = 30.0
