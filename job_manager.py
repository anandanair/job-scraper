import asyncio
import httpx
import random
import time
from datetime import datetime, timedelta, timezone
import logging

# Import shared modules
import config
import user_agents
from supabase_utils import supabase # Use the initialized Supabase client

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def get_utc_now() -> datetime:
    """Returns the current time in UTC."""
    return datetime.now(timezone.utc)

def get_past_date(days: int) -> datetime:
    """Returns the datetime object for a specific number of days ago in UTC."""
    return get_utc_now() - timedelta(days=days)

async def _check_single_linkedin_job_active(job_id: str, client: httpx.AsyncClient) -> bool | None:
    """
    Checks if a single LinkedIn job is still active.
    Returns:
        True if the job appears inactive (404, redirect, specific text).
        False if the job appears active.
        None if the check failed after retries.
    """
    job_detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    retries = 0
    inactive_keywords = ["this job is no longer available", "job is closed", "No longer accepting applications"] # Add more if needed

    while retries <= config.ACTIVE_CHECK_MAX_RETRIES:
        try:
            # Rotate user agent and proxy for each attempt
            user_agent = random.choice(user_agents.USER_AGENTS)
            headers = {'User-Agent': user_agent}

            logging.debug(f"Checking job {job_id} (Attempt {retries+1}/{config.ACTIVE_CHECK_MAX_RETRIES+1}) URL: {job_detail_url} with UA: {user_agent}")

            response = await client.get(
                job_detail_url,
                headers=headers,
                timeout=config.ACTIVE_CHECK_TIMEOUT,
                follow_redirects=True # Allow redirects to check final destination
            )

            # Check for 404 specifically
            if response.status_code == 404:
                logging.info(f"Job {job_id} returned 404. Marking as inactive.")
                return True

            # Check for other non-successful status codes (could indicate removal, private, etc.)
            # Allow redirects (3xx) as httpx handles them by default with follow_redirects=True
            if response.status_code >= 400:
                 logging.warning(f"Job {job_id} check failed with status {response.status_code}. Assuming active for now.")
                 # Decide if other errors mean inactive. For now, only 404 is definitive.
                 # Could return True here for stricter checking.
                 return False # Or None if we want to retry later

            # Check content for inactive keywords
            response_text_lower = response.text.lower()
            for keyword in inactive_keywords:
                if keyword in response_text_lower:
                    logging.info(f"Job {job_id} contains inactive keyword '{keyword}'. Marking as inactive.")
                    return True

            # If status is OK and no inactive keywords found
            logging.debug(f"Job {job_id} appears active (Status: {response.status_code}).")
            return False

        except httpx.TimeoutException:
            logging.warning(f"Timeout checking job {job_id} (Attempt {retries+1}).")
        except httpx.RequestError as e:
            logging.warning(f"Request error checking job {job_id} (Attempt {retries+1}): {e}")
        except Exception as e:
            logging.error(f"Unexpected error checking job {job_id} (Attempt {retries+1}): {e}")

        retries += 1
        if retries <= config.ACTIVE_CHECK_MAX_RETRIES:
            wait_time = config.ACTIVE_CHECK_RETRY_DELAY + random.uniform(0, 5)
            logging.info(f"Retrying job {job_id} check after {wait_time:.2f} seconds...")
            await asyncio.sleep(wait_time)

    logging.error(f"Failed to check job {job_id} activity after {config.ACTIVE_CHECK_MAX_RETRIES + 1} attempts.")
    return None # Failed to determine status

# --- Main Management Functions ---

async def mark_expired_jobs():
    """Marks old jobs (not applied/interviewing) as expired."""
    logging.info("--- Starting Task: Mark Expired Jobs ---")
    expiry_date = get_past_date(config.JOB_EXPIRY_DAYS)
    # Format for Supabase timestampz query
    expiry_date_str = expiry_date.isoformat()
    excluded_statuses = ['applied', 'offer', 'interviewing'] # Add any status that means "don't expire"

    try:
        # Select jobs to expire
        response = supabase.table(config.SUPABASE_TABLE_NAME)\
            .select("job_id")\
            .lt("scraped_at", expiry_date_str)\
            .not_.in_("status", excluded_statuses)\
            .eq("is_active", True)\
            .execute()

        if response.data:
            job_ids_to_expire = [job['job_id'] for job in response.data]
            logging.info(f"Found {len(job_ids_to_expire)} jobs older than {config.JOB_EXPIRY_DAYS} days to mark as expired.")

            if job_ids_to_expire:
                # Update in batches if necessary, though supabase-py might handle large lists
                # For simplicity, updating all at once here. Consider batching for >1000s of IDs.
                update_response = supabase.table(config.SUPABASE_TABLE_NAME)\
                    .update({"job_state": "expired", "is_active": False})\
                    .in_("job_id", job_ids_to_expire)\
                    .execute()

                # Check response structure - may vary slightly
                if hasattr(update_response, 'data') and update_response.data:
                     updated_count = len(update_response.data) # Supabase often returns the updated rows
                     logging.info(f"Successfully marked {updated_count} jobs as expired.")
                elif hasattr(update_response, 'count') and update_response.count is not None:
                     logging.info(f"Successfully marked {update_response.count} jobs as expired (based on count).")
                else:
                     # Log raw response if structure is unexpected
                     logging.warning(f"Mark expired jobs update executed. Response: {update_response}")

        else:
            logging.info("No jobs found meeting the criteria for expiration.")

    except Exception as e:
        logging.error(f"Error marking expired jobs: {e}")

    logging.info("--- Finished Task: Mark Expired Jobs ---")


