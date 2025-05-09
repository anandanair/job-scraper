"""
Stage 2: AI-Powered Resume Parser
This module takes extracted resume text and uses AI to parse it into structured data.
"""

import json
import os
from google import genai
from google.genai import types
from typing import List, Optional
import models


def parse_resume_with_ai(client: genai.Client, resume_text):
    """
    Send resume text to an AI model and get structured information back.
    
    Args:
        resume_text (str): The plain text extracted from the resume
        
    Returns:
        dict: Structured resume information
    """
    print("Processing resume with AI model...")

    prompt = f"""Extract and return the structured resume information from the text below. Only use what is explicitly stated in the text and do not infer or invent any details.

    Resume text:
    {resume_text}
    """

    response = client.models.generate_content(
        model="gemini-2.0-flash", 
        contents=prompt, 
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
            response_schema=models.Resume,
        )
    )
    return response.text
