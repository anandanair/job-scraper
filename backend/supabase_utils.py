from supabase import create_client, Client
import config # Import configuration
from typing import Optional, Any, Dict
import datetime # Import datetime module
import logging # Import logging

# --- Initialize Supabase Client ---
# Ensure URL and Key are provided
if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Supabase URL and Key must be set in environment variables or config.")

supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

# Module-level cache for in-memory deduplication across queries
_CACHED_EXISTING_IDS = None
_CACHED_COMPANY_TITLE_KEYS = None

# --- Supabase Functions ---
def get_existing_jobs_from_supabase(batch_size: int = 1000, force_refresh: bool = False) -> tuple[set, set]:
    """
    Fetches all existing job IDs and company-title pairs from the Supabase 'jobs' table.
    Caches results in memory so subsequent calls in the same run don't re-query Supabase.
    Returns:
        - A set of job_ids
        - A set of (company, job_title) tuples (both lowercased for consistency)
    """
    global _CACHED_EXISTING_IDS, _CACHED_COMPANY_TITLE_KEYS
    if not force_refresh and _CACHED_EXISTING_IDS is not None and _CACHED_COMPANY_TITLE_KEYS is not None:
        return _CACHED_EXISTING_IDS, _CACHED_COMPANY_TITLE_KEYS

    existing_ids = set()
    existing_company_title_keys = set()
    offset = 0

    try:
        while True:
            response = (
                supabase.table(config.SUPABASE_TABLE_NAME)
                .select("job_id, company, job_title")
                .range(offset, offset + batch_size - 1)
                .execute()
            )

            data = response.data

            if not data:
                break  # No more data to fetch

            for item in data:
                job_id = item.get("job_id")
                company = item.get("company")
                job_title = item.get("job_title")

                if job_id:
                    existing_ids.add(str(job_id))

                if company and job_title:
                    normalized_company = company.strip().lower()
                    normalized_title = job_title.strip().lower()
                    existing_company_title_keys.add((normalized_company, normalized_title))

            if len(data) < batch_size:
                break  # Reached the last page, early exit

            offset += batch_size

        print(f"Fetched {len(existing_ids)} job IDs and {len(existing_company_title_keys)} company-title pairs from Supabase.")
        _CACHED_EXISTING_IDS = existing_ids
        _CACHED_COMPANY_TITLE_KEYS = existing_company_title_keys

    except Exception as e:
        print(f"Error fetching existing jobs from Supabase: {e}")

    return existing_ids, existing_company_title_keys

def save_jobs_to_supabase(jobs_data: list):
    """
    Saves or updates a list of job data dictionaries to the Supabase table using upsert.
    This avoids duplicate key errors by updating existing records based on job_id.
    """
    if not jobs_data:
        print("No job data provided to save/update.")
        return

    # Ensure job_id is present and potentially convert to the correct type if needed
    # (Assuming job_id in jobs_data is already the correct string type for your 'text' column)
    processed_jobs_data = []
    for job in jobs_data:
        if 'job_id' in job and job['job_id'] is not None:
             # If your Supabase job_id column was numeric, you'd convert here:
             # try:
             #     job['job_id'] = int(job['job_id'])
             #     processed_jobs_data.append(job)
             # except (ValueError, TypeError):
             #     print(f"Warning: Invalid job_id format found: {job.get('job_id')}. Skipping.")
             # Since it's text, just ensure it's a string (it likely already is)
             job['job_id'] = str(job['job_id'])
             processed_jobs_data.append(job)
        else:
            print(f"Warning: Job data missing job_id. Skipping: {job}")


    if not processed_jobs_data:
        print("No valid job data remaining after processing.")
        return

    print(f"Attempting to upsert {len(processed_jobs_data)} jobs to Supabase...")

    try:
        # Use table name from config
        # Use upsert instead of insert. It will insert new rows
        # or update existing rows if a job_id conflict occurs based on the primary key.
        # Ensure 'job_id' is the primary key or has a unique constraint in your Supabase table.
        # By default, supabase-py's upsert updates the row on conflict.
        data, count = supabase.table(config.SUPABASE_TABLE_NAME).upsert(processed_jobs_data).execute()

        # Update in-memory cache with newly saved jobs
        global _CACHED_EXISTING_IDS, _CACHED_COMPANY_TITLE_KEYS
        if _CACHED_EXISTING_IDS is not None:
            for job in processed_jobs_data:
                _CACHED_EXISTING_IDS.add(str(job['job_id']))
                comp = job.get('company')
                title = job.get('job_title')
                if comp and title:
                    _CACHED_COMPANY_TITLE_KEYS.add((comp.strip().lower(), title.strip().lower()))

        # Check the actual response structure from your Supabase client version for upsert
        # It might differ slightly from insert's response structure
        if data and isinstance(data, tuple) and len(data) > 1:
             # The actual data returned might be in data[1] for upsert
             actual_data = data[1]
             print(f"Successfully upserted/updated {len(processed_jobs_data)} jobs. Supabase response count: {count}")
             # You might want to log the actual response data for debugging:
             # print(f"Supabase response data: {actual_data}")
        else:
             # Log raw response if structure is unexpected or for debugging
             print(f"Attempted to upsert {len(processed_jobs_data)} jobs. Supabase response: {data}")

    except Exception as e:
        print(f"Error upserting data to Supabase: {e}")
        # Consider logging the data that failed to upsert for debugging
        # print(f"Failed data: {processed_jobs_data}")


