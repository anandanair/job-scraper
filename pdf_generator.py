import io
import logging
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.lib import colors
from models import Resume 

logging.basicConfig(level=logging.INFO)

def create_resume_pdf(resume_data: Resume) -> bytes:
    """
    Generates an ATS-friendly PDF resume with improved design from the provided Resume data object.
    Returns the PDF content as bytes.
    """
    buffer = io.BytesIO()
    
    # Document setup with slightly wider margins for better readability
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        leftMargin=0.6*inch, 
        rightMargin=0.6*inch,
        topMargin=0.6*inch, 
        bottomMargin=0.6*inch
    )
    
    # Create custom styles
    styles = getSampleStyleSheet()
    
    # Define a modern color palette
    primary_color = colors.HexColor('#1976D2')  # Modern blue
    secondary_color = colors.HexColor('#455A64')  # Dark blue-gray
    accent_color = colors.HexColor('#03A9F4')  # Light blue
    text_color = colors.HexColor('#212121')  # Near black
    light_text = colors.HexColor('#757575')  # Medium gray
    background_color = colors.HexColor('#F5F5F5')  # Light gray background
    
    # Create custom styles using ReportLab's built-in fonts
    style_name = ParagraphStyle(
        name='Name',
        parent=styles['Heading1'],
        fontSize=26,
        alignment=TA_LEFT,
        spaceAfter=10,
        fontName='Helvetica-Bold',
        textColor=primary_color,
    )
    
    style_section_heading = ParagraphStyle(
        name='SectionHeading',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=4,
        fontName='Helvetica-Bold',
        textColor=primary_color,
        alignment=TA_LEFT,
    )
    
    style_normal = ParagraphStyle(
        name='Normal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,  
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
        fontSize=12,  
        spaceAfter=4,
        fontName='Helvetica-Bold',
        textColor=primary_color,  
    )
    
    style_company = ParagraphStyle(
        name='Company',
        parent=styles['Normal'],
        spaceBefore=2,
        fontSize=10,
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
        fontSize=10,
        leading=14,
        leftIndent=15,
        bulletIndent=0,
        fontName='Helvetica',
        textColor=text_color,
        spaceAfter=4,
    )

    style_tech = ParagraphStyle(
        name='Technologies',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Helvetica-Oblique',
        textColor=light_text,
        spaceAfter=8,
    )
    
    story = []

    # --- Header ---
    if resume_data.name:
        story.append(Paragraph(resume_data.name.upper(), style_name))

    
    # --- Contact Information ---
    contact_info = []
    if resume_data.email: contact_info.append(resume_data.email)
    if resume_data.phone: contact_info.append(resume_data.phone)
    if resume_data.location: contact_info.append(resume_data.location)
    if contact_info:
        story.append(Paragraph(" | ".join(contact_info), style_contact))
    
    # --- Links ---
    links = []
    if resume_data.links:
        if resume_data.links.linkedin: links.append(f"LinkedIn: {resume_data.links.linkedin}")
        if resume_data.links.github: links.append(f"GitHub: {resume_data.links.github}")
        if resume_data.links.portfolio: links.append(f"Portfolio: {resume_data.links.portfolio}")
    if links:
        story.append(Paragraph(" | ".join(links), style_contact))
    
    # --- Summary ---
    if resume_data.summary:
        story.append(Paragraph("PROFESSIONAL SUMMARY", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        # Remove leading/trailing double quotes from summary if they exist
        cleaned_summary = resume_data.summary
        if cleaned_summary.startswith('"') and cleaned_summary.endswith('"'):
            cleaned_summary = cleaned_summary[1:-1]
            
        story.append(Paragraph(cleaned_summary, style_normal))
    
    # --- Skills ---
    if resume_data.skills:
        story.append(Paragraph("SKILLS", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        skills_list = resume_data.skills
        if skills_list: # Ensure there are skills to process
            num_columns = 3  # We'll use a 3-column layout
            
            # Prepare data for the table
            table_data = []
            num_skills = len(skills_list)
            # Calculate number of rows needed (ceiling division)
            rows = (num_skills + num_columns - 1) // num_columns

            for i in range(rows):
                row_items = []
                for j in range(num_columns):
                    skill_index = i * num_columns + j # This fills row by row
                    if skill_index < num_skills:
                        skill_text = f"• {skills_list[skill_index]}" # Add a bullet point
                        row_items.append(Paragraph(skill_text, style_normal))
                    else:
                        row_items.append(Paragraph("", style_normal)) # Empty cell for padding
                table_data.append(row_items)

            if table_data:
                # Calculate available width for the table
                page_width_available = letter[0] - doc.leftMargin - doc.rightMargin
                col_width = page_width_available / num_columns
                
                # Define column widths for the table
                colWidths = [col_width] * num_columns
                
                skills_table = Table(table_data, colWidths=colWidths)
                skills_table.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),          # Align content to the top of cells
                    ('LEFTPADDING', (0,0), (0,-1), 10),         # No left padding for cells
                    ('RIGHTPADDING', (0,0), (-1,-1), 6),        # Padding between columns (applied to right of each cell)
                    ('BOTTOMPADDING', (0,0), (-1,-1), 3),       # Padding below each row
                    # ('GRID', (0,0), (-1,-1), 0.5, colors.red) # Uncomment for debugging table layout
                ]))
                story.append(skills_table)
                story.append(Spacer(1, 0.1*inch)) # Add some space after the skills section
    
    # --- Experience ---
    if resume_data.experience:
        story.append(Paragraph("PROFESSIONAL EXPERIENCE", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        for exp in resume_data.experience:
            # Create a table for job header to align job title and dates
            job_title = f"{exp.job_title}"
            if exp.company and exp.location:
                company_location = f"{exp.company} | {exp.location}"
            elif exp.company:
                company_location = exp.company
            else:
                company_location = ""
            
            dates = ""
            if exp.start_date and exp.end_date: 
                dates = f"{exp.start_date} - {exp.end_date}"
            elif exp.start_date: 
                dates = f"{exp.start_date} - Present"
            
            # Create two-column layout for position details
            data = [[Paragraph(job_title, style_job_title), Paragraph(dates, style_dates)]]
            tbl = Table(data, colWidths=[4.636*inch, 2.5*inch])
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),  # Reduce padding for tighter layout
                ('LEFTPADDING', (0, 0), (0, -1), 0),  # No left padding for the first column
            ]))
            story.append(tbl)
            
            story.append(Paragraph(company_location, style_company))
            story.append(Spacer(1, 0.1*inch))
            
            if exp.description:
                # First check if the description is already in bullets format by looking for newlines
                if '\n' in exp.description:
                    # Handle existing bullet points for responsibilities/achievements
                    bullets = exp.description.split('\n')
                    for bullet in bullets:
                        if bullet.strip():  # Skip empty lines
                            # Handle bullet formatting - ensure proper bullet point
                            bullet_text = bullet.strip()
                            if not bullet_text.startswith('-') and not bullet_text.startswith('•'):
                                bullet_text = f"• {bullet_text}"
                            elif bullet_text.startswith('-'):
                                bullet_text = f"• {bullet_text[1:].strip()}"
                            
                            story.append(Paragraph(bullet_text, style_bullet))
                else:
                    # Split a paragraph into sentences and make each sentence a bullet point
                    # This handles periods followed by a space as sentence delimiters
                    # Also handles common abbreviations like "e.g.", "i.e.", "etc."
                    text = exp.description.strip()
                    
                    # Replace common abbreviations temporarily to avoid splitting at their periods
                    text = text.replace("e.g.", "TEMP_EG")
                    text = text.replace("i.e.", "TEMP_IE")
                    text = text.replace("etc.", "TEMP_ETC")
                    text = text.replace("vs.", "TEMP_VS")
                    text = text.replace("Mr.", "TEMP_MR")
                    text = text.replace("Mrs.", "TEMP_MRS")
                    text = text.replace("Ms.", "TEMP_MS")
                    text = text.replace("Dr.", "TEMP_DR")
                    text = text.replace("St.", "TEMP_ST")
                    text = text.replace("Ph.D.", "TEMP_PHD")
                    text = text.replace("U.S.", "TEMP_US")
                    text = text.replace("U.K.", "TEMP_UK")
                    
                    # Split by periods
                    sentences = text.split('. ')
                    
                    # Process each sentence
                    for i, sentence in enumerate(sentences):
                        if sentence:
                            # Restore abbreviations
                            sentence = sentence.replace("TEMP_EG", "e.g.")
                            sentence = sentence.replace("TEMP_IE", "i.e.")
                            sentence = sentence.replace("TEMP_ETC", "etc.")
                            sentence = sentence.replace("TEMP_VS", "vs.")
                            sentence = sentence.replace("TEMP_MR", "Mr.")
                            sentence = sentence.replace("TEMP_MRS", "Mrs.")
                            sentence = sentence.replace("TEMP_MS", "Ms.")
                            sentence = sentence.replace("TEMP_DR", "Dr.")
                            sentence = sentence.replace("TEMP_ST", "St.")
                            sentence = sentence.replace("TEMP_PHD", "Ph.D.")
                            sentence = sentence.replace("TEMP_US", "U.S.")
                            sentence = sentence.replace("TEMP_UK", "U.K.")
                            
                            # Add period back if it's not the last sentence or if the last sentence doesn't end with punctuation
                            if i < len(sentences) - 1 or not sentence[-1] in ['.', '!', '?']:
                                sentence = sentence + '.'
                                
                            story.append(Paragraph(f"• {sentence.strip()}", style_bullet))
            
            story.append(Spacer(1, 0.15*inch))
    
    # --- Education ---
    if resume_data.education:
        story.append(Paragraph("EDUCATION", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        for edu in resume_data.education:
            # Degree info
            degree_info = f"<b>{edu.degree}</b>"
            if edu.field_of_study: 
                degree_info += f", {edu.field_of_study}"
            
            # Year info
            years = ""
            if edu.start_year and edu.end_year: 
                years = f"{edu.start_year} - {edu.end_year}"
            elif edu.start_year: 
                years = f"Started {edu.start_year}"
            elif edu.end_year: 
                years = f"Graduated {edu.end_year}"
            
            # Create two-column layout
            data = [[Paragraph(degree_info, style_normal), Paragraph(years, style_dates)]]
            tbl = Table(data, colWidths=[5.15*inch, 2*inch])
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (0, -1), 0),
            ]))
            story.append(tbl)
            
            story.append(Paragraph(edu.institution, style_normal))
            story.append(Spacer(1, 0.15*inch))
    
    # --- Projects ---
    if resume_data.projects:
        story.append(Paragraph("PROJECTS", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        for proj in resume_data.projects:
            story.append(Paragraph(f"<b>{proj.name}</b>", style_job_title))
            
            if proj.description:
                # Check if the description is already in bullets format by looking for newlines
                if '\n' in proj.description:
                    bullets = proj.description.split('\n')
                    for bullet in bullets:
                        if bullet.strip():
                            bullet_text = bullet.strip()
                            if not bullet_text.startswith('-') and not bullet_text.startswith('•'):
                                bullet_text = f"• {bullet_text}"
                            elif bullet_text.startswith('-'):
                                bullet_text = f"• {bullet_text[1:].strip()}"
                            story.append(Paragraph(bullet_text, style_bullet))
                else:
                    # Split a paragraph into sentences and make each sentence a bullet point
                    text = proj.description.strip()
                    
                    # Replace common abbreviations temporarily to avoid splitting at their periods
                    text = text.replace("e.g.", "TEMP_EG")
                    text = text.replace("i.e.", "TEMP_IE")
                    text = text.replace("etc.", "TEMP_ETC")
                    text = text.replace("vs.", "TEMP_VS")
                    text = text.replace("Mr.", "TEMP_MR")
                    text = text.replace("Mrs.", "TEMP_MRS")
                    text = text.replace("Ms.", "TEMP_MS")
                    text = text.replace("Dr.", "TEMP_DR")
                    text = text.replace("St.", "TEMP_ST")
                    text = text.replace("Ph.D.", "TEMP_PHD")
                    text = text.replace("U.S.", "TEMP_US")
                    text = text.replace("U.K.", "TEMP_UK")
                    
                    # Split by periods followed by a space, or just periods if it's the end of the string
                    sentences = []
                    current_sentence = ""
                    for char in text:
                        current_sentence += char
                        if char == '.':
                            # Check if the next char is a space or end of string
                            # This is a simplified approach; more robust sentence tokenization might be needed for complex cases
                            if text.index(current_sentence) + len(current_sentence) == len(text) or \
                               (text.index(current_sentence) + len(current_sentence) < len(text) and \
                                text[text.index(current_sentence) + len(current_sentence)] == ' '):
                                sentences.append(current_sentence.strip())
                                current_sentence = ""
                    if current_sentence.strip(): # Add any remaining part
                        sentences.append(current_sentence.strip())

                    # If splitting by ". " resulted in no sentences (e.g. single sentence without trailing space after period)
                    # or if the original text didn't contain ". "
                    if not sentences or (len(sentences) == 1 and sentences[0] == text):
                        # Fallback to splitting by just "." if ". " fails or if it's a single block
                        sentences = [s.strip() for s in text.split('.') if s.strip()]
                        # Add back periods if they were removed, except for the last sentence if it was already punctuated
                        for i in range(len(sentences)):
                            if i < len(sentences) -1: # Add period to all but the last
                                sentences[i] = sentences[i] + "."
                            elif not sentences[i].endswith(('.', '!', '?')): # Add to last if no punctuation
                                 sentences[i] = sentences[i] + "."


                    for i, sentence in enumerate(sentences):
                        if sentence:
                            # Restore abbreviations
                            sentence = sentence.replace("TEMP_EG", "e.g.")
                            sentence = sentence.replace("TEMP_IE", "i.e.")
                            sentence = sentence.replace("TEMP_ETC", "etc.")
                            sentence = sentence.replace("TEMP_VS", "vs.")
                            sentence = sentence.replace("TEMP_MR", "Mr.")
                            sentence = sentence.replace("TEMP_MRS", "Mrs.")
                            sentence = sentence.replace("TEMP_MS", "Ms.")
                            sentence = sentence.replace("TEMP_DR", "Dr.")
                            sentence = sentence.replace("TEMP_ST", "St.")
                            sentence = sentence.replace("TEMP_PHD", "Ph.D.")
                            sentence = sentence.replace("TEMP_US", "U.S.")
                            sentence = sentence.replace("TEMP_UK", "U.K.")
                            
                            # Ensure sentence ends with a period if it was split by ". " and it's not the last part
                            # or if it doesn't have terminal punctuation
                            if not sentence.endswith(('.', '!', '?')):
                                sentence += '.'
                                
                            story.append(Paragraph(f"• {sentence.strip()}", style_bullet))
            
            if proj.technologies:
                tech_text = f"<i>Technologies:</i> {', '.join(proj.technologies)}"
                story.append(Paragraph(tech_text, style_tech))
            
            story.append(Spacer(1, 0.15*inch))
    
    # --- Certifications ---
    if resume_data.certifications:
        story.append(Paragraph("CERTIFICATIONS", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        
        for cert in resume_data.certifications:
            cert_info = f"<b>{cert.name}</b>"
            
            # Right aligned year if available
            year_text = ""
            if cert.year:
                year_text = cert.year
            
            # Create a table for certification info
            data = [[Paragraph(cert_info, style_normal), Paragraph(year_text, style_dates)]]
            tbl = Table(data, colWidths=[5.3*inch, 2*inch])
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(tbl)
            
            if cert.issuer:
                story.append(Paragraph(cert.issuer, style_normal))
            
            story.append(Spacer(1, 0.1*inch))
    
    # --- Languages ---
    if resume_data.languages:
        story.append(Paragraph("LANGUAGES", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2C3E50'), spaceBefore=0, spaceAfter=8))
        story.append(Paragraph(", ".join(resume_data.languages), style_normal))
    
    try:
        doc.build(story)
        logging.info("PDF generated successfully.")
    except Exception as e:
        logging.error(f"Error building PDF: {e}")
        raise  # Re-raise the exception
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes