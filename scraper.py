import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time 
import random 
import logging
import config
import user_agents
import supabase_utils
import html2text
from google import genai
from google.genai import types
import json

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Initialize Gemini Client ---
client = genai.Client(api_key=config.GEMINI_FIRST_API_KEY)

# Convert description to Markdown
# Convert description to Markdown
def convert_plain_text_to_markdown_with_ai(text: str) -> str | None:
    """
    Convert plain text to Markdown using Gemini Flash Lite model.
    """
    if not text:
        # Changed: print to logging.info
        logging.info("Received empty text for Markdown conversion, returning empty string.")
        return "" # Return empty string if input is empty

    # Changed: print to logging.info
    logging.info("Converting description text to Markdown using Gemini Lite...")

    system_prompt = f"""
    You are a Markdown formatter.
    Your task is to convert plain text into well-structured Markdown.
    You must not alter, paraphrase, or omit any part of the input text.
    Only apply formatting using Markdown syntax such as:
    - Headings
    - Bold text
    - Bullet points
    - Paragraph breaks

    Do not add or remove any words, punctuation, or content.
    Do not include any explanation or commentary.
    Only return the formatted Markdown.
    """

    prompt = f"""You are a Markdown formatter.
    Convert the following job description into Markdown format:

    ---
    {text}
    ---
    """

    try: # <--- ADD try block
        response = client.models.generate_content(
            model=config.GEMINI_SECONDARY_MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
            )
        )
        markdown_content = response.text.strip()
        # Changed: print to logging.info
        logging.info("Successfully converted text to Markdown.")
        if not markdown_content: # <--- ADD this check
            logging.warning("Gemini returned empty markdown content for a non-empty input.") # <--- ADD this log
            return "" # <--- ADD this return
        return markdown_content
    except Exception as e: # <--- ADD except block
        logging.error(f"Error during Gemini Markdown conversion: {e}") # <--- ADD this log
        return None # <--- ADD this return for error case


def _get_careers_future_job_company_name(job_item: dict) -> str | None:
    """Helper to extract company name, preferring hiringCompany."""
    if not isinstance(job_item, dict):
        return None
    
    hiring_company = job_item.get('hiringCompany')
    if isinstance(hiring_company, dict) and hiring_company.get('name'):
        return hiring_company['name']
    
    posted_company = job_item.get('postedCompany')
    if isinstance(posted_company, dict) and posted_company.get('name'):
        return posted_company['name']
        
    return None

