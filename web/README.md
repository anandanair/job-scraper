# Web: Fullstack Next.js Application & Automation Engine

The `web/` directory contains the complete Next.js 16 fullstack application, UI dashboard, API endpoints, and TypeScript automation workers for **JobTrack**.

---

## Key Capabilities

1. **Interactive Setup Wizard (`/setup`)**:
   - 5-step guided onboarding: Supabase database connection & SQL verification, AI provider configuration & live test, job search preferences & location combobox, resume PDF upload & AI parsing, and automated GitHub Actions secret injection via Tweetsodium.
2. **Dashboard & Job Pipeline (`/`, `/jobs/new`, `/jobs/top-matches`, `/jobs/applied`)**:
   - View newly scraped jobs, suitability scores, applied statuses, and detailed job views.
   - On-demand single-click AI job rescoring and custom resume tailoring.
3. **Master Resume Studio (`/resume-studio`)**:
   - Dual-mode editor:
     - **Resume Content**: Edit structured profile details, experiences, projects, skills tags, education, certifications.
     - **Design & Style**: ATS visual styling controls (typography scale, font family, line spacing, margins, header alignment, custom section ordering, divider styles).
   - Live 1:1 ATS-compliant PDF generation and preview via PDFKit.
4. **Settings & Dynamic AI Config (`/settings`)**:
   - Switch AI providers (Google Gemini, Fireworks AI, OpenAI, Anthropic, Groq) with live key verification, model selectors, and RPM/quota controls stored directly in Supabase.
5. **Background Batch Workers (`scripts/`)**:
   - Executable TypeScript worker scripts run locally or by scheduled GitHub Actions:
     - `score-jobs.ts`: Evaluates unscored jobs against the candidate's resume (0–100 score).
     - `customize-resumes.ts`: Tailors resumes for top-scoring jobs.
     - `job-manager.ts`: Verifies live job availability and marks expired postings.
     - `parse-resume.ts`: Parses uploaded `resume.pdf` into structured JSON schema in Supabase.

---

## Directory Structure

```
web/
├── scripts/                    # Automation worker scripts (executed via tsx)
│   ├── score-jobs.ts           # Batch job scoring script
│   ├── customize-resumes.ts    # Batch resume tailoring script
│   ├── job-manager.ts          # Job expiration & active status check
│   └── parse-resume.ts         # Resume PDF parser
├── src/
│   ├── app/                    # Next.js App Router (Pages and API Route Handlers)
│   │   ├── api/                # Backend API routes
│   │   │   ├── base-resume/    # Base resume management
│   │   │   ├── customized_resumes/ # Tailored resume endpoints
│   │   │   ├── jobs/           # Job actions, rescore, customize
│   │   │   ├── resume-style/   # ATS style configuration
│   │   │   ├── settings/       # App settings & LLM test
│   │   │   └── setup/          # Setup wizard API endpoints
│   │   ├── jobs/               # Job pages (new, top-matches, applied, [id])
│   │   ├── resume-studio/      # Master Resume Studio
│   │   ├── resume-style/       # Style & preset settings
│   │   ├── settings/           # Settings page
│   │   └── setup/              # Setup wizard page
│   ├── components/             # React components organized by feature
│   │   ├── jobs/               # Job listing and detail components
│   │   ├── resume/             # Resume editing forms and tag list editor
│   │   ├── resume-studio/      # Resume Studio dual-mode UI
│   │   ├── resume-style/       # ATS styling controls
│   │   ├── settings/           # Settings dashboard components
│   │   └── setup/              # Multi-step setup wizard components
│   ├── lib/                    # Core business logic
│   │   ├── llm.ts              # Universal LLM caller (Gemini, Fireworks, OpenAI, Anthropic, Groq)
│   │   ├── pdf.ts              # ATS-compliant PDF generation engine (PDFKit)
│   │   ├── resumeParser.ts     # Resume PDF text extraction and AI parsing
│   │   ├── resumeSanitizer.ts  # Resume schema sanitation and validation
│   │   ├── resume-presets.ts   # ATS styling default presets
│   │   ├── setup/              # Setup wizard helpers, schema, geoLocations, models
│   │   └── supabase/           # Supabase database queries and storage helpers
│   ├── utils/supabase/         # Supabase client/server initializers
│   └── types.ts                # TypeScript interfaces (Job, Resume, Theme, Settings)
├── package.json
└── tsconfig.json
```

---

## Commands

Run from `web/` or from the root directory using root npm shortcuts:

```bash
# Development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run worker scripts
npm run score           # Evaluates unscored jobs
npm run customize       # Tailors resumes for top matches
npm run manage          # Verifies active status of jobs
npm run parse-resume    # Parses resume.pdf
```
