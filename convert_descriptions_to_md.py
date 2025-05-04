import time
import logging
import random # Import random for jitter
from groq import Groq, RateLimitError

import config
import supabase_utils

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Initialize Groq Client ---
if not config.GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY must be set in environment variables or config.py")

groq_client = Groq(api_key=config.GROQ_API_KEY)
GROQ_MODEL = "llama3-70b-8192"
# Base delay between successful API calls (can keep or adjust)
GROQ_REQUEST_DELAY_SECONDS = random.uniform(3, 8) 
# --- Retry Logic Parameters ---
MAX_RETRIES = 5
INITIAL_BACKOFF_SECONDS = 2 # Initial wait time on rate limit error
MAX_BACKOFF_SECONDS = 60    # Maximum wait time

def convert_to_markdown_with_groq(text: str) -> str | None:
    """
    Uses Groq API (Llama3) to convert plain text job description to Markdown.
    Includes exponential backoff with jitter for rate limiting.
    """
    if not text:
        logging.warning("Received empty text for Markdown conversion.")
        return "" # Return empty string if input is empty

    logging.info("Attempting to convert text to Markdown using Groq...")
    prompt = f"""You are a Markdown formatter.
    Convert the job description below into **well-structured Markdown**.
    - **Do not alter or paraphrase any part of the text**.
    - **Preserve all original content exactly as is**.
    - Only apply Markdown formatting such as:
    - Headings
    - Bold text
    - Bullet points
    - Paragraph breaks
    - Do **not** add or remove any words, punctuation, or content.
    - Do **not** include any explanation or commentary.
    - Your output must be **only** the formatted Markdown.

    Job Description:
    ---
    {text}
    ---

    Markdown Output:
    """

    retries = 0
    backoff_time = INITIAL_BACKOFF_SECONDS
    while retries < MAX_RETRIES:
        try:
            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                temperature=0.2,
                stream=False
            )

            markdown_content = completion.choices[0].message.content
            logging.info("Successfully converted text to Markdown.")
            return markdown_content.strip()

        except RateLimitError as e:
            retries += 1
            if retries >= MAX_RETRIES:
                logging.error(f"Groq Rate Limit Error: {e}. Max retries ({MAX_RETRIES}) reached. Skipping this job.")
                return None
            else:
                # Exponential backoff with jitter
                wait_time = min(backoff_time + random.uniform(0, 1), MAX_BACKOFF_SECONDS)
                logging.warning(f"Groq Rate Limit Error encountered. Retrying in {wait_time:.2f} seconds (Attempt {retries}/{MAX_RETRIES})...")
                time.sleep(wait_time)
                # Increase backoff time for the next potential retry
                backoff_time = min(backoff_time * 2, MAX_BACKOFF_SECONDS)


        except Exception as e:
            logging.error(f"Error calling Groq API for Markdown conversion (non-rate-limit): {e}")
            return None # Don't retry on other errors

    # Should not be reached if MAX_RETRIES > 0, but included for safety
    return None


def main():
    """Fetches jobs, converts descriptions to Markdown, and updates Supabase."""
    logging.info("--- Starting Job Description to Markdown Conversion Script ---")
    start_time = time.time()

    # Fetch jobs needing conversion
    jobs_to_convert = supabase_utils.get_jobs_needing_markdown_conversion()

    if not jobs_to_convert:
        logging.info("No jobs require Markdown conversion at this time.")
        return

    logging.info(f"Processing {len(jobs_to_convert)} jobs for Markdown conversion...")
    successful_conversions = 0
    failed_conversions = 0

    for i, job in enumerate(jobs_to_convert):
        job_id = job.get('job_id')
        description = job.get('description')

        if not job_id or not description:
            logging.warning(f"Skipping job due to missing job_id or description: {job}")
            failed_conversions += 1
            continue

        logging.info(f"--- Converting Job {i+1}/{len(jobs_to_convert)} (ID: {job_id}) ---")

        # Convert description to Markdown (now includes retry logic)
        markdown_description = convert_to_markdown_with_groq(description)

        if markdown_description is not None:
            # Update Supabase with the Markdown description
            if supabase_utils.update_job_markdown_description(job_id, markdown_description):
                successful_conversions += 1
            else:
                failed_conversions += 1 # Failed to update DB
                logging.error(f"Failed to update markdown for job_id {job_id} in Supabase.")
        else:
            failed_conversions += 1 # Failed to get conversion from Groq (after retries or other error)
            logging.error(f"Failed to convert description to markdown for job_id {job_id} after retries or due to an error.")

        # Implement delay between *successful* or *finally failed* calls
        # This helps pace the overall script, complementing the backoff logic for errors.
        if i < len(jobs_to_convert) - 1: # Don't sleep after the last job
            logging.debug(f"Waiting {GROQ_REQUEST_DELAY_SECONDS} seconds before next job...")
            time.sleep(GROQ_REQUEST_DELAY_SECONDS)

    end_time = time.time()
    logging.info("--- Markdown Conversion Script Finished ---")
    logging.info(f"Successfully converted and updated: {successful_conversions}")
    logging.info(f"Failed/Skipped conversions: {failed_conversions}")
    logging.info(f"Total time: {end_time - start_time:.2f} seconds")

if __name__ == "__main__":
    main()