import logging
import time
import config  
import supabase_utils
import asyncio
import json
from playwright.async_api import Page, async_playwright, TimeoutError as PlaywrightTimeoutError
import re

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler() # Also log to console
    ]
)

async def is_logged_in(page: Page) -> bool:
    """Checks if the user appears to be logged into LinkedIn."""
    logging.info("Checking LinkedIn login status...")
    try:
        profile_avatar_selector = "img.global-nav__me-photo" 
        profile_locator = page.locator(profile_avatar_selector)
        
        # Use locator's wait_for method
        await profile_locator.wait_for(state='visible', timeout=10000) 
        logging.info("Login check successful (found profile avatar).")
        return True

    except PlaywrightTimeoutError:
        logging.warning("Login check failed (profile avatar not found). User might be logged out.")
        login_button_selector = "a[href*='linkedin.com/login']" 
        signin_button_selector = "button[data-id='sign-in-form__submit-btn']"

        login_visible = await page.locator(login_button_selector).is_visible() 
        signin_visible = await page.locator(signin_button_selector).is_visible() 

        if login_visible or signin_visible:
             logging.warning("Found login/signin elements, confirming user is likely logged out.")
             return False
        logging.warning("Could not definitively determine login status via selectors, assuming logged out for safety.")
        return False

    except Exception as e:
        logging.error(f"Error during login check: {e}", exc_info=True)
        return False # Assume not logged in if error occurs

async def perform_login(page: Page) -> bool:
    """Attempts to log into LinkedIn using credentials from config."""
    logging.info("Attempting scripted LinkedIn login...")
    try:
        await page.goto("https://www.linkedin.com/login", wait_until='domcontentloaded', timeout=30000)
        await asyncio.sleep(3)

        username_selector = "#username"
        password_selector = "#password"
        submit_button_selector = "button[type='submit']" 

        logging.info(f"Filling username: {config.LINKEDIN_EMAIL}")
        await page.fill(username_selector, config.LINKEDIN_EMAIL) 
        await asyncio.sleep(0.5) 

        logging.info("Filling password...")
        await page.fill(password_selector, config.LINKEDIN_PASSWORD) 
        await asyncio.sleep(0.5)

        logging.info("Clicking sign in button...")
        await page.click(submit_button_selector)

        # Wait for navigation/confirmation - VERY IMPORTANT
        page.wait_for_url("**/feed/**", timeout=25000) 
        logging.info("Login successful (redirected to feed).")
        return True

    except PlaywrightTimeoutError:
        logging.error("Timeout during login process. Possible reasons: CAPTCHA, incorrect credentials, slow network, changed selectors.")
        error_message_selector = "div[error-for='username'], div[error-for='password']"
        captcha_selector = "#captcha-internal" 
        
        # Check visibility asynchronously
        error_visible = await page.locator(error_message_selector).first.is_visible(timeout=1000) 
        captcha_visible = await page.locator(captcha_selector).is_visible(timeout=1000) 

        if error_visible:
            logging.error("Login failed: Incorrect username or password detected.")
        elif captcha_visible:
            logging.error("Login failed: CAPTCHA challenge detected. Manual intervention required.")
        else:
            logging.error("Login failed: Unknown reason (Timeout waiting for feed redirection).")
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred during login: {e}", exc_info=True)
        return False

async def find_label_for_element(page: Page, element_locator) -> str:
    """
    Attempts to find the text label associated with a given form element locator.

    Args:
        page: The Playwright Page object.
        element_locator: The Playwright Locator for the input/textarea/select element.

    Returns:
        The associated label text as a string, or an empty string if not found.
    """
    element_id = await element_locator.get_attribute('id')
    element_aria_label = await element_locator.get_attribute('aria-label')
    element_aria_labelledby = await element_locator.get_attribute('aria-labelledby')

    # 1. Explicit aria-label
    if element_aria_label:
        # logging.debug(f"Found label via aria-label: {element_aria_label}")
        return element_aria_label.strip()

    # 2. Explicit aria-labelledby
    if element_aria_labelledby:
        try:
            label_element = page.locator(f"#{element_aria_labelledby}")
            if await label_element.is_visible():
                label_text = await label_element.text_content()
                # logging.debug(f"Found label via aria-labelledby: {label_text}")
                return label_text.strip() if label_text else ""
        except Exception as e:
            logging.warning(f"Error finding label via aria-labelledby '{element_aria_labelledby}': {e}")


    # 3. Standard <label for="element_id">
    if element_id:
        try:
            # Escape special characters in ID for CSS selector if necessary
            # Simple escaping for common cases:
            escaped_id = element_id.replace(':', '\\:').replace('.', '\\.')
            label_locator = page.locator(f"label[for='{escaped_id}']")
            if await label_locator.count() > 0:
                 # Check visibility in case of multiple matches or hidden labels
                 visible_labels = label_locator.filter(has_not_text="").filter(has=page.locator(':visible')) # Ensure it's visible and has text
                 if await visible_labels.count() > 0:
                    label_text = await visible_labels.first.text_content()
                    # logging.debug(f"Found label via 'for' attribute: {label_text}")
                    return label_text.strip() if label_text else ""
        except Exception as e:
             logging.warning(f"Error finding label via 'for={element_id}': {e}")


    # 4. Input nested inside a label: <label>Label Text <input ...></label>
    try:
        # Go up to the parent label element
        parent_label_locator = element_locator.locator("xpath=ancestor::label")
        if await parent_label_locator.count() > 0:
            # Get text content, potentially excluding the input's own value if needed (complex)
            # A simple text_content() might include unwanted text from nested elements.
            # Using evaluate to get only the label's direct text nodes might be more robust but complex.
            # For simplicity, try text_content first.
            label_text = await parent_label_locator.first.text_content()
            # Attempt basic cleanup - this is imperfect
            input_value = await element_locator.input_value() if await element_locator.evaluate("el => typeof el.value !== 'undefined'") else ""
            if label_text and input_value:
                 label_text = label_text.replace(input_value, '') # Try removing input value if present
            # logging.debug(f"Found label via parent <label>: {label_text}")
            return label_text.strip() if label_text else ""
    except Exception as e:
        logging.warning(f"Error finding label via parent <label>: {e}")

    # 5. Look for preceding/nearby elements that look like labels (less reliable)
    # This is more complex and fragile, might involve XPath like `preceding-sibling::label`
    # or searching for elements with specific classes like 'label', 'title' near the input.
    # Skipping this for now to keep it manageable.

    # logging.debug(f"Label not found for element (ID: {element_id})")
    return "" # Return empty string if no label found