# --- LinkedIn Scraping Logic ---
def _fetch_linkedin_job_ids(search_query: str, location: str) -> list:
    """Fetches job IDs from LinkedIn search results pages with delays, rotating user agents, and retries."""

    job_ids_list = []
    start = 0
    max_start = config.LINKEDIN_MAX_START

    # Changed: print to logging.info
    logging.info(f"--- Starting Phase 1: Scraping Job IDs (Max Start: {max_start}) ---")
    while start <= max_start:
        target_url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={search_query.replace(' ', '%2B')}&location={location}&geoId={config.LINKEDIN_GEO_ID}&f_TPR={config.LINKEDIN_JOB_POSTING_DATE}&f_JT={config.LINKEDIN_JOB_TYPE}&f_WT={config.LINKEDIN_F_WT}&start={start}"

        sleep_time = random.uniform(5.0, 15.0)
        # Changed: print to logging.info
        logging.info(f"Waiting for {sleep_time:.2f} seconds before next request...")
        time.sleep(sleep_time)

        user_agent = random.choice(user_agents.USER_AGENTS)
        headers = {'User-Agent': user_agent}
        # Changed: print to logging.info
        logging.info(f"Using User-Agent: {user_agent}")

        # Changed: print to logging.info
        logging.info(f"Scraping URL: {target_url}")

        res = None # <--- ADD this initialization
        retries = 0
        while retries <= config.MAX_RETRIES:
            try:
                res = requests.get(target_url, headers=headers, timeout=config.REQUEST_TIMEOUT)
                res.raise_for_status()
                break
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429 and retries < config.MAX_RETRIES:
                    retries += 1
                    wait_time = config.RETRY_DELAY_SECONDS + random.uniform(0, 5) 
                    # Changed: print to logging.warning
                    logging.warning(f"Error 429: Too Many Requests. Retrying attempt {retries}/{config.MAX_RETRIES} after {wait_time:.2f} seconds...")
                    time.sleep(wait_time)

                    user_agent = random.choice(user_agents.USER_AGENTS)
                    headers = {'User-Agent': user_agent}
                    # Changed: print to logging.info
                    logging.info(f"Retrying with new User-Agent: {user_agent}")
                    continue
                else:
                    # Changed: print to logging.error
                    logging.error(f"HTTP Error fetching search results page: {e}")
                    res = None # Ensure res is None to signal failure
                    break
            except requests.exceptions.RequestException as e:
                # Changed: print to logging.error
                logging.error(f"Request Exception fetching search results page: {e}")
                res = None
                break

        # Changed: print to logging.error
        if res is None:
            logging.error(f"Failed to fetch {target_url} after {retries} retries. Stopping pagination for this query.")
            break 

        if not res.text:
             # Changed: print to logging.info
             logging.info(f"Received empty response text at start={start}, stopping.")
             break

        soup = BeautifulSoup(res.text, 'html.parser')
        all_jobs_on_this_page = soup.find_all('li')

        if not all_jobs_on_this_page:
             # Changed: print to logging.info
             logging.info(f"No job listings ('li' elements) found on page at start={start}, stopping.")
             break

        # Changed: print to logging.info
        logging.info(f"Found {len(all_jobs_on_this_page)} potential job elements on this page.")

        jobs_found_this_iteration = 0
        for job_element in all_jobs_on_this_page:
            base_card = job_element.find("div", {"class": "base-card"})
            job_urn = base_card.get('data-entity-urn') if base_card else None
            if job_urn and 'jobPosting:' in job_urn:
                try:
                    jobid = job_urn.split(":")[3]
                    if jobid not in job_ids_list:
                         job_ids_list.append(jobid)
                         jobs_found_this_iteration += 1
                except IndexError:
                    # Changed: print to logging.warning
                    logging.warning(f"Could not parse job ID from URN: {job_urn}")
                    pass

        # Changed: print to logging.info
        logging.info(f"Added {jobs_found_this_iteration} unique job IDs from this page.")

        if jobs_found_this_iteration == 0 and len(all_jobs_on_this_page) > 0:
            # Changed: print to logging.info
            logging.info("Found list items but no new job IDs extracted, potentially end of relevant results or parsing issue.")
            break

        start += 10

    # Changed: print to logging.info
    logging.info(f"--- Finished Phase 1: Found {len(job_ids_list)} unique job IDs during scraping ---")
    return job_ids_list

