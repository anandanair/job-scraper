from supabase import create_client, Client
import config # Import configuration
from typing import Optional, Any
from models import Resume
import datetime # Import datetime module
import logging # Import logging

# --- Initialize Supabase Client ---
# Ensure URL and Key are provided
if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Supabase URL and Key must be set in environment variables or config.")

supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

# --- Supabase Functions ---
def get_existing_jobs_from_supabase(batch_size: int = 1000) -> tuple[set, set]:
    """
    Fetches all existing job IDs and company-title pairs from the Supabase 'jobs' table.
    Returns:
        - A set of job_ids
        - A set of 'company|job_title' keys (both lowercased for consistency)
    """
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

            offset += batch_size

        print(f"Fetched {len(existing_ids)} job IDs and {len(existing_company_title_keys)} company-title pairs.")

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

def get_resume_custom_fields_by_email(email: str) -> dict | None:
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
                           .select("name, email, phone, location, summary, skills, education, experience, projects, certifications, languages, links")\
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
        # Select fields needed for scoring
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .select("job_id, job_title, company, description, level")\
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

def get_top_scored_jobs_to_apply(limit: int) -> list:
    """
    Fetches the top-scored jobs from Supabase that are ready for application.
    Filters by is_active = true, resume_score is not null, and status is null.
    Orders by resume_score descending.
    Selects fields needed for the application process.
    """
    if limit <= 0:
        logging.warning("Limit for jobs to apply must be positive.")
        return []

    try:
        logging.info(f"Fetching up to {limit} top-scored jobs to apply for...")
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .select("job_id, job_title, company, resume_score")\
                           .eq("is_active", True)\
                           .eq("status", "new")\
                           .not_.is_("resume_score", None)\
                           .order("resume_score", desc=True)\
                           .limit(limit)\
                           .execute()

        if response.data:
            logging.info(f"Successfully fetched {len(response.data)} top-scored jobs to apply for.")
            return response.data
        else:
            logging.info("No top-scored jobs found ready for application at this time.")
            return []

    except Exception as e:
        logging.error(f"Error fetching top-scored jobs to apply for from Supabase: {e}")
        return []

def get_top_scored_jobs_for_resume_generation(limit: int) -> list:
    """
    Fetches the top-scored jobs from Supabase using the RPC 'get_top_scored_jobs_custom_sort'.
    p_page_number is set to 1 and p_page_size is set to the limit.
    Selects fields needed for the application process.
    """
    if limit <= 0:
        logging.warning("Limit for jobs to apply must be positive.")
        return []

    try:
        logging.info(f"Fetching up to {limit} top-scored jobs to apply for using RPC 'get_top_scored_jobs_custom_sort'...")
        response = supabase.rpc(
                "get_jobs_for_resume_generation_custom_sort",
                {"p_page_number": 1, "p_page_size": limit}
            ).execute()

        if response.data:
            logging.info(f"Successfully fetched {len(response.data)} top-scored jobs to apply for via RPC.")
            return response.data
        else:
            # Check for RPC specific errors if any, or just log general empty data
            if hasattr(response, 'error') and response.error:
                logging.error(f"Error calling RPC 'get_top_scored_jobs_custom_sort': {response.error.message}")
            else:
                logging.info("No top-scored jobs found ready for application at this time via RPC.")
            return []

    except Exception as e:
        logging.error(f"Error fetching top-scored jobs to apply for from Supabase RPC: {e}")
        return []

def get_jobs_to_rescore(limit: int) -> list:
    """
    Fetches jobs from Supabase that are ready for re-scoring with a custom resume.
    Filters by is_active = true, resume_link is not null, and resume_score_stage = 'initial'.
    Orders by resume_score descending.
    Selects fields needed for the re-scoring process.
    """
    if limit <= 0:
        logging.warning("Limit for jobs to rescore must be positive.")
        return []

    try:
        logging.info(f"Fetching up to {limit} jobs for re-scoring...")
        response = supabase.rpc(
            "get_jobs_for_rescore", 
            {"p_limit_val": limit}   
        ).execute()

        if hasattr(response, 'data') and response.data is not None:
            if response.data: # Check if list is not empty
                logging.info(f"Successfully fetched {len(response.data)} jobs for re-scoring via RPC.")
                return response.data
            else:
                logging.info("No jobs found meeting re-scoring criteria via RPC at this time (empty list returned).")
                return []
        elif hasattr(response, 'error') and response.error: # Handle explicit error attribute
             logging.error(f"Error calling RPC get_jobs_for_rescore: {response.error}")
             return []
        else: # Fallback for unexpected response structure
            logging.warning(f"Unexpected response structure from RPC call: {response}")
            return []


    except Exception as e:
        logging.error(f"Exception calling RPC get_jobs_for_rescore: {e}", exc_info=True)
        return []

