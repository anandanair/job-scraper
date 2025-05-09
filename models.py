from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

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

# --- Pydantic models for LLM structured output ---
class SummaryOutput(BaseModel):
    summary: str

class SkillsOutput(BaseModel):
    skills: List[str]

class ExperienceListOutput(BaseModel):
    experience: List[Experience]

class SingleExperienceOutput(BaseModel):
    experience: Experience

class ProjectListOutput(BaseModel):
    projects: List[Project]

class SingleProjectOutput(BaseModel):
    project: Project

class ValidationResponse(BaseModel):
    is_valid: bool
    reason: str

class Config:
    extra = 'allow'