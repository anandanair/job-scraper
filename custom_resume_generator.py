import logging
import io
import supabase_utils
import config
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Any, Tuple
import json
import pdf_generator 
import re
import asyncio 
from llm_client import primary_client
from models import (
    Education, Experience, Project, Certification, Links, Resume,
    RoleFocus, CurationPlan, TailoredResumeContent,
    SummaryOutput, SkillsOutput, ExperienceListOutput, SingleExperienceOutput,
    ProjectListOutput, SingleProjectOutput, ValidationResponse
)
import time
import os

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---
def extract_json_from_text(text: str) -> str:
    """
    Extracts and returns the first valid JSON string found in the text.
    Strips markdown formatting (e.g., ```json ... ```), extra whitespace, etc.
    """
    # First, try to find JSON inside markdown code blocks
    fenced_match = re.search(r"```(?:json)?\s*(\[\s*{.*?}\s*\]|\[.*?\]|\{.*?\})\s*```", text, re.DOTALL)
    if fenced_match:
        json_candidate = fenced_match.group(1).strip()
    else:
        # If no fenced block, try to find the first raw JSON object or array
        loose_match = re.search(r"(\[\s*{.*?}\s*\]|\[.*?\]|\{.*?\})", text, re.DOTALL)
        if loose_match:
            json_candidate = loose_match.group(1).strip()
        else:
            # Fallback to the entire string if nothing found
            json_candidate = text.strip()

    try:
        parsed = json.loads(json_candidate)
        return json.dumps(parsed, indent=2)  # return clean, pretty version
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to extract valid JSON: {e}\nRaw candidate:\n{json_candidate}")


# --- Stage 1: The Curator ---
async def curate_resume_with_llm(
    job_details: Dict[str, Any],
    base_resume: Resume
) -> Optional[CurationPlan]:
    """
    Stage 1: Evaluates the Target Job Description against the Master Base Resume.
    Decides the positioning strategy, selects the top 1-3 relevant projects (dropping
    irrelevant ones), curates 8-15 matching skills from the base resume, and provides
    role-by-role bullet guidance.
    """
    logging.info(f"--- Stage 1: Curator started using LLM ({primary_client.model}) ---")

    # Serialize base resume to structured context
    base_resume_dict = base_resume.model_dump()
    resume_context = json.dumps(base_resume_dict, indent=2)

    system_prompt = """
You are an expert executive resume strategist and technical recruiter.
Your task is to analyze a candidate's Master Resume against a Target Job Description and formulate a strategic Curation Plan.

The Master Resume is comprehensive and contains details across multiple domains, projects, and experiences.
Your goal is to select and prioritize what belongs on a focused, targeted 2-page resume to maximize the candidate's chances of landing an interview, WITHOUT EVER fabricating or lying.

CORE RULES FOR CURATION:
1. NO FABRICATION: Every skill, achievement, or project MUST be grounded in the candidate's actual history. Never invent new roles, tools, or projects.
2. PROJECT SELECTION (CRITICAL):
   - Review ALL projects in the Master Resume.
   - Select between 1 and 3 projects that best demonstrate qualifications for this Target Job.
   - If a project is irrelevant or does not add value for this role (e.g., event coordination for a software engineering role), DO NOT include it.
   - If the candidate has 3 or fewer total projects, select only the ones that add value (or all if all are relevant).
   - The names in 'selected_project_names' MUST EXACTLY match the 'name' field of projects present in the Master Resume.
3. SKILLS CURATION:
   - Select 8 to 15 skills that directly match the Target Job requirements.
   - CRITICAL: Every single selected skill MUST already be explicitly present in the Master Resume (in the skills list, project technologies, or experience descriptions). Do NOT add skills the candidate does not have.
4. EXPERIENCE GUIDANCE:
   - All positions in the candidate's work history must be kept (to avoid unexplained employment gaps).
   - For each job, identify:
     a) 'key_achievements_to_highlight': specific tasks, technologies, or achievements from the original description to emphasize.
     b) 'points_to_condense_or_omit': routine, administrative, or irrelevant tasks to downplay or omit completely.
5. STRATEGY SUMMARY:
   - Provide a 1-2 sentence positioning summary explaining how the candidate's actual background directly aligns with this target job.
"""

    prompt = f"""
**Target Job Application**
- Title: {job_details.get('job_title', 'NA')}
- Company: {job_details.get('company', 'NA')}
- Seniority Level: {job_details.get('level', 'NA')}
- Job Description:
{job_details.get('description', 'NA')}

---

**Candidate's Master Base Resume:**
{resume_context}

---

**Task:** Formulate the CurationPlan JSON identifying:
1. 'strategy_summary': 1-2 sentences on how to position the candidate for this role.
2. 'selected_project_names': List of 1 to 3 exact project names from the candidate's projects to include. Omit irrelevant ones.
3. 'selected_skills': Curated 8 to 15 skills strictly present in the base resume that match this job.
4. 'experience_guidance': For each employer/role, list achievements to highlight and duties to condense/omit.
"""

    try:
        logging.info(f"Sending prompt to LLM ({primary_client.model}) for Stage 1: Curator...")
        llm_output = primary_client.generate_content(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            response_format=CurationPlan,
        )
        logging.info("Received response from LLM for Stage 1: Curator.")

        try:
            curation_plan = CurationPlan.model_validate_json(llm_output)
        except ValidationError:
            clean_json = extract_json_from_text(llm_output)
            curation_plan = CurationPlan.model_validate_json(clean_json)

        logging.info(f"Stage 1 Curation Plan generated: Strategy: '{curation_plan.strategy_summary[:80]}...' | Selected Projects: {curation_plan.selected_project_names} | Selected Skills Count: {len(curation_plan.selected_skills)}")
        return curation_plan

    except Exception as e:
        logging.error(f"Error in Stage 1 (Curator): {e}", exc_info=True)
        return None


