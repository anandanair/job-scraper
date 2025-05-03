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
        response = supabase.table(config.SUPABASE_TABLE_NAME).select("job_id").eq('is_active', True).execute()

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
    Saves a list of job data dictionaries to the Supabase table.
    """
    if not jobs_data:
        print("No new job data provided to save.")
        return

    print(f"Attempting to save {len(jobs_data)} new jobs to Supabase...")

    try:
        # Use table name from config
        data, count = supabase.table(config.SUPABASE_TABLE_NAME).insert(jobs_data).execute()
        # Check the actual response structure from your Supabase client version
        # Assuming the first element of 'data' contains the result list if successful
        if data and isinstance(data, tuple) and len(data) > 1:
             actual_data = data[0] # Or data[1] depending on client version
             print(f"Successfully attempted to save {len(jobs_data)} jobs. Supabase response count (may vary): {count}")
             # You might want to log the actual response data for debugging: print(f"Supabase response data: {actual_data}")
        else:
             print(f"Attempted to save {len(jobs_data)} jobs. Supabase response: {data}") # Log raw response if structure is unexpected

    except Exception as e:
        print(f"Error saving data to Supabase: {e}")
        # Consider logging the data that failed to insert for debugging
        # print(f"Failed data: {jobs_data}")