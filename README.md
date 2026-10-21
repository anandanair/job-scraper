# Job Scraper & Application Assistant

This project is a comprehensive suite of tools designed to automate and enhance the job searching process, primarily focusing on LinkedIn and CareersFuture. It scrapes job postings, parses resumes, scores job suitability against a candidate's resume, manages job application statuses, and can even generate custom PDF resumes. The system leverages AI (Fireworks AI, Google Gemini, OpenAI, Claude, etc.) for advanced text processing and Supabase for data storage.

## Features

- **Job Scraping**: Automatically scrapes job postings from LinkedIn and CareersFuture. ([scraper.py](scraper.py))
- **Resume Parsing**:
  - Extracts text from PDF resumes using `pdfplumber`. ([resume_parser.py](resume_parser.py))
  - Uses AI to parse resume text into structured data and saves it securely to Supabase.
- **Job Scoring**: Scores job descriptions against a parsed resume using AI to determine suitability (0–100 score). ([score_jobs.py](score_jobs.py))
- **Universal LLM Support**: Supports 400+ model providers (Fireworks AI, Gemini, OpenAI, Anthropic, Groq, Ollama, etc.) via a unified LiteLLM abstraction layer. ([llm_client.py](llm_client.py))
- **Job Management**:
  - Tracks the status of job applications.
  - Marks old or inactive jobs as expired.
  - Periodically checks if active jobs are still available. ([job_manager.py](job_manager.py))
- **Data Storage**: Uses Supabase to store job data, resume details, and application statuses. ([supabase_utils.py](supabase_utils.py))
- **Custom PDF Resume Generation**: Generates ATS-friendly PDF resumes from structured resume data. ([pdf_generator.py](pdf_generator.py))
- **AI-Powered Text Personalization**: Tailors resume summaries and bullet points specifically for top-matching jobs. ([custom_resume_generator.py](custom_resume_generator.py))
- **Automated Workflows**: Includes pre-configured GitHub Actions for running tasks on a schedule. ([workflows](.github/workflows/))

## Tech Stack

- **Programming Language**: Python 3.11+
- **Web Scraping/HTTP**: `requests`, `httpx`, `BeautifulSoup4`
- **PDF Processing**: `pdfplumber` (extraction), `ReportLab` (ATS PDF generation)
- **AI/LLM**: `litellm` (Fireworks AI, Gemini, OpenAI, Claude, Groq, etc.)
- **Database & Storage**: Supabase (`supabase`)
- **Data Validation**: `Pydantic`
- **CI/CD**: GitHub Actions

---

## Complete Setup and Installation Guide

Follow these steps to get the project running in under 10 minutes:

### Step 1: Fork the Repository
Click the **Fork** button at the top-right of this GitHub repository to create a copy under your own account.

---

### Step 2: Create a Supabase Project & Run the Database Setup

