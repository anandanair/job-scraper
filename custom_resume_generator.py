import logging
import io # Import io
import supabase_utils
import config # Assuming config holds necessary configurations like a default email
from pydantic import BaseModel, Field, ValidationError # Import pydantic
from typing import List, Optional, Dict, Any # Import typing helpers
import json # Import json for parsing LLM output
import pdf_generator 
import re
import asyncio 
from google import genai
from google.genai import types
from models import (
    Education, Experience, Project, Certification, Links, Resume,
    SummaryOutput, SkillsOutput, ExperienceListOutput, SingleExperienceOutput,
    ProjectListOutput, SingleProjectOutput, ValidationResponse
)

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Initialize Gemini Client ---
client = genai.Client(api_key=config.GEMINI_SECOND_API_KEY)

# --- LLM Personalization Function ---
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

    # Optional: validate it's parsable
    try:
        parsed = json.loads(json_candidate)
        return json.dumps(parsed, indent=2)  # return clean, pretty version
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to extract valid JSON: {e}\nRaw candidate:\n{json_candidate}")


async def personalize_section_with_llm(
    section_name: str,
    section_content: Any,
    full_resume: Resume,
    job_details: Dict[str, Any]
    ) -> Any:
    """
    Uses Gemini Flash 2.0 to personalize a specific section of the resume for the given job.
    """
    if not section_content:
        logging.warning(f"Skipping personalization for empty section: {section_name}")
        return section_content # Return original if empty

    output_model_map = {
        "summary": (SummaryOutput, "summary"),
        "skills": (SkillsOutput, "skills"),
        "experience": (SingleExperienceOutput, "experience"),
        "projects": (SingleProjectOutput, "project"),
    }

    if section_name not in output_model_map:
        logging.error(f"Unsupported section_name for LLM personalization: {section_name}")
        return section_content # Fallback for unsupported sections

    OutputModel, output_key = output_model_map[section_name]

    # Prepare full resume context string (excluding the section being personalized)
    resume_context_dict = full_resume.model_dump(exclude={section_name})
    # Limit context size if necessary, especially for large fields like experience descriptions
    # For simplicity here, we convert the whole dict (minus the current section) to string
    resume_context = json.dumps(resume_context_dict, indent=2)

    # Convert section_content to JSON serializable format if it's a list of models
    if isinstance(section_content, list) and section_content and hasattr(section_content[0], 'model_dump'):
        serializable_section_content = [item.model_dump() for item in section_content]
    else:
        serializable_section_content = section_content # Assume it's already serializable (like str or list[str])

    prompts = []

    # Construct the prompt based on the section
    prompt_intro = f"""
    **Task:** Enhance the specified resume section for the target job application.

    **Target Job**
    - Title: {job_details['job_title']}
    - Company: {job_details['company']}
    - Seniority Level: {job_details['level']}
    - Job Description: {job_details['description']}

    ---

    **Full Resume Context (excluding the section being edited):**
    {resume_context}

    **Resume Section to Enhance:** {section_name}
    """

    system_prompt = f"""
    You are an expert resume writer and a precise JSON generation assistant.
    Your primary function is to enhance specified sections of a resume to better align with a target job description, based on the provided resume context and original section content.

    **CRITICAL OUTPUT REQUIREMENTS:**
    1.  You MUST ALWAYS output a single, valid JSON object.
    2.  Your entire response MUST be *only* the JSON object.
    3.  Do NOT include any introductory text, explanations, apologies, markdown formatting (like ```json or ```), or any text outside of the JSON structure itself.

    **CORE RESUME WRITING PRINCIPLES:**
    1.  **Adhere to Instructions:** Meticulously follow all specific instructions provided in the user prompt for the given section.
    2.  **No Fabrication:** NEVER invent new information, skills, projects, job titles, or responsibilities not explicitly found in the original resume materials. Rephrasing and emphasizing existing facts is allowed; fabrication is strictly forbidden.
    3.  **Relevance:** Focus on aligning the candidate's existing experience and skills with the target job.
    4.  **Fact-Based:** All enhancements must be grounded in the provided "Full Resume Context" or "Original Content of This Section."

    You will receive the target job details, full resume context (excluding the section being edited), the specific section name to enhance, its original content, and section-specific instructions. Follow the output format example provided in the user prompt for the structure of the JSON.
    """

    specific_instructions = ""

    if(section_name == "summary"):
        specific_instructions = f"""
        **Original Content of This Section:**
        {json.dumps(serializable_section_content, indent=2)}

        ---
        **Instructions:**
        - Rewrite **only** the summary to be concise, impactful, and highly relevant to the Target Job.
        - **CRITICAL: The core professional identity and experience level (e.g., "IT Support and Cybersecurity Specialist with 4+ years") from the "Original Content of This Section" MUST be preserved.** Do NOT change the candidate's stated primary role or invent a new one like "Frontend Engineer" if it wasn't their original title. The goal is to make their *existing* role and experience sound relevant, not to misrepresent their primary job function.
        - Highlight 2-3 key qualifications or experiences from the "Full Resume Context" or "Original Content of This Section" that ALIGN with the "Job Description." These highlighted aspects should be FACTUALLY based on the provided resume materials.
        - Use strong action verbs and keywords from the "Job Description" where appropriate, but ONLY when describing actual experiences or skills present in the resume.
        - **ABSOLUTELY DO NOT INVENT new information, skills, projects, job titles, or responsibilities not explicitly found in the original resume materials.** Rephrasing and emphasizing existing facts is allowed; fabrication is not.
        - For example, if the original summary says "IT Support Specialist who developed a tool using React," do NOT change this to "Experienced Frontend Engineer." Instead, you might say "IT Support Specialist with experience developing user-facing tools using React, such as Click4IT..."
        ---
        **Expected JSON Output Structure:** {{"summary": "A dynamic and results-oriented Software Engineer with X years of experience..."}}
        """
        prompt = prompt_intro + specific_instructions

        prompts.append(prompt)

    elif(section_name == "experience"):
        for exp_item_content  in serializable_section_content:
            specific_instructions = f"""
             **Original Content of This Specific Experience Item:**
            {json.dumps(exp_item_content, indent=2)}

            ---
            **Instructions for this experience item:**
            - Enhance the 'description' field ONLY. All other fields (job_title, company, dates, etc.) MUST remain UNCHANGED within this specific experience item.
            - Integrate relevant skills from the "Full Resume Context" (especially any explicit skills list) and keywords from the "Target Job Description" naturally into the description.
            - Show HOW these skills were applied and what the IMPACT or achievement was. Quantify achievements if possible, based on the original content.
            - Example: Instead of "Used Python for scripting," try "Automated data processing tasks using Python scripts, reducing manual effort by 20%."
            - Do NOT invent skills or experiences. Stick to the candidate's actual background as reflected in the provided materials.
            ---
            **Expected JSON Output Structure:** {{"experience": {{"job_title": "Original Job Title", "company": "Original Company", "dates": "Original Dates", "description": "Enhanced description...", "location": "Original Location (if present)"}}}}
            """ 
            prompt = prompt_intro + specific_instructions
            prompts.append(prompt)

    elif(section_name == "projects"):
        for project_item_content  in serializable_section_content:
            specific_instructions = f"""
            **Original Content of This Specific Project Item:**
            {json.dumps(project_item_content, indent=2)}

            ---
            **Instructions for this project item:**
            - Enhance the 'description' field ONLY. All other fields (name, technologies, link, etc.) MUST remain UNCHANGED within this specific project item.
            - Integrate relevant skills from the "Full Resume Context" and keywords from the "Target Job Description" naturally into the description.
            - Show HOW these skills were applied.
            - Example: Instead of "Project using React," try "Developed a responsive UI for [Project Purpose] using React and Redux, improving user engagement."
            - Do NOT invent skills or experiences.
            ---
            **Expected JSON Output Structure (for this single project item):** {{"project": {{"name": "Original Project Name", "technologies": ["Tech1", "Tech2"], "description": "Enhanced description...", "link": "Original Link (if present)"}}}}
            """
            prompt = prompt_intro + specific_instructions 
            prompts.append(prompt)

    elif(section_name == "skills"):
        specific_instructions = f"""
        **Original Content of This Section (Candidate's Initial Skills List):**
        {json.dumps(serializable_section_content, indent=2)}

        ---
        **Instructions for Generating the Curated Skills List:**

        **1. Identify Candidate's Actual Skills:**
        - Review the 'Full Resume Context' (which includes the candidate's summary, all experience descriptions, and all project descriptions/technologies).
        - Also, review the 'Original Content of This Section (Candidate's Initial Skills List)' provided above.
        - Compile a temporary list of all skills that are *explicitly written and mentioned* in these specific parts of the resume materials.
        - **CRITICAL RULE: DO NOT infer, assume, or invent any skills. If a skill is not literally written down in the provided resume materials (summary, experience, projects, original skills list), you MUST NOT include it in your temporary list.** For example, if the resume states "developed responsive web applications," do not assume "JavaScript" or "React" unless "JavaScript" or "React" are explicitly written elsewhere as skills or technologies used.

        **2. Select and Refine for the Target Job and Conciseness:**
        - From your temporary list of the candidate's *actual, explicitly mentioned* skills, select only those that are most relevant to the 'Target Job Description'.
        - Your final output MUST be a CONCISE list. **This list MUST contain between 5 and 15 skills.**
        - If, after strictly following all rules, you identify fewer than 5 relevant skills that meet all criteria, then list only those. Do not add skills just to meet the 5-skill minimum if they are not genuinely present and relevant.
        - Prioritize skills that are directly mentioned in the 'Target Job Description' AND are confirmed to be in the candidate's actual, explicitly written skills.
        - Avoid redundancy. If a skill is a more general version of another already included (e.g., "Cloud Computing" vs. "AWS"), prefer the more specific one if relevant and explicitly mentioned, or the one that best matches the job description.
        - This skills list is for high-level impact and scannability. Do not list every minor tool or skill if it clutters the main message or dilutes the impact of key skills.

        ---
        **Expected JSON Output Structure:** {{"skills": ["Python", "JavaScript", "React", "Node.js", "AWS (EC2, S3, Lambda)", "Docker", "Kubernetes", "Agile Methodologies", "CI/CD Pipelines", "SQL", "Git"]}}
        """
        prompt = prompt_intro + specific_instructions 
        prompts.append(prompt)

    logging.info(f"Number of prompts: {len(prompts)}")

    responses = []
    for prompt in prompts:
        logging.info(f"Sending prompt to Gemini for section: {section_name} with structured output schema.")

        # messages = [
        # {'role': 'system', 'content': 'You are an expert resume writer. Only rewrite or generate the specified resume section. Never return the full resume or any unrelated content. Output strictly in the JSON format defined by the provided schema. Do not add any explanatory text before or after the JSON object.'},
        # {'role': 'user', 'content': prompt}
        # ]

        try:
            response = client.models.generate_content(
                model=config.GEMINI_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    system_instruction=system_prompt,
                    response_mime_type='application/json',
                    response_schema=OutputModel,

                )
            )
           
            llm_output = response.text.strip()
            
            logging.info(f"Received response from Gemini for section: {section_name}")

            try:
                # Validate and parse the JSON output against the Pydantic model
                parsed_response_model = OutputModel.model_validate_json(llm_output)
                # Extract the actual content (e.g., the string for summary, list for skills)
                responses.append(parsed_response_model)
                # return getattr(parsed_response_model, output_key)
            except ValidationError as e:
                logging.error(f"Failed to validate LLM JSON output for {section_name} against schema: {e}")
                logging.error(f"LLM Raw Output was for {section_name}: {llm_output}")
                # Fallback: return original content if validation fails
                return section_content
            except json.JSONDecodeError as e: # Should be caught by ValidationError mostly, but as a safeguard
                logging.error(f"Failed to parse LLM JSON output for {section_name}: {e}")
                logging.error(f"LLM Raw Output was for {section_name}: {llm_output}")
                return section_content


        except Exception as e:
            logging.error(f"Error calling Gemini or processing response for section {section_name}: {e}")
            # Fallback: return original content if LLM call fails
            return section_content

    logging.info(f"Received {len(responses)} responses from Gemini for section: {section_name}")

    if(section_name == "summary"):
        return getattr(responses[0], output_key)
    elif(section_name == "skills"):
        return getattr(responses[0], output_key)
    elif(section_name == "experience"):
        experience_list = []
        for response in responses:
            experience_list.append(getattr(response, output_key))
        return experience_list
    elif(section_name == "projects"):
        project_list = []
        for response in responses:
            project_list.append(getattr(response, output_key))
        return project_list

