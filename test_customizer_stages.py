"""
Unit and integration test for Two-Stage Resume Customizer components.
Tests schema validation, guardrail enforcement, and PDF rendering.
"""
import sys
import os
import asyncio
import json

# Ensure project directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import Resume, Experience, Project, Education, Certification, Links, CurationPlan, TailoredResumeContent, RoleFocus
from custom_resume_generator import validate_customization
import pdf_generator

def load_sample_base_resume() -> Resume:
    resume_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resume.json")
    with open(resume_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Resume(**data)

def test_models():
    print("Testing Pydantic models serialization...")
    plan = CurationPlan(
        strategy_summary="Emphasize statistics, Python, and data modeling for machine learning role.",
        selected_project_names=["Assessing Credit Risk using Classification Techniques"],
        selected_skills=["Python", "R", "Statistical Analysis", "Pandas", "NumPy", "SQL"],
        experience_guidance=[
            RoleFocus(
                company="Bharata Mata College (Affiliated to M.G. University)",
                job_title="Assistant Professor | Department of Data Science",
                key_achievements_to_highlight=["Taught Applied Statistics", "Data Analysis (R/Python)"],
                points_to_condense_or_omit=["Faculty documentation", "administrative audits"]
            )
        ]
    )
    assert len(plan.selected_project_names) == 1
    assert len(plan.selected_skills) == 6
    print("[OK] Pydantic models validated successfully.")

def test_validation_logic():
    print("Testing validation logic & guardrails...")
    base_resume = load_sample_base_resume()

    # Case A: Valid tailored content (selective 1 project, preserved jobs)
    valid_content = TailoredResumeContent(
        summary="Experienced Statistician and Data Science Educator with 3+ years specializing in statistical analysis and predictive modeling using Python and R.",
        skills=["Python", "R", "Pandas", "NumPy", "Statistical Analysis", "SQL", "Probability Theory"],
        experience=[
            Experience(
                job_title=base_resume.experience[0].job_title,
                company=base_resume.experience[0].company,
                location=base_resume.experience[0].location,
                start_date=base_resume.experience[0].start_date,
                end_date=base_resume.experience[0].end_date,
                description="- Delivered advanced lectures on Applied Statistics and Data Analysis in Python and R.\n- Supervised final-year student dissertations with predictive modeling focus."
            ),
            Experience(
                job_title=base_resume.experience[1].job_title,
                company=base_resume.experience[1].company,
                location=base_resume.experience[1].location,
                start_date=base_resume.experience[1].start_date,
                end_date=base_resume.experience[1].end_date,
                description="- Consulted on statistical design and applied quantitative modeling across faculty research projects."
            )
        ],
        projects=[
            Project(
                name="Assessing Credit Risk using Classification Techniques",
                description="- Built classification algorithms using R and Python to predict credit default risk.\n- Evaluated model precision and recall across loan datasets.",
                technologies=["R", "Python"]
            )
        ]
    )

    is_valid, reason = asyncio.run(validate_customization(base_resume, valid_content))
    assert is_valid is True, f"Valid content failed validation: {reason}"
    print("[OK] Case A (Valid selective projects & preserved experience) PASSED.")

    # Case B: Fabricated project name not in base resume
    fake_project_content = valid_content.model_copy(deep=True)
    fake_project_content.projects = [
        Project(
            name="Invented Autonomous Driving Drone",
            description="- Fabricated drone software that does not exist.",
            technologies=["C++"]
        )
    ]
    is_valid_fake, reason_fake = asyncio.run(validate_customization(base_resume, fake_project_content))
    assert is_valid_fake is False, "Fabricated project should have been rejected!"
    assert "Fabricated project" in reason_fake
    print(f"[OK] Case B (Fabricated project rejection) PASSED: {reason_fake}")

    # Case C: Altered job title
    altered_title_content = valid_content.model_copy(deep=True)
    altered_title_content.experience[0].job_title = "Chief Technology Officer"
    is_valid_title, reason_title = asyncio.run(validate_customization(base_resume, altered_title_content))
    assert is_valid_title is False, "Altered job title should have been rejected!"
    assert "job_title" in reason_title
    print(f"[OK] Case C (Altered job title rejection) PASSED: {reason_title}")

    # Case D: Too many projects (> 3)
    too_many_proj_content = valid_content.model_copy(deep=True)
    too_many_proj_content.projects = [
        base_resume.projects[0],
        base_resume.projects[1],
        base_resume.projects[2],
        base_resume.projects[0]
    ]
    is_valid_count, reason_count = asyncio.run(validate_customization(base_resume, too_many_proj_content))
    assert is_valid_count is False, "More than 3 projects should have been rejected for page budget!"
    assert "Too many projects" in reason_count
    print(f"[OK] Case D (Max 3 projects limit rejection) PASSED: {reason_count}")

def test_pdf_generation():
    print("Testing PDF generation with tailored resume & link filtering...")
    import pypdfium2 as pdfium
    base_resume = load_sample_base_resume()
    personalized_resume = base_resume.model_copy(deep=True)

    # Apply tailored content with generic github and valid linkedin
    personalized_resume.links = Links(
        github="https://github.com/",
        linkedin="https://www.linkedin.com/in/gopika-thampi/",
        portfolio="NA"
    )
    personalized_resume.summary = "Experienced Statistician with 3+ years in Python, R, and statistical data modeling."
    personalized_resume.skills = ["Python", "R", "Pandas", "NumPy", "Statistical Analysis", "SQL", "Probability Theory"]
    personalized_resume.projects = [base_resume.projects[1]] # Only the Credit Risk project!
    personalized_resume.experience[0].description = "- Delivered advanced lectures on Applied Statistics and Data Analysis in Python and R.\n- Supervised final-year student dissertations with predictive modeling focus."

    pdf_bytes = pdf_generator.create_resume_pdf(personalized_resume)
    assert pdf_bytes is not None and len(pdf_bytes) > 1000, "PDF bytes should be non-empty and valid!"
    
    pdf = pdfium.PdfDocument(pdf_bytes)
    assert len(pdf) <= 2, f"PDF exceeded 2 pages! Actual count: {len(pdf)}"
    page1_text = pdf[0].get_textpage().get_text_range()
    assert "GitHub" not in page1_text, "Generic GitHub link should have been filtered out!"
    assert "LinkedIn" in page1_text, "Valid LinkedIn link should have been rendered!"

    print(f"[OK] PDF generated successfully! Pages: {len(pdf)} | Size: {len(pdf_bytes)} bytes | Links validated.")

if __name__ == "__main__":
    test_models()
    test_validation_logic()
    test_pdf_generation()
    print("\nALL UNIT AND INTEGRATION TESTS PASSED SUCCESSFULLY!")