def _fetch_linkedin_job_details(job_id: str) -> dict | None:
    """Fetches detailed information for a single job ID with delays, rotating user agents, and retries."""

    job_detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    # Changed: print to logging.info
    logging.info(f"Preparing to fetch details for job ID: {job_id}")

    sleep_time = random.uniform(3.0, 10.0)
    # Changed: print to logging.info
    logging.info(f"Waiting for {sleep_time:.2f} seconds before fetching details...")
    time.sleep(sleep_time)

    user_agent = random.choice(user_agents.USER_AGENTS)
    headers = {'User-Agent': user_agent}
    # Changed: print to logging.info
    logging.info(f"Using User-Agent for details: {user_agent}")

    # Changed: print to logging.info
    logging.info(f"Fetching details from: {job_detail_url}")

    resp = None # <--- ADD this initialization
    retries = 0
    while retries <= config.MAX_RETRIES:
        try:
            resp = requests.get(job_detail_url, headers=headers, timeout=config.REQUEST_TIMEOUT)
            resp.raise_for_status()
            break
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429 and retries < config.MAX_RETRIES:
                retries += 1
                wait_time = config.RETRY_DELAY_SECONDS + random.uniform(0, 5) 
                # Changed: print to logging.warning
                logging.warning(f"Error 429 for job ID {job_id}. Retrying attempt {retries}/{config.MAX_RETRIES} after {wait_time:.2f} seconds...")
                time.sleep(wait_time)
                user_agent = random.choice(user_agents.USER_AGENTS)
                headers = {'User-Agent': user_agent}
                # Changed: print to logging.info
                logging.info(f"Retrying job {job_id} with new User-Agent: {user_agent}")
                continue
            else:
                # Changed: print to logging.error
                logging.error(f"HTTP Error fetching details for job ID {job_id}: {e}")
                return None
        except requests.exceptions.RequestException as e:
            # Changed: print to logging.error
            logging.error(f"Request Exception fetching details for job ID {job_id}: {e}")
            return None 

    # Changed: print to logging.error
    if resp is None:
         logging.error(f"Failed to fetch details for job ID {job_id} after {retries} retries (unexpected state).")
         return None

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
        raw_description_text = "" # <--- ADD initialization
        try:
            description_div = soup.find("div", {"class": "show-more-less-html__markup"})
            if description_div:
                raw_description_text = description_div.get_text(separator='\n', strip=True)
                lines = [line for line in raw_description_text.splitlines() if line.strip()]
                raw_description_text = "\n".join(lines)
            else:
                # Changed: print to logging.warning
                logging.warning(f"Could not find description div for job ID {job_id}")
                # No longer need to set job_details["description"] here, handled by explicit None below
        except Exception as e:
                # Changed: print to logging.error
                logging.error(f"Error extracting raw description for job ID {job_id}: {e}")
                raw_description_text = "" # Ensure it's an empty string if extraction fails

        # Changed: Call AI for conversion only if raw_description_text is not empty
        if raw_description_text.strip(): # <--- NEW CHECK
            job_details["description"] = convert_plain_text_to_markdown_with_ai(raw_description_text)
        else:
            job_details["description"] = None # <--- Explicitly set to None if raw text is empty
            logging.warning(f"Raw description was empty for job ID {job_id}. Skipping AI conversion.") # <--- New log

        # --- Set Provider ---
        job_details["provider"] = "linkedin"
        
        return job_details

    except Exception as e:
         # Changed: print to logging.error
         logging.error(f"General Error processing details for job ID {job_id} after successful fetch: {e}")
         return None

def process_linkedin_query(search_query: str, location: str) -> list:
    """
    Orchestrates scraping and detail fetching for a single query,
    filtering against existing jobs in Supabase BEFORE fetching details.
    Returns a list of new job details found.
    """

    scraped_job_ids = _fetch_linkedin_job_ids(search_query, location)
    if not scraped_job_ids:
        # Changed: print to logging.info
        logging.info("No job IDs found in Phase 1. Skipping detail fetching.")
        return []

    unique_linkedin_job_ids = list(set(scraped_job_ids))
    # Changed: print to logging.info
    logging.info(f"Found {len(scraped_job_ids)} raw job IDs, {len(unique_linkedin_job_ids)} unique IDs after scraping.")

    # Changed: print to logging.info
    logging.info("\n--- Starting Filtering Step: Checking against Supabase ---")
    job_ids_set, company_title_set = supabase_utils.get_existing_jobs_from_supabase()

    new_job_ids_to_process = [
        str(job_id) for job_id in unique_linkedin_job_ids 
        if str(job_id) not in job_ids_set
    ]

    # Changed: print to logging.info
    logging.info(f"Found {len(unique_linkedin_job_ids)} unique scraped IDs.")
    # Changed: print to logging.info
    logging.info(f"Found {len(job_ids_set)} existing IDs in Supabase.")
    # Changed: print to logging.info
    logging.info(f"Identified {len(new_job_ids_to_process)} new job IDs to fetch details for.")

    if not new_job_ids_to_process:
        # Changed: print to logging.info
        logging.info("No new job IDs to process after filtering.")
        return []

    # Changed: print to logging.info
    logging.info(f"\n--- Starting Phase 2: Fetching Job Details for {len(new_job_ids_to_process)} New IDs ---")
    detailed_new_jobs = []
    processed_count = 0

    ids_to_fetch = new_job_ids_to_process

    for job_id in ids_to_fetch:
        details = _fetch_linkedin_job_details(job_id)
        if details:
            # --- NEW: Check for description before adding ---
            description = details.get('description')
            if description and description.strip(): # Ensure it's not None or an empty/whitespace string
                if 'job_id' in details and details['job_id'] is not None:
                    detailed_new_jobs.append(details)
                    processed_count += 1
                else:
                    # Changed: print to logging.warning
                    logging.warning(f"Fetched details for {job_id} but missing 'job_id' key. Skipping.")
            else:
                # Changed: print to logging.warning
                logging.warning(f"Skipping job ID {job_id} due to missing or empty description.") # <--- NEW LOG
        else:
            # Changed: print to logging.warning
            logging.warning(f"Skipping job ID {job_id} as detail fetching failed or returned no data.") # <--- NEW LOG

    # Changed: print to logging.info
    logging.info(f"--- Finished Phase 2: Successfully fetched details for {processed_count} new job(s) ---")
    return detailed_new_jobs

