import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time # Import time for sleep
import random # Import random for delays and user-agent selection

import config
import supabase_utils

# --- LinkedIn Scraping Logic ---
def _fetch_job_ids(search_query: str, location: str) -> list:
    """Fetches job IDs from LinkedIn search results pages with delays and rotating user agents."""

    job_ids_list = []
    start = 0
    max_start = config.LINKEDIN_MAX_START

    print(f"--- Starting Phase 1: Scraping Job IDs (Max Start: {max_start}) ---") # Updated log
    while start <= max_start:
        target_url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={search_query.replace(' ', '%2B')}&location={location}&geoId={config.LINKEDIN_GEO_ID}&f_TPR={config.LINKEDIN_JOB_POSTING_DATE}&f_JT={config.LINKEDIN_JOB_TYPE}&start={start}"

        # --- Humanization: Delay and User Agent ---
        # 1. Random Delay
        sleep_time = random.uniform(2.5, 6.0) # Random delay between 2.5 and 6.0 seconds
        print(f"Waiting for {sleep_time:.2f} seconds before next request...")
        time.sleep(sleep_time)

        # 2. Random User Agent
        user_agent = random.choice(config.USER_AGENTS)
        headers = {'User-Agent': user_agent}
        print(f"Using User-Agent: {user_agent}")

        # 3. Random Proxy 
        proxies_dict = None
        proxy_url_selected = None
        proxy_url_selected = random.choice(config.proxy_list)
        proxies_dict = {"http": proxy_url_selected, "https": proxy_url_selected}

        # --- End Humanization ---

        print(f"Scraping URL: {target_url}")

        try:
            # Pass headers to the request
            res = requests.get(target_url, headers=headers, proxies=proxies_dict, timeout=config.REQUEST_TIMEOUT)
            res.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching search results page: {e}")
            # Consider adding a longer pause here on error before breaking
            # time.sleep(30)
            break

        # Check for empty response *after* parsing
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
            if job_urn and 'jobPosting:' in job_urn: # Added check for 'jobPosting:'
                try:
                    jobid = job_urn.split(":")[3]
                    # Add only if not already collected in this session
                    if jobid not in job_ids_list:
                         job_ids_list.append(jobid)
                         jobs_found_this_iteration += 1
                except IndexError:
                    print(f"Warning: Could not parse job ID from URN: {job_urn}")
                    pass # Ignore malformed URNs

        print(f"Added {jobs_found_this_iteration} unique job IDs from this page.")

        if jobs_found_this_iteration == 0 and len(all_jobs_on_this_page) > 0:
            print("Found list items but no new job IDs extracted, potentially end of relevant results or parsing issue.")
            # Decide if you want to break here or continue
            # break

        # LinkedIn pagination can be 10 or 25, often 25 for 'seeMoreJobPostings'
        # Let's assume 25 is more common for this API endpoint
        start += 10 # Adjusted increment

    print(f"--- Finished Phase 1: Found {len(job_ids_list)} unique job IDs during scraping ---")
    return job_ids_list

def _fetch_job_details(job_id: str) -> dict | None:
    """Fetches detailed information for a single job ID with delays and rotating user agents."""

    job_detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    print(f"Preparing to fetch details for job ID: {job_id}")

    # --- Humanization: Delay and User Agent ---
    # 1. Random Delay
    sleep_time = random.uniform(2.0, 5.5) 
    print(f"Waiting for {sleep_time:.2f} seconds before fetching details...")
    time.sleep(sleep_time)

    # 2. Random User Agent
    user_agent = random.choice(config.USER_AGENTS) 
    headers = {'User-Agent': user_agent}
    print(f"Using User-Agent for details: {user_agent}")

    # 3. Random Proxy 
    proxies_dict = None
    proxy_url_selected = None
    proxy_url_selected = random.choice(config.proxy_list)
    proxies_dict = {"http": proxy_url_selected, "https": proxy_url_selected}
    # --- End Humanization ---

    print(f"Fetching details from: {job_detail_url}") 
    
    try:
        resp = requests.get(job_detail_url, headers=headers, proxies=proxies_dict, timeout=config.REQUEST_TIMEOUT)
        resp.raise_for_status() 
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

        except:
            job_details["job_title"] = None

        # --- Extract Seniority Level ---
        try:
            level_element = soup.find("ul",{"class":"description__job-criteria-list"}).find("li")
            job_details["level"] = level_element.text.replace("Seniority level","").strip() if level_element else None

        except:
            job_details["level"] = None

        # --- Extract Location ---
        try:
            location_span = soup.find("span", {"class": "topcard__flavor topcard__flavor--bullet"}) 
            job_details["location"] = location_span.text.strip() if location_span else None

        except:
            job_details["location"] = None 

        # --- Extract Description ---
        try:
            description_div = soup.find("div", {"class": "show-more-less-html__markup"})
            if description_div:
                # Extract text using get_text first
                raw_description = description_div.get_text(separator='\n', strip=True)
                # Clean up potential excessive blank lines and remove specific unwanted lines
                lines = [line for line in raw_description.splitlines() if line.strip()]
                job_details["description"] = "\n".join(lines)

            else:
                print(f"Warning: Could not find description div for job ID {job_id}")
                job_details["description"] = None

        except Exception as e: 
                print(f"Warning: Could not parse description for job ID {job_id}: {e}")
                job_details["description"] = None 

        return job_details
    
    except requests.exceptions.RequestException as e:
         print(f"HTTP Error fetching details for job ID {job_id}: {e}")
         return None # Return None on HTTP failure
    except Exception as e:
         print(f"General Error processing details for job ID {job_id}: {e}")
         return None # Return None on other processing errors

def process_linkedin_query(search_query: str, location: str) -> list:
    """
    Orchestrates scraping and detail fetching for a single query,
    filtering against existing jobs in Supabase.
    Returns a list of new job details found.
    """

    # 1. Fetch all potential job IDs from LinkedIn search
    scraped_job_ids = _fetch_job_ids(search_query, location)
    if not scraped_job_ids:
        print("No job IDs found in Phase 1. Skipping detail fetching.")
        return []

    # 2. Fetch existing job IDs from Supabase
    print("\n--- Starting Filtering Step: Checking against Supabase ---")
    existing_supabase_ids = supabase_utils.get_existing_job_ids_from_supabase()

    # 3. Identify new job IDs
    new_job_ids_to_process = [job_id for job_id in scraped_job_ids if job_id not in existing_supabase_ids]

    print(f"Found {len(scraped_job_ids)} total scraped IDs.")
    print(f"Found {len(existing_supabase_ids)} existing IDs in Supabase.")
    print(f"Identified {len(new_job_ids_to_process)} new job IDs to fetch details for.")

    if not new_job_ids_to_process:
        print("No new job IDs to process after filtering.")
        return []

    # 4. Fetch details for new job IDs (with limit for testing)
    # print(f"\n--- Starting Phase 2: Fetching Job Details for New IDs (Limit: {config.LINKEDIN_DETAIL_FETCH_LIMIT}) ---")
    print(f"\n--- Starting Phase 2: Fetching Job Details for New IDs ---")
    detailed_new_jobs = []
    processed_count = 0

    # Apply the limit from config
    # ids_to_fetch = new_job_ids_to_process[:config.LINKEDIN_DETAIL_FETCH_LIMIT]
    ids_to_fetch = new_job_ids_to_process
    print(f"Processing the first {len(ids_to_fetch)} new job(s) based on limit...")

    for job_id in ids_to_fetch: 
        details = _fetch_job_details(job_id)
        if details:
            detailed_new_jobs.append(details)
            processed_count += 1

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