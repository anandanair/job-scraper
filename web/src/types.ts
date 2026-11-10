// Define basic types (you can refine these later based on your actual table structure)
export interface Job {
  job_id: string;
  company: string;
  job_title: string;
  level: string;
  location: string;
  description: string;
  status: string;
  is_active: boolean;
  application_date: string;
  resume_score?: number;
  notes?: string;
  scraped_at: string;
  last_checked: string;
  job_state: string;
  resume_score_stage: string;
  is_interested: boolean | null;
  customized_resume_id?: string | null;
  customized_resumes?: Resume | null;
  resume_link?: string | null;
  provider: string;
  follow_up_at?: string | null;
  next_event_at?: string | null;
  next_event_label?: string | null;
  status_history?: StatusHistoryEntry[] | null;
  cover_letters?: CoverLetter | { id: string; updated_at?: string } | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  workplace_type?: "remote" | "hybrid" | "onsite" | null;
  dream_score?: number | null;
  total_score?: number | null;
  score_breakdown?: ScoreBreakdown | null;
  application_url?: string | null;
  job_interview_prep?: JobInterviewPrep | null;
}

export interface ScoreBreakdown {
  hard_skills_score?: number;
  experience_score?: number;
  seniority_score?: number;
  culture_fit_score?: number;
  // Dream Hunter sub-scores (sum up to 100)
  dream_craft_score?: number;
  dream_workplace_score?: number;
  dream_seniority_score?: number;
  dream_culture_score?: number;
  culture_analysis?: string; // Transparent reasoning of how company intel and reviews affected scoring
  // Grounded Company Intelligence transparency
  company_intel?: {
    company_name?: string;
    glassdoor_rating?: number | null;
    glassdoor_reviews_count?: number | null;
    summary?: string | null;
    source_snippets?: Array<{ title: string; snippet: string; link: string }>;
    is_cached?: boolean;
    retrieved_at?: string;
  };
  matched_skills: string[];
  skill_gaps: string[];
  key_strengths?: string[];
  red_flags?: string[];
  actionable_advice?: string;
}

export interface CompanyProfile {
  company_name: string;
  domain?: string | null;
  industry?: string | null;
  size_band?: string | null;
  headquarters?: string | null;
  glassdoor_rating?: number | null;
  glassdoor_reviews_count?: number | null;
  culture_summary?: string | null;
  source_snippets?: Array<{ title: string; snippet: string; link: string }>;
  created_at?: string;
  updated_at?: string;
  is_cached?: boolean;
}

// Append-only record of a single status transition
export interface StatusHistoryEntry {
  from: string | null;
  to: string;
  at: string;
  note?: string;
}

// --- Resume Related Interfaces ---

export interface Education {
  degree: string;
  field_of_study: string | null;
  institution: string;
  start_year: string | null;
  end_year: string | null;
}

