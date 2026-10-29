import { Job, Resume, DashboardStats, ResumeThemeConfig, ResumeStyleSetting, AppSettings } from "@/types";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";
import { createSupabaseServerClient, createSupabaseStaticClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";
import { PostgrestError } from "@supabase/supabase-js";

// Helper function to handle Supabase response errors
async function handleResponse({
  data,
  error,
}: {
  data: any[] | null; // Keep 'any' for flexibility or refine if possible
  error: PostgrestError | null;
}): Promise<any> {
  // Keep 'any' or refine return type
  if (error) {
    console.error("Supabase response error:", error);
    throw new Error(error.message); // Or handle error more gracefully
  }
  // Allow returning empty arrays or potentially null for single results handled elsewhere
  // Removed the !data check here as it might be too strict for all cases
  return data;
}

// --- Query Functions ---

export async function getTopScoredJobs(
  page: number = 1, // Default to page 1
  pageSize: number = 10, // Default page size
  provider?: string, // Optional provider filter
  minScore: number = 50, // Default minScore
  maxScore: number = 100, // Default maxScore
  isInterested?: boolean | null, // Optional interest filter (true, false, or null for 'not marked')
  searchQuery?: string, // Optional search query
): Promise<Job[]> {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("jobs")
    .select("*, customized_resumes(id, resume_link)")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new")
    .not("resume_score", "is", null)
    .gte("resume_score", minScore)
    .lte("resume_score", maxScore);

  if (provider) {
    query = query.eq("provider", provider);
  }

  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  } else {
    // Default: show null or true
    query = query.or("is_interested.is.null,is_interested.eq.true");
  }

  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  query = query
    .order("resume_score", { ascending: false })
    .order("scraped_at", { ascending: false })
    .range(from, to);

  const response = await query;
  const data = await handleResponse(response);
  return data ?? [];
}

// New function to get the count of top scored jobs
// Updated to support provider, score, interest, and search filtering
export async function getTopScoredJobsCount(
  provider?: string,
  minScore: number = 50, // Default minScore
  maxScore: number = 100, // Default maxScore
  isInterested?: boolean | null, // Optional interest filter
  searchQuery?: string, // Optional search query
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact", head: true }) // Select count only
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new")
    .not("resume_score", "is", null)
    .gte("resume_score", minScore) // Apply minScore filter
    .lte("resume_score", maxScore); // Apply maxScore filter

  // Add provider filter if specified
  if (provider) {
    query = query.eq("provider", provider);
  }

  // Add interest filter if specified
  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  } else {
    query = query.or("is_interested.is.null,is_interested.eq.true");
  }

  // Add search query filter if specified
  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  const { count, error } = await query;

  if (error) {
    console.error("Supabase count error:", error.message || "Unknown error");
    throw new Error(error.message || "Failed to get job count");
  }

  return count ?? 0; // Return the count or 0 if null
}

export async function getNewJobs(
  page: number = 1,
  pageSize: number = 10,
  provider?: string, // Optional provider filter
  minScore?: number, // Optional minScore filter
  maxScore?: number, // Optional maxScore filter
  isInterested?: boolean | null, // Optional interest filter (true, false, or null for 'not marked')
  searchQuery?: string, // Optional search query
): Promise<Job[]> {
  const supabase = await createSupabaseServerClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("jobs")
    .select("*, customized_resumes(id, resume_link)")
    .eq("is_active", true)
    .eq("status", "new") // Filter by status
    .eq("job_state", "new");

  // Only apply score filter if explicitly provided by user
  if (minScore !== undefined) {
    query = query.gte("resume_score", minScore);
  }
  if (maxScore !== undefined) {
    query = query.lte("resume_score", maxScore);
  }

  // Add provider filter if specified
  if (provider) {
    query = query.eq("provider", provider);
  }

  // Add interest filter if specified
  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  } else {
    // Default behavior from original function: is_interested is null or true
    query = query.or("is_interested.is.null,is_interested.eq.true");
  }

  // Add search query filter if specified
  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  // Order strictly by newest scraped_at first (pure intake feed)
  query = query
    .order("scraped_at", { ascending: false })
    .range(from, to);

  const response = await query;
  return handleResponse(response);
}