async def get_llm_answer_for_field(question_label: str, element_tag: str, element_type: str) -> dict | None:
    """
    Placeholder function to simulate getting an answer from an LLM.
    Replace this with your actual Ollama API call logic.

    Args:
        question_label: The label text associated with the form element.
        element_tag: The HTML tag of the element (e.g., 'input', 'select').
        element_type: The type attribute of the element (e.g., 'text', 'radio').

    Returns:
        A dictionary with the answer details if found, e.g.:
        {'answer': 'ValueToFill', 'type': 'text'}
        {'answer': 'Yes', 'type': 'radio', 'option_text': 'Yes'}
        {'answer': 'Option Label', 'type': 'select', 'option_text': 'Option Label'}
        Returns None if no match is found or an error occurs.
    """
    logging.debug(f"[LLM Placeholder] Received question: '{question_label}' for element {element_tag}[type={element_type}]")

    # --- Placeholder Logic ---
    # In a real implementation:
    logging.info(f"question_label: {question_label}")
    logging.info(f"element_tag: {element_tag}")
    logging.info(f"element_type: {element_type}")
    # 1. Load or access config.CUSTOM_ANSWERS4
    # 2. Format a prompt for the LLM including the question_label and CUSTOM_ANSWERS context.
    # 3. Make an HTTP POST request to your Ollama endpoint (e.g., http://localhost:11434/api/generate)
    #    with the model name and the prompt.
    # 4. Parse the LLM's JSON response.
    # 5. Try to extract the best answer value and potentially the required option_text/type.
    # 6. Return the structured dictionary or None.

    # Example: Simulate finding an answer for 'salary expectations'
    if "salary expectations" in question_label.lower():
        logging.info("[LLM Placeholder] Simulated match for 'salary expectations'")
        # Simulate LLM determining it's a text input and finding the answer
        return {"answer": "110000", "type": "text"} # Example structure

    # Example: Simulate finding answer for 'singapore citizen' radio
    if "singapore citizen" in question_label.lower():
         logging.info("[LLM Placeholder] Simulated match for 'singapore citizen'")
         # Simulate LLM determining it's radio and needs the 'Yes' option text
         return {"answer": "Yes", "type": "radio", "option_text": "Yes"}

    logging.debug(f"[LLM Placeholder] No simulated match found for '{question_label}'")
    return None # Simulate no match found