# --- Stage 2: The Writer ---
async def write_tailored_resume_with_llm(
    job_details: Dict[str, Any],
    base_resume: Resume,
    curation_plan: CurationPlan
) -> Optional[TailoredResumeContent]:
    """
    Stage 2: Enhances and polishes the selected resume sections into high-impact,
    ATS-optimized bullet points based on the Curation Plan.
    """
    logging.info(f"--- Stage 2: Writer started using LLM ({primary_client.model}) ---")

    # Filter base projects to only those selected in Stage 1
    selected_names = set(p.strip().lower() for p in curation_plan.selected_project_names)
    filtered_base_projects = [
        p.model_dump() for p in base_resume.projects
        if p.name.strip().lower() in selected_names
    ]
    # Fallback if no projects matched by exact name
    if not filtered_base_projects and base_resume.projects:
        logging.warning("No projects matched curation plan names; defaulting to first 2 base projects.")
        filtered_base_projects = [p.model_dump() for p in base_resume.projects[:2]]

    system_prompt = """
You are an elite executive resume writer and precise JSON generator.
Your task is to craft tailored, compelling resume content for a target job application based on the provided Curation Plan and candidate's Master Resume.

WRITING RULES:
1. SUMMARY:
   - Write a compelling 2-3 sentence elevator pitch tailored to the target job and positioning strategy.
   - CRITICAL: Preserve the candidate's core professional identity and actual years of experience. Do NOT falsely invent titles the candidate never held.
2. SKILLS:
   - Provide the curated list of 8 to 15 skills strictly selected from the candidate's actual skills.
3. EXPERIENCE:
   - Include ALL work experience entries from the Master Resume (all employers, job titles, locations, and dates MUST remain EXACTLY identical).
   - Rewrite each role's 'description' into 3 to 4 punchy, high-impact bullet points separated by newlines (e.g., "- Spearheaded...\n- Optimized...\n- Delivered...").
   - Emphasize the 'key_achievements_to_highlight' from the Curation Plan.
   - Omit the 'points_to_condense_or_omit'.
   - Quantify impact wherever supported by the candidate's original history.
   - NEVER invent new achievements, companies, or tools.
4. PROJECTS:
   - Include ONLY the selected projects provided in the prompt.
   - Preserve the 'name' and 'technologies' fields from the original project.
   - Rewrite each project's 'description' into 2 to 3 concise, impactful bullet points separated by newlines (e.g., "- Engineered...\n- Applied...").
"""

    prompt = f"""
**Target Job**
- Title: {job_details.get('job_title', 'NA')}
- Company: {job_details.get('company', 'NA')}
- Seniority Level: {job_details.get('level', 'NA')}
- Job Description:
{job_details.get('description', 'NA')}

---

**Curation Plan (Strategy & Selection)**
- Strategy: {curation_plan.strategy_summary}
- Selected Skills: {json.dumps(curation_plan.selected_skills)}
- Experience Guidance: {json.dumps([g.model_dump() for g in curation_plan.experience_guidance], indent=2)}

---

**Original Experience Entries (Keep job_title, company, location, dates UNCHANGED; enhance description only):**
{json.dumps([exp.model_dump() for exp in base_resume.experience], indent=2)}

---

**Selected Projects to Include (Keep name & technologies UNCHANGED; enhance description only):**
{json.dumps(filtered_base_projects, indent=2)}

---

**Candidate's Original Summary:**
{base_resume.summary}
"""

    try:
        logging.info(f"Sending prompt to LLM ({primary_client.model}) for Stage 2: Writer...")
        llm_output = primary_client.generate_content(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            response_format=TailoredResumeContent,
        )
        logging.info("Received response from LLM for Stage 2: Writer.")

        try:
            tailored_content = TailoredResumeContent.model_validate_json(llm_output)
        except ValidationError:
            clean_json = extract_json_from_text(llm_output)
            tailored_content = TailoredResumeContent.model_validate_json(clean_json)

        return tailored_content

    except Exception as e:
        logging.error(f"Error in Stage 2 (Writer): {e}", exc_info=True)
        return None


