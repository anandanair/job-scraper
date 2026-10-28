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
  appliedTodayCount: number;
}

// --- Resume Style & Theme Interfaces ---

export type FontFamilyOption = "Helvetica" | "Times-Roman" | "Courier";
export type FontSizeScaleOption = "compact" | "normal" | "spacious";
export type LineSpacingOption = "tight" | "normal" | "relaxed";
export type HeaderAlignmentOption = "left" | "center";
export type HeaderStyleOption = "stacked_left" | "stacked_center" | "split_twocol";
export type SkillsLayoutOption = "grid_3col" | "inline_wrap";
export type MarginsOption = "compact" | "normal" | "wide";
export type HeadingStyleOption = "underline" | "left_bar" | "shaded_pill" | "borderless";
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

export type LLMProvider = "gemini" | "fireworks" | "openai" | "groq" | "anthropic";
export type LLMTier = "free" | "paid";

export interface AppSettings {
  id?: string;
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
  setup_step?: number;
  setup_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}


