import argparse
import sys
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time 
import random 
import logging
import config
import user_agents
import supabase_utils
from markdownify import markdownify as md
import json

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Convert HTML description to Markdown
def convert_html_to_markdown(html: str) -> str | None:
    """
    Convert HTML to clean Markdown using BeautifulSoup (to strip unwanted tags)
    and markdownify (to convert the cleaned HTML to Markdown).
    No LLM API calls are made — this is entirely local.
    """
    if not html or not html.strip():
        logging.info("Received empty HTML for Markdown conversion, returning empty string.")
        return ""

    try:
        # Clean the HTML: remove scripts, styles, nav, and other non-content tags
        soup = BeautifulSoup(html, 'html.parser')
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript']):
            tag.decompose()

        cleaned_html = str(soup)

        # Convert cleaned HTML to Markdown
        markdown_text = md(
            cleaned_html,
            heading_style="ATX",
            bullets="-",
            strip=['img'],
        )

        # Clean up excessive blank lines
        lines = markdown_text.splitlines()
        cleaned_lines = []
        prev_blank = False
        for line in lines:
            if not line.strip():
                if not prev_blank:
                    cleaned_lines.append('')
                prev_blank = True
            else:
                cleaned_lines.append(line)
                prev_blank = False
        markdown_text = '\n'.join(cleaned_lines).strip()

        logging.info("Successfully converted HTML to Markdown.")
        return markdown_text if markdown_text else ""
    except Exception as e:
        logging.error(f"Error during HTML to Markdown conversion: {e}")
        return None

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


# --- Persistent LinkedIn Session ---
_LINKEDIN_SESSION = None

def get_linkedin_session() -> requests.Session:
    """
    Initializes and returns a persistent requests.Session for LinkedIn.
    Uses a single consistent modern desktop User-Agent and standard browser headers,
    preserving cookies (bcookie, bscookie, etc.) across search and detail requests.
    """
    global _LINKEDIN_SESSION
    if _LINKEDIN_SESSION is None:
        _LINKEDIN_SESSION = requests.Session()
        desktop_agents = [ua for ua in user_agents.USER_AGENTS if "Windows" in ua or "Macintosh" in ua or "X11" in ua]
        chosen_ua = random.choice(desktop_agents) if desktop_agents else random.choice(user_agents.USER_AGENTS)
        _LINKEDIN_SESSION.headers.update({
            'User-Agent': chosen_ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
        })
        logging.info(f"Initialized persistent LinkedIn session with User-Agent: {chosen_ua}")
    return _LINKEDIN_SESSION

def _get_request_headers() -> dict:
    """Helper to return realistic browser headers with a random modern user agent."""
    user_agent = random.choice(user_agents.USER_AGENTS)
    return {
        'User-Agent': user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
    }

