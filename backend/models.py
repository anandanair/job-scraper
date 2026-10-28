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


# --- App Settings Model ---
class AppSettings(BaseModel):
    id: Optional[str] = None
    llm_provider: str = "gemini"
    llm_model: str = "gemini-3.8-flash"
    llm_api_key: Optional[str] = None
    llm_tier: str = "free"  # "free" | "paid"
    linkedin_search_queries: List[str] = Field(default_factory=lambda: ["Software Engineer", "Full Stack Developer"])
    linkedin_location: str = "Singapore"
    linkedin_geo_id: str = "102454443"
    linkedin_job_type: str = "F"
    linkedin_job_posting_date: str = "r86400"
    linkedin_f_wt: str = "1,2,3"
    careers_future_search_queries: List[str] = Field(default_factory=lambda: ["Software Engineer", "Frontend Developer"])
    careers_future_search_categories: List[str] = Field(default_factory=lambda: ["Information Technology"])
    careers_future_search_employment_types: List[str] = Field(default_factory=lambda: ["Full Time"])
    scraping_sources: List[str] = Field(default_factory=lambda: ["linkedin"])
    jobs_to_score_per_run: int = 10
    jobs_to_customize_per_run: int = 2
    max_jobs_per_search: Dict[str, int] = Field(default_factory=lambda: {"linkedin": 10, "careers_future": 20})
    llm_max_rpm: int = 10
    llm_request_delay_seconds: int = 8
    llm_daily_request_budget: int = 0


class Config:
    extra = 'allow'