async def validate_customization(
    section_name: str, 
    original_content: Any, 
    customized_content: Any, 
    full_original_resume: Resume, 
    job_details: Dict[str, Any]
    ) -> (bool, str):

    resume_context_dict = full_original_resume.model_dump(exclude={section_name})
    resume_context = json.dumps(resume_context_dict, indent=2)

    # Convert original_content to JSON serializable format if it's a list of models
    if isinstance(original_content, list) and original_content and hasattr(original_content[0], 'model_dump'):
        serializable_original_content = [item.model_dump() for item in original_content]
    else:
        serializable_original_content = original_content 

    # Convert customized_content to JSON serializable format if it's a list of models
    if isinstance(customized_content, list) and customized_content and hasattr(customized_content[0], 'model_dump'):
        serializable_customized_content = [item.model_dump() for item in customized_content]
    else:
        serializable_customized_content = customized_content 

    system_prompt=f"""
    You are a meticulous Resume Fact-Checker.
    Your primary function is to compare an "Original Resume Section" with a "Customized Resume Section" and determine if the customized version introduces any information, skills, experiences, or qualifications that are NOT supported by or cannot be reasonably inferred from the original section or the broader original resume context.

    **CRITICAL OUTPUT REQUIREMENTS:**
    1.  You MUST ALWAYS output a single, valid JSON object.
    2.  Your entire response MUST be *only* the JSON object.
    3.  Do NOT include any introductory text, explanations, apologies, markdown formatting (like ```json or ```), or any text outside of the JSON structure itself.
    4.  The JSON object MUST contain exactly two keys:
        - "is_valid": A boolean value (true if the customized section is a faithful and accurate representation of the original according to the provided criteria; false otherwise).
        - "reason": A string providing a brief explanation for your decision. If 'is_valid' is false, this reason MUST pinpoint the specific discrepancies or unsupported claims, especially if the primary job title or core professional identity was altered without direct support from the original resume. If 'is_valid' is true, the reason should be concise, such as "Customization is valid and factually consistent with the original materials."

    You will be provided with the target job details, the full original resume context, the specific original resume section, and the customized version of that section, along with detailed evaluation criteria.
    """

    user_prompt = f"""
    **Task:** Evaluate the "Customized Resume Section" against the "Original Resume Section" and "Original Full Resume Context" based on the criteria below, to determine if the customization is factually supported.

    **Target Job Details:**
    - Title: {job_details['job_title']}
    - Company: {job_details['company']}
    - Seniority Level: {job_details['level']}
    - Job Description: {job_details['description']}

    ---
    **Original Full Resume Context (excluding this specific section if it were part of a larger list being iteratively processed):**
    {resume_context}

    ---
    **Original Resume Section ("{section_name}"):**
    {json.dumps(serializable_original_content, indent=2)}

    ---
    **Customized Resume Section ("{section_name}"):**
    {json.dumps(serializable_customized_content, indent=2)}

    ---
    **Evaluation Criteria:**
    1.  **Factual Accuracy:**
        - Does the customized section add, remove, or alter core facts, numbers, dates, roles, or technologies in a way that is not *explicitly supported* by the original resume materials (original section or full context)?
        - **Crucial Check**: Has the primary job title or core professional identity from the "Original Resume Section" (e.g., "IT Support and Cybersecurity Specialist") been fundamentally changed to something else (e.g., "Frontend Engineer") in the "Customized Resume Section"? This is UNACCEPTABLE if the new title is NOT *also explicitly stated as a primary role or a clearly documented career transition goal with supporting evidence* in the "Original Full Resume Context" or "Original Resume Section." Simply possessing skills used by a different profession does not equate to holding that profession's title if the original resume states a different primary role.
        - Rephrasing, reordering bullet points, or using synonyms IS ACCEPTABLE.
        - Emphasizing aspects present in the original to match the job description IS ACCEPTABLE, *as long as it doesn't change the nature of the original statement, invent new responsibilities for an existing role, or alter the primary professional identity.*
        - Introducing entirely new skills, responsibilities, projects, or achievements NOT mentioned or clearly and directly implied in the original IS UNACCEPTABLE. "Reasonable inference" should be conservative; do not assume a new job title or significantly expanded responsibilities without explicit textual support in the original documents.

    2.  **Skill Consistency:**
        - If new technical skills or tools are mentioned in the customized section, are they verifiably present in the "Original Resume Section" OR in the broader "Original Full Resume Context"? (This is distinct from changing the primary job title). Listing a skill mentioned elsewhere in the resume is acceptable; inventing a skill is not.

    3.  **Preservation of Core Meaning and Identity:**
        - Does the customized section fundamentally change the nature, scope, or *primary professional identity* of what was originally stated? Changing "IT Support Specialist" to "Frontend Engineer" is a fundamental change of core meaning and UNACCEPTABLE if "Frontend Engineer" (or similar) is not supported as an actual primary role or clearly documented career aspiration with evidence in the original resume materials.

    ---
    **Example of an Invalid Change of Role:**
    Original Summary: "IT Support Specialist with experience in Python scripting for task automation and basic web page updates using HTML/CSS."
    Customized Summary for a Software Engineer role: "Software Engineer with Python expertise and frontend development skills."
    **Evaluation:** INVALID if "Software Engineer" was not their stated role or a documented career transition supported by other parts of the original resume. While they used Python and HTML/CSS, the *role itself* has been misrepresented. It would be ACCEPTABLE to say: "IT Support Specialist leveraging Python for automation and foundational HTML/CSS for web updates, with skills applicable to software development environments."

    Based on all the provided information and evaluation criteria, provide your JSON response.
    """

    # messages = [
    # {'role': 'system', 'content': 'You are a Resume Fact-Checker. Output ONLY a JSON object with "is_valid" (boolean) and "reason" (string).'},
    # {'role': 'user', 'content': prompt}
    # ]

    try:
        response = client.models.generate_content(
                model=config.GEMINI_MODEL_NAME,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    system_instruction=system_prompt,
                    response_mime_type='application/json',
                    response_schema=ValidationResponse,

                )
            )
       
        llm_output = response.text.strip()
        
        try:
            # Validate and parse the JSON output against the Pydantic model
            parsed_validation_response_model = ValidationResponse.model_validate_json(llm_output)
            logging.info(f"Customization validation response: {parsed_validation_response_model}")
            return parsed_validation_response_model.is_valid, parsed_validation_response_model.reason

        except ValidationError as e:
            logging.error(f"Failed to validate LLM JSON output against validation schema: {e}")
            logging.error(f"LLM Raw Output was: {llm_output}")
            return False, "Failed to validate LLM JSON output against validation schema."

        except json.JSONDecodeError as e: 
            logging.error(f"Failed to parse LLM JSON output: {e}")
            logging.error(f"LLM Raw Output was: {llm_output}")
            return False, "Failed to parse LLM JSON output."


    except Exception as e:
        logging.error(f"Error calling Gemini or processing response: {e}")
        return false, "Error calling Gemini or processing response."

