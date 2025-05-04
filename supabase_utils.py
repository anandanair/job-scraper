from supabase import create_client, Client
import config # Import configuration
import datetime # Import datetime module
import logging # Import logging

# --- Initialize Supabase Client ---
# Ensure URL and Key are provided
if not config.SUPABASE_URL or not config.SUPABASE_KEY:
    raise ValueError("Supabase URL and Key must be set in environment variables or config.")

supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

# --- Supabase Functions ---
def get_existing_job_ids_from_supabase() -> set:
    """
    Fetches existing active job IDs from the Supabase 'jobs' table.
    Returns a set of job IDs for efficient lookup.
    """
    existing_ids = set()
    try:
        # Use table name from config
        response = supabase.table(config.SUPABASE_TABLE_NAME).select("job_id").execute()

        if response.data:
            for item in response.data:
                if 'job_id' in item:
                    existing_ids.add(item['job_id'])
            print(f"Successfully fetched {len(existing_ids)} existing job IDs from Supabase.")
        else:
            # Handle cases where response.data might be None or empty list explicitly
            if response.data is None:
                 print("Error fetching from Supabase or no data returned.")
            else:
                 print("No existing active job IDs found in Supabase.")

    except Exception as e:
        print(f"Error fetching existing job IDs from Supabase: {e}")

    return existing_ids


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