1. Go to [Supabase](https://supabase.com/) and create a free account or log in.
2. Click **"New Project"**, choose an organization, give it a name, and set a database password.
3. Once your project is created (takes ~1 minute), navigate to the **SQL Editor** tab (the `>_` icon on the left sidebar).
4. Click **"New query"**.
5. Open the [`supabase_setup/init.sql`](supabase_setup/init.sql) file from this repository, copy its entire contents, paste it into the Supabase SQL Editor, and click **"Run"**.
   - *What this does*: Automatically creates all database tables (`jobs`, `base_resume`, `customized_resumes`, `resume_style_settings`), indexes, triggers, and creates both private storage buckets (`resumes` and `personalized_resumes`).

---

### Step 3: Get Your Supabase Credentials

> [!NOTE]
> **Supabase recently renamed API keys:**
> - The old **`service_role` key** is now called the **Secret key** (`sb_secret_...`).
> - The old **`anon` key** is now called the **Publishable key** (`sb_publishable_...`).

There are two easy ways to find your credentials:

#### Option A: The "Connect" Button (Fastest)
1. At the very top header of your Supabase dashboard (next to your project name), click the **"Connect"** button.
2. Select **Python** or **Next.js**.
3. It will display your ready-to-copy credentials:
   - **Project URL** (e.g., `https://abcdefghijkl.supabase.co`)
   - **Secret key** (starts with `sb_secret_...` or legacy JWT string)
   - **Publishable / Anon key** (starts with `sb_publishable_...`)

#### Option B: From Project Settings
1. Click the **Project Settings** (gear icon at the bottom of the left sidebar).
2. Go to **API** (or **API Keys**):
   - **Project URL**: Found under the *Project URL* section.
   - **Secret key**: Click *Reveal* next to your Secret key — this is your `SUPABASE_SERVICE_ROLE_KEY`.

---

### Step 4: Choose Your LLM Provider & Get an API Key

You can use any LLM provider. Here are the most popular options:

* **Fireworks AI (Recommended — Fast & Inexpensive)**:
  - Sign up at [Fireworks AI](https://fireworks.ai/) and create an API key at [fireworks.ai/api-keys](https://fireworks.ai/api-keys).
  - Great recommended models:
    - `accounts/fireworks/models/glm-5p3-flash` (very fast and economical)
    - `accounts/fireworks/models/llama-v3p3-70b-instruct`
* **Google Gemini**:
  - Get a free or pay-as-you-go key from [Google AI Studio](https://aistudio.google.com/app/apikey).
  - Supported models: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`.
* **Groq, OpenAI, Anthropic, or DeepSeek**:
  - Supported directly via their standard API keys (`GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

---

### Step 5: Configure GitHub Repository Secrets

In your forked GitHub repository:
1. Navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Click **"New repository secret"** and add the following:

| Secret Name | Required? | Value / Description | Example |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **Yes** | Your Supabase Project URL | `https://abcdefghijkl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Your Supabase Secret / Service Role Key | `sb_secret_...` |
| `FIREWORKS_API_KEY` | If using Fireworks | Your Fireworks AI API key | `fw_...` |
| `LLM_API_KEY` | If using Gemini/other | Your primary LLM API key | `AIzaSy...` |
| `OPENAI_API_KEY` | Optional | OpenAI API key (if using GPT models) | `sk-...` |
| `ANTHROPIC_API_KEY`| Optional | Anthropic API key (if using Claude) | `sk-ant-...` |
| `GROQ_API_KEY` | Optional | Groq API key | `gsk_...` |

*(Optional)* You can also add a **Repository Variable** (under the "Variables" tab) named `LLM_MODEL` with your model name (e.g., `accounts/fireworks/models/glm-5p3-flash`). If not set, it defaults to the model in [`config.py`](config.py).

---

### Step 6: Upload Your Resume to Supabase Storage

1. In your Supabase dashboard, click **Storage** in the left sidebar.
2. Open the **`resumes`** bucket (created in Step 2).
3. Click **"Upload files"** and upload your resume.
4. **Important**: The file must be named exactly **`resume.pdf`**.

> [!TIP]
> **Privacy & Security**: Your resume is stored in your private Supabase Storage bucket. It is **never committed to GitHub**, keeping your personal contact information secure.

---

### Step 7: Parse Your Resume

1. Go to the **Actions** tab in your forked GitHub repository.
2. In the left workflow list, select **"Parse Resume Manually"**.
3. Click **"Run workflow"** > **"Run workflow"**.
4. This script downloads `resume.pdf` from Supabase Storage, parses it with AI, and stores your structured experience, skills, and education into the `base_resume` database table.

---

### Step 8: Customize Job Search Preferences ([`config.py`](config.py))

Edit [`config.py`](config.py) directly on GitHub or locally to configure the jobs you are looking for:

```python
# --- Search Configuration ---
LINKEDIN_SEARCH_QUERIES = ["Software Engineer", "Full Stack Developer"]  # Your job titles
LINKEDIN_LOCATION = "Singapore"                                          # Target city/country
LINKEDIN_GEO_ID = 102454443                                              # Singapore: 102454443, Dubai: 100205264, US: 103644278
LINKEDIN_JOB_TYPE = "F"                                                  # F=Full-time, C=Contract, P=Part-time, I=Internship
LINKEDIN_JOB_POSTING_DATE = "r86400"                                     # r86400=Past 24h, r604800=Past week

# --- Which Platforms to Scrape ---
SCRAPING_SOURCES = ["linkedin", "careers_future"]  # Both platforms are supported!

# --- LLM Model Selection ---
LLM_MODEL = "accounts/fireworks/models/glm-5p3-flash"  # Or "gemini", "openai/gpt-4o-mini", etc.
```

Commit your changes to [`config.py`](config.py).

---

### Step 9: Enable Automated GitHub Actions

1. In your forked repository, click the **Actions** tab.
2. If GitHub displays a banner saying *"Workflows aren’t running on this forked repository"*, click **"Enable Actions on this repository"**.
3. The automated background workflows will now run on a schedule:
   - **`Daily Job Scraper`** (`scrape_jobs.yml`): Runs twice daily at 11:30 AM SGT (`30 3 * * *`) and 7:00 PM SGT (`0 11 * * *`) to capture both morning and end-of-day postings.
   - **`Job Scorer`** (`score_jobs.yml`): Runs every 4 hours to score unscored jobs against your resume (0–100) in batches of 10 (`JOBS_TO_SCORE_PER_RUN = 10`).
   - **`Daily Job Manager`** (`job_manager.yml`): Runs daily to mark jobs older than 30 days as expired and check if postings are still active.
   - **`Resume Customization`** (`hourly_resume_customization.yml`): Runs every 3 hours (`0 */3 * * *`) to generate custom tailored resumes (2 per run) for jobs with `resume_score >= 70`.

---

## Viewing Your Jobs: Web Interface

A modern Next.js web application is available to view scraped jobs, filter by score/interest, track applications, customize your base resume and ATS styling via **Resume Studio**, on-demand tailor custom resumes, rescore jobs with AI, and preview generated PDF resumes.

- **Frontend Repository**: [jobs-scrapper-web](https://github.com/anandanair/jobs-scrapper-web)
- **Key Features Included**:
  - **Resume Studio (`/resume-studio`)**: Dual-mode master resume editor (`Resume Content` + `Design & Style`) with live ATS persona switching, tag chip editor, unified save/reset, and calibrated 1:1 PDF typesetting with orphan heading prevention.
  - **Pipeline Dashboard**: Interactive pipeline tracking, metrics, and clear score distinction between base and tailored resumes.
  - **On-Demand AI Tailoring & Rescoring**: Tailor any resume for a specific job description with single-click AI optimization.
- **Setup**:
  1. Clone `jobs-scrapper-web`:
     ```bash
     git clone https://github.com/anandanair/jobs-scrapper-web.git
     cd jobs-scrapper-web
     npm install
     ```
  2. Create a `.env.local` file with your Supabase and LLM credentials:
     ```env
     NEXT_PUBLIC_SUPABASE_URL="https://<YOUR_PROJECT_REF>.supabase.co"
     NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
     SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."

     # Optional: Enables on-demand in-app resume tailoring & rescoring
     LLM_API_KEY="AIzaSy... or fw_..."
     LLM_MODEL="accounts/fireworks/models/glm-5p3-flash"
     ```
  3. Start the dashboard:
     ```bash
     npm run dev
     ```
  4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Local Development (Optional)

If you prefer to run or test the Python scripts on your local machine:

1. **Clone your repository locally:**
   ```bash
   git clone https://github.com/<your-username>/linkedin-jobs-scrapper.git
   cd linkedin-jobs-scrapper
   ```
2. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Create a `.env` file in the root folder:**
   ```env
   SUPABASE_URL="https://<YOUR_PROJECT_REF>.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
   FIREWORKS_API_KEY="fw_..."
   LLM_MODEL="accounts/fireworks/models/glm-5p3-flash"
   ```
5. **Run any script directly:**
   ```bash
   python scraper.py        # Scrapes new jobs
   python resume_parser.py  # Parses your resume PDF from Supabase
   python score_jobs.py     # Scores jobs against your resume
   python job_manager.py    # Manages expiration and active status
   ```

---

## Project Structure

```
.
├── .github/workflows/          # Automated GitHub Actions
│   ├── hourly_resume_customization.yml
│   ├── job_manager.yml
│   ├── parse_resume.yml
│   ├── score_jobs.yml
│   └── scrape_jobs.yml
├── config.py                   # Job search parameters & LLM configurations
├── custom_resume_generator.py  # Generates tailored resumes for top-scored jobs
├── job_manager.py              # Manages job statuses & expires old jobs
├── llm_client.py               # Universal LLM client (LiteLLM) with rate limiting
├── models.py                   # Pydantic models for structured resume & job validation
├── pdf_generator.py            # Generates ATS-friendly PDF resumes (ReportLab)
├── requirements.txt            # Python dependencies
├── resume_parser.py            # Extracts text from resume PDF & parses with AI
├── score_jobs.py               # Evaluates job suitability against candidate profile
├── scraper.py                  # Core scraping engine (LinkedIn & CareersFuture)
├── supabase_setup/
│   └── init.sql                # Complete database schema & storage setup
├── supabase_utils.py           # Database & Storage helper functions
└── user_agents.py              # Modern browser User-Agent rotation pool
```

## Contributing

Contributions, bug reports, and suggestions are welcome! Feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is created for educational and personal career-search purposes. Please ensure your scraping frequency adheres to platform policies and respect rate limits.
