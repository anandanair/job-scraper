from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Education(BaseModel):
    degree: str = ""
    field_of_study: str = ""
    institution: str = ""
    start_year: str = ""
    end_year: str = ""

class Experience(BaseModel):
    job_title: str = ""
    company: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""

class Project(BaseModel):
    name: str = ""
    description: str = ""
    technologies: List[str] = Field(default_factory=list)

class Certification(BaseModel):
    name: str = ""
    issuer: str = ""
    year: str = ""

class Links(BaseModel):
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""

class Resume(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[Certification] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    links: Links = Field(default_factory=Links)

# --- Pydantic models for Stage 1 & Stage 2 LLM structured output ---
class RoleFocus(BaseModel):
    company: str
    job_title: str
    key_achievements_to_highlight: List[str] = Field(
        default_factory=list,
        description="Key responsibilities, tools, or achievements from this role in the base resume to emphasize."
    )
    points_to_condense_or_omit: List[str] = Field(
        default_factory=list,
        description="Responsibilities or tasks from this role in the base resume that are irrelevant to the target JD."
    )

class CurationPlan(BaseModel):
    strategy_summary: str = Field(
        description="Brief 1-2 sentence strategy explaining how the candidate's actual background aligns with the target job."
    )
    selected_project_names: List[str] = Field(
        default_factory=list,
        description="Exact names of projects from the base resume to include (choose 1 to 3 most relevant projects; omit irrelevant ones)."
    )
    selected_skills: List[str] = Field(
        default_factory=list,
        description="Curated list of 8 to 15 skills strictly from the candidate's base resume that match the target JD."
    )
    experience_guidance: List[RoleFocus] = Field(
        default_factory=list,
        description="Guidance for each job in the candidate's history on what to highlight or prune."
    )

class TailoredResumeContent(BaseModel):
    summary: str = Field(
        description="Impactful 2-3 sentence professional summary tailored to the target job, preserving core identity."
    )
    skills: List[str] = Field(
        default_factory=list,
        description="Curated list of 8-15 skills matching the target job (strictly subset of base resume)."
    )
    experience: List[Experience] = Field(
        default_factory=list,
        description="List of all work experiences with tailored, newline-separated bullet-point descriptions."
    )
    projects: List[Project] = Field(
        default_factory=list,
        description="List of selected projects with tailored, newline-separated bullet-point descriptions."
    )

# --- Legacy models kept for backwards compatibility ---
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