// Function to get the count of all active jobs with filters
export async function getAllActiveJobsCount(
  provider?: string, // Optional provider filter
  minScore?: number, // Optional minScore filter
  maxScore?: number, // Optional maxScore filter
  isInterested?: boolean | null, // Optional interest filter
  searchQuery?: string, // Optional search query
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact", head: true }) // Select count only
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  // Only apply score filter if explicitly provided by user
  if (minScore !== undefined) {
    query = query.gte("resume_score", minScore);
  }
  if (maxScore !== undefined) {
    query = query.lte("resume_score", maxScore);
  }

  // Add provider filter if specified
  if (provider) {
    query = query.eq("provider", provider);
  }

  // Add interest filter if specified
  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  }
  // If isInterested is undefined, no additional filter is applied for interest status.

  // Add search query filter if specified
  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  const { count, error } = await query;

  if (error) {
    console.error("Supabase count error (all active jobs):", error);
    throw new Error(error.message); // Or return 0, depending on desired behavior
  }

  return count ?? 0; // Return the count or 0 if null
}

// Function to get jobs with custom resumes generated (Tailored & Ready)
export async function getTailoredJobs(
  page: number = 1,
  pageSize: number = 10,
  provider?: string,
  minScore?: number,
  maxScore?: number,
  isInterested?: boolean | null,
  searchQuery?: string,
): Promise<Job[]> {
  const supabase = await createSupabaseServerClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("jobs")
    .select("*, customized_resumes(id, resume_link)")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new")
    .not("customized_resume_id", "is", null);

  if (minScore !== undefined) {
    query = query.gte("resume_score", minScore);
  }
  if (maxScore !== undefined) {
    query = query.lte("resume_score", maxScore);
  }
  if (provider) {
    query = query.eq("provider", provider);
  }

  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  } else {
    query = query.or("is_interested.is.null,is_interested.eq.true");
  }

  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  query = query
    .order("resume_score", { ascending: false })
    .order("scraped_at", { ascending: false })
    .range(from, to);

  const response = await query;
  return handleResponse(response);
}

// Function to get the count of jobs with custom resumes generated
export async function getTailoredJobsCount(
  provider?: string,
  minScore?: number,
  maxScore?: number,
  isInterested?: boolean | null,
  searchQuery?: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new")
    .not("customized_resume_id", "is", null);

  if (minScore !== undefined) {
    query = query.gte("resume_score", minScore);
  }
  if (maxScore !== undefined) {
    query = query.lte("resume_score", maxScore);
  }
  if (provider) {
    query = query.eq("provider", provider);
  }

  if (isInterested === true) {
    query = query.is("is_interested", true);
  } else if (isInterested === false) {
    query = query.is("is_interested", false);
  } else if (isInterested === null) {
    query = query.is("is_interested", null);
  } else {
    query = query.or("is_interested.is.null,is_interested.eq.true");
  }

  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  const { count, error } = await query;

  if (error) {
    console.error("Supabase count error (tailored jobs):", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

export interface JobsTabCounts {
  newCount: number;
  matchesCount: number;
  tailoredCount: number;
}

// Helper to fetch live counts for all 3 Jobs Hub tabs in parallel
export async function getJobsTabCounts(): Promise<JobsTabCounts> {
  const supabase = await createSupabaseServerClient();

  const [newRes, matchesRes, tailoredRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new")
      .or("is_interested.is.null,is_interested.eq.true"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new")
      .not("resume_score", "is", null)
      .gte("resume_score", 50)
      .or("is_interested.is.null,is_interested.eq.true"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new")
      .not("customized_resume_id", "is", null)
      .or("is_interested.is.null,is_interested.eq.true"),
  ]);

  return {
    newCount: newRes.count ?? 0,
    matchesCount: matchesRes.count ?? 0,
    tailoredCount: tailoredRes.count ?? 0,
  };
}

export async function getAppliedJobs(
  page: number = 1,
  pageSize: number = 10,
  provider?: string,
  searchQuery?: string,
  applicationStatus?: string,
  sortBy?: string, // New: sortBy parameter
  sortOrder?: string, // New: sortOrder parameter (e.g., 'asc' or 'desc')
): Promise<Job[]> {
  const supabase = await createSupabaseServerClient();

  const rpcParams: any = {
    p_page_number: page,
    p_page_size: pageSize,
    p_provider: provider || null,
    p_search_query: searchQuery || null,
    p_application_status: applicationStatus || null,
    p_sort_by: sortBy || null, // New: Pass sortBy to RPC params
    p_sort_order: sortOrder || "desc", // New: Pass sortOrder, default to 'desc'
  };

  const response = await supabase.rpc("get_applied_jobs_sorted", rpcParams);

  const data = await handleResponse(response);
  return data ?? [];
}

// Function to get the count of applied jobs
export async function getAppliedJobsCount(
  provider?: string,
  searchQuery?: string,
  applicationStatus?: string, // Add new applicationStatus parameter
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  // IMPORTANT: Ensure these statuses match those in your RPC and database
  // Suggestion: Standardize to ['applied', 'interviewing', 'offered'] if 'offered' is correct
  const appliedStatuses = ["applied", "interviewing", "offer"];

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact", head: true }) // Select count only
    .eq("is_active", true)
    // .in("status", appliedStatuses) // Filter by relevant statuses - replaced by specific status or all applied
    .eq("job_state", "new");

  // Add application status filter if specified
  if (applicationStatus) {
    query = query.eq("status", applicationStatus);
  } else {
    // If no specific status, filter by all relevant applied statuses
    query = query.in("status", appliedStatuses);
  }

  // Add provider filter if specified
  if (provider) {
    query = query.eq("provider", provider);
  }

  // Add search query filter if specified
  if (searchQuery) {
    query = query.or(
      `job_title.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`,
    );
  }

  const { count, error } = await query;

  if (error) {
    console.error("Supabase count error (applied jobs):", error);
    throw new Error(error.message); // Or return 0, depending on desired behavior
  }

  return count ?? 0; // Return the count or 0 if null
}

/**
 * Gets the count of applied jobs on a specific date.
 * @param dateThe date string in 'YYYY-MM-DD' format.
 * @returns A promise that resolves to the number of jobs applied on that date.
 */
export async function getAppliedJobsCountByDate(
  localDateString: string,
): Promise<number> {
  // localDateString is "YYYY-MM-DD", e.g., "2025-05-21" from server's local TZ
  const supabase = await createSupabaseServerClient();
  const appliedStatuses = ["applied", "interviewing", "offer"];

  // Create a Date object representing the start of the local day (00:00:00 local time)
  // For "2025-05-21", this will be 2025-05-21T00:00:00 in the server's local timezone.
  const startOfLocalDay = new Date(localDateString);

  // Convert the start of the local day to a UTC ISO string for the query
  const startOfDayUTCForQuery = startOfLocalDay.toISOString();

  // Create a Date object for the end of the local day
  // Start with the beginning of the local day again
  const endOfLocalDay = new Date(localDateString);
  // Advance it by one full day to get the start of the *next* local day
  endOfLocalDay.setDate(startOfLocalDay.getDate() + 1);

  // Convert the start of the next local day to a UTC ISO string for the query boundary
  const startOfNextDayUTCForQuery = endOfLocalDay.toISOString();

  // For debugging:
  // console.log(`Querying for applications on local date: ${localDateString}`);
  // console.log(`UTC Range: >= ${startOfDayUTCForQuery} and < ${startOfNextDayUTCForQuery}`);

  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .in("status", appliedStatuses)
    .eq("job_state", "new") // Retained this filter if it's still relevant
    .gte("application_date", startOfDayUTCForQuery) // Greater than or equal to the start of the local day (in UTC)
    .lt("application_date", startOfNextDayUTCForQuery); // Less than the start of the next local day (in UTC)

  if (error) {
    console.error(
      `Supabase count error (applied jobs on local date ${localDateString}):`,
      error,
    );
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getJobById(job_id: string): Promise<Job | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, customized_resumes(id, resume_link)") // Fetches all job fields and the resume_link from the related customized_resume
    .eq("job_id", job_id)
    .single(); // Use single() if you expect only one or zero results

  if (error && error.code !== "PGRST116") {
    // PGRST116: Row not found, which is okay for single()
    console.error("Supabase response error:", error);
    throw new Error(error.message);
  }
  // The 'data' object will now potentially include a 'customized_resumes' field:
  // e.g., { ..., customized_resume_id: 'xyz', customized_resumes: { resume_link: '...' } }
  // or { ..., customized_resume_id: null, customized_resumes: null }
  return data as Job | null; // Ensure your Job type definition accommodates this structure
}

// New function to update a job by its ID
export async function updateJobById(
  job_id: string,
  updates: Partial<Omit<Job, "job_id">>,
): Promise<Job | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("job_id", job_id)
    .select() // Select the updated row
    .single(); // Expect a single row to be returned

  // The handleResponse function might need adjustment if it's not designed for single object returns
  // or if you want specific error handling for updates.
  // For now, we'll adapt the error handling similar to getJobById.
  if (error) {
    // PGRST116: Row not found, which means the job_id didn't match any record.
    if (error.code === "PGRST116") {
      console.warn(`Job with ID ${job_id} not found for update.`);
      return null;
    }
    console.error("Supabase update error:", error);
    throw new Error(error.message);
  }
  return data as Job | null; // Cast to Job or null
}

/**
 * Retrieves a specific customized resume by its ID.
 * @param resume_id The ID of the customized resume to retrieve.
 * @returns A promise that resolves to the Resume object or null if not found.
 */
export async function getCustomizedResumeById(
  resume_id: string,
): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customized_resumes") // Target the 'customized_resumes' table
    .select("*")
    .eq("id", resume_id) // Assuming 'id' is the primary key column
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: Row not found, which is okay for single()
    console.error("Supabase error fetching customized resume:", error);
    throw new Error(error.message);
  }
  return data as Resume | null;
}

/**
 * Updates specified fields of a customized resume by its ID.
 * @param resume_id The ID of the customized resume to update.
 * @param updates An object containing the fields to update.
 * @returns A promise that resolves to the updated Resume object or null if not found.
 */
export async function updateCustomizedResumeById(
  resume_id: string,
  updates: Partial<Omit<Resume, "id" | "created_at" | "last_updated">>, // Exclude system-managed fields from direct update via this function
): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customized_resumes") // Target the 'customized_resumes' table
    .update(updates)
    .eq("id", resume_id) // Assuming 'id' is the primary key column
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Row not found
      console.warn(
        `Customized resume with ID ${resume_id} not found for update.`,
      );
      return null;
    }
    console.error("Supabase error updating customized resume:", error);
    throw new Error(error.message);
  }
  return data as Resume | null;
}

