import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time # Import time for sleep
import random # Import random for delays and user-agent selection
from groq import Groq, RateLimitError


import config
import user_agents
import supabase_utils

groq_client = Groq(api_key=config.GROQ_API_KEY)
GROQ_MODEL = "llama3-70b-8192"
GROQ_REQUEST_DELAY_SECONDS = random.uniform(2.5, 6.0)

# Convert description to Markdown
def convert_to_markdown_with_groq(text: str) -> str | None:
    """
    Uses Groq API (Llama3) to convert plain text job description to Markdown.
    """
    if not text:
        print("Received empty text for Markdown conversion.")
        return "" # Return empty string if input is empty

    print("Converting description text to Markdown using Groq...")
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
        print("Successfully converted text to Markdown.")
        return markdown_content.strip()

    except RateLimitError as e:
        print(f"Groq Rate Limit Error: {e}. Consider increasing GROQ_REQUEST_DELAY_SECONDS.")
        return None
    except Exception as e:
        print(f"Error calling Groq API for Markdown conversion: {e}")
        return None

# --- LinkedIn Scraping Logic ---
def _fetch_job_ids(search_query: str, location: str) -> list:
    """Fetches job IDs from LinkedIn search results pages with delays, rotating user agents, and retries."""

    job_ids_list = []
    start = 0
    max_start = config.LINKEDIN_MAX_START

    print(f"--- Starting Phase 1: Scraping Job IDs (Max Start: {max_start}) ---")
    while start <= max_start:
        target_url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={search_query.replace(' ', '%2B')}&location={location}&geoId={config.LINKEDIN_GEO_ID}&f_TPR={config.LINKEDIN_JOB_POSTING_DATE}&f_JT={config.LINKEDIN_JOB_TYPE}&start={start}"

        # --- Humanization: Delay and User Agent ---
        # 1. Random Delay before *each* attempt (including retries)
        sleep_time = random.uniform(5.0, 15.0)
        print(f"Waiting for {sleep_time:.2f} seconds before next request...")
        time.sleep(sleep_time)

        # 2. Random User Agent
        user_agent = random.choice(user_agents.USER_AGENTS)
        headers = {'User-Agent': user_agent}
        print(f"Using User-Agent: {user_agent}")
        # --- End Humanization ---

        print(f"Scraping URL: {target_url}")

        retries = 0
        while retries <= config.MAX_RETRIES:
            try:
                # Pass headers to the request
                res = requests.get(target_url, headers=headers, timeout=config.REQUEST_TIMEOUT)
                res.raise_for_status()
                break
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429 and retries < config.MAX_RETRIES:
                    retries += 1
                    wait_time = config.RETRY_DELAY_SECONDS + random.uniform(0, 5) 
                    print(f"Error 429: Too Many Requests. Retrying attempt {retries}/{config.MAX_RETRIES} after {wait_time:.2f} seconds...")
                    time.sleep(wait_time)

                    # Rotate user-agent again on retry
                    user_agent = random.choice(user_agents.USER_AGENTS)
                    headers = {'User-Agent': user_agent}
                    print(f"Retrying with new User-Agent: {user_agent}")
                    continue # Go to the next retry iteration
                else:
                    # For non-429 HTTP errors or if max retries reached for 429
                    print(f"HTTP Error fetching search results page: {e}")
                    res = None # Ensure res is None to signal failure
                    break # Break the retry loop, proceed to outer loop break
            except requests.exceptions.RequestException as e:
                # For other connection errors, timeouts, etc.
                print(f"Request Exception fetching search results page: {e}")
                res = None # Ensure res is None to signal failure
                # Consider a longer pause or breaking immediately for persistent connection issues
                # time.sleep(30)
                break # Break the retry loop, proceed to outer loop break

        # Check if the request ultimately failed after retries
        if res is None:
            print(f"Failed to fetch {target_url} after {retries} retries. Stopping pagination for this query.")
            break # Break the outer while loop (pagination)

        # Check for empty response *after* successful request
        if not res.text:
             print(f"Received empty response text at start={start}, stopping.")
             break

        soup = BeautifulSoup(res.text, 'html.parser')
        all_jobs_on_this_page = soup.find_all('li')

        # This check correctly identifies when no job listings are returned
        if not all_jobs_on_this_page:
             print(f"No job listings ('li' elements) found on page at start={start}, stopping.")
             break

        print(f"Found {len(all_jobs_on_this_page)} potential job elements on this page.")

        jobs_found_this_iteration = 0
        for job_element in all_jobs_on_this_page:
            base_card = job_element.find("div", {"class": "base-card"})
            # Check if it has the job ID attribute and is likely a job posting
            job_urn = base_card.get('data-entity-urn') if base_card else None
            if job_urn and 'jobPosting:' in job_urn:
                try:
                    jobid = job_urn.split(":")[3]
                    if jobid not in job_ids_list:
                         job_ids_list.append(jobid)
                         jobs_found_this_iteration += 1
                except IndexError:
                    print(f"Warning: Could not parse job ID from URN: {job_urn}")
                    pass

        print(f"Added {jobs_found_this_iteration} unique job IDs from this page.")

        if jobs_found_this_iteration == 0 and len(all_jobs_on_this_page) > 0:
            print("Found list items but no new job IDs extracted, potentially end of relevant results or parsing issue.")
            break

        start += 10

    print(f"--- Finished Phase 1: Found {len(job_ids_list)} unique job IDs during scraping ---")
    return job_ids_list