# --- Validation Logic ---
async def validate_customization(
    base_resume: Resume,
    tailored_content: TailoredResumeContent
) -> Tuple[bool, str]:
    """
    Validates that the customized resume adheres to strict truthfulness rules:
    - Experience history is fully preserved (all jobs, companies, dates match base resume).
    - Projects are an exact subset of the master resume (no fabricated projects, max 3 projects).
    - Skills list is valid and focused (between 5 and 20 skills).
    - Summary is non-empty and well-formed.
    """
    if not tailored_content:
        return False, "Tailored content is null or empty."

    # 1. Validate Summary
    if not tailored_content.summary or len(tailored_content.summary.strip()) < 20:
        return False, "Summary is empty or too short."

    # 2. Validate Skills
    if not tailored_content.skills or len(tailored_content.skills) < 5:
        return False, f"Skills list has fewer than 5 items ({len(tailored_content.skills)})."
    if len(tailored_content.skills) > 20:
        return False, f"Skills list has too many items ({len(tailored_content.skills)}). Max allowed is 20."

    # 3. Validate Experience
    if len(tailored_content.experience) != len(base_resume.experience):
        return False, f"Experience count changed from {len(base_resume.experience)} to {len(tailored_content.experience)}."

    for orig, cust in zip(base_resume.experience, tailored_content.experience):
        o_dict = orig.model_dump()
        c_dict = cust.model_dump()

        # Core fields must not be altered (no fake companies, titles, or dates)
        for field in ['job_title', 'company', 'location']:
            o_val = str(o_dict.get(field, '')).strip().lower()
            c_val = str(c_dict.get(field, '')).strip().lower()
            if o_val != c_val:
                return False, f"Core experience field '{field}' was changed from '{o_val}' to '{c_val}'."

        if not cust.description or len(cust.description.strip()) < 10:
            return False, f"Experience description for '{cust.company}' is empty or invalid."

    # 4. Validate Projects
    if base_resume.projects:
        orig_names = {p.name.strip().lower() for p in base_resume.projects if p.name}
        cust_projects = tailored_content.projects

        if len(cust_projects) > 3:
            return False, f"Too many projects selected ({len(cust_projects)}). Max allowed is 3 to respect the 2-page limit."

        for proj in cust_projects:
            p_name = proj.name.strip().lower()
            if p_name not in orig_names:
                return False, f"Fabricated project '{proj.name}' was not found in the master resume."
            if not proj.description or len(proj.description.strip()) < 10:
                return False, f"Project description for '{proj.name}' is empty or invalid."

    return True, "All validation checks passed successfully."