// New function to upload a personalized resume PDF to Supabase Storage
/**
 * Uploads a personalized resume PDF to Supabase Storage.
 * @param job_id The ID of the job for which the resume is personalized.
 * @param file The PDF file to upload.
 * @returns A promise that resolves to an object containing the public URL of the uploaded file.
 * @throws Will throw an error if the upload fails or the public URL cannot be retrieved.
 */
export async function uploadPersonalizedResume(
  fileName: string,
  file: File,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const filePath = fileName;

  console.log("Uploading file to path:", filePath);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("personalized_resumes") // Updated bucket name
    .upload(filePath, file, {
      upsert: true, // Overwrite if file already exists
    });

  if (uploadError) {
    console.error("Supabase storage upload error:", uploadError);
    throw new Error(
      `Failed to upload personalized resume: ${uploadError.message}`,
    );
  }

  if (!uploadData || !uploadData.path) {
    console.error(
      "Supabase storage upload error: No path returned despite no error.",
    );
    throw new Error(
      "Failed to upload personalized resume: No path returned from storage.",
    );
  }

  return fileName;
}

/**
 * Retrieves the user profile from the 'base_resume' table.
 * Fetches the latest row as per the backend architecture.
 * @returns A promise that resolves to the Resume object or null if not found.
 */
export async function getUserProfileByEmail(): Promise<Resume | null> {
  const supabase = createSupabaseStaticClient();

  // Fetch the latest base resume from the 'base_resume' table
  // This follows the backend's architecture of keeping a single/latest base resume.
  const { data, error } = await supabase
    .from("base_resume")
    .select("resume_data")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // PGRST116: Row not found, which is okay
      console.warn("No base resume found in the 'base_resume' table.");
      return null;
    }
    console.error("Supabase error fetching base resume:", error);
    throw new Error(error.message);
  }

  return (data as any)?.resume_data as Resume | null;
}

/**
 * Upserts the base resume data into the 'base_resume' table.
 * If an existing row exists, it updates it; if not, it inserts a new row.
 * Ensures there is only one active base resume.
 */
