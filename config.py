import os
from dotenv import load_dotenv

load_dotenv()

# --- Supabase Configuration ---
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_TABLE_NAME: str = "jobs"
SUPABASE_RESUME_TABLE_NAME = "resumes"
SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME = "customized_resumes"
SUPABASE_STORAGE_BUCKET="resumes"

# --- Groq Configuration ---
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# --- Google Configuration ---
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY")
GEMINI_SECOND_API_KEY = os.environ.get("GEMINI_SECOND_API_KEY")
GEMINI_MODEL_NAME = "gemini-2.0-flash"
GEMINI_SECONDARY_MODEL_NAME = "gemini-2.0-flash-lite"

# --- Resume Scoring Configuration ---
JOBS_TO_SCORE_PER_RUN = 10 # Limit jobs processed per script execution (respects API limits)
GEMINI_REQUEST_DELAY_SECONDS = 6 # Delay between Gemini API calls (10 requests/min)

# --- LinkedIn Configuration ---
LINKEDIN_EMAIL = os.environ.get("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD = os.environ.get("LINKEDIN_PASSWORD")
PERSISTENT_PROFILE_PATH = r"C:\Users\anand\AppData\Local\linkedin_job_applier_profile"
RESUME_FILE_PATH="./resume_files/resume.pdf"
USER_PHONE_NUMBER= os.environ.get("PHONE_NUMBER")
LINKEDIN_CITY = "Singapore, Singapore"

# --- LinkedIn Configuration ---
LINKEDIN_SEARCH_QUERIES = ["it support", "full stack web developer", "application support", "cybersecurity analyst", "AI"]
LINKEDIN_LOCATION = "Singapore"
LINKEDIN_GEO_ID = 102454443 # Singapore
LINKEDIN_JOB_TYPE = "F" # Full-time
# LINKEDIN_JOB_POSTING_DATE = "" # anytime
LINKEDIN_JOB_POSTING_DATE = "r86400" # Past 24 hours

#  --- Careers Future Configuration ---
CAREERS_FUTURE_SEARCH_QUERIES = ["IT Support", "Full Stack Web Developer", "Application Support", "Cybersecurity Analyst", "Artifical Intelligence"]
CAREERS_FUTURE_SEARCH_CATEGORIES = ["Information Technology"]
CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES = ["Full Time"]


# --- Scraping Parameters ---
LINKEDIN_MAX_START = 30 # Reduced for 40 Jobs ids
# LINKEDIN_MAX_START = 990 # Maximum start value for full scrape
# LINKEDIN_DETAIL_FETCH_LIMIT = 2 # Max new jobs to fetch details for per query (for testing)
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

