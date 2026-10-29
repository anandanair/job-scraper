export interface ScrapedJob {
  job_id: string;
  company: string | null;
  job_title: string | null;
  level: string | null;
  location: string | null;
  description: string | null;
  provider: "linkedin" | "careers_future";
  posted_at?: string | null;
}

export interface CandidateJob {
  job_id: string;
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
}

export interface ScraperOptions {
  source?: "all" | "linkedin" | "careers_future";
  query?: string;
  limit?: number;
  dryRun?: boolean;
}

export interface LinkedInConfig {
  maxStart: number;
  requestTimeoutSeconds: number;
  maxRetries: number;
  retryDelaySeconds: number;
  detailFetchMinDelay: number;
  detailFetchMaxDelay: number;
  searchQueryMinDelay: number;
  searchQueryMaxDelay: number;
  location: string;
  geoId: string | number;
  jobType: string;
  jobPostingDate: string;
  f_WT: string;
}

export interface CareersFutureConfig {
  categories: string[];
  employmentTypes: string[];
  maxRetries: number;
  requestTimeoutSeconds: number;
}
