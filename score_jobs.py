from google import genai
import time
import json
import logging
from typing import List, Optional, Dict, Any
import requests
import io
import pdfplumber

import config
import supabase_utils

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Initialize Gemini Client ---
client = genai.Client(api_key=config.GEMINI_FIRST_API_KEY)

# --- Helper Functions ---

def format_resume_to_text(resume_data: Dict[str, Any]) -> str:
    """
    Formats the structured resume data dictionary into a plain text string.
    """
    if not resume_data:
        return "Resume data is not available."

    lines = []

    # Basic Info
    lines.append(f"Name: {resume_data.get('name', 'N/A')}")
    lines.append(f"Email: {resume_data.get('email', 'N/A')}")
    if resume_data.get('phone'): lines.append(f"Phone: {resume_data['phone']}")
    if resume_data.get('location'): lines.append(f"Location: {resume_data['location']}")
    if resume_data.get('links'):
        links_str = ", ".join(f"{k}: {v}" for k, v in resume_data['links'].items() if v)
        if links_str: lines.append(f"Links: {links_str}")
    lines.append("\n---\n")

    # Summary
    if resume_data.get('summary'):
        lines.append("Summary:")
        lines.append(resume_data['summary'])
        lines.append("\n---\n")

    # Skills
    if resume_data.get('skills'):
        lines.append("Skills:")
        lines.append(", ".join(resume_data['skills']))
        lines.append("\n---\n")

    # Experience
    if resume_data.get('experience'):
        lines.append("Experience:")
        for exp in resume_data['experience']:
            lines.append(f"\n* {exp.get('job_title', 'N/A')} at {exp.get('company', 'N/A')}")
            if exp.get('location'): lines.append(f"  Location: {exp['location']}")
            date_range = f"{exp.get('start_date', '?')} - {exp.get('end_date', 'Present')}"
            lines.append(f"  Dates: {date_range}")
            if exp.get('description'):
                lines.append("  Description:")
                # Indent description lines
                desc_lines = exp['description'].split('\n')
                lines.extend([f"    - {line.strip()}" for line in desc_lines if line.strip()])
        lines.append("\n---\n")

    # Education
    if resume_data.get('education'):
        lines.append("Education:")
        for edu in resume_data['education']:
            degree_info = f"{edu.get('degree', 'N/A')}"
            if edu.get('field_of_study'): degree_info += f", {edu['field_of_study']}"
            lines.append(f"\n* {degree_info} from {edu.get('institution', 'N/A')}")
            year_range = f"{edu.get('start_year', '?')} - {edu.get('end_year', 'Present')}"
            lines.append(f"  Years: {year_range}")
        lines.append("\n---\n")

    # Projects
    if resume_data.get('projects'):
        lines.append("Projects:")
        for proj in resume_data['projects']:
            lines.append(f"\n* {proj.get('name', 'N/A')}")
            if proj.get('description'): lines.append(f"  Description: {proj['description']}")
            if proj.get('technologies'): lines.append(f"  Technologies: {', '.join(proj['technologies'])}")
        lines.append("\n---\n")

    # Certifications
    if resume_data.get('certifications'):
        lines.append("Certifications:")
        for cert in resume_data['certifications']:
            cert_info = f"{cert.get('name', 'N/A')}"
            if cert.get('issuer'): cert_info += f" ({cert['issuer']})"
            if cert.get('year'): cert_info += f" - {cert['year']}"
            lines.append(f"* {cert_info}")
        lines.append("\n---\n")

    # Languages
    if resume_data.get('languages'):
        lines.append("Languages:")
        lines.append(", ".join(resume_data['languages']))
        lines.append("\n---\n")

    return "\n".join(lines)


