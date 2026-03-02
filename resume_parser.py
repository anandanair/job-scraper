import pdfplumber
import config
import json
import models
from llm_client import primary_client

def extract_text_from_pdf(pdf_path):
    """
    Extracts text from a given PDF file.

    Args:
        pdf_path (str): The file path to the PDF resume.

    Returns:
        str: The extracted text content from the PDF.
    """
    print(f"Extracting text from: {pdf_path}")
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Extract the visible text
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
            
            # Extract embedded hyperlinks which are not captured by extract_text()
            if page.hyperlinks:
                for link in page.hyperlinks:
                    uri = link.get("uri")
                    if uri:
                        text += f"Embedded Link: {uri}\n"
    return text

def parse_resume_with_ai(resume_text):
    """
    Send resume text to an AI model and get structured information back.
    
    Args:
        resume_text (str): The plain text extracted from the resume
        
    Returns:
        str: JSON string of structured resume information
    """
    print("Processing resume with AI model...")

    prompt = f"""Extract and return the structured resume information from the text below. 
    Only use what is explicitly stated in the text and do not infer or invent any details.
    
    CRITICAL: If any information is missing or not available in the text, use "NA" for that field. 
    This applies to all fields (e.g., summary, dates, location, links, etc.). 
    Do NOT leave fields empty or use empty strings.

    Resume text:
    {resume_text}
    """

    response_text = primary_client.generate_content(
        prompt=prompt,
        response_format=models.Resume,
    )
    return response_text

def main(pdf_file_path):
    """
    Main function to orchestrate the resume parsing process.
    """
    # 1. Extract text from PDF
    resume_text = extract_text_from_pdf(pdf_file_path)
    if not resume_text:
        print("Failed to extract text. Exiting.")
        return

    # 2. Parse resume text with AI
    parsed_resume_details_str = parse_resume_with_ai(resume_text)
    if not parsed_resume_details_str:
        print("Failed to parse resume. Exiting.")
        return

    try:
        # Convert the JSON string response to a dictionary
        resume_data_dict = json.loads(parsed_resume_details_str)
        
        # Recursive function to replace empty values or None with "NA"
        def replace_empty_with_na(data):
            if isinstance(data, dict):
                return {k: replace_empty_with_na(v) for k, v in data.items()}
            elif isinstance(data, list):
                return[replace_empty_with_na(i) for i in data]
            elif data == "" or data is None:
                return "NA"
            return data

        resume_data_dict = replace_empty_with_na(resume_data_dict)

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from AI: {e}")
        print(f"Raw response: {parsed_resume_details_str}")
        return

    # 3. Save parsed data to local JSON file
    output_path = config.BASE_RESUME_PATH
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(resume_data_dict, f, indent=4)
        print(f"Successfully saved parsed resume to {output_path}")
    except Exception as e:
        print(f"Error saving resume to {output_path}: {e}")

    print("\nResume processing finished.")


if __name__ == "__main__":
    pdf_path = "./resume.pdf"
    print(f"Starting resume processing for: {pdf_path}")
    main(pdf_path)