def _fetch_careers_future_jobs(search_query: str) -> list:
    """
    Fetches job items from CareersFuture based on the provided search query.
    This involves:
    1. Getting skill suggestions based on the search query.
    2. Using these skill UUIDs to search for jobs.
    3. Handling pagination to retrieve all job results.
    4. Returning a list of all collected job item dictionaries.

    Args:
        search_query (str): The job title or keywords to search for.

    Returns:
        list: A list of job item dictionaries. Returns an empty list if an error occurs
              or if no jobs are found.
    """


    careers_future_suggestions_api_url = "https://api.mycareersfuture.gov.sg/v2/skills/suggestions"
    careers_future_search_api_base_url =  "https://api.mycareersfuture.gov.sg/v2/search"

    skillUuids = []

    # --- 1. Get Skill Suggestions ---
    skills_suggestions_payload = {'jobTitle': search_query}

    try:
        logging.info(f"Fetching skill suggestions for query: '{search_query}' from {careers_future_suggestions_api_url}")
        skills_suggestions_response = requests.post(
            careers_future_suggestions_api_url, 
            data=skills_suggestions_payload,
            timeout=config.REQUEST_TIMEOUT
            )

        skills_suggestions_response.raise_for_status()
        skills_data = skills_suggestions_response.json()
        skills_list = skills_data.get('skills', [])
        skillUuids = [skill_dict['uuid'] for skill_dict in skills_list if 'uuid' in skill_dict]
        logging.info(f"Successfully retrieved {len(skillUuids)} skill UUIDs for '{search_query}'.")
        if not skillUuids:
            logging.warning(f"No skill UUIDs found for query '{search_query}'. Job search will proceed without specific skill filtering.")


    except requests.exceptions.HTTPError as http_err:
        status_code = http_err.response.status_code if http_err.response is not None else 'N/A'
        response_text = http_err.response.text if http_err.response is not None else 'N/A'
        logging.error(f"HTTP error during skill suggestions: {http_err} - Status: {status_code}")
        logging.debug(f"Skill suggestions error response content: {response_text[:500]}") # Log first 500 chars
        return [] # Cannot proceed without at least attempting skills
    except requests.exceptions.RequestException as req_err: # Catches ConnectionError, Timeout, etc.
        logging.error(f"Request exception during skill suggestions: {req_err}")
        return []
    except json.JSONDecodeError:
        content_for_log = skills_suggestions_response.text if 'skills_suggestions_response' in locals() and skills_suggestions_response else "N/A"
        logging.error(f"Could not decode JSON response for skill suggestions. Content: {content_for_log[:500]}")
        return []

    # --- 2. Search for Jobs and Handle Pagination ---
    all_job_items = []
    total_api_calls_for_search = 0

    # Initial search URL with default limit and page
    current_search_url = f"{careers_future_search_api_base_url}?limit=100&page=0"
    search_payload = {
        'sessionId':"",
        'search': search_query,
        'categories':config.CAREERS_FUTURE_SEARCH_CATEGORIES,
        'employmentTypes': config.CAREERS_FUTURE_SEARCH_EMPLOYMENT_TYPES,
        'postingCompany' : [],
        'sortBy': ["new_posting_date"],
        'skillUuids': skillUuids,

    }

    try:
        while current_search_url:
            total_api_calls_for_search += 1
            logging.info(f"Job search API call {total_api_calls_for_search}: POST to {current_search_url}")
        
            search_response = requests.post(current_search_url, json=search_payload)
            search_response.raise_for_status()
            search_results_data  = search_response.json()

            current_page_jobs = search_results_data.get('results', [])
            all_job_items.extend(current_page_jobs)

            logging.info(f"Retrieved {len(current_page_jobs)} job items from this page. Total items collected: {len(all_job_items)}.")

            # Log total results reported by API (often present in the first page's response)
            if 'total' in search_results_data and total_api_calls_for_search == 1:
                logging.info(f"API reports total potential jobs matching criteria: {search_results_data['total']}")
            
            # Get the next page URL. The API provides a full URL.
            next_page_link_info = search_results_data.get("_links", {}).get("next", {})
            current_search_url = next_page_link_info.get("href") if next_page_link_info else None 

            if current_search_url:
                logging.debug(f"Next page URL for job search: {current_search_url}")
            else:
                logging.info("No more job pages to fetch.")

        logging.info(f"Completed job search. Total API calls made for search: {total_api_calls_for_search}.")
    
    except requests.exceptions.HTTPError as http_err:
        status_code = http_err.response.status_code if http_err.response is not None else 'N/A'
        response_text = http_err.response.text if http_err.response is not None else 'N/A'
        logging.error(f"HTTP error during job search: {http_err} - Status: {status_code}")
        logging.debug(f"Job search error response content: {response_text[:500]}")
        # Partial results might have been collected. We'll process what we have.
    except requests.exceptions.RequestException as req_err:
        logging.error(f"Request exception during job search: {req_err}")
        # Partial results might have been collected.
    except json.JSONDecodeError:
        content_for_log = search_response.text if 'search_response' in locals() and search_response else "N/A"
        logging.error(f"Could not decode JSON response during job search. Content: {content_for_log[:500]}")
        # Partial results might have been collected.

    # --- 3. Return all collected job items ---
    if not all_job_items:
        logging.info(f"No job items were collected for query '{search_query}'.")
        return [] # Return empty list if no items were found/collected

    logging.info(f"Returning {len(all_job_items)} total job items for query '{search_query}'.")
    return all_job_items

