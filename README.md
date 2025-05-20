# LinkedIn Job Scraper & Application Assistant

This project is a comprehensive suite of tools designed to automate and enhance the job searching process, primarily focusing on LinkedIn. It scrapes job postings, parses resumes, scores job suitability against a candidate's resume, manages job application statuses, and can even generate custom PDF resumes. The system leverages AI (Google Gemini) for advanced text processing and Supabase for data storage.

## Features

- **LinkedIn Job Scraping**: Automatically scrapes job postings from LinkedIn. (Implemented in [scraper.py](scraper.py) and [scrape_jobs.py](scrape_jobs.py)
- **Resume Parsing**:
  - Extracts text from PDF resumes using `pdfplumber`. (<mcsymbol name="extract_text_from_pdf" filename="resume_parser.py" path="d:\dev\linkedin-jobs-scrapper\resume_parser.py" startline="10" type="function"></mcsymbol> in <mcfile name="resume_parser.py" path="d:\dev\linkedin-jobs-scrapper\resume_parser.py"></mcfile>)
  - Utilizes Google Gemini AI to parse resume text into structured data (<mcsymbol name="Resume" filename="models.py" path="d:\dev\linkedin-jobs-scrapper\models.py" startline="34" type="class"></mcsymbol>). (Implemented in <mcfile name="parse_resume_with_ai.py" path="d:\dev\linkedin-jobs-scrapper\parse_resume_with_ai.py"></mcfile>)
- **Job Scoring**: Scores job descriptions against a parsed resume using AI to determine suitability. (Implemented in <mcfile name="score_jobs.py" path="d:\dev\linkedin-jobs-scrapper\score_jobs.py"></mcfile>)
- **Job Management**:
  - Tracks the status of job applications.
  - Marks old or inactive jobs as expired.
  - Periodically checks if active jobs are still available on LinkedIn.
    (Implemented in <mcfile name="job_manager.py" path="d:\dev\linkedin-jobs-scrapper\job_manager.py"></mcfile>)
- **Data Storage**: Uses Supabase to store job data, resume details, and application statuses. (Utility functions in <mcfile name="supabase_utils.py" path="d:\dev\linkedin-jobs-scrapper\supabase_utils.py"></mcfile>)
- **Custom PDF Resume Generation**: Generates ATS-friendly PDF resumes from structured resume data. (Implemented in <mcfile name="pdf_generator.py" path="d:\dev\linkedin-jobs-scrapper\pdf_generator.py"></mcfile>)
- **AI-Powered Text Processing**: Leverages Google Gemini for tasks like resume parsing and converting job descriptions to Markdown.
- **Automated Workflows**: Includes GitHub Actions for running tasks like job scraping, scoring, and management on a schedule. (See <mcfolder name="workflows" path="d:\dev\linkedin-jobs-scrapper\.github\workflows"></mcfolder>)

## Tech Stack

- **Programming Language**: Python 3.x
- **Web Scraping/HTTP**:
  - `requests`
  - `httpx`
  - `BeautifulSoup4` (for HTML parsing)
  - `Playwright` (for browser automation)
- **PDF Processing**:
  - `pdfplumber` (for text extraction)
  - `ReportLab` (for PDF generation)
- **AI/LLM**: `google-genai` (Google Gemini API)
- **Database**: Supabase (`supabase`)
- **Data Validation**: `Pydantic`
- **Environment Management**: `python-dotenv`
- **Text Conversion**: `html2text`
- **CI/CD**: GitHub Actions

## Setup and Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd linkedin-jobs-scrapper
    ```

2.  **Create and activate a virtual environment:**

    ```bash
    python -m venv .venv
    # On Windows
    .\.venv\Scripts\activate
    # On macOS/Linux
    source .venv/bin/activate
    ```

3.  **Install dependencies:**

    ```bash
    pip install -r requirements.txt
    ```

    You might also need to install Playwright's browser drivers:

    ```bash
    playwright install
    ```

4.  **Set up environment variables:**
    - Create a `.env` file in the root directory by copying the `.env.example` (if one exists) or creating it from scratch.
    - Populate it with your API keys and configuration details. See the **Configuration** section below and <mcfile name="config.py" path="d:\dev\linkedin-jobs-scrapper\config.py"></mcfile> for required variables.

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Supabase Configuration
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
SUPABASE_TABLE_NAME="jobs" # Or your chosen table name for jobs
SUPABASE_RESUME_TABLE_NAME="resumes" # Or your chosen table name for resumes

# Google Gemini API Keys
GEMINI_FIRST_API_KEY="YOUR_GEMINI_API_KEY_PRIMARY" # Used for core tasks like scoring, resume parsing
GEMINI_SECONDARY_API_KEY="YOUR_GEMINI_API_KEY_SECONDARY" # Used for less critical tasks like Markdown conversion
# Or, if using a single key for all:
# GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Job Scraping Configuration (examples from config.py, adjust as needed)
LINKEDIN_USERNAME="YOUR_LINKEDIN_EMAIL" # If using authenticated scraping
LINKEDIN_PASSWORD="YOUR_LINKEDIN_PASSWORD" # If using authenticated scraping
SEARCH_KEYWORDS="Software Engineer, Data Scientist" # Comma-separated
SEARCH_LOCATIONS="United States, Remote" # Comma-separated
MAX_PAGES_PER_SEARCH="5"
MAX_WORKERS="5" # For concurrent scraping tasks

# Job Management Configuration (examples from config.py)
JOB_EXPIRY_DAYS="90"
JOB_CHECK_DAYS="7" # How often to check if a job is still active
JOB_CHECK_LIMIT="50" # Max jobs to check for activity per run
ACTIVE_CHECK_MAX_RETRIES="3"
ACTIVE_CHECK_TIMEOUT="20" # Seconds
ACTIVE_CHECK_RETRY_DELAY="10" # Seconds

# Resume Parsing
RESUME_FILE_PATH="./resume_files/your_resume.pdf" # Path to your resume PDF

# Other configurations might be present in config.py
# Ensure all necessary variables used by config.py are defined in your .env

Note: Refer to `config.py` for a comprehensive list of all configurable parameters and their default values.

## Usage
The project consists of several main scripts:

- scraper.py : Run to scrape job listings from LinkedIn based on keywords and locations defined in your configuration.
```

python scraper.py

```
- resume_parser.py : Parses a resume PDF, extracts text, uses AI to structure it, and saves it to Supabase.
```

# Ensure RESUME_FILE_PATH is set in 
your .env or config.py
python resume_parser.py

```
- score_jobs.py : Fetches unscored jobs from Supabase, retrieves your resume data, and uses AI to score each job against your resume.
```

python score_jobs.py 
your_email@example.com

```(Replace your_email@example.com with the email associated with your parsed resume in Supabase).
- job_manager.py : Performs job management tasks like marking old jobs as expired and checking if currently active jobs are still available on LinkedIn.
```

python job_manager.py

```
- custom_resume_generator.py : (Assuming its purpose) Generates custom resumes, possibly tailored for specific jobs.
```

# Usage might vary, e.g.:
python custom_resume_generator.py 
--job-id <job_id_from_supabase> 
--output-file custom_resume.pdf

```
- pdf_generator.py : This is likely a module used by other scripts (like custom_resume_generator.py ) to create PDF files. It can be tested or used independently if it has a main block.
### Automated Workflows
The project includes GitHub Actions workflows located in `.github/workflows` :

- hourly_resume_customization.yml : (Purpose inferred) Likely runs resume customization tasks hourly.
- job_manager.yml : Runs the job management script on a schedule.
- score_jobs.yml : Runs the job scoring script on a schedule.
- scrape_jobs.yml : Runs the job scraping script on a schedule.
These workflows require repository secrets to be set up for API keys and other sensitive configurations.

## Project Structure
```

.
├── .github/                    # GitHub 
Actions workflows
│   └── workflows/
│       ├── hourly_resume_customization.
yml
│       ├── job_manager.yml
│       ├── score_jobs.yml
│       └── scrape_jobs.yml
├── .gitignore                  # 
Specifies intentionally untracked files
├── config.py                   # Project 
configuration, loads .env variables
├── custom_resume_generator.py  # Script 
for generating custom/tailored resumes
├── job_manager.py              # Manages 
job statuses, checks active jobs
├── models.py                   # 
Pydantic models for data structures 
(Resume, Job, etc.)
├── parse_resume_with_ai.py     # 
AI-powered resume text parsing logic
├── pdf_generator.py            # 
Generates PDF resumes using ReportLab
├── requirements.txt            # Python 
dependencies
├── resume_parser.py            # Main 
script for parsing resume PDFs
├── resume_files/               # 
(Gitignored) Directory to store resume 
PDF files
├── score_jobs.py               # Scores 
jobs against a resume using AI
├── scraper.py                  # 
LinkedIn job scraping script
├── supabase_utils.py           # Utility 
functions for Supabase interaction
├── user_agents.py              # List of 
user agents for scraping
└── .env                        # 
(Gitignored) Environment variables (needs 
to be created)

```
## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue.
(You can add more specific contribution guidelines here).

## License
(Consider adding a license file, e.g., MIT License. If you do, state it here.)
This project is currently unlicensed.
```