async def apply_to_job(job_details: dict, resume_path: str) -> tuple[bool, str]:
    """
    Uses Playwright to navigate to the job posting and attempt an 'Easy Apply'.

    Args:
        job_details: Dictionary containing job information (job_id, job_title).
        resume_path: The absolute path to the resume file for uploading.

    Returns:
        A tuple: (success: bool, status_message: str)
        Possible status messages: 'applied', 'external', 'failed', 'no_apply_button'
    """

    job_id = job_details.get('job_id')
    job_title = job_details.get('job_title')
    linkedin_job_url = f"https://www.linkedin.com/jobs/view/{job_id}/"

    logging.info(f"Attempting to apply for job ID: {job_id}, Title: {job_title}")
    logging.info(f"Job URL: {linkedin_job_url}")
    logging.info(f"Using resume: {resume_path}")

    # Validate resume path
    import os
    if not os.path.exists(resume_path):
        logging.error(f"Resume file not found at: {resume_path}")
        return False, "failed_resume_not_found"

    context = None # Initialize context variable
    page = None # Initialize page variable

    async with async_playwright() as p:
        try:
            user_data_dir = config.PERSISTENT_PROFILE_PATH
            context  = await p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=False,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--password-store=basic" 
                ],
                slow_mo=50 
            )

            pages = context.pages
            if pages:
                page = pages[0]
            else:
                page = await context.new_page() # Add await

            logging.info(f"Browser launched with persistent context: {user_data_dir}")

            # --- LOGIN CHECK ---
            # Navigate to a page to reliably check login status before the job page
            await page.goto("https://www.linkedin.com/feed/", wait_until='domcontentloaded', timeout=45000)
            await asyncio.sleep(3)

            if not await is_logged_in(page):
                logging.warning("Not logged in. Attempting login sequence...")
                if not await perform_login(page):
                    logging.error("LinkedIn login failed. Cannot proceed with application.")
                    await context.close()
                    return False, "failed_login_required"
                # Login successful, short pause before proceeding
                await asyncio.sleep(5)
                logging.info("Login successful, proceeding to job application.")
            else:
                logging.info("Already logged in based on initial check.")

            # Navigate to the job page
            logging.info(f"Navigated to job page for ID: {job_id}")
            await page.goto(linkedin_job_url, wait_until='domcontentloaded', timeout=60000) # 60 seconds timeout
            await asyncio.sleep(5) # Allow dynamic content to load

            # --- Look for 'Easy Apply' button ---
            easy_apply_button_selector = "div.jobs-apply-button--top-card button.jobs-apply-button"

            try:
                logging.info(f"Waiting for Easy Apply button ({easy_apply_button_selector}) to be visible...")
                easy_apply_button_locator = page.locator(easy_apply_button_selector)

                try:
                     # Wait for at least one matching element to be visible
                    await easy_apply_button_locator.first.wait_for(state='visible', timeout=15000) # Add await, wait for first
                    logging.info("Easy Apply button locator found.")

                    target_button = easy_apply_button_locator.first

                    # Check if it's enabled before clicking
                    if not await target_button.is_enabled():
                         logging.error("Easy Apply button found but is disabled.")
                         await context.close()
                         return False, "failed_button_disabled"

                    logging.info("Attempting application...")
                    apply_button_text = await target_button.text_content()
                    if "easy apply" in apply_button_text.strip().lower():
                        logging.info("Easy Apply button found and clickable.")
                        try:
                            await asyncio.sleep(0.5)
                            await target_button.click(timeout=10000) 
                            logging.info("Clicked 'Easy Apply' button.")

                            # --- Handle 'Easy Apply' Modal Dynamically ---
                            modal_selector = "div[role='dialog'].jobs-easy-apply-modal" 
                            modal_locator = page.locator(modal_selector)

                            try:
                                logging.info(f"Waiting for modal ({modal_selector}) to appear...")
                                await modal_locator.wait_for(state='visible', timeout=20000) 
                                logging.info("'Easy Apply' modal detected.")
                                await asyncio.sleep(2)

                                max_steps = 5 # Safety break to prevent infinite loops
                                current_step = 0
                                application_submitted = False
                                final_status_message = "failed_modal_processing" # Default failure message

                                while current_step < max_steps:
                                    current_step += 1
                                    logging.info(f"--- Processing Modal Step {current_step} ---")

                                    if not await modal_locator.is_visible():
                                            logging.warning(f"Modal disappeared unexpectedly during step {current_step}.")
                                            if not application_submitted: # If we haven't clicked submit yet
                                                final_status_message = "failed_modal_disappeared"
                                            break # Exit loop

                                    await asyncio.sleep(1)

                                    resume_handled_this_step = False
                                    try:
                                        # Define selector for the container of the SELECTED resume
                                        selected_resume_container_selector = "div.jobs-document-upload-redesign-card__container--selected"
                                        # Be more specific: ensure it's within the resume section if possible
                                        resume_section_selector = "div:has(> h3:text-is('Resume'))" # Look for div containing the Resume H3
                                        specific_selected_resume_locator = modal_locator.locator(resume_section_selector).locator(selected_resume_container_selector)

                                        logging.debug("Checking for pre-selected resume...")
                                        # Check if the selected container exists and is visible within the resume section
                                        selected_count = await specific_selected_resume_locator.count()

                                        if selected_count > 0:
                                            selected_resume_element = specific_selected_resume_locator.first
                                            if await selected_resume_element.is_visible(timeout=3000): # Quick check if visible
                                                # Optionally, verify the filename matches expectations if needed
                                                selected_filename_locator = selected_resume_element.locator("h3.jobs-document-upload-redesign-card__file-name")
                                                selected_filename = "Unknown Filename"
                                                if await selected_filename_locator.count() > 0:
                                                    selected_filename = (await selected_filename_locator.text_content() or "").strip()
                                                logging.info(f"Verified: Pre-uploaded resume '{selected_filename}' is selected.")
                                                resume_handled_this_step = True # Mark resume as handled for this step
                                            else:
                                                logging.debug("Found selected resume container, but it's not visible.")
                                        else:
                                            logging.info("No pre-selected resume container found.")

                                    except Exception as resume_err:
                                        logging.error(f"An error occurred during resume handling: {resume_err}", exc_info=True)
                                    # End of Resume Handling Block

                                    # --- Dynamic Field Identification and Filling ---
                                    interactive_elements = await modal_locator.locator("input, textarea, select").all()
                                    logging.info(f"Found {len(interactive_elements)} potential input elements on step {current_step}.")

                                    for element in interactive_elements:
                                        if not await element.is_visible(): # Skip hidden elements
                                            continue

                                        element_tag = await element.evaluate('el => el.tagName.toLowerCase()')
                                        element_type = (await element.get_attribute('type') or 'text') 
                                        element_id = await element.get_attribute('id')
                                        element_name = await element.get_attribute('name')
                                        element_label = await find_label_for_element(page, element) 

                                        # Ensure this loop does NOT try to handle resume elements again
                                        is_resume_related = ('resume' in (element_id or "").lower()) or \
                                                            ('resume' in element_label.lower()) or \
                                                            ('document' in (element_id or "").lower() and 'resume' in (element_id or "").lower())

                                        if is_resume_related and element_type == 'file':
                                            logging.debug(f"Skipping resume-related file input in loop: {element_id}")
                                            continue
                                        if is_resume_related and element_type == 'radio': # Skip the selection radio button
                                            logging.debug(f"Skipping resume-related radio button in loop: {element_id}")
                                            continue

                                        logging.debug(f"Processing other element: Tag={element_tag}, Type={element_type}, ID={element_id}, Label='{element_label}'")

                                        element_handled = False
                                        answer_data_from_llm = None 

                                        # --- Fill based on label or known attributes ---
                                        norm_label = element_label.lower().strip() if element_label else ""
                                        norm_name = element_name.lower().strip() if element_name else ""

                                        try:
                                            is_editable = await element.is_editable()
                                            is_visible = await element.is_visible()

                                            # Country Code 
                                            is_country_select = ('country' in norm_label or 'country' in element_id.lower()) and ('phone' in norm_label or 'phone' in element_id.lower())
                                            if element_tag == 'select' and is_country_select:
                                                if config.LINKEDIN_LOCATION:
                                                    if is_visible:
                                                        logging.info(f"Found country code select dropdown (Label: '{element_label}', ID: '{element_id}'). Attempting to select based on location: '{config.LINKEDIN_LOCATION}'.")
                                                        try:
                                                            # We need to find the option whose text STARTS WITH the location name
                                                            options = await element.locator('option').all()
                                                            matched_option_label = None
                                                            for option in options:
                                                                option_text = await option.text_content()
                                                                if option_text and option_text.strip().startswith(config.LINKEDIN_LOCATION):
                                                                    matched_option_label = option_text.strip()
                                                                    logging.info(f"Found matching country option: '{matched_option_label}'")
                                                                    break # Found the option

                                                            if matched_option_label:
                                                                # Check if it's already selected (optional but good)
                                                                current_value_text = await element.input_value() # input_value gets the text of the selected option for select
                                                                if current_value_text != matched_option_label:
                                                                    logging.info(f"Selecting country option: '{matched_option_label}'")
                                                                    await element.select_option(label=matched_option_label, timeout=7000)
                                                                    await asyncio.sleep(0.5)
                                                                    element_handled = True
                                                                else:
                                                                    logging.info(f"Country option '{matched_option_label}' is already selected.")
                                                                    element_handled = True
                                                            else:
                                                                logging.warning(f"Could not find an option starting with location '{config.LINKEDIN_LOCATION}' in the country code dropdown.")

                                                        except PlaywrightTimeoutError:
                                                            logging.warning(f"Timeout trying to select country option for '{config.LINKEDIN_LOCATION}'.")
                                                        except Exception as select_err:
                                                            logging.warning(f"Could not select country option for '{config.LINKEDIN_LOCATION}'. Error: {select_err}")
                                                    else:
                                                        logging.warning(f"Country code select dropdown (Label: '{element_label}') found but is not visible.")
                                                else:
                                                    logging.warning(f"Country code select dropdown found, but LINKEDIN_LOCATION not set in config.")
                                                continue # Move to the next element

                                            # Phone Number
                                            if element_tag == 'input' and ('phone' in norm_label or 'phone' in norm_name or 'mobile' in norm_label):
                                                if config.USER_PHONE_NUMBER and is_editable:
                                                    current_value = await element.input_value()
                                                    if current_value != config.USER_PHONE_NUMBER:
                                                        logging.info(f"Filling phone number field (Label: '{element_label}')")
                                                        await element.fill(config.USER_PHONE_NUMBER)
                                                        await asyncio.sleep(0.5)
                                                        element_handled = True
                                                    else:
                                                        logging.info("Phone number field already filled correctly.")
                                                        element_handled = True
                                                elif not config.USER_PHONE_NUMBER:
                                                    logging.warning(f"Phone number field found (Label: '{element_label}'), but USER_PHONE_NUMBER not set in config.")
                                                continue 

                                            # Email (usually pre-filled, but check)
                                            elif element_tag == 'select' and ('email' in norm_label):
                                                if config.LINKEDIN_EMAIL:
                                                    if is_visible: # Ensure the select element itself is visible
                                                        logging.info(f"Found email select dropdown (Label: '{element_label}'). Attempting to select '{config.LINKEDIN_EMAIL}'.")
                                                        try:
                                                            # Use select_option matching the visible text (label) of the <option>
                                                            # This assumes the visible text IS the email address.
                                                            await element.select_option(label=config.LINKEDIN_EMAIL, timeout=7000) # Increased timeout slightly
                                                            await asyncio.sleep(0.5) # Short pause after selection
                                                            logging.info(f"Successfully selected email: {config.LINKEDIN_EMAIL}")
                                                            element_handled = True
                                                        except PlaywrightTimeoutError:
                                                            logging.warning(f"Timeout trying to select email option '{config.LINKEDIN_EMAIL}'. The option might not exist or the element is slow.")
                                                        except Exception as select_err:
                                                            # Playwright raises an error if the label/value doesn't match any option
                                                            logging.warning(f"Could not select email option '{config.LINKEDIN_EMAIL}' by label. Check if the email in config exactly matches an option's text. Error: {select_err}")
                                                    else:
                                                        logging.warning(f"Email select dropdown (Label: '{element_label}') found but is not visible.")
                                                else:
                                                    logging.warning(f"Email select dropdown found (Label: '{element_label}'), but LINKEDIN_EMAIL not set in config.")
                                                continue # Move to the next element in the loop

                                            # --- Fallback: Handle Email if it appears as an Input (less likely now but safe) ---
                                            elif element_tag == 'input' and (element_type == 'email' or 'email' in norm_label):
                                                logging.warning(f"Found an unexpected INPUT field for email (Label: '{element_label}'). Attempting to fill.")
                                                if config.LINKEDIN_EMAIL and is_editable:
                                                    current_value = await element.input_value()
                                                    if current_value != config.LINKEDIN_EMAIL:
                                                        logging.info(f"Filling unexpected email input (Label: '{element_label}')")
                                                        await element.fill(config.LINKEDIN_EMAIL)
                                                        await asyncio.sleep(0.5)
                                                        element_handled = True
                                                    else:
                                                        logging.info("Unexpected email input already filled correctly.")
                                                elif not config.LINKEDIN_EMAIL:
                                                    logging.warning(f"Unexpected email input found (Label: '{element_label}'), but LINKEDIN_EMAIL not set in config.")
                                                continue # Move to next element

                                            # City
                                            elif element_tag == 'input' and ('city' in norm_label or 'city' in element_id.lower()):
                                                if config.LINKEDIN_CITY:
                                                    if is_editable and is_visible:
                                                        logging.info(f"Found city input field (Label: '{element_label}', ID: '{element_id}'). Attempting autocomplete for: '{config.LINKEDIN_CITY}'.")
                                                        try:
                                                            # 1. Fill the input to trigger autocomplete
                                                            base_city_name = config.LINKEDIN_CITY.split(',')[0]
                                                            logging.debug(f"Filling city input with: '{base_city_name}' to trigger dropdown.")
                                                            await element.fill(config.LINKEDIN_CITY, timeout=5000)
                                                            await asyncio.sleep(1.5) # Short pause for dropdown JS to trigger

                                                            # 2. Define selectors for the dropdown and the specific option
                                                            dropdown_selector = "div.basic-typeahead__triggered-content[role='listbox']"
                                                            # The option text we MUST match exactly, taken from config
                                                            option_selector_text = config.LINKEDIN_CITY 

                                                            logging.info(f"Waiting for city autocomplete dropdown ('{dropdown_selector}')")
                                                            dropdown_locator = page.locator(dropdown_selector)
                                                            await dropdown_locator.wait_for(state='visible', timeout=8000) # Wait longer for network/JS
                                                            logging.info("Autocomplete dropdown appeared.")

                                                            # 3. Locate and click the correct option
                                                            # Use get_by_text with exact=True, matching the required text in config
                                                            logging.info(f"Attempting to find exact option text: '{option_selector_text}'")
                                                            option_element_locator = dropdown_locator.get_by_text(option_selector_text, exact=False)

                                                            target_click_element = option_element_locator.first
                                                            logging.info(f"Waiting for city option '{option_selector_text}' to be visible.")                                               
                                                            await target_click_element.wait_for(state='visible', timeout=5000)

                                                            logging.info(f"Clicking city option: '{option_selector_text}'")
                                                            await target_click_element.click(timeout=5000)

                                                            # 4. Wait for dropdown to disappear (confirms selection registered)
                                                            await dropdown_locator.wait_for(state='hidden', timeout=5000)
                                                            logging.info(f"City '{config.LINKEDIN_CITY}' selected successfully from autocomplete.")
                                                            await asyncio.sleep(0.5) # Final short pause
                                                            element_handled = True

                                                        except PlaywrightTimeoutError as auto_timeout:
                                                            logging.warning(f"Timeout during city autocomplete for '{config.LINKEDIN_CITY}'. Dropdown or option might not have appeared/matched. Check selectors and config value. Error: {auto_timeout}")
                                                        except Exception as auto_err:
                                                            # Playwright might raise if get_by_text finds no match
                                                            logging.error(f"Error during city autocomplete for '{config.LINKEDIN_CITY}'. Ensure config value exactly matches dropdown text. Error: {auto_err}", exc_info=True)

                                                    else:
                                                        logging.warning(f"City input field found (Label: '{element_label}') but is not visible or editable.")
                                                else:
                                                    logging.warning(f"City input field found (Label: '{element_label}'), but LINKEDIN_CITY not set in config or is empty.")
                                                continue # Move to the next element


                                            # --- LLM Fallback Handler ---
                                            if not element_handled and element_label: # Only run if not handled and has a label
                                                logging.info(f"Field '{element_label}' not handled by specific logic. Querying LLM placeholder...")
                                                answer_data_from_llm = await get_llm_answer_for_field(element_label, element_tag, element_type)

                                                # if answer_data_from_llm:
                                                #     logging.info(f"[LLM Placeholder] Provided answer data: {answer_data_from_llm}")
                                                #     answer_value = answer_data_from_llm.get("answer")
                                                #     option_text_to_select = answer_data_from_llm.get("option_text")
                                                #     input_type_hint = answer_data_from_llm.get("type", element_tag) # Use element_tag as fallback type hint

                                                #     if answer_value is not None:
                                                #         logging.info(f"Attempting to answer '{element_label}' using LLM response '{answer_value}' (Type Hint: {input_type_hint})")
                                                #         # --- Use filling logic similar to the dictionary approach ---
                                                #         # (Input Fields)
                                                #         if element_tag == 'input' and element_type in ['text', 'number', 'email', 'tel', 'url', 'search']: # Added 'search' type
                                                #              if is_editable:
                                                #                 current_val = await element.input_value()
                                                #                 if current_val != str(answer_value):
                                                #                     await element.fill(str(answer_value))
                                                #                     await asyncio.sleep(0.3)
                                                #                     logging.info("[LLM Handler] Filled text/number input.")
                                                #                     element_handled = True # Mark as handled by LLM
                                                #                 else:
                                                #                     logging.info("[LLM Handler] Input already has correct value.")
                                                #                     element_handled = True
                                                #              else:
                                                #                  logging.warning("[LLM Handler] Input field not editable.")

                                                #         # (Textarea)
                                                #         elif element_tag == 'textarea':
                                                #              if is_editable:
                                                #                 current_val = await element.input_value()
                                                #                 if current_val != str(answer_value):
                                                #                     await element.fill(str(answer_value))
                                                #                     await asyncio.sleep(0.3)
                                                #                     logging.info("[LLM Handler] Filled textarea.")
                                                #                     element_handled = True
                                                #                 else:
                                                #                     logging.info("[LLM Handler] Textarea already has correct value.")
                                                #                     element_handled = True
                                                #              else:
                                                #                  logging.warning("[LLM Handler] Textarea field not editable.")

                                                #         # (Select Dropdown)
                                                #         elif element_tag == 'select':
                                                #             text_to_find = option_text_to_select if option_text_to_select else str(answer_value)
                                                #             logging.info(f"[LLM Handler] Attempting to select option with text: '{text_to_find}'")
                                                #             current_selected_text = await element.input_value()
                                                #             if current_selected_text != text_to_find:
                                                #                 await element.select_option(label=text_to_find, timeout=7000)
                                                #                 await asyncio.sleep(0.3)
                                                #                 logging.info(f"[LLM Handler] Selected option '{text_to_find}'.")
                                                #                 element_handled = True
                                                #             else:
                                                #                 logging.info(f"[LLM Handler] Option '{text_to_find}' already selected.")
                                                #                 element_handled = True

                                                #         # (Radio Buttons) - Reuse previous logic, adapt slightly
                                                #         elif element_tag == 'input' and element_type == 'radio':
                                                #             radio_name = await element.get_attribute('name')
                                                #             if radio_name:
                                                #                 radio_group_locator = page.locator(f"input[type='radio'][name='{radio_name}']")
                                                #                 radio_buttons = await radio_group_locator.all()
                                                #                 target_radio_button = None
                                                #                 text_to_match = option_text_to_select if option_text_to_select else str(answer_value)

                                                #                 for radio_btn in radio_buttons:
                                                #                     radio_id = await radio_btn.get_attribute("id")
                                                #                     radio_value = await radio_btn.get_attribute("value")
                                                #                     radio_label_text = ""
                                                #                     if radio_id:
                                                #                         label_for = page.locator(f"label[for='{radio_id}']")
                                                #                         if await label_for.count() > 0:
                                                #                              radio_label_text = (await label_for.first.text_content() or "").strip()
                                                #                     # TODO: Add more robust label finding if needed

                                                #                     if radio_label_text == text_to_match or radio_value == text_to_match:
                                                #                         target_radio_button = radio_btn
                                                #                         break

                                                #                 if target_radio_button:
                                                #                      await target_radio_button.check(timeout=5000)
                                                #                      await asyncio.sleep(0.3)
                                                #                      logging.info("[LLM Handler] Clicked/Checked radio button.")
                                                #                      element_handled = True
                                                #                 else:
                                                #                     logging.warning(f"[LLM Handler] Could not find radio button option matching '{text_to_match}' for question '{element_label}'.")
                                                #             else:
                                                #                 logging.warning("[LLM Handler] Radio button has no name attribute.")

                                                #         # (Checkboxes) - Reuse previous logic
                                                #         elif element_tag == 'input' and element_type == 'checkbox':
                                                #              # Assuming LLM returns True/False in 'answer'
                                                #              if isinstance(answer_value, bool):
                                                #                  if answer_value: await element.check(timeout=5000)
                                                #                  else: await element.uncheck(timeout=5000)
                                                #                  logging.info(f"[LLM Handler] {'Checked' if answer_value else 'Unchecked'} checkbox.")
                                                #                  element_handled = True
                                                #                  await asyncio.sleep(0.3)
                                                #              else:
                                                #                  logging.warning(f"[LLM Handler] LLM answer for checkbox '{element_label}' is not boolean. Skipping.")

                                                #         else:
                                                #              logging.warning(f"[LLM Handler] Unhandled element type '{element_tag}/{element_type}' for LLM response.")
                                                #     else:
                                                #          logging.warning(f"[LLM Placeholder] Did not provide a valid answer value for '{element_label}'.")
                                                # else:
                                                #     # LLM explicitly returned None (no match)
                                                #     logging.info(f"[LLM Placeholder] Could not find answer for '{element_label}'.")
                                                #     # element_handled remains False

                                            # --- Final Check for Unhandled Elements ---
                                            if not element_handled:
                                                logging.warning(f"UNHANDLED Element: Label='{element_label}', ID='{element_id}', Type='{element_tag}/{element_type}'. No specific handler or LLM answer found. Skipping.")

                                            
                                            # --- Add more elif blocks for other common fields ---
                                            # e.g., Address, City, Postal Code, Custom Questions (Textarea)
                                            # For Textareas/Custom Questions: You might log a warning and skip,
                                            # or provide default answers in config if they are predictable.
                                            if element_tag == 'textarea':
                                                logging.warning(f"Textarea field found (Label: '{element_label}'). Possible custom question. Skipping automatic fill.")
                                                continue

                                            # --- Handle Select/Dropdowns ---
                                            if element_tag == 'select':
                                                logging.warning(f"Select/Dropdown field found (Label: '{element_label}'). Automatic handling not implemented. Skipping.")
                                                # Future: Could try selecting first valid option or matching based on config
                                                continue

                                            # --- Handle Radio Buttons / Checkboxes ---
                                            if element_type in ['radio', 'checkbox']:
                                                logging.warning(f"Radio/Checkbox field found (Label: '{element_label}', Name: '{element_name}'). Automatic handling not implemented. Skipping.")
                                                # Future: Requires logic to select based on label text of options
                                                continue

                                        except PlaywrightTimeoutError as field_timeout:
                                            logging.warning(f"Timeout interacting with field (Label: '{element_label}'): {field_timeout}")
                                        except Exception as field_err:
                                            logging.error(f"Error processing field (Label: '{element_label}'): {field_err}", exc_info=True)

                                    # --- Find Action Buttons (Submit, Review, Next) ---
                                    submit_button = modal_locator.locator("button:has-text('Submit application')")
                                    review_button = modal_locator.locator("button:has-text('Review application'), button:has-text('Review')")

                                    next_button = modal_locator.locator("button:has-text('Next'), button:has-text('Continue')") 

                                    # Add await for checks and clicks
                                    submit_visible = await submit_button.is_visible()
                                    submit_enabled = await submit_button.is_enabled() if submit_visible else False

                                    review_visible = await review_button.is_visible()
                                    review_enabled = await review_button.is_enabled() if review_visible else False

                                    next_visible = await next_button.is_visible()
                                    next_enabled = await next_button.is_enabled() if next_visible else False

                                    # Prioritize Submit button
                                    if submit_visible and submit_enabled:
                                        logging.info("Found 'Submit application' button. Clicking...")
                                        await submit_button.click()
                                        application_submitted = True 
                                        final_status_message = "applied"
                                        break 

                                    # Then Review button
                                    elif review_visible and review_enabled:
                                        logging.info("Found 'Review' button. Clicking to proceed...")
                                        await review_button.click()
                                        await asyncio.sleep(3) # Wait for the next step/review page to load
                                        continue # Continue to the next iteration of the while loop

                                    # Then Next button
                                    elif next_visible and next_enabled:
                                        logging.info("Found 'Next' button. Clicking to proceed...")
                                        await next_button.click()
                                        await asyncio.sleep(3)
                                        continue # Continue to the next iteration of the while loop

                                    else:
                                        logging.error(f"Could not find enabled 'Submit', 'Review', or 'Next' button on step {current_step}. Available buttons might be disabled or have different text.")
                                        final_status_message = "failed_no_action_button"
                                        break # Exit loop, application failed at this step

                                # --- After the Loop ---
                                if application_submitted:
                                    await asyncio.sleep(5) 
                                    if not await modal_locator.is_visible(timeout=5000):
                                        logging.info("Application submitted successfully (modal closed after submit).")
                                        await context.close()
                                        return True, "applied"
                                    else:
                                        confirmation_selector = "h2:has-text('Application submitted'), h3:has-text('submitted')" 
                                        if await page.locator(confirmation_selector).first.is_visible(timeout=5000): # Check if *any* confirmation exists
                                            logging.info("Application submitted successfully (confirmation text found).")
                                            await context.close()
                                            return True, "applied"
                                        else:
                                            logging.warning("Clicked submit, but confirmation is unclear (modal still visible, no confirmation text found). Marking as potentially failed.")
                                            await context.close()
                                            return False, "failed_confirmation_unclear"

                                elif current_step == max_steps:
                                    logging.error("Reached maximum steps without submitting. Failing application.")
                                    await context.close()
                                    return False, "failed_max_steps"
                                else:
                                    logging.error(f"Application failed during modal processing. Final status: {final_status_message}")
                                    await context.close()
                                    return False, final_status_message

                            except PlaywrightTimeoutError:
                                logging.error(f"Timed out waiting for the 'Easy Apply' modal ({modal_selector}) to appear or during step processing.")
                                await context.close() # Let finally block handle closing
                                return False, "failed_modal_timeout"
                            except Exception as modal_err:
                                logging.error(f"Error processing 'Easy Apply' modal: {modal_err}", exc_info=True)
                                await context.close()
                                return False, "failed_modal_error"

                        except PlaywrightTimeoutError:
                            logging.error(f"Timeout occurred while trying to click the Easy Apply button.")
                            await context.close()
                            return False, "failed_button_click_timeout"
                        except Exception as click_err:
                            logging.error(f"Error clicking Easy Apply button: {click_err}", exc_info=True)
                            await context.close()
                            return False, "failed_button_click_error"

                    elif "apply" in apply_button_text.strip().lower():
                        logging.info("Apply button found and clickable.")
                        try:
                            await asyncio.sleep(0.5)

                            async with context.expect_page() as new_page_info:
                                # await page.wait_for_load_state("networkidle")
                                await target_button.click(timeout=10000) 
                                logging.info("Clicked 'Apply' button.")

                            new_page  = await new_page_info.value
                            logging.info(f"New page opened after clicking 'Apply': {await new_page.title()}")
                            interactive_elements = await new_page.locator("input, textarea, select").all()
                            if interactive_elements:
                                logging.info(f"Found {len(interactive_elements)} potential input elements on new page.")
                            else :
                                buttons_and_links = new_page.locator("button, a")
                                apply_elements_filtered = buttons_and_links.filter(has_text=re.compile("apply", re.IGNORECASE))

                                print(f"\n--- Found using locator('button, a').filter() ---")
                                print(f"Count: {await apply_elements_filtered.count()}")

                                await apply_elements_filtered.first.wait_for(state='visible', timeout=15000) # Add await, wait for first
                                logging.info("Apply button locator found.")

                                new_page_target_button = apply_elements_filtered.first

                                 # Check if it's enabled before clicking
                                if not await new_page_target_button.is_enabled():
                                    logging.error("Apply button found but is disabled.")
                                    await context.close()
                                    return False, "failed_button_disabled"

                                for i in range(await apply_elements_filtered.count()):
                                    element = apply_elements_filtered.nth(i)
                                    print(f"Element {i+1} text: '{await element.text_content()}' Tag: {await element.evaluate('el => el.tagName')}")                     

                        except PlaywrightTimeoutError:
                            logging.error(f"Timeout occurred while trying to click the Easy Apply button.")
                            await context.close()
                            return False, "failed_button_click_timeout"
                        except Exception as click_err:
                            logging.error(f"Error clicking Easy Apply button: {click_err}", exc_info=True)
                            await context.close()
                            return False, "failed_button_click_error"                            

                except PlaywrightTimeoutError:
                    logging.info("Easy Apply button not found within timeout.")
                    logging.warning(f"Neither 'Easy Apply' nor 'Apply' button found for job ID: {job_id}.")
                    await context.close() # Add await
                    return False, "no_apply_button"

            except PlaywrightTimeoutError:
                logging.error(f"Timed out waiting for apply buttons on job page: {linkedin_job_url}")
                await context.close()
                return False, "failed_page_timeout"
            except Exception as page_err:
                logging.error(f"Error interacting with job page elements: {page_err}", exc_info=True)
                await context.close()
                return False, "failed_page_interaction"

        except Exception as browser_err:
            logging.error(f"Failed to launch or control browser: {browser_err}", exc_info=True)
            if context and context.is_connected: # is_connected might be sync
                 try:
                    await context.close() 
                 except Exception as close_err:
                    logging.error(f"Error closing context after browser error: {close_err}")
            return False, "failed_browser_error"

        finally:
             if context and context.is_connected:
                 logging.info("Closing browser context in finally block.")
                 try:
                     await context.close() # Add await
                 except Exception as final_close_err:
                     logging.error(f"Error closing context in finally block: {final_close_err}")