def update_job_score(job_id: str, score: int, resume_score_stage: str = "initial") -> bool:
    """
    Updates the 'resume_score' and 'resume_score_stage' for a specific job_id in the Supabase 'jobs' table.
    Returns True on success, False on failure.
    """
    if not job_id or score is None:
        logging.error(f"Invalid input for updating job score: job_id={job_id}, score={score}")
        return False

    if resume_score_stage not in ["initial", "custom"]:
        logging.error(f"Invalid resume_score_stage: {resume_score_stage}. Must be 'initial' or 'custom'.")
        return False

    try:
        logging.info(f"Updating score for job_id {job_id} to {score} and stage to {resume_score_stage}...")
        update_payload = {
            "resume_score": score,
            "resume_score_stage": resume_score_stage
        }
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .update(update_payload)\
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

def get_job_by_id(job_id: str) -> dict | None:
    """
    Fetches a single job record from the Supabase 'jobs' table based on job_id.
    """
    if not job_id:
        logging.error("No job_id provided to fetch job details.")
        return None
    if not hasattr(config, 'SUPABASE_TABLE_NAME') or not config.SUPABASE_TABLE_NAME:
        logging.error("SUPABASE_TABLE_NAME is not defined in config.py")
        return None

    try:
        logging.info(f"Fetching job details for job_id: {job_id} from table '{config.SUPABASE_TABLE_NAME}'")
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .select("company, job_title, level, description")\
                           .eq("job_id", job_id) \
                           .limit(1)\
                           .execute() # Assuming 'job_id' is the column name

        if response.data:
            logging.info(f"Successfully fetched job data for job_id: {job_id}.")
            return response.data[0] # Return the first matching job
        else:
            logging.warning(f"No job found for job_id: {job_id}")
            return None

    except Exception as e:
        logging.error(f"Error fetching job data from Supabase for job_id {job_id}: {e}")
        return None

def upload_customized_resume_to_storage(file_content: bytes, destination_path: str) -> Optional[str]:
    """
    Uploads the generated resume PDF (as bytes) to Supabase Storage.

    Args:
        file_content: The resume content in bytes.
        destination_path: The desired path and filename within the bucket
                          (e.g., "personalized_resumes/resume_job_12345.pdf").
                          Ensure this path is unique per job/resume.

    Returns:
        The public URL of the uploaded file, or None if upload fails.
    """
    if not file_content:
        logging.error("Cannot upload empty file content.")
        return None
    if not config.SUPABASE_STORAGE_BUCKET:
        logging.error("Supabase storage bucket name not configured.")
        return None

    try:
        logging.info(f"Uploading resume to Supabase Storage at path: {destination_path}")

        # Use upsert=True if you want to overwrite if a file with the same name exists,
        # otherwise False (or omit) to potentially get an error if it exists.
        # Ensure your destination_path includes job_id or similar for uniqueness.
        upload_response = supabase.storage.from_(config.SUPABASE_STORAGE_BUCKET)\
            .upload(
                path=destination_path,
                file=file_content,
                file_options={"content-type": "application/pdf", "upsert": "true"} # Set upsert based on desired behavior
            )

        # Retrieve the public URL after successful upload
        public_url_response = supabase.storage.from_(config.SUPABASE_STORAGE_BUCKET)\
            .get_public_url(destination_path)

        logging.info(f"Successfully uploaded resume. Public URL: {public_url_response}")
        return public_url_response

    except Exception as e:
        # Supabase client might raise specific exceptions, catch broadly for now
        logging.error(f"Error uploading file to Supabase Storage: {e}")
        # Attempt to remove partially uploaded file if possible/needed (more complex error handling)
        # try:
        #     supabase.storage.from_(config.SUPABASE_STORAGE_BUCKET).remove([destination_path])
        # except:
        #     logging.warning(f"Could not clean up potentially failed upload at {destination_path}")
        return None

