# LinkedIn Job Scraper & Application Assistant

This project is a comprehensive suite of tools designed to automate and enhance the job searching process, primarily focusing on LinkedIn. It scrapes job postings, parses resumes, scores job suitability against a candidate's resume, manages job application statuses, and can even generate custom PDF resumes. The system leverages AI (Google Gemini) for advanced text processing and Supabase for data storage.

## Features

- **LinkedIn Job Scraping**: Automatically scrapes job postings from LinkedIn. ([scraper.py](scraper.py))
- **Resume Parsing**:
  - Extracts text from PDF resumes using `pdfplumber`. ([resume_parser.py](resume_parser.py))
  - Utilizes Google Gemini AI to parse resume text into structured data ([parse_resume_with_ai.py](parse_resume_with_ai.py))
- **Job Scoring**: Scores job descriptions against a parsed resume using AI to determine suitability. ([score_jobs.py](score_jobs.py))
- **Job Management**:
  - Tracks the status of job applications.
  - Marks old or inactive jobs as expired.
  - Periodically checks if active jobs are still available on LinkedIn.
    ([job_manager.py](job_manager.py))
- **Data Storage**: Uses Supabase to store job data, resume details, and application statuses. (Utility functions in [supabase_utils.py](supabase_utils.py))
- **Custom PDF Resume Generation**: Generates ATS-friendly PDF resumes from structured resume data. ([pdf_generator.py](pdf_generator.py))
- **AI-Powered Text Processing**: Leverages Google Gemini for tasks like resume parsing and converting job descriptions to Markdown.
- **Automated Workflows**: Includes GitHub Actions for running tasks like job scraping, scoring, and management on a schedule. ([workflows](.github/workflows/))

## Tech Stack

- **Programming Language**: Python 3.11.9
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
    git clone https://github.com/anandanair/linkedin-jobs-scrapper
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
