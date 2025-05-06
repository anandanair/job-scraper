import os
from dotenv import load_dotenv

load_dotenv()

# --- Supabase Configuration ---
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_TABLE_NAME: str = "jobs"
SUPABASE_RESUME_TABLE_NAME = "resumes"

# --- Groq Configuration ---
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# --- Google Configuration ---
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY")
# Consider using a specific model version if needed, e.g., "gemini-1.5-flash"
GEMINI_MODEL_NAME = "gemini-2.0-flash"

# --- Resume Scoring Configuration ---
JOBS_TO_SCORE_PER_RUN = 20 # Limit jobs processed per script execution (respects API limits)
GEMINI_REQUEST_DELAY_SECONDS = 6 # Delay between Gemini API calls (10 requests/min)

# --- LinkedIn Configuration ---
LINKEDIN_EMAIL = os.environ.get("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD = os.environ.get("LINKEDIN_PASSWORD")
PERSISTENT_PROFILE_PATH = r"C:\Users\anand\AppData\Local\linkedin_job_applier_profile"
RESUME_FILE_PATH="./resume_files/resume.pdf"
USER_PHONE_NUMBER= os.environ.get("PHONE_NUMBER")
LINKEDIN_CITY = "Singapore, Singapore"

# --- LinkedIn Configuration ---
LINKEDIN_SEARCH_QUERIES = ["it support", "full stack web developer", "next js", "application support", "cybersecurity analyst"]
LINKEDIN_LOCATION = "Singapore"
LINKEDIN_GEO_ID = 102454443 # Singapore
LINKEDIN_JOB_TYPE = "F" # Full-time
LINKEDIN_JOB_POSTING_DATE = "" # anytime
# LINKEDIN_JOB_POSTING_DATE = "r86400" # Past 24 hours

# --- Scraping Parameters ---
# LINKEDIN_MAX_START = 0 # Testing with a smaller number (0 means 1 page)
LINKEDIN_MAX_START = 990 # Maximum start value for full scrape
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

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
]

raw_proxies = [
    "38.154.227.167:5868:fbjewpss:9nwozqnmpvqq",
    "45.127.248.127:5128:fbjewpss:9nwozqnmpvqq",
    "198.23.239.134:6540:fbjewpss:9nwozqnmpvqq",
    "38.153.152.244:9594:fbjewpss:9nwozqnmpvqq",
    "86.38.234.176:6630:fbjewpss:9nwozqnmpvqq",
    "173.211.0.148:6641:fbjewpss:9nwozqnmpvqq",
    "216.10.27.159:6837:fbjewpss:9nwozqnmpvqq",
    "154.36.110.199:6853:fbjewpss:9nwozqnmpvqq",
    "45.151.162.198:6600:fbjewpss:9nwozqnmpvqq",
    "188.74.210.21:6100:fbjewpss:9nwozqnmpvqq"
]

proxy_list = [
    f"http://{user}:{password}@{ip}:{port}"
    for ip, port, user, password in (proxy.split(":") for proxy in raw_proxies)
]