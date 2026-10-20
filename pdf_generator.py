import io
import logging
from typing import Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, HRFlowable, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.lib import colors
from models import Resume 

logging.basicConfig(level=logging.INFO)

def is_valid_profile_link(url: Optional[str], platform: str) -> bool:
    """
    Checks if a link is an actual personal profile URL rather than a generic
    placeholder, empty value, or root homepage.
    """
    if not url:
        return False
    u = str(url).strip()
    if not u or u.upper() in ("NA", "NONE", "NULL", "N/A", "#"):
        return False

    # Normalize url for checking
    normalized = u.lower().rstrip('/')
    # Remove protocol prefix for path checking
    for prefix in ("https://", "http://", "//"):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
    if normalized.startswith("www."):
        normalized = normalized[4:]

    if platform == "github":
        # Must have a username/path after github.com/
        if normalized in ("github.com", ""):
            return False
        parts = normalized.split("github.com/")
        if len(parts) < 2 or not parts[1].strip('/'):
            return False
    elif platform == "linkedin":
        if normalized in ("linkedin.com", "linkedin.com/in", ""):
            return False
        parts = normalized.split("linkedin.com/in/")
        if len(parts) >= 2:
            if not parts[1].strip('/'):
                return False
        else:
            parts = normalized.split("linkedin.com/")
            if len(parts) < 2 or not parts[1].strip('/'):
                return False
    elif platform == "portfolio":
        if normalized in ("portfolio.com", "myportfolio.com", ""):
            return False
            
    return True