# --- Main Processing Logic ---
async def process_job(job_details: Dict[str, Any], base_resume_details: Resume):
    """
    Processes a single job using the Two-Stage (Curator + Writer) pipeline:
    1. Stage 1 (Curator): Determines strategy, selects top 1-3 projects, curates skills, sets bullet guidance.
    2. Stage 2 (Writer): Rewrites summary, experience bullets, and selected project bullets.
    3. Validates the customized content.
    4. Generates PDF, uploads to Supabase Storage, and updates database records.
    """
    job_id = job_details.get("job_id")
    if not job_id:
        logging.error("Job details missing job_id.")
        return

    logging.info(f"--- Starting processing for job_id: {job_id} ---")

    try:
        # Initialize customized resume with base resume details
        personalized_resume_data = base_resume_details.model_copy(deep=True)
        sleep_time = config.LLM_REQUEST_DELAY_SECONDS

        # ---------------------------------------------------------------------
        # Stage 1: The Curator
        # ---------------------------------------------------------------------
        curation_plan = await curate_resume_with_llm(job_details, base_resume_details)
        if not curation_plan:
            logging.warning(f"Stage 1 Curator failed for job_id {job_id}. Falling back to original base resume.")
            # PDF generation proceeds with base resume
        else:
            # Respect configured request delay between LLM calls
            if sleep_time > 0:
                logging.info(f"Waiting for {sleep_time} seconds before Stage 2 request...")
                time.sleep(sleep_time)

            # -----------------------------------------------------------------
            # Stage 2: The Writer
            # -----------------------------------------------------------------
            tailored_content = await write_tailored_resume_with_llm(
                job_details, base_resume_details, curation_plan
            )

            if not tailored_content:
                logging.warning(f"Stage 2 Writer failed for job_id {job_id}. Falling back to original base resume.")
            else:
                # -------------------------------------------------------------
                # Validation Step
                # -------------------------------------------------------------
                logging.info(f"Validating customized resume content for job_id: {job_id}")
                is_valid, reason = await validate_customization(base_resume_details, tailored_content)

                if is_valid:
                    logging.info(f"Customization validation passed: {reason}")
                    personalized_resume_data.summary = tailored_content.summary
                    personalized_resume_data.skills = tailored_content.skills
                    personalized_resume_data.experience = tailored_content.experience
                    personalized_resume_data.projects = tailored_content.projects
                else:
                    logging.warning(f"VALIDATION FAILED for job_id {job_id}. Reason: {reason}")
                    logging.warning(f"Falling back to original base resume content for job_id {job_id}.")

        # ---------------------------------------------------------------------
        # Generate PDF
        # ---------------------------------------------------------------------
        logging.info(f"Generating PDF for job_id: {job_id}")
        try:
            pdf_bytes = pdf_generator.create_resume_pdf(personalized_resume_data)
            if not pdf_bytes:
                raise ValueError("PDF generation returned empty bytes.")
            logging.info(f"PDF generation complete for job_id: {job_id}")
        except Exception as e:
            logging.error(f"Failed to generate PDF for job_id {job_id}: {e}")
            return

        # ---------------------------------------------------------------------
        # Upload PDF to Supabase Storage
        # ---------------------------------------------------------------------
        destination_path = f"resume_{job_id}.pdf"
        logging.info(f"Uploading PDF to {destination_path} for job_id: {job_id}")
        resume_path = supabase_utils.upload_customized_resume_to_storage(pdf_bytes, destination_path)

        if not resume_path:
            logging.error(f"Failed to upload resume PDF for job_id: {job_id}")
            return

        logging.info(f"Successfully uploaded PDF for job_id: {job_id}. Path: {resume_path}")

        # ---------------------------------------------------------------------
        # Save Customized Resume to Supabase Table
        # ---------------------------------------------------------------------
        logging.info("Adding customized resume to Supabase")
        customized_resume_id = supabase_utils.save_customized_resume(personalized_resume_data, resume_path)

        # ---------------------------------------------------------------------
        # Update Job Record in Supabase
        # ---------------------------------------------------------------------
        logging.info(f"Updating job record for job_id: {job_id} with resume path.")
        update_success = supabase_utils.update_job_with_resume_link(
            job_id, customized_resume_id, new_status="resume_generated"
        )

        if update_success:
            logging.info(f"Successfully updated job record for job_id: {job_id}")
        else:
            logging.error(f"Failed to update job record for job_id: {job_id}")

        logging.info(f"--- Finished processing for job_id: {job_id} ---")

    except Exception as e:
        logging.error(f"An unexpected error occurred while processing job_id {job_id}: {e}", exc_info=True)


