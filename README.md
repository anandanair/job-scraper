# Job Scraper & Application Assistant

This project is a comprehensive suite of tools designed to automate and enhance the job searching process, primarily focusing on LinkedIn. It scrapes job postings, parses resumes, scores job suitability against a candidate's resume, manages job application statuses, and can even generate custom PDF resumes. The system leverages AI (Google Gemini) for advanced text processing and Supabase for data storage.

## Features

- **Job Scraping**: Automatically scrapes job postings. ([scraper.py](scraper.py))
- **Resume Parsing**:
  - Extracts text from PDF resumes using `pdfplumber`. ([resume_parser.py](resume_parser.py))
  - Utilizes Google Gemini AI to parse resume text into structured data ([parse_resume_with_ai.py](parse_resume_with_ai.py))
- **Job Scoring**: Scores job descriptions against a parsed resume using AI to determine suitability. ([score_jobs.py](score_jobs.py))
- **Universal LLM Support**: Supports 400+ model providers (Gemini, OpenAI, Anthropic, Ollama, Groq, etc.) via a unified abstraction layer. ([llm_client.py](llm_client.py))
- **Job Management**:
  - Tracks the status of job applications.
  - Marks old or inactive jobs as expired.
  - Periodically checks if active jobs are still available.
    ([job_manager.py](job_manager.py))
- **Data Storage**: Uses Supabase to store job data, resume details, and application statuses. (Utility functions in [supabase_utils.py](supabase_utils.py))
- **Custom PDF Resume Generation**: Generates ATS-friendly PDF resumes from structured resume data. ([pdf_generator.py](pdf_generator.py))
- **AI-Powered Text Processing**: Leverages any configured LLM for tasks like resume parsing and job description formatting.
- **Quota Management**: Built-in rate limiting, exponential backoff, and daily budget tracking for LLM API calls. Features dynamic model rotation (e.g., automatically switching between Gemini models) to bypass rate limitations.
- **Automated Workflows**: Includes optimized GitHub Actions for running tasks on a schedule without exhausting quotas. ([workflows](.github/workflows/))

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
- **AI/LLM**: `litellm` (Universal proxy supporting Gemini, OpenAI, Claude, etc.), `google-genai`
- **Database**: Supabase (`supabase`)
- **Data Validation**: `Pydantic`
- **Environment Management**: `python-dotenv`
- **Text Conversion**: `html2text`
- **CI/CD**: GitHub Actions

## Setup and Installation

This project is designed to run primarily through GitHub Actions. Follow these steps to set it up for your own use:

1.  **Fork the Repository:**
    - Click the "Fork" button at the top right of this page to create a copy of this repository in your own GitHub account.

2.  **Create a Supabase Project:**
    - Go to [Supabase](https://supabase.com/) and create a new project.
    - Once your project is created, navigate to the "SQL Editor" section.
    - Open the `supabase_setup/init.sql` file from this repository, copy its content, and run it in your Supabase SQL Editor. This will set up the necessary tables (like `jobs` and `customized_resumes`).

3.  **Obtain API Keys for Your LLM Provider:**
    - Get API key(s) from your chosen provider (e.g., [Google AI Studio](https://aistudio.google.com/app/apikey), [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/), etc.).

4.  **Configure GitHub Repository Secrets and Variables:**
    - In your forked GitHub repository, go to "Settings".
    - In the left sidebar, navigate to "Secrets and variables" under the "Security" section, and then click on "Actions".
    - **Add Repository Secrets** (Click "New repository secret"):
      - `LLM_API_KEY`: Your primary LLM API key (e.g., for Gemini or Groq). Also accepts legacy `GEMINI_FIRST_API_KEY`.
      - `OPENAI_API_KEY`: (Optional) Your OpenAI API key if using GPT models.
      - `ANTHROPIC_API_KEY`: (Optional) Your Anthropic API key if using Claude models.
      - `GROQ_API_KEY`: (Optional) Your Groq API key if using Groq models.
      - `LINKEDIN_EMAIL`: The email address associated with your resume.
      - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project's `service_role` key.
      - `SUPABASE_URL`: Your Supabase project's URL.
    - **Add Repository Variables** (Click the "Variables" tab, then "New repository variable"):
      - `LLM_MODEL`: (Optional) The model name (e.g., `gemini` to cycle Gemini models, or `openai/gpt-4o-mini`). Defaults to `gemini`.
      - `LLM_MAX_RPM`: (Optional) Max requests per minute for your API key. Default is `10`.
      - `LLM_REQUEST_DELAY_SECONDS`: (Optional) Delay between API calls in seconds. Default is `8`.
      - `JOBS_TO_SCORE_PER_RUN`: (Optional) Number of jobs to score per workflow run. Default is `1`.

5.  **Upload Your Resume:**
    - In your forked GitHub repository, upload your resume to the root directory. **The resume file must be named `resume.pdf`**.

6.  **Parse Your Resume:**
    - Go to the "Actions" tab in your forked GitHub repository.
    - Find the workflow named "Parse Resume Manually" in the list of workflows.
    - Click on it, and then click the "Run workflow" button. This will trigger the `resume_parser.py` script, which will extract information from your `resume.pdf`, parse it using AI, and store the structured data locally to `resume.json`.

7.  **Configure Job Search Parameters (Edit `config.py`):**
    - In your forked GitHub repository, navigate to the [config.py](config.py) file.
    - Edit the file to customize your job search preferences. The main variables you'll likely want to change are:

      ```python
      # --- Scraping Parameters ---
      SCRAPING_SOURCES = ["linkedin", "careers_future"] # Providers to scrape
      MAX_JOBS_PER_SEARCH = {
          "linkedin": 2, # Max jobs to scrape per LinkedIn query
          "careers_future": 10, # Max jobs to scrape per CareersFuture query
      }

      # --- LinkedIn Search Configuration ---
      LINKEDIN_SEARCH_QUERIES = ["it support", "full stack web developer", "application support", "cybersecurity analyst", "AI"] # Keywords for LinkedIn job search
      LINKEDIN_LOCATION = "Singapore" # Target location for LinkedIn jobs
      LINKEDIN_GEO_ID = 102454443 # Geographical ID for LinkedIn location (e.g., Singapore)
      LINKEDIN_JOB_TYPE = "F" # Job type: "F" for Full-time, "C" for Contract, etc.
      LINKEDIN_JOB_POSTING_DATE = "r86400" # Time filter: "r86400" for past 24 hours, "r604800" for past week, leave it empty for 'anytime'

      # --- Careers Future Search Configuration ---
      CAREERS_FUTURE_SEARCH_QUERIES = ["IT Support", "Full Stack Web Developer"]
      CAREERS_FUTURE_SEARCH_CATEGORIES = ["Information Technology"]
      CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES = ["Full Time"]

      # --- LLM Configuration (Optional) ---
      # LLM_MODEL = "gemini"                       # Google, dynamically switches models (Default)
      # LLM_MODEL = "groq/llama-3.3-70b-versatile" # Groq (Free)
      # LLM_MODEL = "openai/gpt-4o-mini"           # OpenAI
      ```

    - **IMPORTANT**: Do not modify other variables in `config.py` as they are carefully calibrated to prevent rate limiting and potential account bans. Only edit the search queries and location parameters shown above.
    - Commit the changes to your `config.py` file in your repository.

8.  **Enable GitHub Actions:**
    - Go to the "Actions" tab in your forked GitHub repository.
    - You will see a message saying "Workflows aren't running on this repository". Click the "Enable Actions on this repository" button (or a similar prompt) to allow the scheduled workflows to run automatically.
    - Ensure all workflows listed (e.g., `scrape_jobs.yml`, `score_jobs.yml`, `job_manager.yml`) are enabled. If any are disabled, you may need to enable them individually.

## Automated Workflows

Once the setup is complete and GitHub Actions are enabled, the workflows defined in [workflows](.github/workflows/) are scheduled to run automatically:

- **`scrape_jobs.yml`**: Periodically scrapes new job postings from LinkedIn and CareersFuture based on your `config.py` settings and saves them to your Supabase database.
- **`score_jobs.yml`**: Periodically scores the newly scraped jobs and jobs with custom resumes against your parsed resume / custom resume and updates the scores in the database.
- **`job_manager.yml`**: Periodically manages job statuses (e.g., marks old jobs as expired, checks if active jobs are still available).
- **`hourly_resume_customization.yml`**: (If enabled and configured) May run tasks related to customizing resumes for specific jobs.

You can monitor the execution of these actions in the "Actions" tab of your repository.

## Usage

After the initial setup and the "Parse Resume Manually" action has successfully run, the system will operate automatically through the scheduled GitHub Actions.

You can interact with the data directly through your Supabase dashboard to view scraped jobs, your parsed resume, and job scores.

### Web Interface for Viewing Data

A Next.js web application is available to view and manage the scraped jobs, your resume details, and job scores from the database.

- **Repository:** [jobs-scrapper-web](https://github.com/anandanair/jobs-scraper-web)
- **Setup:** To use the web interface, clone the `jobs-scrapper-web` repository and follow the setup instructions provided in its `README.md` file to run it locally. This will typically involve configuring it to connect to your Supabase instance.

The individual Python scripts can still be run locally for development or testing, but this requires setting up a local Python environment, installing dependencies from `requirements.txt`, and creating a local `.env` file with the necessary credentials (mirroring the GitHub secrets).

**Local Development Setup (Optional):**

1.  **Clone your forked repository locally:**
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
    playwright install # Install browser drivers for Playwright
    ```
4.  **Create a `.env` file:**
    - In the root of your local repository, create a `.env` file.
    - Add the keys and values that you configured as GitHub secrets:

      ```env
      # LLM Configuration
      LLM_MODEL="gemini"
      LLM_API_KEY="YOUR_LLM_API_KEY"
      LLM_MAX_RPM="10"
      JOBS_TO_SCORE_PER_RUN="1"

      # Optional: Provider-specific keys (if not using LLM_API_KEY)
      # OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
      # GROQ_API_KEY="YOUR_GROQ_API_KEY"

      # Supabase & LinkedIn
      SUPABASE_URL="YOUR_SUPABASE_URL"
      SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
      LINKEDIN_EMAIL="YOUR_LINKEDIN_EMAIL"
      ```

5.  **Run scripts locally (example):**
    ```bash
    python scraper.py
    python resume_parser.py
    python score_jobs.py
    python job_manager.py
    ```

## Project Structure

```
.
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── hourly_resume_customization.yml
│       ├── job_manager.yml
│       ├── parse_resume.yml
│       ├── score_jobs.yml
│       └── scrape_jobs.yml
├── .gitignore                  # Specifies intentionally untracked files that Git should ignore
├── README.md                   # This file
├── config.py                   # Configuration settings (API keys, search parameters)
├── custom_resume_generator.py  # Script to generate customized resumes (if applicable)
├── job_manager.py              # Manages job statuses
├── llm_client.py               # Universal LLM abstraction (LiteLLM) with rate limiting
├── models.py                   # Pydantic models for data validation
├── pdf_generator.py            # Generates PDF resumes
├── requirements.txt            # Python dependencies
├── resume_files/               # Folder to store your resume.pdf
├── resume_parser.py            # Main script to parse local resume PDF
├── score_jobs.py               # Scores job suitability against resumes
├── scraper.py                  # Core scraping logic for LinkedIn and CareersFuture
├── supabase_setup/             # SQL scripts for Supabase database initialization
│   └── init.sql
├── supabase_utils.py           # Utility functions for interacting with Supabase
└── user_agents.py              # List of user-agents for web scraping
```

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  **Fork the Repository:** Create your own fork of the project on GitHub.
2.  **Create a Branch:** Create a new branch in your fork for your feature or bug fix (e.g., `git checkout -b feature/your-awesome-feature` or `git checkout -b fix/issue-description`).
3.  **Make Changes:** Implement your changes in your branch.
4.  **Test Your Changes:** Ensure your changes work as expected and do not break existing functionality.
5.  **Commit Your Changes:** Commit your changes with clear and descriptive commit messages (e.g., `git commit -m 'feat: Add awesome new feature'`).
6.  **Push to Your Fork:** Push your changes to your forked repository (`git push origin feature/your-awesome-feature`).
7.  **Open a Pull Request:** Go to the original repository and open a Pull Request from your forked branch to the main branch of the original repository. Provide a clear description of your changes in the Pull Request.

Please ensure your code adheres to the existing style and that any new dependencies are added to `requirements.txt`.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

## Acknowledgements

- This project utilizes [LiteLLM](https://docs.litellm.ai/) as a universal proxy to support 400+ LLM providers.
- Originally built with the powerful [Google Gemini API](https://ai.google.dev/models/gemini) for AI-driven text processing.
- Data storage is managed with [Supabase](https://supabase.com/), an excellent open-source Firebase alternative.
- Web scraping capabilities are enhanced by [Playwright](https://playwright.dev/) and [Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/).
- PDF generation is handled by [ReportLab](https://www.reportlab.com/).
- PDF text extraction is performed using [pdfplumber](https://github.com/jsvine/pdfplumber).

## Disclaimer

This project is for educational and personal use only. Scraping websites like LinkedIn may be against their Terms of Service. Use this tool responsibly and at your own risk. The developers of this project are not responsible for any misuse or any action taken against your account by LinkedIn or other platforms.

## Contact

If you have any questions, suggestions, or issues, please open an issue on the GitHub repository.