def _fetch_careers_future_job_details(job_id: str) -> dict | None:
    """
    Fetch job details from CareersFuture based on the provided job ID.

    Args:
        job_id (str): The UUID of the job to fetch details for.

    Returns:
        dict | None: A dictionary containing the job details if successful,
                      None otherwise.
    """
    if not job_id:
        logging.warning("Job ID is missing or empty. Cannot fetch details.")
        return None

    api_url = f"https://api.mycareersfuture.gov.sg/v2/jobs/{job_id}"
    
    logging.info(f"Attempting to fetch job details for ID: {job_id} from URL: {api_url}")

    try:
        response = requests.get(api_url, timeout=config.REQUEST_TIMEOUT) # <--- Changed: Added timeout

        response.raise_for_status()

        job_data = response.json()
        logging.info(f"Successfully fetched and parsed job details for ID: {job_id}")

        raw_description_html = job_data.get('description', '')
        # Convert HTML description to plain text then Markdown
        plain_text_description = html2text.html2text(raw_description_html)
        markdown_description = None # <--- Initialize to None
        if plain_text_description.strip(): # <--- NEW CHECK: Only convert if plain text is not empty
            markdown_description = convert_plain_text_to_markdown_with_ai(plain_text_description)
        else:
            logging.warning(f"Raw description was empty for Careers Future job ID {job_id}. Skipping AI conversion.") # <--- NEW LOG

        job_details = {
            'job_id': job_data.get('uuid'),
            'company': _get_careers_future_job_company_name(job_data),
            'job_title': job_data.get('title'),
            'location': 'Singapore',
            'level': job_data.get('positionLevels', [{'position': 'Not applicable'}])[0].get('position', 'Not applicable'),
            'provider': 'careers_future',
            'description': markdown_description, # <--- Use the potentially converted Markdown
            'posted_at': job_data.get('metadata', {}).get('createdAt', ''),
        }

        return job_details

    except requests.exceptions.HTTPError as http_err:
        status_code = http_err.response.status_code if http_err.response is not None else 'N/A'
        response_text = http_err.response.text if http_err.response is not None else 'N/A'
        # Log specific error codes differently, e.g., 404 Not Found
        if status_code == 404:
            logging.warning(f"Job details not found (404) for ID: {job_id} at {api_url}.")
        else:
            logging.error(f"HTTP error occurred while fetching job details for ID '{job_id}': {http_err} - Status: {status_code}")
            logging.debug(f"Error response content: {response_text[:500]}") # Log first 500 chars
    except requests.exceptions.ConnectionError as conn_err:
        logging.error(f"Connection error occurred while fetching job details for ID '{job_id}': {conn_err}")
    except requests.exceptions.Timeout as timeout_err:
        logging.error(f"Timeout error occurred while fetching job details for ID '{job_id}': {timeout_err}")
    except requests.exceptions.RequestException as req_err: # Catch-all for other requests issues
        logging.error(f"An error occurred during the request for job details for ID '{job_id}': {req_err}")
    except json.JSONDecodeError:
        # This might happen if the response is not valid JSON, even with a 2xx status
        content_for_log = response.text if 'response' in locals() and response else "N/A"
        logging.error(f"Failed to decode JSON response for job details for ID '{job_id}'. Content: {content_for_log[:500]}")
    
    return None # Return None in case of any error