# --- Main Processing Logic ---
async def process_job(job_details: Dict[str, Any], base_resume_details: Resume):
    """
    Processes a single job: personalizes resume, generates PDF, uploads, updates status.
    """
    job_id = job_details.get("job_id")
    if not job_id:
        logging.error("Job details missing job_id.")
        return

    logging.info(f"--- Starting processing for job_id: {job_id} ---")

    try:
        # 1. Personalize Resume Sections
        personalized_resume_data = base_resume_details.model_copy(deep=True) # Create a copy for this job
        any_validation_failed = False

        sections_to_personalize = {
            "summary": base_resume_details.summary,
            "experience": base_resume_details.experience,
            "projects": base_resume_details.projects,
            "skills": base_resume_details.skills,
        }

        for section_name, section_content in sections_to_personalize.items():
            if any_validation_failed: # If a previous section failed validation, skip further personalization
                logging.warning(f"Skipping further personalization for job_id {job_id} due to prior validation failure.")
                break # Exit the loop over sections

            if section_content:
                logging.info(f"Personalizing section: {section_name} for job_id: {job_id}")
                personalized_content = await personalize_section_with_llm(
                    section_name,
                    section_content,
                    base_resume_details, # Pass the original full resume for context
                    job_details # Pass the specific job details
                )

                # Validate the customization
                logging.info(f"Validating customization for section: {section_name} for job_id: {job_id}")
                is_valid, reason = await validate_customization(
                    section_name,
                    section_content,
                    personalized_content,
                    base_resume_details,
                    job_details 
                )

                if is_valid:
                    logging.info(f"Customization for section {section_name} is valid.")
                    setattr(personalized_resume_data, section_name, personalized_content)
                    # Update the copied resume data
                    sections_to_personalize[section_name] = personalized_content

                else:
                    logging.warning(f"VALIDATION FAILED for section {section_name} for job_id {job_id}. Reason: {reason}")
                    logging.warning(f"Halting resume generation for job_id {job_id}.")
                    any_validation_failed = True  
                    break;       
                    # If customization is not valid, revert to the original content
                    # setattr(personalized_resume_data, section_name, section_content)      
                
                logging.info(f"Finished personalizing section: {section_name} for job_id: {job_id}")
            else:
                 logging.info(f"Skipping empty section: {section_name} for job_id: {job_id}")

        # --- Check if any validation failed before proceeding ---
        if any_validation_failed:
            logging.info(f"--- Aborting PDF generation and further processing for job_id: {job_id} due to validation failure. ---")
            return 

        # 2. Generate PDF
        logging.info(f"Generating PDF for job_id: {job_id}")
        try:
            pdf_bytes = pdf_generator.create_resume_pdf(personalized_resume_data)
            if not pdf_bytes:
                 raise ValueError("PDF generation returned empty bytes.")
            logging.info(f"PDF generation complete for job_id: {job_id}")
        except Exception as e:
            logging.error(f"Failed to generate PDF for job_id {job_id}: {e}")
            # Skip to the next job if PDF generation fails
            return # Stop processing this job

        # 3. Upload PDF to Supabase Storage
        # Construct a unique path, e.g., using job_id
        destination_path = f"personalized_resumes/resume_{job_id}.pdf"
        logging.info(f"Uploading PDF to {destination_path} for job_id: {job_id}")
        resume_link = supabase_utils.upload_customized_resume_to_storage(pdf_bytes, destination_path)

        if not resume_link:
            logging.error(f"Failed to upload resume PDF for job_id: {job_id}")
            # Skip updating the job record if upload fails
            return # Stop processing this job

        logging.info(f"Successfully uploaded PDF for job_id: {job_id}. Link: {resume_link}")

        # 4. Add Customized Resume to Supabase
        logging.info("Adding customized resume to Supabase")
        customized_resume_id = supabase_utils.save_customized_resume(personalized_resume_data, resume_link)


        # 4. Update Job Record in Supabase
        logging.info(f"Updating job record for job_id: {job_id} with resume link.")
        # Optionally set a new status like "resume_generated" or "ready_to_apply"
        update_success = supabase_utils.update_job_with_resume_link(job_id, customized_resume_id, new_status="resume_generated")

        if update_success:
            logging.info(f"Successfully updated job record for job_id: {job_id}")
        else:
            logging.error(f"Failed to update job record for job_id: {job_id}")

        logging.info(f"--- Finished processing for job_id: {job_id} ---")

    except Exception as e:
        logging.error(f"An unexpected error occurred while processing job_id {job_id}: {e}", exc_info=True)
        # Log the error but continue to the next job