def update_job_with_resume_link(job_id: str, customized_resume_id: str,  new_status: Optional[str] = "resume_generated") -> bool:
    """
    Updates the job record in the Supabase table with the resume link and optionally a new status.

    Args:
        job_id: The unique ID of the job to update.
        customized_resume_id: The id the generated resume in Supabase customized_resumes table.
        new_status: The status to set for the job after processing (e.g., 'resume_generated').
                    Set to None to only update the link without changing status.

    Returns:
        True if the update was successful, False otherwise.
    """
    if not job_id or not customized_resume_id:
        logging.error("Job ID and Customized Resume id are required for updating the job.")
        return False

    try:
        update_data = {"customized_resume_id": customized_resume_id}
        # if new_status:
        #     update_data["job_state"] = new_status # Assuming 'status' is your column name

        logging.info(f"Updating job {job_id} with resume link, resume id and status '{new_status or 'unchanged'}'...")

        response = supabase.table(config.SUPABASE_TABLE_NAME)\
                           .update(update_data)\
                           .eq("job_id", job_id)\
                           .execute()

        # Check if the update affected any rows (response.data might contain updated rows)
        if response.data:
            logging.info(f"Successfully updated job {job_id}.")
            return True
        else:
            # This might happen if the job_id didn't exist or matched 0 rows
            logging.warning(f"Update query executed for job {job_id}, but no rows seemed to be affected.")
            # Depending on strictness, you might return False here
            return False # Treat as failure if no row was confirmed updated

    except Exception as e:
        logging.error(f"Error updating job {job_id} in Supabase: {e}")
        return False

def save_customized_resume(resume_data: 'Resume', resume_link: str) -> Optional[Any]: # Return type changed
    """
    Saves a customized resume to the Supabase 'customized_resumes' table.

    Args:
        resume_data: A Resume object (Pydantic model) containing the resume details.

    Returns:
        The ID (typically string UUID or integer) of the inserted resume if successful, None otherwise.
    """

    if not resume_link:
        logging.error("Resume Link is required for saving the resume.")
        return False

    if not resume_data:
        logging.error("No resume data provided to save.")
        return None

    if not hasattr(config, 'SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME') or \
       not config.SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME:
        logging.error("SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME is not defined in config.py")
        return None

    try:
        # Convert Pydantic model to dict for Supabase
        if hasattr(resume_data, 'model_dump'):
            data_to_insert = resume_data.model_dump(exclude_none=True)
        else:
            data_to_insert = resume_data.dict(exclude_none=True)

        data_to_insert['resume_link'] = resume_link

        logging.info(
            f"Saving customized resume for email: {getattr(resume_data, 'email', 'N/A')} "
            f"with link '{resume_link}' to table '{config.SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME}'"
        )

        response = supabase.table(config.SUPABASE_CUSTOMIZED_RESUMES_TABLE_NAME)\
                           .insert(data_to_insert)\
                           .execute()

        if response.data and len(response.data) > 0:
            inserted_record = response.data[0]
            if 'id' in inserted_record:
                resume_id = inserted_record['id']
                logging.info(
                    f"Successfully saved customized resume for {getattr(resume_data, 'email', 'N/A')} "
                    f"with ID: {resume_id}."
                )
                return resume_id
            else:
                logging.warning(
                    f"Customized resume for {getattr(resume_data, 'email', 'N/A')} saved, "
                    f"but 'id' key not found in the response data. Full record: {inserted_record}"
                )
                return None
        else:
            error_message = "Unknown error"
            if hasattr(response, 'error') and response.error:
                error_message = response.error
                logging.error(
                    f"Failed to save customized resume for {getattr(resume_data, 'email', 'N/A')}. "
                    f"Supabase Error: {error_message}"
                )
            elif hasattr(response, 'message') and response.message:
                error_message = response.message
                logging.error(
                    f"Failed to save customized resume for {getattr(resume_data, 'email', 'N/A')}. "
                    f"Supabase API Error: {error_message}"
                )
            else:
                logging.warning(
                    f"Customized resume for {getattr(resume_data, 'email', 'N/A')} might not have been saved "
                    f"or ID not returned. Response data is empty or missing. Response: {response}"
                )
            return None

    except Exception as e:
        logging.error(
            f"Error saving customized resume for {getattr(resume_data, 'email', 'N/A')} to Supabase: {e}",
            exc_info=True
        )
        return None