export async function upsertBaseResume(
  resumeData: Omit<Resume, "id" | "created_at">
): Promise<Resume> {
  const supabase = createSupabaseStaticClient();

  // Find existing row
  const { data: existing } = await supabase
    .from("base_resume")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("base_resume")
      .update({ resume_data: resumeData, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("resume_data")
      .single();

    if (error) {
      console.error("Error updating base resume:", error);
      throw new Error(error.message);
    }
    return (data as any)?.resume_data as Resume;
  } else {
    const { data, error } = await supabase
      .from("base_resume")
      .insert({ resume_data: resumeData })
      .select("resume_data")
      .single();

    if (error) {
      console.error("Error inserting base resume:", error);
      throw new Error(error.message);
    }
    return (data as any)?.resume_data as Resume;
  }
}

/**
 * Updates the base resume data in the 'base_resume' table.
 * Finds the latest row and updates its resume_data JSONB column.
 * @param resumeData The full Resume data object to save.
 * @returns The updated Resume data or null.
 */
export async function updateBaseResume(
  resumeData: Omit<Resume, "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link">,
): Promise<Resume | null> {
  const supabase = createSupabaseStaticClient();

  // First, find the latest base resume row ID
  const { data: existing, error: fetchError } = await supabase
    .from("base_resume")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      console.warn("No base resume found to update.");
      return null;
    }
    console.error("Error fetching base resume for update:", fetchError);
    throw new Error(fetchError.message);
  }

  // Update the resume_data JSONB column
  const { data, error } = await supabase
    .from("base_resume")
    .update({ resume_data: resumeData })
    .eq("id", existing.id)
    .select("resume_data")
    .single();

  if (error) {
    console.error("Error updating base resume:", error);
    throw new Error(error.message);
  }

  return (data as any)?.resume_data as Resume | null;
}

// --- New Count Functions ---

/**
 * Gets the count of expired jobs.
 * @returns A promise that resolves to the number of expired jobs.
 */