# --- App Settings & Dynamic Configuration ---

def get_app_settings() -> Optional[Dict[str, Any]]:
    """
    Fetches the latest application settings from the 'app_settings' table.
    Returns:
        The settings dictionary or None if table is empty or inaccessible.
    """
    try:
        response = (
            supabase.table("app_settings")
            .select("*")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logging.warning(f"Could not fetch app_settings from Supabase (falling back to config.py defaults): {e}")
        return None


def load_and_apply_app_settings() -> Optional[Dict[str, Any]]:
    """
    Loads dynamic user preferences from the 'app_settings' Supabase table and attaches
    them to the 'config' module in-memory for the scraper.
    """
    settings = get_app_settings()
    if not settings:
        logging.warning("No remote app_settings found in Supabase. Please complete the Setup Wizard.")
        config.LINKEDIN_SEARCH_QUERIES = []
        config.LINKEDIN_LOCATION = "Singapore"
        config.LINKEDIN_GEO_ID = 102454443
        config.LINKEDIN_JOB_TYPE = "F"
        config.LINKEDIN_JOB_POSTING_DATE = "r86400"
        config.LINKEDIN_F_WT = "1,2,3"
        config.CAREERS_FUTURE_SEARCH_QUERIES = []
        config.CAREERS_FUTURE_SEARCH_CATEGORIES = []
        config.CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES = []
        config.SCRAPING_SOURCES = ["linkedin"]
        config.MAX_JOBS_PER_SEARCH = {"linkedin": 10, "careers_future": 20}
        return None

    # 1. Update Search Preferences from Supabase app_settings
    config.LINKEDIN_SEARCH_QUERIES = settings.get("linkedin_search_queries") or []
    config.LINKEDIN_LOCATION = settings.get("linkedin_location") or "Singapore"
    geo_id = settings.get("linkedin_geo_id")
    try:
        config.LINKEDIN_GEO_ID = int(geo_id) if geo_id else 102454443
    except (ValueError, TypeError):
        config.LINKEDIN_GEO_ID = geo_id or 102454443

    config.LINKEDIN_JOB_TYPE = settings.get("linkedin_job_type") or "F"
    config.LINKEDIN_JOB_POSTING_DATE = settings.get("linkedin_job_posting_date") or "r86400"
    config.LINKEDIN_F_WT = settings.get("linkedin_f_wt") or "1,2,3"

    config.CAREERS_FUTURE_SEARCH_QUERIES = settings.get("careers_future_search_queries") or []
    config.CAREERS_FUTURE_SEARCH_CATEGORIES = settings.get("careers_future_search_categories") or []
    config.CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES = settings.get("careers_future_search_employment_types") or []

    # 2. Update Sources and Limits
    config.SCRAPING_SOURCES = settings.get("scraping_sources") or ["linkedin"]
    config.MAX_JOBS_PER_SEARCH = settings.get("max_jobs_per_search") or {"linkedin": 10, "careers_future": 20}

    logging.info(
        f"Successfully applied dynamic app_settings from Supabase: "
        f"ScrapingSources={config.SCRAPING_SOURCES}, Location='{config.LINKEDIN_LOCATION}', "
        f"LinkedInQueries={config.LINKEDIN_SEARCH_QUERIES}"
    )

    return settings


# Automatically load dynamic settings from Supabase upon import
try:
    load_and_apply_app_settings()
except Exception as _e:
    logging.debug(f"Initial load of app_settings deferred: {_e}")