def get_resume_score_from_ai(resume_text: str, job_details: Dict[str, Any]) -> Optional[int]:
    """
    Sends resume and job details to Gemini to get a suitability score.
    Returns the score as an integer (0-100) or None if scoring fails.
    """
    if not resume_text or not job_details or not job_details.get('description'):
        logging.warning(f"Missing resume text or job description for job_id {job_details.get('job_id')}. Skipping scoring.")
        return None

    job_company = job_details.get('company', 'N/A')
    job_title = job_details.get('job_title', 'N/A')
    job_description = job_details.get('description', 'N/A')
    job_level = job_details.get('level', 'N/A')

    logging.info(f"Scoring job_id: {job_details.get('job_id')} with job_title: {job_title} and job_level: {job_level}")

    prompt = f"""
    You are a scoring assistant. You will be given a resume and a job description.  
    Based **only** on the information provided, **return exactly one integer between 0 and 100** (inclusive) that represents the candidate’s suitability for the role.  
    Do **not** return any words, punctuation, or explanation—only the integer.

    --- RESUME ---
    {resume_text}
    --- END RESUME ---

    --- JOB DESCRIPTION ---
    Job Title: {job_title}
    Company: {job_company}
    Level: {job_level}

    {job_description}
    --- END JOB DESCRIPTION ---

    Score (0–100):
    """

    try:
        logging.info(f"Requesting score for job_id: {job_details.get('job_id')}")
        response = client.models.generate_content(
            model=config.GEMINI_MODEL_NAME, 
            contents=prompt
            )

        # Attempt to parse the score
        score_text = response.text.strip()
        score = int(score_text)
        if 0 <= score <= 100:
            logging.info(f"Received score {score} for job_id: {job_details.get('job_id')}")
            return score
        else:
            logging.warning(f"Received score out of range ({score}) for job_id: {job_details.get('job_id')}. Raw response: '{score_text}'")
            return None
    except ValueError:
        logging.error(f"Could not parse integer score from Gemini response for job_id: {job_details.get('job_id')}. Raw response: '{response.text.strip()}'")
        return None
    except Exception as e:
        # Catch potential API errors (rate limits, etc.)
        logging.error(f"Error calling Gemini API for job_id {job_details.get('job_id')}: {e}")
        # Consider specific error handling for rate limits if needed
        return None


def extract_text_from_pdf_url(pdf_url: str) -> Optional[str]:
    """
    Downloads a PDF from a URL and extracts text from it.
    """
    if not pdf_url:
        logging.warning("No PDF URL provided for text extraction.")
        return None
    try:
        logging.info(f"Downloading PDF from URL: {pdf_url}")
        response = requests.get(pdf_url, timeout=30) 
        response.raise_for_status()  # Raise an exception for bad status codes

        logging.info(f"Successfully downloaded PDF. Extracting text...")
        text = ""
        with io.BytesIO(response.content) as pdf_file:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        
        if not text.strip():
            logging.warning(f"Extracted no text from PDF at {pdf_url}. The PDF might be image-based or empty.")
            return None
            
        logging.info(f"Successfully extracted text from PDF URL: {pdf_url[:70]}...")
        return text.strip()

    except requests.exceptions.RequestException as e:
        logging.error(f"Error downloading PDF from {pdf_url}: {e}")
        return None
    except pdfplumber.exceptions.PDFSyntaxError: # Catch specific pdfplumber error
        logging.error(f"Error: Could not open PDF from {pdf_url}. It might be corrupted or not a PDF.")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred while extracting text from PDF URL {pdf_url}: {e}")
        return None

def rescore_jobs_with_custom_resume():
    """Fetches jobs with custom resumes and re-scores them."""
    logging.info("--- Starting Job Re-scoring with Custom Resumes ---")
    rescore_start_time = time.time()

    jobs_to_rescore = supabase_utils.get_jobs_to_rescore(config.JOBS_TO_SCORE_PER_RUN)
    if not jobs_to_rescore:
        logging.info("No jobs require re-scoring with custom resumes at this time.")
        logging.info("--- Job Re-scoring Finished (No Jobs) ---")
        return

    logging.info(f"Processing {len(jobs_to_rescore)} jobs for re-scoring...")
    successful_rescores = 0
    failed_rescores = 0

    for i, job in enumerate(jobs_to_rescore):
        job_id = job.get('job_id')
        resume_link = job.get('resume_link')

        if not job_id or not resume_link:
            logging.warning(f"Skipping re-scoring for job due to missing job_id or resume_link: {job}")
            failed_rescores += 1
            continue

        logging.info(f"--- Re-scoring Job {i+1}/{len(jobs_to_rescore)} (ID: {job_id}) using custom resume from {resume_link[:70]}... ---")

        custom_resume_text = extract_text_from_pdf_url(resume_link)

        if not custom_resume_text:
            logging.error(f"Failed to extract text from custom resume PDF for job_id {job_id}. Skipping re-score.")
            failed_rescores += 1
            if i < len(jobs_to_rescore) - 1:
                logging.debug(f"Waiting {config.GEMINI_REQUEST_DELAY_SECONDS} seconds before next job...")
                time.sleep(config.GEMINI_REQUEST_DELAY_SECONDS)
            continue
        
        logging.debug(f"Custom resume text for job {job_id} (first 200 chars): {custom_resume_text[:200]}")
        score = get_resume_score_from_ai(custom_resume_text, job)

        if score is not None:
            if supabase_utils.update_job_score(job_id, score, resume_score_stage="custom"):
                successful_rescores += 1
            else:
                failed_rescores += 1 
        else:
            failed_rescores += 1 

        if i < len(jobs_to_rescore) - 1: 
            logging.debug(f"Waiting {config.GEMINI_REQUEST_DELAY_SECONDS} seconds before next API call...")
            time.sleep(config.GEMINI_REQUEST_DELAY_SECONDS)

    rescore_end_time = time.time()
    logging.info("--- Job Re-scoring Finished ---")
    logging.info(f"Successfully re-scored: {successful_rescores}")
    logging.info(f"Failed/Skipped re-scores: {failed_rescores}")
    logging.info(f"Total re-scoring time: {rescore_end_time - rescore_start_time:.2f} seconds")