async def check_linkedin_job_activity():
    """Checks if active jobs are still available on LinkedIn."""
    logging.info("--- Starting Task: Check Job Activity ---")
    check_older_than_date = get_past_date(config.JOB_CHECK_DAYS)
    check_older_than_date_str = check_older_than_date.isoformat()
    now_str = get_utc_now().isoformat()

    jobs_to_check = []
    try:
        # Query for jobs needing a check: active AND older than N days
        # Order by last_checked ASC to prioritize oldest checks
        # Limit the number of checks per run
        excluded_statuses = ['applied', 'offer', 'interviewing'] # Add any status that means "don't expire"
        query = supabase.table(config.SUPABASE_TABLE_NAME)\
            .select("job_id, last_checked")\
            .eq("is_active", True)\
            .eq("provider", "linkedin")\
            .not_.in_("status", excluded_statuses)\
            .lt("last_checked", check_older_than_date_str)\
            .order("last_checked", desc=False)\
            .limit(config.JOB_CHECK_LIMIT)

        response = query.execute()

        if response.data:
            jobs_to_check = response.data
            logging.info(f"Found {len(jobs_to_check)} active jobs to check (limit: {config.JOB_CHECK_LIMIT}).")
        else:
            logging.info("No active jobs need checking currently.")
            return # Nothing to do

    except Exception as e:
        logging.error(f"Error fetching jobs to check: {e}")
        return # Cannot proceed

    # Use httpx.AsyncClient for connection pooling and efficiency
    async with httpx.AsyncClient() as client:
        tasks = []
        for job in jobs_to_check:
            if(job['provider'] == 'linkedin'):
                tasks.append(_check_single_linkedin_job_active(job['job_id'], client))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    inactive_job_ids = []
    active_checked_job_ids = []
    failed_check_job_ids = []

    for i, result in enumerate(results):
        job_id = jobs_to_check[i]['job_id']
        if isinstance(result, Exception):
            logging.error(f"Exception checking job {job_id}: {result}")
            failed_check_job_ids.append(job_id)
        elif result is True: # Job confirmed inactive
            inactive_job_ids.append(job_id)
        elif result is False: # Job confirmed active
            active_checked_job_ids.append(job_id)
        elif result is None: # Check failed after retries
            failed_check_job_ids.append(job_id)

    logging.info(f"Activity Check Summary: Inactive={len(inactive_job_ids)}, Active={len(active_checked_job_ids)}, Failed={len(failed_check_job_ids)}")

    # Update Supabase
    try:
        if inactive_job_ids:
            update_inactive = supabase.table(config.SUPABASE_TABLE_NAME)\
                .update({"job_state": "removed", "is_active": False, "last_checked": now_str})\
                .in_("job_id", inactive_job_ids)\
                .execute()
            # Add logging for update_inactive response count/data
            logging.info(f"Marked {len(inactive_job_ids)} jobs as removed. Response: {update_inactive}")


        if active_checked_job_ids:
            update_active = supabase.table(config.SUPABASE_TABLE_NAME)\
                .update({"last_checked": now_str})\
                .in_("job_id", active_checked_job_ids)\
                .execute()
            # Add logging for update_active response count/data
            logging.info(f"Updated last_checked for {len(active_checked_job_ids)} active jobs. Response: {update_active}")

    except Exception as e:
        logging.error(f"Error updating job statuses after activity check: {e}")

    logging.info("--- Finished Task: Check Job Activity ---")


async def delete_old_inactive_jobs():
    """Permanently deletes very old inactive jobs."""
    logging.info("--- Starting Task: Delete Old Inactive Jobs ---")
    delete_older_than_date = get_past_date(config.JOB_DELETION_DAYS)
    delete_older_than_date_str = delete_older_than_date.isoformat()
    inactive_states = ['expired', 'removed']

    try:
        # Select jobs to delete
        # No need to select data, just filter and delete
        delete_response = supabase.table(config.SUPABASE_TABLE_NAME)\
            .delete()\
            .eq("is_active", False)\
            .in_("job_state", inactive_states)\
            .lt("scraped_at", delete_older_than_date_str)\
            .execute()

        # Check response structure for delete count
        deleted_count = 0
        if hasattr(delete_response, 'data') and delete_response.data:
             deleted_count = len(delete_response.data) # Delete often returns the deleted rows
        elif hasattr(delete_response, 'count') and delete_response.count is not None:
             deleted_count = delete_response.count

        if deleted_count > 0:
            logging.info(f"Successfully deleted {deleted_count} inactive jobs older than {config.JOB_DELETION_DAYS} days.")
        else:
            logging.info("No old inactive jobs found to delete.")
            # Log raw response if structure is unexpected but count is 0
            logging.debug(f"Delete response when no jobs matched: {delete_response}")


    except Exception as e:
        logging.error(f"Error deleting old inactive jobs: {e}")

    logging.info("--- Finished Task: Delete Old Inactive Jobs ---")


# --- Main Execution ---
async def main():
    """Runs the job management tasks."""
    logging.info("Starting Job Management Script...")
    start_time = time.time()

    await mark_expired_jobs()
    await check_linkedin_job_activity()
    await delete_old_inactive_jobs()

    end_time = time.time()
    logging.info(f"Job Management Script finished in {end_time - start_time:.2f} seconds.")

if __name__ == "__main__":
    asyncio.run(main())