def update_job_status(job_id: str, status: str):
    """
    Updates the status of the job in the Supabase 'jobs' table.
    """
    logging.info(f"Updating status for job ID: {job_id} to '{status}'")
    # --- Placeholder for Supabase Update Logic ---
    # Call a new function in supabase_utils (e.g., update_job_status)
    # success = supabase_utils.update_job_status(job_id, status)
    # if success:
    #     logging.info(f"Successfully updated status for job ID: {job_id}")
    # else:
    #     logging.error(f"Failed to update status for job ID: {job_id}")
    # --- End Placeholder ---
    pass # Remove this pass when implementing the actual update

async def main():
    """
    Main function to fetch the top job and initiate the application process.
    """
    logging.info("--- Starting Job Application Script ---")

    # --- Get User Info and Resume Path from Config ---
    try:
        resume_path = config.RESUME_FILE_PATH
        phone_number = config.USER_PHONE_NUMBER

        if not resume_path:
            raise ValueError("RESUME_FILE_PATH not set in config.py")
        logging.info(f"Resume: {resume_path}")
    except (AttributeError, ValueError) as config_err:
        logging.error(f"Configuration error: {config_err}. Please set USER_EMAIL and RESUME_FILE_PATH in config.py.")
        logging.info("--- Job Application Script Finished (Config Error) ---")
        return

    # Fetch the single top-scored job to apply for
    top_jobs = supabase_utils.get_top_scored_jobs_to_apply(limit=1)

    if not top_jobs:
        logging.info("No suitable jobs found to apply for at this time.")
        logging.info("--- Job Application Script Finished ---")
        return

    job_to_apply = top_jobs[0]
    job_id = job_to_apply.get('job_id')
    job_title = job_to_apply.get('job_title')
    job_score = job_to_apply.get('resume_score')

    logging.info(f"Found top job to apply for: ID={job_id}, Title='{job_title}', Score={job_score}")

    # Attempt to apply using Playwright
    try:
        application_successful, status_message = await apply_to_job(job_to_apply, resume_path)

        if application_successful:
            logging.info(f"Successfully applied via 'Easy Apply' to job ID: {job_id}")
            update_job_status(job_id, status_message) # status_message should be 'applied'
        else:
            logging.warning(f"Application attempt for job ID: {job_id} resulted in status: {status_message}")
            # Update status in Supabase based on the outcome
            update_job_status(job_id, status_message) # e.g., 'external', 'failed', 'no_apply_button'

    except Exception as e:
        logging.error(f"An critical error occurred during the application process for job ID {job_id}: {e}", exc_info=True)
        # Update status to 'application_error'
        update_job_status(job_id, "application_error")

    logging.info("--- Job Application Script Finished ---")

if __name__ == "__main__":
    asyncio.run(main())