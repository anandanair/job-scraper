from supabase import create_client, Client
import config # Import configuration

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