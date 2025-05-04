import pdfplumber
from google import genai
import config
from parse_resume_with_ai import parse_resume_with_ai
import json
from supabase_utils import save_resume_to_supabase 

client = genai.Client(api_key=config.GEMINI_API_KEY)

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
            text += page.extract_text() + "\n"
    return text

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
    parsed_resume_details_str = parse_resume_with_ai(client, resume_text)
    if not parsed_resume_details_str:
        print("Failed to parse resume. Exiting.")
        return

    try:
        # Convert the JSON string response to a dictionary
        resume_data_dict = json.loads(parsed_resume_details_str)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from AI: {e}")
        print(f"Raw response: {parsed_resume_details_str}")
        return

    # 3. Save parsed data to Supabase
    save_resume_to_supabase(resume_data_dict) # Call the save function

    print("\nResume processing finished.")
    # Optionally print the data that was sent to Supabase
    # print(json.dumps(resume_data_dict, indent=4))


if __name__ == "__main__":
    pdf_path = "./resume_files/resume.pdf"
    print(f"Starting resume processing for: {pdf_path}")
    main(pdf_path)