export async function getExpiredJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("job_state", "expired");

  if (error) {
    console.error("Supabase count error (expired jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs pending to be scored (resume_score is null).
 * @returns A promise that resolves to the number of jobs pending scoring.
 */
export async function getPendingScoreJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .is("resume_score", null)
    .eq("is_active", true) // Assuming we only count active jobs
    .eq("status", "new") // And new jobs that haven't been processed beyond initial scraping
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (pending score jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs that have already been scored (resume_score is not null).
 * @returns A promise that resolves to the number of scored jobs.
 */
export async function getScoredJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs which have a custom resume generated (customized_resume_id is not null).
 * @returns A promise that resolves to the number of jobs with a custom resume.
 */
export async function getCustomResumeJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("customized_resume_id", "is", null)
    .eq("is_active", true); // Assuming active jobs

  if (error) {
    console.error("Supabase count error (custom resume jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs which have no custom resume (customized_resume_id is null).
 * @returns A promise that resolves to the number of jobs without a custom resume.
 */
export async function getNoCustomResumeJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .is("customized_resume_id", null)
    .eq("is_active", true); // Assuming active jobs

  if (error) {
    console.error("Supabase count error (no custom resume jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of scored jobs based on the original resume.
 * (resume_score is not null AND resume_score_stage is "initial")
 * @returns A promise that resolves to the number of jobs scored with the original resume.
 */
export async function getScoredWithOriginalResumeCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("resume_score_stage", "initial")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored with original resume):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of scored jobs based on a custom resume.
 * (resume_score is not null AND resume_score_stage is "custom")
 * @returns A promise that resolves to the number of jobs scored with a custom resume.
 */
export async function getScoredWithCustomResumeCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("resume_score_stage", "custom")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored with custom resume):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs from LinkedIn.
 * Filters for active, new status, and new job_state jobs by default.
 * @returns A promise that resolves to the number of LinkedIn jobs.
 */
export async function getLinkedInJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("provider", "linkedin")
    .eq("is_active", true) // Consider if these filters are always needed
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (LinkedIn jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs from Careers Future.
 * Filters for active, new status, and new job_state jobs by default.
 * @returns A promise that resolves to the number of Careers Future jobs.
 */
export async function getCareersFutureJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("provider", "careers_future")
    .eq("is_active", true) // Consider if these filters are always needed
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (Careers Future jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}


/**
 * Fetches all 13 dashboard counts.
 * Uses the Supabase RPC function 'get_dashboard_stats' if available (1 network round trip ~30ms),
 * or gracefully falls back to parallel count queries via Promise.all.
 */
export async function getDashboardStats(
  localDateString: string
): Promise<DashboardStats> {
  const supabase = createSupabaseStaticClient();

  const startOfLocalDay = new Date(localDateString);
  const startOfDayUTC = startOfLocalDay.toISOString();
  const endOfLocalDay = new Date(localDateString);
  endOfLocalDay.setDate(startOfLocalDay.getDate() + 1);
  const startOfNextDayUTC = endOfLocalDay.toISOString();

  try {
    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_today_start: startOfDayUTC,
      p_today_end: startOfNextDayUTC,
    });

    if (!error && data) {
      return data as DashboardStats;
    }
  } catch (err) {
    console.warn("RPC get_dashboard_stats call failed, falling back to parallel count queries:", err);
  }

  // Graceful fallback: parallel queries using static client (no cookies needed)
  const appliedStatuses = ["applied", "interviewing", "offer"];

  const [
    totalNewJobsRes,
    totalAppliedJobsRes,
    totalTopMatchesRes,
    expiredJobsRes,
    pendingScoreJobsRes,
    scoredJobsRes,
    customResumeJobsRes,
    noCustomResumeJobsRes,
    scoredWithOriginalResumeRes,
    scoredWithCustomResumeRes,
    linkedInJobsRes,
    careersFutureJobsRes,
    appliedTodayRes,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .in("status", appliedStatuses)
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new")
      .gte("resume_score", 50)
      .lte("resume_score", 100),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("job_state", "expired"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .is("resume_score", null)
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .not("resume_score", "is", null)
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .not("customized_resume_id", "is", null)
      .eq("is_active", true),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .is("customized_resume_id", null)
      .eq("is_active", true),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .not("resume_score", "is", null)
      .eq("resume_score_stage", "initial")
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .not("resume_score", "is", null)
      .eq("resume_score_stage", "custom")
      .eq("is_active", true)
      .eq("status", "new")
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("provider", "linkedin")
      .eq("is_active", true)
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("provider", "careers_future")
      .eq("is_active", true)
      .eq("job_state", "new"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .in("status", appliedStatuses)
      .eq("job_state", "new")
      .gte("application_date", startOfDayUTC)
      .lt("application_date", startOfNextDayUTC),
  ]);

  return {
    totalNewJobs: totalNewJobsRes.count ?? 0,
    totalAppliedJobs: totalAppliedJobsRes.count ?? 0,
    totalTopMatches: totalTopMatchesRes.count ?? 0,
    expiredJobsCount: expiredJobsRes.count ?? 0,
    pendingScoreJobsCount: pendingScoreJobsRes.count ?? 0,
    scoredJobsCount: scoredJobsRes.count ?? 0,
    customResumeJobsCount: customResumeJobsRes.count ?? 0,
    noCustomResumeJobsCount: noCustomResumeJobsRes.count ?? 0,
    scoredWithOriginalResumeCount: scoredWithOriginalResumeRes.count ?? 0,
    scoredWithCustomResumeCount: scoredWithCustomResumeRes.count ?? 0,
    linkedInJobsCount: linkedInJobsRes.count ?? 0,
    careersFutureJobsCount: careersFutureJobsRes.count ?? 0,
    appliedTodayCount: appliedTodayRes.count ?? 0,
  };
}

/**
 * Cached version of getDashboardStats using Next.js unstable_cache.
 * Automatically serves instant responses from cache.
 * Revalidates in the background after 5 minutes or on-demand via tag 'dashboard-stats'.
 */
export const getCachedDashboardStats = unstable_cache(
  async (localDateString: string) => {
    return await getDashboardStats(localDateString);
  },
  ["dashboard-stats-cache"],
  {
    revalidate: 300, // Background revalidation every 5 minutes
    tags: ["dashboard-stats"],
  }
);

// --- Resume Style Settings Queries ---

/**
 * Fetches the active resume style settings from the 'resume_style_settings' table.
 * If not configured or table does not exist, safely returns DEFAULT_THEME_CONFIG.
 */
export async function getActiveResumeStyle(): Promise<ResumeThemeConfig> {
  try {
    const supabase = createSupabaseStaticClient();
    const { data, error } = await supabase
      .from("resume_style_settings")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        "Could not fetch resume style settings from Supabase, falling back to default:",
        error.message
      );
      return DEFAULT_THEME_CONFIG;
    }

    if (data?.theme_config) {
      return data.theme_config as ResumeThemeConfig;
    }
  } catch (err) {
    console.warn("Error getting active resume style, using default:", err);
  }
  return DEFAULT_THEME_CONFIG;
}

/**
 * Saves a new active resume style configuration to the 'resume_style_settings' table.
 * Automatically deactivates previously active styles.
 */
export async function saveActiveResumeStyle(
  themeConfig: ResumeThemeConfig,
  name?: string
): Promise<ResumeStyleSetting> {
  return saveResumeStyleSetting(themeConfig, name, true);
}

/**
 * Updates an existing resume style persona by ID (without changing its active status).
 */
export async function updateResumeStyleById(
  id: string,
  themeConfig: ResumeThemeConfig,
  name?: string
): Promise<ResumeStyleSetting> {
  const supabase = createSupabaseStaticClient();
  const updatePayload: any = {
    theme_config: themeConfig,
    preset: themeConfig.preset || "custom",
    updated_at: new Date().toISOString(),
  };
  if (name) {
    updatePayload.name = name;
  }

  const { data, error } = await supabase
    .from("resume_style_settings")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update resume style setting:", error);
    throw new Error(`Failed to update resume style setting: ${error.message}`);
  }

  return data as ResumeStyleSetting;
}

/**
 * Saves a new resume style configuration, optionally activating it.
 */
export async function saveResumeStyleSetting(
  themeConfig: ResumeThemeConfig,
  name?: string,
  makeActive: boolean = false
): Promise<ResumeStyleSetting> {
  const supabase = createSupabaseStaticClient();

  if (makeActive) {
    try {
      await supabase
        .from("resume_style_settings")
        .update({ is_active: false })
        .eq("is_active", true);
    } catch (err) {
      console.warn("Warning deactivating previous style settings:", err);
    }
  }

  // Insert the setting
  const { data, error } = await supabase
    .from("resume_style_settings")
    .insert({
      name: name || themeConfig.preset || "Custom Style",
      preset: themeConfig.preset || "custom",
      is_active: makeActive,
      theme_config: themeConfig,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save resume style setting:", error);
    throw new Error(`Failed to save resume style setting: ${error.message}`);
  }

  return data as ResumeStyleSetting;
}

/**
 * Retrieves all saved resume style settings / presets from Supabase.
 */
export async function getAllResumeStyles(): Promise<ResumeStyleSetting[]> {
  try {
    const supabase = createSupabaseStaticClient();
    const { data, error } = await supabase
      .from("resume_style_settings")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Could not fetch resume styles from Supabase:", error.message);
      return [];
    }

    return (data || []) as ResumeStyleSetting[];
  } catch (err) {
    console.warn("Error fetching all resume styles:", err);
    return [];
  }
}

/**
 * Activates a specific saved resume style setting by ID.
 */
export async function activateResumeStyleById(id: string): Promise<ResumeStyleSetting> {
  const supabase = createSupabaseStaticClient();

  // Deactivate all first
  await supabase
    .from("resume_style_settings")
    .update({ is_active: false })
    .neq("id", id);

  // Activate the selected one
  const { data, error } = await supabase
    .from("resume_style_settings")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to activate resume style setting:", error);
    throw new Error(`Failed to activate resume style setting: ${error.message}`);
  }

  return data as ResumeStyleSetting;
}

/**
 * Deletes a custom saved resume style preset by ID.
 */
export async function deleteResumeStyleById(id: string): Promise<boolean> {
  const supabase = createSupabaseStaticClient();
  const { error } = await supabase
    .from("resume_style_settings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete resume style setting:", error);
    throw new Error(`Failed to delete resume style setting: ${error.message}`);
  }

  return true;
}

// --- App Settings Queries ---

/**
 * Fetches the active application settings from the 'app_settings' table.
 */
export async function getAppSettings(): Promise<AppSettings | null> {
  try {
    const supabase = createSupabaseStaticClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      if (!error.message?.includes("fetch failed")) {
        console.warn("Could not fetch app_settings from Supabase:", error.message);
      }
      return null;
    }

    return data as AppSettings;
  } catch (err: any) {
    if (!err.message?.includes("fetch failed")) {
      console.warn("Exception fetching app_settings:", err.message);
    }
    return null;
  }
}

/**
 * Updates or creates the active application settings in the 'app_settings' table.
 */
export async function updateAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const supabase = createSupabaseStaticClient();
  const current = await getAppSettings();

  const targetId = current?.id || "00000000-0000-0000-0000-000000000001";
  const payload = {
    ...settings,
    id: targetId,
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (result.error) {
    if (!result.error.message?.includes("fetch failed")) {
      console.error("Failed to update app_settings:", result.error);
    }
    throw new Error(`Failed to update app_settings: ${result.error.message}`);
  }

  return result.data as AppSettings;
}