# --- LinkedIn Scraping Logic ---
def _fetch_linkedin_job_ids(search_query: str, location: str) -> list[dict]:
    """
    Fetches job candidates (ID, title, company, location) from LinkedIn search results pages
    using a persistent session, adaptive backoff, and pagination.
    """
    candidate_jobs = []
    seen_ids = set()
    start = 0
    max_start = config.LINKEDIN_MAX_START

    # Format workplace type filter (f_WT: 1=Onsite, 2=Remote, 3=Hybrid)
    f_wt = getattr(config, 'LINKEDIN_F_WT', None)
    if isinstance(f_wt, (list, tuple)):
        f_wt_str = ",".join(str(x) for x in f_wt)
    elif f_wt is not None:
        f_wt_str = str(f_wt).strip()
    else:
        f_wt_str = ""
    f_wt_param = f"&f_WT={f_wt_str}" if f_wt_str else ""

    session = get_linkedin_session()
    logging.info(f"--- Starting Phase 1: Scraping Job IDs (Max Start: {max_start}) ---")

    while start <= max_start:
        target_url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={search_query.replace(' ', '%20')}&location={location}&geoId={config.LINKEDIN_GEO_ID}&f_TPR={config.LINKEDIN_JOB_POSTING_DATE}&f_JT={config.LINKEDIN_JOB_TYPE}{f_wt_param}&start={start}"

        if start > 0:
            sleep_time = random.uniform(8.0, 16.0)
            logging.info(f"Waiting for {sleep_time:.2f} seconds before next search page...")
            time.sleep(sleep_time)

        logging.info(f"Scraping URL: {target_url}")

        res = None 
        retries = 0
        while retries <= config.MAX_RETRIES:
            try:
                res = session.get(target_url, timeout=config.REQUEST_TIMEOUT)
                res.raise_for_status()
                break
            except requests.exceptions.HTTPError as e:
                if e.response is not None and e.response.status_code == 429 and retries < config.MAX_RETRIES:
                    retries += 1
                    wait_time = (config.RETRY_DELAY_SECONDS * (2 ** (retries - 1))) + random.uniform(2, 8)
                    logging.warning(f"Error 429: Too Many Requests. Cooling down attempt {retries}/{config.MAX_RETRIES} for {wait_time:.2f} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    logging.error(f"HTTP Error fetching search results page: {e}")
                    res = None 
                    break
            except requests.exceptions.RequestException as e:
                logging.error(f"Request Exception fetching search results page: {e}")
                res = None
                break

        if res is None:
            logging.error(f"Failed to fetch {target_url} after {retries} retries. Stopping pagination for this query.")
            break 

        if not res.text or not res.text.strip():
            logging.info(f"Received empty response text at start={start}, stopping.")
            break

        soup = BeautifulSoup(res.text, 'html.parser')
        all_jobs_on_this_page = soup.find_all('li')

        if not all_jobs_on_this_page:
            logging.info(f"No job listings ('li' elements) found on page at start={start}, stopping.")
            break

        logging.info(f"Found {len(all_jobs_on_this_page)} potential job elements on this page.")

        jobs_found_this_iteration = 0
        for job_element in all_jobs_on_this_page:
            base_card = job_element.find("div", {"class": "base-card"})
            job_urn = base_card.get('data-entity-urn') if base_card else None
            if job_urn and 'jobPosting:' in job_urn:
                try:
                    jobid = job_urn.split(":")[3]
                    title_tag = job_element.find("h3", {"class": "base-search-card__title"})
                    company_tag = job_element.find("h4", {"class": "base-search-card__subtitle"})
                    location_tag = job_element.find("span", {"class": "job-search-card__location"})

                    title = title_tag.get_text(strip=True) if title_tag else None
                    company = company_tag.get_text(strip=True) if company_tag else None
                    loc = location_tag.get_text(strip=True) if location_tag else None

                    if jobid not in seen_ids:
                        seen_ids.add(jobid)
                        candidate_jobs.append({
                            "job_id": jobid,
                            "job_title": title,
                            "company": company,
                            "location": loc
                        })
                        jobs_found_this_iteration += 1
                except IndexError:
                    logging.warning(f"Could not parse job ID from URN: {job_urn}")
                    pass

        logging.info(f"Added {jobs_found_this_iteration} unique job IDs from this page.")

        if jobs_found_this_iteration == 0 and len(all_jobs_on_this_page) > 0:
            logging.info("Found list items but no new job IDs extracted, potentially end of relevant results.")
            break

        # Advance start offset dynamically based on returned cards
        start += max(len(all_jobs_on_this_page), 10)

    logging.info(f"--- Finished Phase 1: Found {len(candidate_jobs)} unique candidate jobs during scraping ---")
    return candidate_jobs

def _fetch_linkedin_job_details(job_id: str, candidate_fallback: dict = None) -> dict | None:
    """
    Fetches detailed information for a single job ID with gentle pacing,
    persistent session, and exponential backoff on HTTP 429.
    """
    job_detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    session = get_linkedin_session()

    min_delay = getattr(config, 'DETAIL_FETCH_MIN_DELAY', 12.0)
    max_delay = getattr(config, 'DETAIL_FETCH_MAX_DELAY', 22.0)
    sleep_time = random.uniform(min_delay, max_delay)

    logging.info(f"Preparing to fetch details for job ID: {job_id}")
    logging.info(f"Waiting for {sleep_time:.2f} seconds before fetching details...")
    time.sleep(sleep_time)

    logging.info(f"Fetching details from: {job_detail_url}")

    resp = None 
    retries = 0
    while retries <= config.MAX_RETRIES:
        try:
            resp = session.get(job_detail_url, timeout=config.REQUEST_TIMEOUT)
            resp.raise_for_status()
            break
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 429 and retries < config.MAX_RETRIES:
                retries += 1
                wait_time = (config.RETRY_DELAY_SECONDS * (2 ** (retries - 1))) + random.uniform(2, 8)
                logging.warning(f"Error 429 for job ID {job_id}. Cooling down attempt {retries}/{config.MAX_RETRIES} for {wait_time:.2f} seconds...")
                time.sleep(wait_time)
                continue
            else:
                logging.error(f"HTTP Error fetching details for job ID {job_id}: {e}")
                return None
        except requests.exceptions.RequestException as e:
            logging.error(f"Request Exception fetching details for job ID {job_id}: {e}")
            return None 

    if resp is None:
        logging.error(f"Failed to fetch details for job ID {job_id} after {retries} retries.")
        return None

    try:
        soup = BeautifulSoup(resp.text, 'html.parser')
        job_details = {"job_id": job_id}

        # --- Extract Company ---
        try:
            company_img = soup.find("div", {"class": "top-card-layout__card"})
            if company_img and company_img.find("a") and company_img.find("a").find("img"):
                job_details["company"] = company_img.find("a").find("img").get('alt', '').strip()
            if not job_details.get("company"):
                company_link = soup.find("a", {"class": "topcard__org-name-link"})
                if company_link:
                    job_details["company"] = company_link.text.strip()
                else:
                    sub_title_span = soup.find("span", {"class": "topcard__flavor"})
                    if sub_title_span:
                        job_details["company"] = sub_title_span.text.strip()

            if not job_details.get("company") and candidate_fallback:
                job_details["company"] = candidate_fallback.get("company")
        except Exception as e:
            logging.debug(f"Error extracting company for job ID {job_id}: {e}")
            job_details["company"] = candidate_fallback.get("company") if candidate_fallback else None

        # --- Extract Job Title ---
        try:
            title_link = soup.find("div", {"class": "top-card-layout__entity-info"})
            if title_link and title_link.find("a"):
                job_details["job_title"] = title_link.find("a").text.strip()
            if not job_details.get("job_title"):
                title_h1 = soup.find("h1", {"class": "top-card-layout__title"})
                if title_h1:
                    job_details["job_title"] = title_h1.text.strip()

            if not job_details.get("job_title") and candidate_fallback:
                job_details["job_title"] = candidate_fallback.get("job_title")
        except Exception as e: 
            logging.debug(f"Error extracting job title for job ID {job_id}: {e}")
            job_details["job_title"] = candidate_fallback.get("job_title") if candidate_fallback else None

        # --- Extract Seniority Level ---
        try:
            criteria_items = soup.find("ul", {"class": "description__job-criteria-list"})
            items = criteria_items.find_all("li") if criteria_items else []
            job_details["level"] = None 
            for item in items:
                header = item.find("h3", {"class": "description__job-criteria-subheader"})
                if header and "Seniority level" in header.text:
                    level_text = item.find("span", {"class": "description__job-criteria-text"})
                    if level_text:
                        job_details["level"] = level_text.text.strip()
                        break 
        except Exception as e: 
            logging.debug(f"Error extracting seniority level for job ID {job_id}: {e}")
            job_details["level"] = None

        # --- Extract Location ---
        try:
            location_span = soup.find("span", {"class": "topcard__flavor topcard__flavor--bullet"})
            if location_span:
                job_details["location"] = location_span.text.strip()
            else:
                subtitle_div = soup.find("div", {"class": "topcard__flavor-row"})
                if subtitle_div:
                    location_span_fallback = subtitle_div.find("span", {"class": "topcard__flavor"})
                    if location_span_fallback:
                        job_details["location"] = location_span_fallback.text.strip()

            if not job_details.get("location") and candidate_fallback:
                job_details["location"] = candidate_fallback.get("location")
        except Exception as e:
            logging.debug(f"Error extracting location for job ID {job_id}: {e}")
            job_details["location"] = candidate_fallback.get("location") if candidate_fallback else None

        # --- Extract Description ---
        description_html = "" 
        try:
            description_div = soup.find("div", {"class": "show-more-less-html__markup"})
            if description_div:
                description_html = str(description_div)
            else:
                logging.warning(f"Could not find description div for job ID {job_id}")
        except Exception as e:
            logging.error(f"Error extracting description HTML for job ID {job_id}: {e}")
            description_html = ""

        if description_html.strip():
            job_details["description"] = convert_html_to_markdown(description_html)
        else:
            job_details["description"] = None 
            logging.warning(f"Description HTML was empty for job ID {job_id}. Skipping conversion.") 

        # --- Set Provider ---
        job_details["provider"] = "linkedin"
        
        return job_details

    except Exception as e:
        logging.error(f"General Error processing details for job ID {job_id} after successful fetch: {e}")
        return None

def process_linkedin_query(search_query: str, location: str, limit: int = None) -> list:
    """
    Orchestrates scraping and detail fetching for a single query,
    pre-filtering candidates against Supabase (by ID and company/title)
    BEFORE fetching details.
    """
    candidate_jobs = _fetch_linkedin_job_ids(search_query, location)
    if not candidate_jobs:
        logging.info("No job candidates found in Phase 1. Skipping detail fetching.")
        return []

    logging.info("\n--- Starting Filtering Step: Checking against Supabase ---")
    job_ids_set, company_title_set = supabase_utils.get_existing_jobs_from_supabase()

    new_candidates_to_process = []
    skipped_by_id = 0
    skipped_by_combo = 0

    for item in candidate_jobs:
        jid = str(item['job_id'])
        if jid in job_ids_set:
            skipped_by_id += 1
            continue

        comp = item.get('company')
        title = item.get('job_title')
        if comp and title:
            combo_key = (comp.strip().lower(), title.strip().lower())
            if combo_key in company_title_set:
                skipped_by_combo += 1
                continue

        new_candidates_to_process.append(item)

    logging.info(f"Phase 1 found {len(candidate_jobs)} total candidate jobs.")
    logging.info(f"Filtered against Supabase: {skipped_by_id} skipped by existing ID, {skipped_by_combo} skipped by company/title duplicate.")
    logging.info(f"Identified {len(new_candidates_to_process)} genuinely new jobs to fetch details for.")

    if not new_candidates_to_process:
        logging.info("No new job IDs to process after filtering.")
        return []

    if limit is not None and len(new_candidates_to_process) > limit:
        logging.info(f"Truncating new_candidates_to_process from {len(new_candidates_to_process)} to {limit} to stay within source limit.")
        new_candidates_to_process = new_candidates_to_process[:limit]

    logging.info(f"\n--- Starting Phase 2: Fetching Job Details for {len(new_candidates_to_process)} New IDs ---")
    detailed_new_jobs = []
    processed_count = 0

    for candidate in new_candidates_to_process:
        job_id = candidate['job_id']
        details = _fetch_linkedin_job_details(job_id, candidate_fallback=candidate)
        if details:
            description = details.get('description')
            if description and description.strip(): 
                if 'job_id' in details and details['job_id'] is not None:
                    detailed_new_jobs.append(details)
                    processed_count += 1
                else:
                    logging.warning(f"Fetched details for {job_id} but missing 'job_id' key. Skipping.")
            else:
                logging.warning(f"Skipping job ID {job_id} due to missing or empty description.") 
        else:
            logging.warning(f"Skipping job ID {job_id} as detail fetching failed or returned no data.") 

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
        logging.debug(f"Skill suggestions error response content: {response_text[:500]}") 
        return []
    except requests.exceptions.RequestException as req_err: 
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

            # Log total results reported by API 
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
    except requests.exceptions.RequestException as req_err:
        logging.error(f"Request exception during job search: {req_err}")
    except json.JSONDecodeError:
        content_for_log = search_response.text if 'search_response' in locals() and search_response else "N/A"
        logging.error(f"Could not decode JSON response during job search. Content: {content_for_log[:500]}")

    # --- 3. Return all collected job items ---
    if not all_job_items:
        logging.info(f"No job items were collected for query '{search_query}'.")
        return [] 

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
        response = requests.get(api_url, timeout=config.REQUEST_TIMEOUT) 

        response.raise_for_status()

        job_data = response.json()
        logging.info(f"Successfully fetched and parsed job details for ID: {job_id}")

        raw_description_html = job_data.get('description', '')
        # Convert HTML description directly to Markdown (no LLM needed)
        markdown_description = None 
        if raw_description_html.strip(): 
            markdown_description = convert_html_to_markdown(raw_description_html)
        else:
            logging.warning(f"Raw description was empty for Careers Future job ID {job_id}. Skipping conversion.") 

        job_details = {
            'job_id': job_data.get('uuid'),
            'company': _get_careers_future_job_company_name(job_data),
            'job_title': job_data.get('title'),
            'location': 'Singapore',
            'level': job_data.get('positionLevels', [{'position': 'Not applicable'}])[0].get('position', 'Not applicable'),
            'provider': 'careers_future',
            'description': markdown_description, 
            'posted_at': job_data.get('metadata', {}).get('createdAt', ''),
        }

        return job_details

    except requests.exceptions.HTTPError as http_err:
        status_code = http_err.response.status_code if http_err.response is not None else 'N/A'
        response_text = http_err.response.text if http_err.response is not None else 'N/A'
        if status_code == 404:
            logging.warning(f"Job details not found (404) for ID: {job_id} at {api_url}.")
        else:
            logging.error(f"HTTP error occurred while fetching job details for ID '{job_id}': {http_err} - Status: {status_code}")
            logging.debug(f"Error response content: {response_text[:500]}") 
    except requests.exceptions.ConnectionError as conn_err:
        logging.error(f"Connection error occurred while fetching job details for ID '{job_id}': {conn_err}")
    except requests.exceptions.Timeout as timeout_err:
        logging.error(f"Timeout error occurred while fetching job details for ID '{job_id}': {timeout_err}")
    except requests.exceptions.RequestException as req_err: 
        logging.error(f"An error occurred during the request for job details for ID '{job_id}': {req_err}")
    except json.JSONDecodeError:
        content_for_log = response.text if 'response' in locals() and response else "N/A"
        logging.error(f"Failed to decode JSON response for job details for ID '{job_id}'. Content: {content_for_log[:500]}")
    
    return None # Return None in case of any error

def process_careers_future_query(search_query: str, limit: int = None) -> list:
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
        
        if normalized_company and normalized_title:
            company_title_key = (normalized_company, normalized_title)
            if company_title_key in company_title_set_supabase:
                logging.debug(f"Skipping job (Company/Title combo exists in Supabase): UUID='{job_uuid}', Company='{normalized_company}', Title='{normalized_title}'")
                skipped_by_combo_count +=1
                continue 
        elif job_uuid: 
            logging.debug(f"Job UUID='{job_uuid}' has no company/title for combo check. Will be added if ID is new.")
        else: 
             logging.warning(f"Job item has no UUID and insufficient company/title for matching: {str(job_item)[:100]}")


        new_job_ids_to_process.append(job_uuid) 

    # 4. Fetch details ONLY for the genuinely new job IDs
    if limit is not None and len(new_job_ids_to_process) > limit:
        logging.info(f"Truncating new_job_ids_to_process from {len(new_job_ids_to_process)} to {limit} to stay within source limit.")
        new_job_ids_to_process = new_job_ids_to_process[:limit]

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
                    
                    logging.warning(f"Fetched details for {job_id} but missing 'job_id' key. Skipping.")
            else:
                
                logging.warning(f"Skipping job ID {job_id} due to missing or empty description.") 
        else:
            
            logging.warning(f"Skipping job ID {job_id} as detail fetching failed or returned no data.") 



    logging.info(f"--- Finished Phase 4: Successfully fetched details for {processed_count} new job(s) ---")
    return detailed_new_jobs

# --- Main Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Multi-source Job Scraper (LinkedIn & CareersFuture)")
    parser.add_argument("--source", choices=["all", "linkedin", "careers_future"], default=None,
                        help="Specific source to scrape (defaults to config.SCRAPING_SOURCES)")
    parser.add_argument("--query", type=str, default=None,
                        help="Specific search query to run (defaults to queries in config)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Maximum jobs to fetch per search query (overrides config)")
    args = parser.parse_args()

    total_new_jobs_saved = 0

    # Determine enabled sources
    if args.source and args.source != "all":
        active_sources = [args.source]
    else:
        active_sources = config.SCRAPING_SOURCES

    # Get jobs from LinkedIn
    if "linkedin" in active_sources:
        logging.info("\n--- Starting LinkedIn Job Scraping ---")
        max_jobs = args.limit if args.limit is not None else config.MAX_JOBS_PER_SEARCH.get("linkedin", 10)
        linkedin_queries = [args.query] if args.query else config.LINKEDIN_SEARCH_QUERIES

        for idx, query in enumerate(linkedin_queries):
            print(f"\n{'='*20} Processing LinkedIn Search Query: '{query}' {'='*20}")

            # 1. Process query
            new_linkedin_job_details = process_linkedin_query(query, config.LINKEDIN_LOCATION, limit=max_jobs)

            # 2. Save new scraped data to Supabase
            if new_linkedin_job_details:
                print(f"\n--- Saving {len(new_linkedin_job_details)} new job(s) for query '{query}' ---")
                supabase_utils.save_jobs_to_supabase(new_linkedin_job_details)
                total_new_jobs_saved += len(new_linkedin_job_details)
            else:
                print(f"\nNo new job details were fetched or processed for query '{query}'.")

            # Inter-query jitter delay if more queries remain
            if idx < len(linkedin_queries) - 1:
                q_min = getattr(config, 'SEARCH_QUERY_MIN_DELAY', 15.0)
                q_max = getattr(config, 'SEARCH_QUERY_MAX_DELAY', 30.0)
                sleep_time = random.uniform(q_min, q_max)
                logging.info(f"Waiting {sleep_time:.2f}s before next LinkedIn search query...")
                time.sleep(sleep_time)
    else:
        logging.info("\n--- Skipping LinkedIn Job Scraping per arguments / config ---")

    # Get jobs from Careers Future
    if "careers_future" in active_sources:
        logging.info(f"\n--- Starting Careers Future Job Scraping ---")
        max_jobs = args.limit if args.limit is not None else config.MAX_JOBS_PER_SEARCH.get("careers_future", 20)
        cf_queries = [args.query] if args.query else config.CAREERS_FUTURE_SEARCH_QUERIES

        for idx, query in enumerate(cf_queries):
            logging.info(f"\n{'='*20} Processing Careers Future Search Query: '{query}' {'='*20}")

            # 1. Process query
            new_careers_future_job_details = process_careers_future_query(query, limit=max_jobs)

            # 2. Save new scraped data to Supabase
            if new_careers_future_job_details:
                logging.info(f"\n--- Saving {len(new_careers_future_job_details)} new job(s) for query '{query}' ---")
                supabase_utils.save_jobs_to_supabase(new_careers_future_job_details)
                total_new_jobs_saved += len(new_careers_future_job_details)
            else:
                logging.info(f"\nNo new job details were fetched or processed for query '{query}'.")

            if idx < len(cf_queries) - 1:
                sleep_time = random.uniform(5.0, 10.0)
                logging.info(f"Waiting {sleep_time:.2f}s before next Careers Future search query...")
                time.sleep(sleep_time)
    else:
        logging.info("\n--- Skipping Careers Future Job Scraping per arguments / config ---")

    # --- End of Script ---      
    logging.info(f"\n{'='*20} Job scraping script finished {'='*20}")
    logging.info(f"Total new jobs saved across all queries: {total_new_jobs_saved}")