def _fetch_job_details(job_id: str) -> dict | None:
    """Fetches detailed information for a single job ID with delays, rotating user agents, and retries."""

    job_detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    print(f"Preparing to fetch details for job ID: {job_id}")

    # --- Humanization: Delay and User Agent ---
    # 1. Random Delay before *each* attempt
    sleep_time = random.uniform(3.0, 10.0)
    print(f"Waiting for {sleep_time:.2f} seconds before fetching details...")
    time.sleep(sleep_time)

    # 2. Random User Agent
    user_agent = random.choice(user_agents.USER_AGENTS)
    headers = {'User-Agent': user_agent}
    print(f"Using User-Agent for details: {user_agent}")
    # --- End Humanization ---

    print(f"Fetching details from: {job_detail_url}")

    retries = 0
    resp = None # Initialize resp to None
    while retries <= config.MAX_RETRIES:
        try:
            resp = requests.get(job_detail_url, headers=headers, timeout=config.REQUEST_TIMEOUT)
            resp.raise_for_status()
            # Success
            break
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429 and retries < config.MAX_RETRIES:
                retries += 1
                wait_time = config.RETRY_DELAY_SECONDS + random.uniform(0, 5) 
                print(f"Error 429 for job ID {job_id}. Retrying attempt {retries}/{config.MAX_RETRIES} after {wait_time:.2f} seconds...")
                time.sleep(wait_time)
                # Rotate user-agent again on retry
                user_agent = random.choice(user_agents.USER_AGENTS)
                headers = {'User-Agent': user_agent}
                print(f"Retrying job {job_id} with new User-Agent: {user_agent}")
                continue
            else:
                # Non-429 HTTP error or max retries reached for 429
                print(f"HTTP Error fetching details for job ID {job_id}: {e}")
                return None # Return None on HTTP failure after retries
        except requests.exceptions.RequestException as e:
            # Other connection errors, timeouts, etc.
            print(f"Request Exception fetching details for job ID {job_id}: {e}")
            return None 

    # If the loop finished because retries were exhausted for a non-HTTP error (though current logic returns early)
    # or if the request somehow failed without raising an exception handled above.
    if resp is None:
         print(f"Failed to fetch details for job ID {job_id} after {retries} retries (unexpected state).")
         return None

    # --- Process successful response ---
    try:
        soup = BeautifulSoup(resp.text, 'html.parser')
        job_details = {"job_id": job_id}

        # --- Extract Company ---
        try:
            company_img = soup.find("div",{"class":"top-card-layout__card"}).find("a").find("img")
            if company_img:
                job_details["company"] = company_img.get('alt').strip()
            if not job_details.get("company"):
                 company_link = soup.find("a", {"class": "topcard__org-name-link"})
                 if company_link:
                      job_details["company"] = company_link.text.strip()
                 else:
                      sub_title_span = soup.find("span", {"class": "topcard__flavor"})
                      if sub_title_span:
                           job_details["company"] = sub_title_span.text.strip()

            if not job_details.get("company"):
                 job_details["company"] = None
                 print(f"Warning: Could not extract company for job ID {job_id}")

        except Exception as e:
            print(f"Error extracting company for job ID {job_id}: {e}")
            job_details["company"] = None

        # --- Extract Job Title ---
        try:
            title_link = soup.find("div",{"class":"top-card-layout__entity-info"}).find("a")
            job_details["job_title"] = title_link.text.strip() if title_link else None
            if not job_details["job_title"]: # Added check if title is still None
                 title_h1 = soup.find("h1", {"class": "top-card-layout__title"}) # Fallback selector
                 if title_h1:
                      job_details["job_title"] = title_h1.text.strip()

        except Exception as e: # Catch broader exceptions during extraction
            print(f"Error extracting job title for job ID {job_id}: {e}")
            job_details["job_title"] = None

        # --- Extract Seniority Level ---
        try:
            # Find all criteria items
            criteria_items = soup.find("ul",{"class":"description__job-criteria-list"}).find_all("li")
            job_details["level"] = None # Default to None
            for item in criteria_items:
                header = item.find("h3", {"class": "description__job-criteria-subheader"})
                if header and "Seniority level" in header.text:
                    level_text = item.find("span", {"class": "description__job-criteria-text"})
                    if level_text:
                        job_details["level"] = level_text.text.strip()
                        break # Found it, stop looking
        except Exception as e: # Catch potential NoneType errors if structure isn't found
            print(f"Error extracting seniority level for job ID {job_id}: {e}")
            job_details["level"] = None

        # --- Extract Location ---
        try:
            # Look for the specific span first
            location_span = soup.find("span", {"class": "topcard__flavor topcard__flavor--bullet"})
            if location_span:
                job_details["location"] = location_span.text.strip()
            else:
                # Fallback: Look for any span within the subtitle div
                subtitle_div = soup.find("div", {"class": "topcard__flavor-row"})
                if subtitle_div:
                    location_span_fallback = subtitle_div.find("span", {"class": "topcard__flavor"}) # Find the first flavor span
                    if location_span_fallback:
                         job_details["location"] = location_span_fallback.text.strip()

            if not job_details.get("location"): # Check if still None
                 job_details["location"] = None
                 print(f"Warning: Could not extract location for job ID {job_id}")


        except Exception as e:
            print(f"Error extracting location for job ID {job_id}: {e}")
            job_details["location"] = None

        # --- Extract Description ---
        try:
            description_div = soup.find("div", {"class": "show-more-less-html__markup"})
            if description_div:
                raw_description = description_div.get_text(separator='\n', strip=True)
                lines = [line for line in raw_description.splitlines() if line.strip()]
                raw_description = "\n".join(lines)
                job_details["description"] = convert_to_markdown_with_groq(raw_description)
            else:
                print(f"Warning: Could not find description div for job ID {job_id}")
                job_details["description"] = None
        except Exception as e:
                print(f"Warning: Could not parse description for job ID {job_id}: {e}")
                job_details["description"] = None

        return job_details

    except Exception as e:
         # Catch errors during BeautifulSoup parsing or data extraction
         print(f"General Error processing details for job ID {job_id} after successful fetch: {e}")
         return None # Return None on processing errors

