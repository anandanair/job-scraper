from google import genai
import time
import json
import logging
from typing import List, Optional, Dict, Any

import config
import supabase_utils

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Initialize Gemini Client ---
client = genai.Client(api_key=config.GEMINI_API_KEY)

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


# --- Main Execution ---

def main():
    """Main function to score jobs based on the target resume."""
    logging.info("--- Starting Job Scoring Script ---")
    start_time = time.time()

    # 1. Fetch Resume Data
    resume_data = supabase_utils.get_resume_by_email(config.LINKEDIN_EMAIL)
    if not resume_data:
        logging.error(f"Could not retrieve resume for {config.LINKEDIN_EMAIL}. Exiting.")
        return

    # 2. Format Resume to Text
    resume_text = format_resume_to_text(resume_data)
    logging.info("Resume data formatted to text.")
    # logging.debug(f"Formatted Resume Text:\n{resume_text[:500]}...") # Optional: Log snippet

    # 3. Fetch Jobs to Score
    jobs_to_score = supabase_utils.get_jobs_to_score(config.JOBS_TO_SCORE_PER_RUN)
    if not jobs_to_score:
        logging.info("No jobs require scoring at this time.")
        return

    logging.info(f"Processing {len(jobs_to_score)} jobs for scoring...")
    successful_scores = 0
    failed_scores = 0

    # 4. Loop Through Jobs and Score
    for i, job in enumerate(jobs_to_score):
        job_id = job.get('job_id')
        if not job_id:
            logging.warning("Found job data without job_id. Skipping.")
            continue

        logging.info(f"--- Scoring Job {i+1}/{len(jobs_to_score)} (ID: {job_id}) ---")

        # Get score from AI
        score = get_resume_score_from_ai(resume_text, job)

        if score is not None:
            # Update score in Supabase
            if supabase_utils.update_job_score(job_id, score):
                successful_scores += 1
            else:
                failed_scores += 1 # Failed to update DB
        else:
            failed_scores += 1 # Failed to get score from AI

        # Implement delay to respect API rate limits
        if i < len(jobs_to_score) - 1: # Don't sleep after the last job
            logging.debug(f"Waiting {config.GEMINI_REQUEST_DELAY_SECONDS} seconds before next API call...")
            time.sleep(config.GEMINI_REQUEST_DELAY_SECONDS)

    end_time = time.time()
    logging.info("--- Job Scoring Script Finished ---")
    logging.info(f"Successfully scored: {successful_scores}")
    logging.info(f"Failed/Skipped scores: {failed_scores}")
    logging.info(f"Total time: {end_time - start_time:.2f} seconds")


if __name__ == "__main__":
    if not config.GEMINI_API_KEY:
        logging.error("GOOGLE_API_KEY environment variable not set.")
    elif not config.SUPABASE_URL or not config.SUPABASE_KEY:
        logging.error("Supabase URL or Key environment variable not set.")
    elif not config.LINKEDIN_EMAIL:
        logging.error("LINKEDIN_EMAIL not set in config.py")
    else:
        main()