# --- Main Execution ---

def main():
    """Main function to score jobs based on the target resume."""
    logging.info("--- Starting Job Scoring Script ---")
    overall_start_time = time.time()

    # --- Phase 1: Initial Scoring with Default Resume ---
    logging.info("--- Phase 1: Initial Scoring with Default Resume ---")
    initial_score_start_time = time.time()
    default_resume_data = supabase_utils.get_resume_by_email(config.LINKEDIN_EMAIL)
    if not default_resume_data:
        logging.error(f"Could not retrieve resume for {config.LINKEDIN_EMAIL}. Skipping initial scoring phase.")
    else:
        # 2. Format Resume to Text
        default_resume_text = format_resume_to_text(default_resume_data)
        logging.info("Default resume data formatted to text.")

        # 3. Fetch Jobs to Score
        jobs_to_score_initially = supabase_utils.get_jobs_to_score(config.JOBS_TO_SCORE_PER_RUN)
        if not jobs_to_score_initially:
            logging.info("No jobs require initial scoring at this time.")
        else:
            logging.info(f"Processing {len(jobs_to_score_initially)} jobs for initial scoring...")
            successful_initial_scores = 0
            failed_initial_scores = 0

            # 4. Loop Through Jobs and Score Them
            for i, job in enumerate(jobs_to_score_initially):
                job_id = job.get('job_id')
                if not job_id:
                    logging.warning("Found job data without job_id during initial scoring. Skipping.")
                    failed_initial_scores +=1
                    continue

                logging.info(f"--- Initial Scoring Job {i+1}/{len(jobs_to_score_initially)} (ID: {job_id}) ---")
                score = get_resume_score_from_ai(default_resume_text, job)

                if score is not None:
                    if supabase_utils.update_job_score(job_id, score, resume_score_stage="initial"):
                        successful_initial_scores += 1
                    else:
                        failed_initial_scores += 1
                else:
                    failed_initial_scores += 1

                if i < len(jobs_to_score_initially) - 1:
                    logging.debug(f"Waiting {config.GEMINI_REQUEST_DELAY_SECONDS} seconds before next API call...")
                    time.sleep(config.GEMINI_REQUEST_DELAY_SECONDS)
            
            initial_score_end_time = time.time()
            logging.info("--- Initial Scoring Phase Finished ---")
            logging.info(f"Successfully initially scored: {successful_initial_scores}")
            logging.info(f"Failed/Skipped initial scores: {failed_initial_scores}")
            logging.info(f"Total initial scoring time: {initial_score_end_time - initial_score_start_time:.2f} seconds")

    # # --- Phase 2: Re-scoring with Custom Resumes ---
    rescore_jobs_with_custom_resume() 

    overall_end_time = time.time()
    logging.info("--- Job Scoring Script Finished (All Phases) ---")
    logging.info(f"Total script execution time: {overall_end_time - overall_start_time:.2f} seconds")


if __name__ == "__main__":
    if not config.GEMINI_FIRST_API_KEY:
        logging.error("GEMINI_FIRST_API_KEY environment variable not set.")
    elif not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        logging.error("Supabase URL or Key environment variable not set.")
    elif not config.LINKEDIN_EMAIL:
        logging.error("LINKEDIN_EMAIL not set in config.py")
    else:
        main()