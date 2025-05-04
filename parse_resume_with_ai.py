"""
Stage 2: AI-Powered Resume Parser
This module takes extracted resume text and uses AI to parse it into structured data.
"""

import json
import os
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional


class Education(BaseModel):
    degree: str
    field_of_study: Optional[str]
    institution: str
    start_year: Optional[str]
    end_year: Optional[str]


class Experience(BaseModel):
    job_title: str
    company: str
    location: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    description: Optional[str]


class Project(BaseModel):
    name: str
    description: Optional[str]
    technologies: Optional[List[str]]


class Certification(BaseModel):
    name: str
    issuer: Optional[str]
    year: Optional[str]


class Links(BaseModel):
    linkedin: Optional[str]
    github: Optional[str]
    portfolio: Optional[str]


class Resume(BaseModel):
    name: str
    email: str
    phone: Optional[str]
    location: Optional[str]
    summary: Optional[str]
    skills: Optional[List[str]]
    education: Optional[List[Education]]
    experience: Optional[List[Experience]]
    projects: Optional[List[Project]]
    certifications: Optional[List[Certification]]
    languages: Optional[List[str]]
    links: Optional[Links]


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
            response_schema=Resume,
        )
    )
    return response.text