async def run_job_processing_cycle():
    """
    Fetches top jobs and processes them one by one.
    """
    logging.info("Starting new job processing cycle...")

    # 1. Retrieve Base Resume Details from Supabase (with local file fallback)
    resume_path = getattr(config, 'BASE_RESUME_PATH', 'resume.json')
    
    # Try fetching resume from Supabase first
    raw_resume_details = supabase_utils.get_base_resume()
    
    if raw_resume_details:
        logging.info("Successfully loaded base resume from Supabase database.")
    elif os.path.exists(resume_path):
        logging.info(f"Supabase fetch failed. Falling back to local file: {resume_path}")
        try:
            with open(resume_path, 'r', encoding='utf-8') as f:
                raw_resume_details = json.load(f)
        except Exception as e:
            logging.error(f"Failed to read or decode {resume_path}: {e}")
            return
    else:
        logging.error(f"Base resume not found in Supabase or at '{resume_path}'. Please run the 'Parse Resume' workflow first.")
        return

    if not raw_resume_details:
        logging.error("Could not load valid base resume details. Aborting cycle.")
        return

    # Parse raw details into Pydantic model
    try:
        for key in ['skills', 'experience', 'education', 'projects', 'certifications', 'languages']:
            if raw_resume_details.get(key) is None:
                raw_resume_details[key] = []
        base_resume_details = Resume(**raw_resume_details)
        logging.info("Successfully parsed base resume.")
    except Exception as e:
        logging.error(f"Error parsing base resume details into Pydantic model: {e}")
        logging.error(f"Raw base resume data: {raw_resume_details}")
        return

    # 2. Fetch Top Jobs to Process
    jobs_limit = config.JOBS_TO_CUSTOMIZE_PER_RUN
    logging.info(f"Fetching top {jobs_limit} scored jobs to apply for...")
    jobs_to_process = supabase_utils.get_top_scored_jobs_for_resume_generation(limit=jobs_limit)

    if not jobs_to_process:
        logging.info("No new jobs found to process in this cycle.")
        return

    logging.info(f"Found {len(jobs_to_process)} jobs to process.")

    # 3. Process Each Job Sequentially
    for job_details in jobs_to_process:
        await process_job(job_details, base_resume_details)

    logging.info("Finished job processing cycle.")


# --- Script Entry Point ---
if __name__ == "__main__":
    logging.info("Script started.")
    try:
        asyncio.run(run_job_processing_cycle())
        logging.info("Resume processing completed successfully.")
    except Exception as e:
        logging.error(f"Error during task execution: {e}", exc_info=True)