def save_resume_to_supabase(resume_data: dict):
    """
    Saves or updates parsed resume data to the Supabase 'resumes' table based on email.
    Includes a timestamp indicating when the parsing occurred.
    Requires the 'email' column in the Supabase table to have a UNIQUE constraint.
    """
    if not resume_data:
        print("No resume data provided to save.")
        return

    # Ensure email is present, as it's the key for upsert
    if 'email' not in resume_data or not resume_data['email']:
        print("Error: Resume data must contain a valid 'email' field for upserting.")
        return

    # Ensure the resume table name is configured
    if not hasattr(config, 'SUPABASE_RESUME_TABLE_NAME') or not config.SUPABASE_RESUME_TABLE_NAME:
        print("Error: SUPABASE_RESUME_TABLE_NAME is not defined in config.py")
        return

    # Add/Update the current timestamp for the operation
    # Use ISO 8601 format, which Supabase handles well for TIMESTAMPTZ
    resume_data['parsed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    print(f"Attempting to upsert resume data for {resume_data['email']} into table '{config.SUPABASE_RESUME_TABLE_NAME}'...")

    try:
        # Use upsert instead of insert.
        # Specify 'email' as the column to check for conflicts.
        # If a row with the same email exists, it will be updated. Otherwise, a new row is inserted.
        # Ensure your Supabase 'resumes' table columns match the keys in resume_data
        # and that columns for lists/nested objects (like skills, education, experience) are JSONB type.
        data, count = supabase.table(config.SUPABASE_RESUME_TABLE_NAME)\
                              .upsert(resume_data, on_conflict='email')\
                              .execute()

        # Check response structure for upsert (might be similar to insert or jobs upsert)
        if data and isinstance(data, tuple) and len(data) > 1:
             actual_data = data[1]
             # Check if actual_data is a list and not empty to determine if records were returned
             if isinstance(actual_data, list) and actual_data:
                 print(f"Successfully upserted resume data for {resume_data['email']}. Records affected/returned: {len(actual_data)}.")
                 # print(f"Supabase response data: {actual_data}") # Optional: log response
             else:
                 # Upsert might return an empty list or different structure on success depending on version/scenario
                 print(f"Successfully executed upsert for resume data for {resume_data['email']}. Supabase response count: {count}")
        else:
             # Log raw response if structure is unexpected
             print(f"Attempted to upsert resume data for {resume_data['email']}. Supabase response: {data}")


    except Exception as e:
        print(f"Error upserting resume data to Supabase: {e}")
        # Consider logging the data that failed to upsert
        # print(f"Failed data: {resume_data}")


def get_resume_by_email(email: str) -> dict | None:
    """
    Fetches a single resume record from the Supabase 'resumes' table based on email.
    """
    if not email:
        logging.error("No email provided to fetch resume.")
        return None
    if not hasattr(config, 'SUPABASE_RESUME_TABLE_NAME') or not config.SUPABASE_RESUME_TABLE_NAME:
        logging.error("SUPABASE_RESUME_TABLE_NAME is not defined in config.py")
        return None

    try:
        logging.info(f"Fetching resume for email: {email} from table '{config.SUPABASE_RESUME_TABLE_NAME}'")
        response = supabase.table(config.SUPABASE_RESUME_TABLE_NAME)\
                           .select("*")\
                           .eq("email", email)\
                           .limit(1)\
                           .execute()

        if response.data:
            logging.info(f"Successfully fetched resume data for {email}.")
            return response.data[0] # Return the first matching resume
        else:
            logging.warning(f"No resume found for email: {email}")
            return None

    except Exception as e:
        logging.error(f"Error fetching resume data from Supabase for email {email}: {e}")
        return None


def get_jobs_to_score(limit: int) -> list:
    """
    Fetches jobs from the Supabase 'jobs' table that need scoring.
    Filters by is_active = true and resume_score = null.
    Selects only necessary fields (job_id, job_title, description).
    Orders by scraped_at ascending to process older jobs first.
    """
    if limit <= 0:
        logging.warning("Limit for jobs to score must be positive.")
        return []

    try:
        logging.info(f"Fetching up to {limit} jobs needing scoring...")
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .select("job_id, job_title, description")\
                           .eq("is_active", True)\
                           .is_("resume_score", None)\
                           .order("scraped_at", desc=False)\
                           .limit(limit)\
                           .execute()

        if response.data:
            logging.info(f"Successfully fetched {len(response.data)} jobs to score.")
            return response.data
        else:
            logging.info("No jobs found needing scoring at this time.")
            return []

    except Exception as e:
        logging.error(f"Error fetching jobs to score from Supabase: {e}")
        return []


def update_job_score(job_id: str, score: int) -> bool:
    """
    Updates the 'resume_score' for a specific job_id in the Supabase 'jobs' table.
    Returns True on success, False on failure.
    """
    if not job_id or score is None:
        logging.error(f"Invalid input for updating job score: job_id={job_id}, score={score}")
        return False

    try:
        logging.info(f"Updating score for job_id {job_id} to {score}...")
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .update({"resume_score": score})\
                           .eq("job_id", job_id)\
                           .execute()

        # Check if the update was successful (response structure might vary)
        # A common pattern is checking if data is returned or count is non-zero
        if hasattr(response, 'data') and response.data:
             logging.info(f"Successfully updated score for job_id {job_id}.")
             return True
        elif hasattr(response, 'count') and response.count is not None and response.count > 0:
             logging.info(f"Successfully updated score for job_id {job_id} (count={response.count}).")
             return True
        elif not hasattr(response, 'data') and not hasattr(response, 'count'):
             # Handle cases where the response might not have data/count but didn't error
             logging.warning(f"Update score for job_id {job_id} executed, but response structure unclear: {response}")
             return True # Assume success if no exception occurred
        else:
             logging.warning(f"Update score for job_id {job_id} might have failed or job not found. Response: {response}")
             return False


    except Exception as e:
        logging.error(f"Error updating score for job_id {job_id} in Supabase: {e}")
        return False

# Need to delete after testing
def get_jobs_needing_markdown_conversion() -> list:
    """
    Fetches jobs from the Supabase 'jobs' table that need Markdown conversion.
    Filters by description IS NOT NULL and description_is_markdown IS NOT TRUE.
    Selects only necessary fields (job_id, description).
    Orders by scraped_at ascending.
    """
    # if limit <= 0:
    #     logging.warning("Limit for jobs to convert must be positive.")
    #     return []

    try:
        logging.info(f"Fetching jobs needing Markdown conversion...")
        # Filter for jobs where description exists and markdown flag is not true
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
            .select("job_id, description")\
            .not_.is_("description", None)\
            .not_.is_("description_is_markdown", True)\
            .order("scraped_at", desc=False)\
            .execute()


        if response.data:
            logging.info(f"Successfully fetched {len(response.data)} jobs to convert.")
            return response.data
        else:
            logging.info("No jobs found needing Markdown conversion at this time.")
            return []

    except Exception as e:
        logging.error(f"Error fetching jobs for Markdown conversion from Supabase: {e}")
        return []


# Need to delete after testing
def update_job_markdown_description(job_id: str, markdown_description: str) -> bool:
    """
    Updates the 'description' with Markdown content and sets 'description_is_markdown' to True
    for a specific job_id in the Supabase 'jobs' table.
    Returns True on success, False on failure.
    """
    if not job_id or markdown_description is None: # Allow empty string for markdown
        logging.error(f"Invalid input for updating job markdown: job_id={job_id}")
        return False

    try:
        logging.info(f"Updating markdown description and flag for job_id {job_id}...")
        update_payload = {
            "description": markdown_description,
            "description_is_markdown": True # Set the flag to true
        }
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .update(update_payload)\
                           .eq("job_id", job_id)\
                           .execute()

        # Check if the update was successful (response structure might vary)
        if hasattr(response, 'data') and response.data:
             logging.info(f"Successfully updated markdown and flag for job_id {job_id}.")
             return True
        elif hasattr(response, 'count') and response.count is not None and response.count > 0:
             logging.info(f"Successfully updated markdown and flag for job_id {job_id} (count={response.count}).")
             return True
        elif not hasattr(response, 'data') and not hasattr(response, 'count'):
             logging.warning(f"Update markdown/flag for job_id {job_id} executed, but response structure unclear: {response}")
             return True # Assume success if no exception occurred
        else:
             logging.warning(f"Update markdown/flag for job_id {job_id} might have failed or job not found. Response: {response}")
             return False

    except Exception as e:
        logging.error(f"Error updating markdown/flag for job_id {job_id} in Supabase: {e}")