def process_careers_future_query(search_query: str) -> list:
    """
    Fetch jobs from CareersFuture and return them as a list of dictionaries.
    """
    # 1. Fetch all potential job items from CareersFuture search
    careers_future_jobs = _fetch_careers_future_jobs(search_query)
    if not careers_future_jobs:
        print("No job items found in Phase 1. Skipping detail fetching.")
        return []

    # 2. Fetch existing job identifiers from Supabase
    logging.info("Phase 2: Fetching existing job identifiers from Supabase...")
    try:
        job_ids_set_supabase, company_title_set_supabase = supabase_utils.get_existing_jobs_from_supabase()
        logging.info(f"Phase 2: Supabase returned {len(job_ids_set_supabase)} existing IDs and {len(company_title_set_supabase)} company/title pairs.")
    except Exception as e:
        logging.error(f"Failed to fetch existing jobs from Supabase: {e}")
        logging.warning("Proceeding without Supabase data; all fetched jobs will be considered new.")
        job_ids_set_supabase = set()
        company_title_set_supabase = set()

    # 3. Filter the fetched jobs
    logging.info("Phase 3: Filtering fetched jobs against Supabase data...")
    new_job_ids_to_process = []
    skipped_by_id_count = 0
    skipped_by_combo_count = 0

    for job_item in careers_future_jobs:
        if not isinstance(job_item, dict):
            logging.warning(f"Skipping invalid job item (not a dict): {str(job_item)[:100]}")
            continue

        job_uuid = str(job_item.get('uuid'))
        
        # Check 1: Does the UUID already exist in Supabase?
        if job_uuid and job_uuid in job_ids_set_supabase:
            logging.debug(f"Skipping job (ID exists in Supabase): UUID='{job_uuid}', Title='{job_item.get('title', 'N/A')}'")
            skipped_by_id_count += 1
            continue # Skip this job

        # Prepare for Check 2: Company & Title combination
        company_name = _get_careers_future_job_company_name(job_item)
        job_title = job_item.get('title')

        normalized_company = None
        normalized_title = None

        if company_name:
            normalized_company = company_name.strip().lower()
        if job_title:
            normalized_title = job_title.strip().lower()
        
        # Check 2: Does the normalized (company, title) combo exist?
        # Only perform this check if both normalized_company and normalized_title are non-empty
        if normalized_company and normalized_title:
            company_title_key = (normalized_company, normalized_title)
            if company_title_key in company_title_set_supabase:
                logging.debug(f"Skipping job (Company/Title combo exists in Supabase): UUID='{job_uuid}', Company='{normalized_company}', Title='{normalized_title}'")
                skipped_by_combo_count +=1
                continue # Skip this job
        elif job_uuid: # If no company/title to check, rely on UUID (which was already checked)
            logging.debug(f"Job UUID='{job_uuid}' has no company/title for combo check. Will be added if ID is new.")
        else: # No UUID and no company/title
             logging.warning(f"Job item has no UUID and insufficient company/title for matching: {str(job_item)[:100]}")
             # Decide if you want to skip these or process them differently. For now, they'll pass if not caught by ID.


        # If we reach here, the job is considered new
        new_job_ids_to_process.append(job_uuid) # Add the original full job item

    # 4. Fetch details ONLY for the genuinely new job IDs
    print(f"\n--- Phase 4: Fetching Job Details for {len(new_job_ids_to_process)} New Jobs ---")
    detailed_new_jobs = []
    processed_count = 0

    for job_id in new_job_ids_to_process:
        details = _fetch_careers_future_job_details(job_id)
        if details:
            # --- NEW: Check for description before adding ---
            description = details.get('description')
            if description and description.strip(): # Ensure it's not None or an empty/whitespace string
                if 'job_id' in details and details['job_id'] is not None:
                    detailed_new_jobs.append(details)
                    processed_count += 1
                else:
                    # Changed: print to logging.warning
                    logging.warning(f"Fetched details for {job_id} but missing 'job_id' key. Skipping.")
            else:
                # Changed: print to logging.warning
                logging.warning(f"Skipping job ID {job_id} due to missing or empty description.") # <--- NEW LOG
        else:
            # Changed: print to logging.warning
            logging.warning(f"Skipping job ID {job_id} as detail fetching failed or returned no data.") # <--- NEW LOG


    # Changed: print to logging.info
    logging.info(f"--- Finished Phase 4: Successfully fetched details for {processed_count} new job(s) ---")
    return detailed_new_jobs