def create_resume_pdf(resume_data: Resume) -> bytes:
    """
    Generates an ATS-friendly PDF resume with improved design from the provided Resume data object.
    Enforces clean page budgeting to comfortably fit within 2 pages without orphan section headings.
    Returns the PDF content as bytes.
    """
    buffer = io.BytesIO()
    
    # Document setup with tight ATS margins to preserve vertical space
    doc = BaseDocTemplate(
        buffer, 
        pagesize=letter,
        leftMargin=0.5*inch, 
        rightMargin=0.5*inch,
        topMargin=0.45*inch, 
        bottomMargin=0.45*inch
    )
    frame = Frame(
        doc.leftMargin, 
        doc.bottomMargin, 
        doc.width, 
        doc.height, 
        leftPadding=0, 
        rightPadding=0, 
        topPadding=0, 
        bottomPadding=0, 
        id='normal'
    )
    template = PageTemplate(id='resume_page', frames=frame)
    doc.addPageTemplates([template])
    
    # Available content width
    avail_width = doc.width # 7.5 inches = 540 points
    
    # Create custom styles
    styles = getSampleStyleSheet()
    
    # Define a modern color palette
    primary_color = colors.HexColor('#1976D2')  # Modern blue
    secondary_color = colors.HexColor('#455A64')  # Dark blue-gray
    text_color = colors.HexColor('#212121')  # Near black
    light_text = colors.HexColor('#757575')  # Medium gray
    
    # Create custom styles using ReportLab's built-in fonts
    style_name = ParagraphStyle(
        name='Name',
        parent=styles['Heading1'],
        fontSize=24,
        alignment=TA_LEFT,
        spaceAfter=6,
        fontName='Helvetica-Bold',
        textColor=primary_color,
    )
    
    style_section_heading = ParagraphStyle(
        name='SectionHeading',
        parent=styles['Heading2'],
        fontSize=11,
        spaceBefore=7,
        spaceAfter=2,
        fontName='Helvetica-Bold',
        textColor=primary_color,
        alignment=TA_LEFT,
        keepWithNext=True,  # Prevent heading from separating from following content
    )
    
    style_normal = ParagraphStyle(
        name='Normal',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13.5,  
        fontName='Helvetica',
        textColor=text_color,
    )
    
    style_contact = ParagraphStyle(
        name='Contact',
        parent=styles['Normal'],
        alignment=TA_LEFT,
        fontSize=9,
        leading=12,
        spaceAfter=2,
        textColor=secondary_color,
    )
    
    style_job_title = ParagraphStyle(
        name='JobTitle',
        parent=styles['Normal'],
        fontSize=11,  
        spaceAfter=2,
        fontName='Helvetica-Bold',
        textColor=primary_color,  
    )
    
    style_company = ParagraphStyle(
        name='Company',
        parent=styles['Normal'],
        spaceBefore=1,
        fontSize=9.5,
        fontName='Helvetica-Bold',  
        textColor=secondary_color,
    )
    
    style_dates = ParagraphStyle(
        name='Dates',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_RIGHT,
        fontName='Helvetica-Oblique',
        textColor=light_text,
    )
    
    style_bullet = ParagraphStyle(
        name='Bullet',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13,
        leftIndent=12,
        bulletIndent=0,
        fontName='Helvetica',
        textColor=text_color,
        spaceAfter=2,
    )

    style_tech = ParagraphStyle(
        name='Technologies',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11.5,
        fontName='Helvetica-Oblique',
        textColor=light_text,
        spaceAfter=3,
    )
    
    story = []

    # --- Header ---
    if resume_data.name:
        story.append(Paragraph(resume_data.name.upper(), style_name))

    # --- Contact Information ---
    contact_info = []
    if resume_data.email and resume_data.email != "NA": contact_info.append(resume_data.email)
    if resume_data.phone and resume_data.phone != "NA": contact_info.append(resume_data.phone)
    if resume_data.location and resume_data.location != "NA": contact_info.append(resume_data.location)
    if contact_info:
        story.append(Paragraph(" | ".join(contact_info), style_contact))
    
    # --- Links ---
    links = []
    if resume_data.links:
        def format_link(url, label):
            clean_url = url if url.startswith('http') else f"https://{url}"
            clean_url = clean_url.replace('&', '&amp;')
            return f'<u><a href="{clean_url}"><font color="#1976D2">{label}</font></a></u>'

        if is_valid_profile_link(resume_data.links.linkedin, "linkedin"): 
            links.append(format_link(resume_data.links.linkedin, "LinkedIn"))
        if is_valid_profile_link(resume_data.links.github, "github"): 
            links.append(format_link(resume_data.links.github, "GitHub"))
        if is_valid_profile_link(resume_data.links.portfolio, "portfolio"): 
            links.append(format_link(resume_data.links.portfolio, "Portfolio"))
            
    if links:
        story.append(Paragraph(" | ".join(links), style_contact))
    
    story.append(Spacer(1, 0.04*inch))

    # --- Summary ---
    if resume_data.summary and resume_data.summary != "NA":
        cleaned_summary = resume_data.summary
        if cleaned_summary.startswith('"') and cleaned_summary.endswith('"'):
            cleaned_summary = cleaned_summary[1:-1]
            
        story.append(KeepTogether([
            Paragraph("PROFESSIONAL SUMMARY", style_section_heading),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4),
            Paragraph(cleaned_summary, style_normal),
            Spacer(1, 0.04*inch)
        ]))
    
    # --- Skills ---
    if resume_data.skills and resume_data.skills != ["NA"]:
        skills_list = [s for s in resume_data.skills if s != "NA"]
        
        if skills_list:
            num_columns = 3
            table_data = []
            num_skills = len(skills_list)
            rows = (num_skills + num_columns - 1) // num_columns

            for i in range(rows):
                row_items = []
                for j in range(num_columns):
                    skill_index = i * num_columns + j
                    if skill_index < num_skills:
                        skill_text = f"• {skills_list[skill_index]}"
                        row_items.append(Paragraph(skill_text, style_normal))
                    else:
                        row_items.append(Paragraph("", style_normal))
                table_data.append(row_items)

            if table_data:
                col_width = avail_width / num_columns
                colWidths = [col_width] * num_columns
                
                skills_table = Table(table_data, colWidths=colWidths, hAlign='LEFT')
                skills_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('LEFTPADDING', (0,0), (0,-1), 0),
                    ('LEFTPADDING', (1,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                    ('TOPPADDING', (0,0), (-1,-1), 1),
                ]))
                
                story.append(KeepTogether([
                    Paragraph("SKILLS", style_section_heading),
                    HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4),
                    skills_table,
                    Spacer(1, 0.05*inch)
                ]))
    
    # --- Experience ---
    if resume_data.experience:
        exp_header = [
            Paragraph("PROFESSIONAL EXPERIENCE", style_section_heading),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4)
        ]
        
        first_exp = True
        for exp in resume_data.experience:
            exp_flowables = []
            job_title = f"{exp.job_title}" if exp.job_title != "NA" else ""
            
            company_parts = []
            if exp.company and exp.company != "NA": company_parts.append(exp.company)
            if exp.location and exp.location != "NA": company_parts.append(exp.location)
            company_location = " | ".join(company_parts)
            
            dates = ""
            if exp.start_date and exp.start_date != "NA" and exp.end_date and exp.end_date != "NA": 
                dates = f"{exp.start_date} - {exp.end_date}"
            elif exp.start_date and exp.start_date != "NA": 
                dates = f"{exp.start_date} - Present"
            
            # Combine job title and company location in a unified header table
            job_rows = [
                [Paragraph(job_title, style_job_title), Paragraph(dates, style_dates)]
            ]
            if company_location:
                job_rows.append([Paragraph(company_location, style_company), Paragraph("", style_dates)])
                
            tbl = Table(job_rows, colWidths=[avail_width - 2.0*inch, 2.0*inch], hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            exp_flowables.append(tbl)
            exp_flowables.append(Spacer(1, 0.03*inch))
            
            if exp.description and exp.description != "NA":
                if '\n' in exp.description:
                    bullets = exp.description.split('\n')
                    for bullet in bullets:
                        if bullet.strip():
                            bullet_text = bullet.strip()
                            if not bullet_text.startswith('-') and not bullet_text.startswith('•'):
                                bullet_text = f"• {bullet_text}"
                            elif bullet_text.startswith('-'):
                                bullet_text = f"• {bullet_text[1:].strip()}"
                            
                            exp_flowables.append(Paragraph(bullet_text, style_bullet))
                else:
                    text = exp.description.strip()
                    for abr, placeholder in [("e.g.", "TEMP_EG"), ("i.e.", "TEMP_IE"), ("etc.", "TEMP_ETC"), ("vs.", "TEMP_VS"), ("Ph.D.", "TEMP_PHD"), ("U.S.", "TEMP_US")]:
                        text = text.replace(abr, placeholder)
                    sentences = text.split('. ')
                    for i, sentence in enumerate(sentences):
                        if sentence.strip():
                            for abr, placeholder in [("e.g.", "TEMP_EG"), ("i.e.", "TEMP_IE"), ("etc.", "TEMP_ETC"), ("vs.", "TEMP_VS"), ("Ph.D.", "TEMP_PHD"), ("U.S.", "TEMP_US")]:
                                sentence = sentence.replace(placeholder, abr)
                            if i < len(sentences) - 1 or not sentence[-1] in ['.', '!', '?']:
                                sentence = sentence + '.'
                            exp_flowables.append(Paragraph(f"• {sentence.strip()}", style_bullet))
            
            exp_flowables.append(Spacer(1, 0.06*inch))
            
            if first_exp:
                # Bind section heading with the first experience so it never orphans at bottom of page
                story.append(KeepTogether(exp_header + exp_flowables))
                first_exp = False
            else:
                story.append(KeepTogether(exp_flowables))
    
    # --- Education ---
    if resume_data.education:
        edu_header = [
            Paragraph("EDUCATION", style_section_heading),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4)
        ]
        
        first_edu = True
        for edu in resume_data.education:
            edu_flowables = []
            degree_info = f"<b>{edu.degree}</b>" if edu.degree != "NA" else ""
            if edu.field_of_study and edu.field_of_study != "NA": 
                degree_info += f", {edu.field_of_study}"
            
            years = ""
            if edu.start_year and edu.start_year != "NA" and edu.end_year and edu.end_year != "NA": 
                years = f"{edu.start_year} - {edu.end_year}"
            elif edu.start_year and edu.start_year != "NA": 
                years = f"Started {edu.start_year}"
            elif edu.end_year and edu.end_year != "NA": 
                years = f"Graduated {edu.end_year}"
            
            edu_rows = [
                [Paragraph(degree_info, style_normal), Paragraph(years, style_dates)]
            ]
            if edu.institution and edu.institution != "NA":
                edu_rows.append([Paragraph(edu.institution, style_normal), Paragraph("", style_dates)])
                
            tbl = Table(edu_rows, colWidths=[avail_width - 1.8*inch, 1.8*inch], hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
            ]))
            edu_flowables.append(tbl)
            edu_flowables.append(Spacer(1, 0.05*inch))
            
            if first_edu:
                # Bind section heading with first education item
                story.append(KeepTogether(edu_header + edu_flowables))
                first_edu = False
            else:
                story.append(KeepTogether(edu_flowables))
    
    # --- Projects ---
    if resume_data.projects:
        proj_header = [
            Paragraph("PROJECTS", style_section_heading),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4)
        ]
        
        first_proj = True
        for proj in resume_data.projects:
            proj_flowables = []
            if proj.name and proj.name != "NA":
                proj_flowables.append(Paragraph(f"<b>{proj.name}</b>", style_job_title))
            
            # Technologies right below header before description
            if proj.technologies and proj.technologies != ["NA"]:
                tech_list = [t for t in proj.technologies if t != "NA"]
                if tech_list:
                    tech_text = f"<i>Technologies:</i> {', '.join(tech_list)}"
                    proj_flowables.append(Paragraph(tech_text, style_tech))

            if proj.description and proj.description != "NA":
                if '\n' in proj.description:
                    bullets = proj.description.split('\n')
                    for bullet in bullets:
                        if bullet.strip():
                            bullet_text = bullet.strip()
                            if not bullet_text.startswith('-') and not bullet_text.startswith('•'):
                                bullet_text = f"• {bullet_text}"
                            elif bullet_text.startswith('-'):
                                bullet_text = f"• {bullet_text[1:].strip()}"
                            proj_flowables.append(Paragraph(bullet_text, style_bullet))
                else:
                    text = proj.description.strip()
                    sentences = [s.strip() for s in text.split('.') if s.strip()]
                    for s in sentences:
                        proj_flowables.append(Paragraph(f"• {s}.", style_bullet))
            
            proj_flowables.append(Spacer(1, 0.05*inch))
            
            if first_proj:
                # Bind section heading with first project item so PROJECTS is never stranded at page bottom
                story.append(KeepTogether(proj_header + proj_flowables))
                first_proj = False
            else:
                story.append(KeepTogether(proj_flowables))
    
    # --- Certifications ---
    if resume_data.certifications:
        cert_header = [
            Paragraph("CERTIFICATIONS", style_section_heading),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4)
        ]
        
        first_cert = True
        for cert in resume_data.certifications:
            if (not cert.name or cert.name == "NA") and (not cert.issuer or cert.issuer == "NA"):
                continue

            cert_flowables = []
            cert_name = f"<b>{cert.name}</b>" if cert.name and cert.name != "NA" else ""
            year_text = cert.year if cert.year and cert.year != "NA" else ""
            
            # Combine cert name, issuer, and year into a single unified table structure
            table_rows = [
                [Paragraph(cert_name, style_normal), Paragraph(year_text, style_dates)]
            ]
            if cert.issuer and cert.issuer != "NA":
                table_rows.append([Paragraph(cert.issuer, style_company), Paragraph("", style_dates)])

            tbl = Table(table_rows, colWidths=[avail_width - 1.8*inch, 1.8*inch], hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
            ]))
            cert_flowables.append(tbl)
            cert_flowables.append(Spacer(1, 0.04*inch))

            if first_cert:
                # Bind section heading with first certification item
                story.append(KeepTogether(cert_header + cert_flowables))
                first_cert = False
            else:
                story.append(KeepTogether(cert_flowables))
    
    # --- Languages ---
    if resume_data.languages and resume_data.languages != ["NA"]:
        lang_list = [l for l in resume_data.languages if l != "NA"]
        if lang_list:
            story.append(KeepTogether([
                Paragraph("LANGUAGES", style_section_heading),
                HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=4),
                Paragraph(", ".join(lang_list), style_normal)
            ]))
    
    try:
        doc.build(story)
        logging.info("PDF generated successfully.")
    except Exception as e:
        logging.error(f"Error building PDF: {e}")
        raise
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