def process_linkedin_query(search_query: str, location: str) -> list:
    """
    Orchestrates scraping and detail fetching for a single query,
    filtering against existing jobs in Supabase BEFORE fetching details.
    Returns a list of new job details found.
    """

    # 1. Fetch all potential job IDs from LinkedIn search
    scraped_job_ids = _fetch_job_ids(search_query, location)
    if not scraped_job_ids:
        print("No job IDs found in Phase 1. Skipping detail fetching.")
        return []

    # Make the list unique *before* checking against Supabase
    unique_linkedin_job_ids = list(set(scraped_job_ids))
    print(f"Found {len(scraped_job_ids)} raw job IDs, {len(unique_linkedin_job_ids)} unique IDs after scraping.")

    # 2. Fetch existing job IDs from Supabase (ensure this function fetches ALL IDs as strings)
    print("\n--- Starting Filtering Step: Checking against Supabase ---")
    # Make sure get_existing_job_ids_from_supabase fetches ALL IDs as strings
    existing_supabase_ids = supabase_utils.get_existing_job_ids_from_supabase()

    # 3. Identify new job IDs by filtering unique scraped IDs against existing ones
    new_job_ids_to_process = [job_id for job_id in unique_linkedin_job_ids if job_id not in existing_supabase_ids]

    # Corrected print statement placement and content
    print(f"Found {len(unique_linkedin_job_ids)} unique scraped IDs.")
    print(f"Found {len(existing_supabase_ids)} existing IDs in Supabase.")
    print(f"Identified {len(new_job_ids_to_process)} new job IDs to fetch details for.")

    if not new_job_ids_to_process:
        print("No new job IDs to process after filtering.")
        return []

    # 4. Fetch details ONLY for the genuinely new job IDs
    print(f"\n--- Starting Phase 2: Fetching Job Details for {len(new_job_ids_to_process)} New IDs ---")
    detailed_new_jobs = []
    processed_count = 0

    # No limit applied here unless specifically desired via config
    ids_to_fetch = new_job_ids_to_process
    # print(f"Processing {len(ids_to_fetch)} new job(s)...") # Optional: less verbose

    for job_id in ids_to_fetch:
        details = _fetch_job_details(job_id)
        if details:
            # Ensure the job_id key exists in details before adding
            if 'job_id' in details and details['job_id'] is not None:
                 detailed_new_jobs.append(details)
                 processed_count += 1
            else:
                 print(f"Warning: Fetched details for {job_id} but missing 'job_id' key. Skipping.")


    print(f"--- Finished Phase 2: Successfully fetched details for {processed_count} new job(s) ---")
    return detailed_new_jobs

 


    print(f"--- Finished Phase 2: Successfully processed details for {len(detailed_jobs)} new job(s) (limited for testing) ---")
    return detailed_jobs

# --- Main Execution ---
if __name__ == "__main__":
    print("Starting job scraping script...")
    print(f"Using Supabase table: {config.SUPABASE_TABLE_NAME}")
    print(f"LinkedIn Location: {config.LINKEDIN_LOCATION}")
    # print(f"Detail Fetch Limit per Query: {config.LINKEDIN_DETAIL_FETCH_LIMIT}")

    total_new_jobs_saved = 0

    for query in config.LINKEDIN_SEARCH_QUERIES:
        print(f"\n{'='*20} Processing Search Query: '{query}' {'='*20}")

        # 1. Process the query: Scrape IDs, filter, fetch new details
        new_job_details = process_linkedin_query(query, config.LINKEDIN_LOCATION)

        # 2. Save the NEW scraped data to Supabase
        if new_job_details:
            print(f"\n--- Saving {len(new_job_details)} new job(s) for query '{query}' ---")
            supabase_utils.save_jobs_to_supabase(new_job_details)
            total_new_jobs_saved += len(new_job_details)
        else:
            print(f"\nNo new job details were fetched or processed for query '{query}'.")

    print(f"\n{'='*20} Job scraping script finished {'='*20}")
    print(f"Total new jobs saved across all queries: {total_new_jobs_saved}")