export interface Experience {
  job_title: string;
  company: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface Project {
  name: string;
  description: string | null;
  technologies: string[] | null;
}

export interface Certification {
  name: string;
  issuer: string | null;
  year: string | null;
}

export interface Links {
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

// Updated Resume Interface
export interface Resume {
  id: string; // Assuming this is the primary key for the resume table
  name: string;
  email: string;
  created_at: string; // Keep this if it's the resume creation timestamp
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
  languages: string[];
  links: Links; // Changed to single object based on Python model
  parsed_at: string;
  last_updated?: string; // Optional field for last update timestamp
  resume_link?: string; // Optional field for resume link ur
  theme_config?: ResumeThemeConfig | null; // Optional snapshot of resume theme settings
}

// --- Multi-Stage Resume Tailoring Types ---
export interface RoleGuidance {
  company: string;
  job_title: string;
  key_achievements_to_highlight: string[];
  points_to_condense_or_omit: string[];
}

export interface CurationPlan {
  strategy_summary: string;
  target_role_pain_points: string[];
  selected_project_names: string[];
  selected_skills: string[];
  missing_skills_acknowledged: string[];
  experience_guidance: RoleGuidance[];
}

export interface DashboardStats {
  totalNewJobs: number;
  totalAppliedJobs: number;
  totalTopMatches: number;
  expiredJobsCount: number;
  pendingScoreJobsCount: number;
  scoredJobsCount: number;
  customResumeJobsCount: number;
  noCustomResumeJobsCount: number;
  scoredWithOriginalResumeCount: number;
  scoredWithCustomResumeCount: number;
  linkedInJobsCount: number;
  careersFutureJobsCount: number;
  remoteOkJobsCount: number;
  atsJobsCount: number;
  appliedTodayCount: number;
}

// --- Resume Style & Theme Interfaces ---

export type FontFamilyOption = "Helvetica" | "Times-Roman" | "Courier";
export type FontSizeScaleOption = "compact" | "normal" | "spacious";
export type LineSpacingOption = "tight" | "normal" | "relaxed";
export type HeaderAlignmentOption = "left" | "center";
export type HeaderStyleOption =
  | "stacked_left"
  | "stacked_center"
  | "split_twocol";
export type SkillsLayoutOption = "grid_3col" | "inline_wrap";
export type MarginsOption = "compact" | "normal" | "wide";
export type HeadingStyleOption =
  | "underline"
  | "left_bar"
  | "shaded_pill"
  | "borderless";
export type ResumeSectionKey =
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "projects"
  | "certifications"
  | "languages";

export interface ResumeThemeConfig {
  preset: string;
  typography: {
    fontFamily: FontFamilyOption;
    fontSizeScale: FontSizeScaleOption;
    lineSpacing: LineSpacingOption;
  };
  colors: {
    primary: string;
    secondary: string;
    text: string;
    light: string;
    divider: string;
  };
  layout: {
    headerAlignment: HeaderAlignmentOption;
    headerStyle?: HeaderStyleOption;
    professionalTitle?: string;
    showDividers: boolean;
    dividerThickness: number;
    skillsLayout: SkillsLayoutOption;
    margins: MarginsOption;
    headingStyle?: HeadingStyleOption;
    sectionOrder: ResumeSectionKey[];
    hiddenSections?: ResumeSectionKey[];
    customSectionTitles?: Partial<Record<ResumeSectionKey, string>>;
  };
}

export interface ResumeStyleSetting {
  id?: string;
  name: string;
  preset: string;
  is_active: boolean;
  theme_config: ResumeThemeConfig;
  created_at?: string;
  updated_at?: string;
}


// --- App Settings & Configuration Interfaces ---

export type LLMProvider =
  | "gemini"
  | "fireworks"
  | "openai"
  | "groq"
  | "anthropic";
export type LLMTier = "free" | "paid";
export type JobSearchMode = "get_hired_fast" | "dream_hunter";

export interface AppSettings {
  id?: string;
  job_search_mode?: JobSearchMode;
  llm_provider: LLMProvider;
  llm_model: string;
  llm_api_key?: string | null;
  llm_tier: LLMTier;
  linkedin_search_queries: string[];
  linkedin_location: string;
  linkedin_geo_id: string;
  linkedin_job_type?: string;
  linkedin_job_posting_date?: string;
  linkedin_f_wt?: string;
  careers_future_search_queries: string[];
  careers_future_search_categories?: string[];
  careers_future_search_employment_types?: string[];
  scraping_sources: string[];
  jobs_to_score_per_run: number;
  jobs_to_customize_per_run: number;
  max_jobs_per_search?: Record<string, number>;
  llm_max_rpm: number;
  llm_request_delay_seconds: number;
  llm_daily_request_budget: number;
  schedule_timezone?: string;
  schedule_hour?: number;
  schedule_minute?: number;
  last_scraped_at?: string | null;
  dream_job_profile?: DreamJobProfile | null;
  search_locations?: SearchLocation[] | null;
  setup_step?: number;
  setup_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

// --- Automation Runs & Telemetry Interfaces ---

export type AutomationRunStatus = "running" | "success" | "warning" | "failed" | "skipped" | "stopped";
export type AutomationWorkflowId = "scrape_jobs" | "score_jobs" | "customize_resumes" | "job_manager";

export interface AutomationRun {
  id: string;
  workflow_name: string;
  workflow_id: AutomationWorkflowId;
  status: AutomationRunStatus;
  trigger_type: "schedule" | "workflow_dispatch" | "local_cli" | "local_web";
  started_at: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
  summary?: string | null;
  metrics: Record<string, any>;
  error_count: number;
  warning_count: number;
  error_message?: string | null;
  errors_list: string[];
  log_output?: string | null;
  github_run_id?: string | null;
  github_run_number?: string | null;
  github_run_url?: string | null;
  created_at: string;
}

// --- Cover Letter Interfaces ---

export type CoverLetterTone =
  | "confident_professional"
  | "executive"
  | "technical"
  | "short_note";

export interface CoverLetter {
  id: string;
  job_id: string;
  content: string;
  tone: CoverLetterTone;
  created_at: string;
  updated_at: string;
}

// --- Dream Job Profile & Multi-Region Interfaces ---

export interface SearchLocation {
  id: string;
  name: string;
  country: string;
  geoId?: string | number;
  enabled: boolean;
}

export interface DreamJobProfile {
  target_titles: string[];
  target_seniorities: string[]; // "junior" | "mid" | "senior" | "lead" | "manager"
  workplace_models: string[]; // "remote" | "hybrid" | "onsite"
  relocation_preference?: string[];
  salary_floor_min?: number | null;
  salary_floor_currency?: string;
  salary_floor_period?: "month" | "year";
  favorite_tech_stack: string[];
  dealbreaker_tech_stack: string[];
  company_stages?: string[]; // "startup" | "scaleup" | "enterprise"
  culture_priorities?: string[]; // "wlb" | "ai_rd" | "autonomy" | "equity" | "mentorship"
  blacklisted_companies?: string[];
  target_ats_companies?: string[]; // Greenhouse/Lever/Ashby slugs e.g. ["grab", "stripe", "carousell"]
}

// --- On-Demand Outreach & Networking Interfaces ---

export interface OutreachVariants {
  linkedin_connection_note: string; // Under 300 characters
  cold_inmail: string; // ~150 words
  referral_request: string; // Warm referral message
}

// --- On-Demand Interview Preparation Interfaces ---

export interface BehavioralStarAnswer {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface TechnicalQuestionItem {
  question: string;
  topic: string;
  answer_guide: string;
}

export interface JobInterviewPrep {
  id: string;
  job_id: string;
  technical_questions: TechnicalQuestionItem[];
  behavioral_star: BehavioralStarAnswer[];
  reverse_questions: string[];
  company_brief?: string | null;
  created_at: string;
  updated_at: string;
}