# --- Main Execution ---
if __name__ == "__main__":

    total_new_jobs_saved = 0

    # Get jobs from LinkedIn
    logging.info("\n--- Starting LinkedIn Job Scraping ---")
    for query in config.LINKEDIN_SEARCH_QUERIES:
        print(f"\n{'='*20} Processing Search Query: '{query}' {'='*20}")

        # 1. Process the query: Scrape IDs, filter, fetch new details
        new_linkedin_job_details = process_linkedin_query(query, config.LINKEDIN_LOCATION)

        # 2. Save the NEW scraped data to Supabase
        if new_linkedin_job_details:
            print(f"\n--- Saving {len(new_linkedin_job_details)} new job(s) for query '{query}' ---")
            supabase_utils.save_jobs_to_supabase(new_linkedin_job_details)
            total_new_jobs_saved += len(new_linkedin_job_details)
        else:
            print(f"\nNo new job details were fetched or processed for query '{query}'.")

    # Get jobs from Careers Future
    logging.info(f"\n--- Starting Careers Future Job Scraping ---")
    for query in config.CAREERS_FUTURE_SEARCH_QUERIES:
        logging.info(f"\n{'='*20} Processing Careers Future Search Query: '{query}' {'='*20}")

        # 1. Process the query: Scrape IDs, filter, fetch new details
        new_careers_future_job_details = process_careers_future_query(query)

        # 2. Save the NEW scraped data to Supabase
        if new_careers_future_job_details:
            logging.info(f"\n--- Saving {len(new_careers_future_job_details)} new job(s) for query '{query}' ---")
            supabase_utils.save_jobs_to_supabase(new_careers_future_job_details)
            total_new_jobs_saved += len(new_careers_future_job_details)
        else:
            logging.info(f"\nNo new job details were fetched or processed for query '{query}'.")

    # --- End of Script ---      
    logging.info(f"\n{'='*20} Job scraping script finished {'='*20}")
    logging.info(f"Total new jobs saved across all queries: {total_new_jobs_saved}")