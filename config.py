import os
from dotenv import load_dotenv

load_dotenv()

# --- DO NOT MODIFY THE BELOW SECTION ---

# --- Supabase Configuration ---
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_TABLE_NAME: str = "jobs"
SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME = "customized_resumes"
SUPABASE_STORAGE_BUCKET="personalized_resumes"
BASE_RESUME_PATH = "resume.json"

# --- LLM Configuration ---
# Use any model supported by LiteLLM (400+ models). 
# Format: "provider/model-name"
# Examples:
#   "gemini"                             (Google, dynamically switches models)
#   "openai/gpt-4o-mini"                 (OpenAI)
#   "anthropic/claude-3-5-haiku-latest"  (Anthropic)
#   "ollama/llama3"                      (Local, free)
#   "groq/llama-3.3-70b-versatile"       (Groq, free tier)
#   "deepseek/deepseek-chat"             (DeepSeek)
#   "mistral/mistral-small-latest"       (Mistral)
#   "openrouter/google/gemini-2.5-flash" (OpenRouter)
# Full list: https://docs.litellm.ai/docs/providers
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini")

# API keys — set only the key(s) needed for your chosen provider.
# Backward compatible: GEMINI_API_KEY / GEMINI_FIRST_API_KEY / GEMINI_SECOND_API_KEY still work.
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_FIRST_API_KEY")

# Rate Limiting & Quota Management
LLM_MAX_RPM = int(os.environ.get("LLM_MAX_RPM", "10"))            # Max requests per minute
LLM_MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "3"))     # Max retries on rate-limit errors
LLM_RETRY_BASE_DELAY = int(os.environ.get("LLM_RETRY_BASE_DELAY", "10"))  # Base delay for backoff (seconds)
LLM_DAILY_REQUEST_BUDGET = int(os.environ.get("LLM_DAILY_REQUEST_BUDGET", "0"))  # 0 = unlimited
LLM_REQUEST_DELAY_SECONDS = int(os.environ.get("LLM_REQUEST_DELAY_SECONDS", "8"))  # Delay between API calls

# --- Resume Scoring Configuration ---
JOBS_TO_SCORE_PER_RUN = int(os.environ.get("JOBS_TO_SCORE_PER_RUN", "1"))  # Jobs per script run

# --- Resume Customization Configuration ---
JOBS_TO_CUSTOMIZE_PER_RUN = int(os.environ.get("JOBS_TO_CUSTOMIZE_PER_RUN", "1"))  # Jobs per customization run

# --- LinkedIn Configuration ---
LINKEDIN_EMAIL = os.environ.get("LINKEDIN_EMAIL")


# --- Scraping Parameters ---
SCRAPING_SOURCES = ["linkedin"] # Current options: "linkedin", "careers_future"
MAX_JOBS_PER_SEARCH = {
    "linkedin": int(os.environ.get("MAX_JOBS_PER_SEARCH_LINKEDIN", "2")),
    "careers_future": int(os.environ.get("MAX_JOBS_PER_SEARCH_CAREERS_FUTURE", "10")),
}
DEFAULT_MAX_JOBS_PER_SEARCH = int(os.environ.get("DEFAULT_MAX_JOBS_PER_SEARCH", "10"))
LINKEDIN_MAX_START = 1 # Reduced for 40 Jobs ids
REQUEST_TIMEOUT = 30 # Timeout for HTTP requests in seconds
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 15

# --- Job Management Parameters ---
JOB_EXPIRY_DAYS = 30 # Mark jobs as expired after this many days if not applied/interviewing etc.
JOB_CHECK_DAYS = 3   # Check if a job is still active if last_checked is older than this
JOB_DELETION_DAYS = 60 # Delete inactive ('expired', 'removed') jobs older than this
JOB_CHECK_LIMIT = 50 # Max number of jobs to check for activity per run
ACTIVE_CHECK_TIMEOUT = 20 # Timeout for checking if a job is active
ACTIVE_CHECK_MAX_RETRIES = 2
ACTIVE_CHECK_RETRY_DELAY = 10 # Base delay for retrying active check

# --- DO NOT MODITY THE ABOVE SECTION ---

# --- LinkedIn Search Configuration ---
LINKEDIN_SEARCH_QUERIES = ["maths lecturer", "statistics lecturer", "maths teacher", "Maths assistant professor", "Maths professor"]
LINKEDIN_LOCATION = "Singapore" #"Dubai" 
LINKEDIN_GEO_ID = 102454443 #Singapore  
# 102454443 #Singapore
# 100205264 #Dubai
LINKEDIN_JOB_TYPE = "F" # Full-time
LINKEDIN_JOB_POSTING_DATE = "r86400" # r86400=Past 24 hours, r172800=Past 48 hours, r259200=Past 3 days, r604800=Past week
LINKEDIN_F_WT=1 #3=Hybrid, 2=Remote, 1=Onsite

#  --- Careers Future Search Configuration ---
CAREERS_FUTURE_SEARCH_QUERIES = ["IT Support", "Full Stack Web Developer", "Application Support", "Cybersecurity Analyst", "fresher developer"]
CAREERS_FUTURE_SEARCH_CATEGORIES = ["Information Technology"]
CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES = ["Full Time"]