async def run_job_processing_cycle():
    """
    Fetches top jobs and processes them one by one.
    """
    logging.info("Starting new job processing cycle...")

    # 1. Retrieve Base Resume Details
    user_email = config.LINKEDIN_EMAIL
    if not user_email:
        logging.error("LINKEDIN_EMAIL not set in config. Cannot fetch base resume.")
        return

    logging.info(f"Fetching base resume for user: {user_email}")
    raw_resume_details = supabase_utils.get_resume_custom_fields_by_email(user_email)

    if not raw_resume_details:
        logging.error(f"Could not find base resume for user: {user_email}. Aborting cycle.")
        return

    # Parse raw details into Pydantic model
    try:
        # Ensure lists are handled correctly if they are null/None from DB
        for key in ['skills', 'experience', 'education', 'projects', 'certifications', 'languages']:
             if raw_resume_details.get(key) is None:
                 raw_resume_details[key] = []
        base_resume_details = Resume(**raw_resume_details)
        logging.info("Successfully parsed base resume.")
    except Exception as e:
        logging.error(f"Error parsing base resume details into Pydantic model: {e}")
        logging.error(f"Raw base resume data: {raw_resume_details}")
        return # Abort cycle if base resume is invalid

    # 2. Fetch Top Jobs to Process
    jobs_limit = 2 # Fetch top 2 jobs
    logging.info(f"Fetching top {jobs_limit} scored jobs to apply for...")
    jobs_to_process = supabase_utils.get_top_scored_jobs_for_resume_generation(limit=jobs_limit)

    if not jobs_to_process:
        logging.info("No new jobs found to process in this cycle.")
        return

    logging.info(f"Found {len(jobs_to_process)} jobs to process.")

    # 3. Process Each Job Sequentially (to avoid overwhelming Gemini/resources)
    for job_details in jobs_to_process:
        await process_job(job_details, base_resume_details) # Pass base resume

    logging.info("Finished job processing cycle.")

# --- Script Entry Point ---
if __name__ == "__main__":
    logging.info("Script started.")
    try:
        asyncio.run(run_job_processing_cycle())
        logging.info("Rresume processing completed successfully.")
    except Exception as e:
        logging.error(f"Error during task execution: {e}", exc_info=True)