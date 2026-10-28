import io
import logging
from typing import Optional, Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    HRFlowable,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.lib import colors
from models import Resume
import supabase_utils

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

    normalized = u.lower().rstrip("/")
    for prefix in ("https://", "http://", "//"):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
    if normalized.startswith("www."):
        normalized = normalized[4:]

    if platform == "github":
        if normalized in ("github.com", ""):
            return False
        parts = normalized.split("github.com/")
        if len(parts) < 2 or not parts[1].strip("/"):
            return False
    elif platform == "linkedin":
        if normalized in ("linkedin.com", "linkedin.com/in", ""):
            return False
        parts = normalized.split("linkedin.com/in/")
        if len(parts) >= 2:
            if not parts[1].strip("/"):
                return False
        else:
            parts = normalized.split("linkedin.com/")
            if len(parts) < 2 or not parts[1].strip("/"):
                return False
    elif platform == "portfolio":
        if normalized in ("portfolio.com", "myportfolio.com", ""):
            return False

    return True


def _get_font_names(family: str) -> Dict[str, str]:
    if family == "Times-Roman":
        return {
            "regular": "Times-Roman",
            "bold": "Times-Bold",
            "italic": "Times-Italic",
            "boldItalic": "Times-BoldItalic",
        }
    elif family == "Courier":
        return {
            "regular": "Courier",
            "bold": "Courier-Bold",
            "italic": "Courier-Oblique",
            "boldItalic": "Courier-BoldOblique",
        }
    return {
        "regular": "Helvetica",
        "bold": "Helvetica-Bold",
        "italic": "Helvetica-Oblique",
        "boldItalic": "Helvetica-BoldOblique",
    }


def _get_margins(margin_option: str):
    if margin_option == "compact":
        return 0.4 * inch, 0.4 * inch, 0.35 * inch, 0.35 * inch
    elif margin_option == "wide":
        return 0.6 * inch, 0.6 * inch, 0.6 * inch, 0.6 * inch
    return 0.5 * inch, 0.5 * inch, 0.45 * inch, 0.45 * inch


def create_resume_pdf(
    resume_data: Resume, style_config: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Generates an ATS-friendly PDF resume using the provided Resume data object
    and active style configuration (colors, typography, margins, section ordering).
    """
    if style_config is None:
        style_config = supabase_utils.get_active_resume_style()

    buffer = io.BytesIO()

    # Typography & Colors
    typography = style_config.get("typography", {})
    font_family_opt = typography.get("fontFamily", "Helvetica")
    fonts = _get_font_names(font_family_opt)
    font_scale = typography.get("fontSizeScale", "normal")
    line_spacing = typography.get("lineSpacing", "normal")

    colors_cfg = style_config.get("colors", {})
    primary_color = colors.HexColor(colors_cfg.get("primary", "#1976D2"))
    secondary_color = colors.HexColor(colors_cfg.get("secondary", "#455A64"))
    text_color = colors.HexColor(colors_cfg.get("text", "#212121"))
    light_text = colors.HexColor(colors_cfg.get("light", "#757575"))
    divider_color = colors.HexColor(colors_cfg.get("divider", "#2C3E50"))

    layout_cfg = style_config.get("layout", {})
    header_align_opt = layout_cfg.get("headerAlignment", "left")
    header_style_opt = layout_cfg.get("headerStyle")
    if not header_style_opt:
        header_style_opt = "stacked_center" if header_align_opt == "center" else "stacked_left"
    header_alignment = TA_CENTER if header_style_opt == "stacked_center" else TA_LEFT
    prof_title = layout_cfg.get("professionalTitle", "").strip() if layout_cfg.get("professionalTitle") else ""
    show_dividers = layout_cfg.get("showDividers", True)
    divider_thickness = layout_cfg.get("dividerThickness", 1)
    skills_layout = layout_cfg.get("skillsLayout", "grid_3col")
    margins_opt = layout_cfg.get("margins", "normal")
    section_order = layout_cfg.get(
        "sectionOrder",
        [
            "summary",
            "skills",
            "experience",
            "education",
            "projects",
            "certifications",
            "languages",
        ],
    )

    # Margin setup
    left_m, right_m, top_m, bottom_m = _get_margins(margins_opt)

    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=left_m,
        rightMargin=right_m,
        topMargin=top_m,
        bottomMargin=bottom_m,
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
        id="normal",
    )
    template = PageTemplate(id="resume_page", frames=frame)
    doc.addPageTemplates([template])

    avail_width = doc.width

    # Font size scale mappings
    if font_scale == "compact":
        name_size, heading_size, body_size, meta_size = 22, 10.5, 9.0, 8.0
    elif font_scale == "spacious":
        name_size, heading_size, body_size, meta_size = 26, 12.5, 10.0, 9.0
    else:  # normal
        name_size, heading_size, body_size, meta_size = 24, 11.0, 9.5, 8.5

    leading_mult = 1.2 if line_spacing == "tight" else (1.5 if line_spacing == "relaxed" else 1.35)

    styles = getSampleStyleSheet()

    style_name = ParagraphStyle(
        name="Name",
        parent=styles["Heading1"],
        fontSize=name_size,
        alignment=header_alignment,
        spaceAfter=3,
        fontName=fonts["bold"],
        textColor=primary_color,
    )

    style_prof_title = ParagraphStyle(
        name="ProfTitle",
        parent=styles["Normal"],
        fontSize=heading_size + 1,
        alignment=header_alignment,
        spaceAfter=4,
        fontName=fonts["bold"],
        textColor=secondary_color,
    )

    style_name_left = ParagraphStyle(
        name="NameLeft",
        parent=styles["Heading1"],
        fontSize=name_size * 0.95,
        alignment=TA_LEFT,
        spaceAfter=2,
        fontName=fonts["bold"],
        textColor=primary_color,
    )

    style_prof_title_left = ParagraphStyle(
        name="ProfTitleLeft",
        parent=styles["Normal"],
        fontSize=heading_size,
        alignment=TA_LEFT,
        spaceAfter=2,
        fontName=fonts["bold"],
        textColor=secondary_color,
    )

    style_contact_right = ParagraphStyle(
        name="ContactRight",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=meta_size + 0.5,
        leading=(meta_size + 0.5) * 1.3,
        spaceAfter=2,
        textColor=secondary_color,
    )

    style_section_heading = ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontSize=heading_size,
        spaceBefore=7,
        spaceAfter=2,
        fontName=fonts["bold"],
        textColor=primary_color,
        alignment=TA_LEFT,
        keepWithNext=True,
    )

    style_normal = ParagraphStyle(
        name="Normal",
        parent=styles["Normal"],
        fontSize=body_size,
        leading=body_size * leading_mult,
        fontName=fonts["regular"],
        textColor=text_color,
    )

    style_contact = ParagraphStyle(
        name="Contact",
        parent=styles["Normal"],
        alignment=header_alignment,
        fontSize=meta_size + 0.5,
        leading=(meta_size + 0.5) * 1.3,
        spaceAfter=2,
        textColor=secondary_color,
    )

    style_job_title = ParagraphStyle(
        name="JobTitle",
        parent=styles["Normal"],
        fontSize=body_size + 1.5,
        spaceAfter=2,
        fontName=fonts["bold"],
        textColor=primary_color,
    )

    style_company = ParagraphStyle(
        name="Company",
        parent=styles["Normal"],
        spaceBefore=1,
        fontSize=body_size,
        fontName=fonts["bold"],
        textColor=secondary_color,
    )

    style_dates = ParagraphStyle(
        name="Dates",
        parent=styles["Normal"],
        fontSize=meta_size + 0.5,
        alignment=TA_RIGHT,
        fontName=fonts["italic"],
        textColor=light_text,
    )

    style_bullet = ParagraphStyle(
        name="Bullet",
        parent=styles["Normal"],
        fontSize=body_size,
        leading=body_size * leading_mult,
        leftIndent=12,
        bulletIndent=0,
        fontName=fonts["regular"],
        textColor=text_color,
        spaceAfter=2,
    )

    style_tech = ParagraphStyle(
        name="Technologies",
        parent=styles["Normal"],
        fontSize=meta_size,
        leading=meta_size * 1.3,
        fontName=fonts["italic"],
        textColor=light_text,
        spaceAfter=3,
    )

    story: List[Any] = []

    # --- Contact Information & Links Preparation ---
    contact_info = []
    if resume_data.email and resume_data.email != "NA":
        contact_info.append(resume_data.email)
    if resume_data.phone and resume_data.phone != "NA":
        contact_info.append(resume_data.phone)
    if resume_data.location and resume_data.location != "NA":
        contact_info.append(resume_data.location)

    links = []
    if resume_data.links:
        hex_primary = colors_cfg.get("primary", "#1976D2")

        def format_link(url, label):
            clean_url = url if url.startswith("http") else f"https://{url}"
            clean_url = clean_url.replace("&", "&amp;")
            return f'<u><a href="{clean_url}"><font color="{hex_primary}">{label}</font></a></u>'

        if is_valid_profile_link(resume_data.links.linkedin, "linkedin"):
            links.append(format_link(resume_data.links.linkedin, "LinkedIn"))
        if is_valid_profile_link(resume_data.links.github, "github"):
            links.append(format_link(resume_data.links.github, "GitHub"))
        if is_valid_profile_link(resume_data.links.portfolio, "portfolio"):
            links.append(format_link(resume_data.links.portfolio, "Portfolio"))

    # --- Header Render by header_style_opt ---
    if header_style_opt == "split_twocol":
        left_flowables = []
        if resume_data.name:
            left_flowables.append(Paragraph(resume_data.name.upper(), style_name_left))
        if prof_title:
            left_flowables.append(Paragraph(prof_title, style_prof_title_left))

        right_flowables = []
        if contact_info:
            right_flowables.append(Paragraph(" | ".join(contact_info), style_contact_right))
        if links:
            right_flowables.append(Paragraph(" | ".join(links), style_contact_right))

        header_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=[avail_width * 0.58, avail_width * 0.42],
            hAlign="LEFT",
        )
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(header_table)
    else:
        if resume_data.name:
            story.append(Paragraph(resume_data.name.upper(), style_name))
        if prof_title:
            story.append(Paragraph(prof_title, style_prof_title))
        if contact_info:
            story.append(Paragraph(" | ".join(contact_info), style_contact))
        if links:
            story.append(Paragraph(" | ".join(links), style_contact))

    story.append(Spacer(1, 0.05 * inch))

    heading_style = layout_cfg.get("headingStyle", "underline")

    # Helper for section dividers
    def create_section_header(title: str):
        if heading_style == "left_bar":
            bar_table = Table(
                [[Paragraph("", style_normal), Paragraph(f"<b>{title}</b>", style_section_heading)]],
                colWidths=[4, avail_width - 4],
                hAlign="LEFT",
            )
            bar_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, 0), primary_color),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 1),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                        ("LEFTPADDING", (1, 0), (1, 0), 6),
                    ]
                )
            )
            return [Spacer(1, 0.04 * inch), bar_table, Spacer(1, 0.04 * inch)]
        elif heading_style == "shaded_pill":
            tint_color = colors.Color(
                primary_color.red, primary_color.green, primary_color.blue, alpha=0.12
            )
            pill_table = Table(
                [[Paragraph(f"<b>{title}</b>", style_section_heading)]],
                colWidths=[avail_width],
                hAlign="LEFT",
            )
            pill_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, 0), tint_color),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]
                )
            )
            return [Spacer(1, 0.04 * inch), pill_table, Spacer(1, 0.04 * inch)]
        elif heading_style == "borderless":
            return [Paragraph(title, style_section_heading), Spacer(1, 0.04 * inch)]
        else:
            flowables = [Paragraph(title, style_section_heading)]
            if show_dividers:
                flowables.append(
                    HRFlowable(
                        width="100%",
                        thickness=divider_thickness,
                        color=divider_color,
                        spaceBefore=0,
                        spaceAfter=4,
                    )
                )
            return flowables

    # --- Section Renderers ---

    def render_summary_story(title: str = "PROFESSIONAL SUMMARY"):
        if resume_data.summary and resume_data.summary != "NA":
            cleaned_summary = resume_data.summary
            if cleaned_summary.startswith('"') and cleaned_summary.endswith('"'):
                cleaned_summary = cleaned_summary[1:-1]
            hdr = create_section_header(title)
            story.append(
                KeepTogether(
                    hdr
                    + [
                        Paragraph(cleaned_summary, style_normal),
                        Spacer(1, 0.04 * inch),
                    ]
                )
            )

    def render_skills_story(title: str = "SKILLS"):
        if resume_data.skills and resume_data.skills != ["NA"]:
            skills_list = [s for s in resume_data.skills if s != "NA"]
            if skills_list:
                hdr = create_section_header(title)
                if skills_layout == "inline_wrap":
                    skills_text = "  •  ".join(skills_list)
                    story.append(
                        KeepTogether(
                            hdr
                            + [
                                Paragraph(skills_text, style_normal),
                                Spacer(1, 0.05 * inch),
                            ]
                        )
                    )
                else:
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
                        col_widths = [col_width] * num_columns
                        skills_table = Table(
                            table_data, colWidths=col_widths, hAlign="LEFT"
                        )
                        skills_table.setStyle(
                            TableStyle(
                                [
                                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                    ("LEFTPADDING", (0, 0), (0, -1), 0),
                                    ("LEFTPADDING", (1, 0), (-1, -1), 8),
                                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                                ]
                            )
                        )
                        story.append(
                            KeepTogether(
                                hdr
                                + [
                                    skills_table,
                                    Spacer(1, 0.05 * inch),
                                ]
                            )
                        )

    def render_experience_story(title: str = "PROFESSIONAL EXPERIENCE"):
        if resume_data.experience:
            exp_header = create_section_header(title)
            first_exp = True
            for exp in resume_data.experience:
                exp_flowables = []
                job_title = f"{exp.job_title}" if exp.job_title != "NA" else ""

                company_parts = []
                if exp.company and exp.company != "NA":
                    company_parts.append(exp.company)
                if exp.location and exp.location != "NA":
                    company_parts.append(exp.location)
                company_location = " | ".join(company_parts)

                dates = ""
                if (
                    exp.start_date
                    and exp.start_date != "NA"
                    and exp.end_date
                    and exp.end_date != "NA"
                ):
                    dates = f"{exp.start_date} - {exp.end_date}"
                elif exp.start_date and exp.start_date != "NA":
                    dates = f"{exp.start_date} - Present"

                job_rows = [
                    [
                        Paragraph(job_title, style_job_title),
                        Paragraph(dates, style_dates),
                    ]
                ]
                if company_location:
                    job_rows.append(
                        [
                            Paragraph(company_location, style_company),
                            Paragraph("", style_dates),
                        ]
                    )

                tbl = Table(
                    job_rows,
                    colWidths=[avail_width - 2.0 * inch, 2.0 * inch],
                    hAlign="LEFT",
                )
                tbl.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                            ("TOPPADDING", (0, 0), (-1, -1), 1),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ]
                    )
                )
                exp_flowables.append(tbl)
                exp_flowables.append(Spacer(1, 0.03 * inch))

                if exp.description and exp.description != "NA":
                    if "\n" in exp.description:
                        bullets = exp.description.split("\n")
                        for bullet in bullets:
                            if bullet.strip():
                                b_text = bullet.strip()
                                if not b_text.startswith("-") and not b_text.startswith("•"):
                                    b_text = f"• {b_text}"
                                elif b_text.startswith("-"):
                                    b_text = f"• {b_text[1:].strip()}"
                                exp_flowables.append(Paragraph(b_text, style_bullet))
                    else:
                        text = exp.description.strip()
                        for abr, placeholder in [
                            ("e.g.", "TEMP_EG"),
                            ("i.e.", "TEMP_IE"),
                            ("etc.", "TEMP_ETC"),
                            ("vs.", "TEMP_VS"),
                            ("Ph.D.", "TEMP_PHD"),
                            ("U.S.", "TEMP_US"),
                        ]:
                            text = text.replace(abr, placeholder)
                        sentences = text.split(". ")
                        for i, sentence in enumerate(sentences):
                            if sentence.strip():
                                for abr, placeholder in [
                                    ("e.g.", "TEMP_EG"),
                                    ("i.e.", "TEMP_IE"),
                                    ("etc.", "TEMP_ETC"),
                                    ("vs.", "TEMP_VS"),
                                    ("Ph.D.", "TEMP_PHD"),
                                    ("U.S.", "TEMP_US"),
                                ]:
                                    sentence = sentence.replace(placeholder, abr)
                                if i < len(sentences) - 1 or not sentence[-1] in [".", "!", "?"]:
                                    sentence = sentence + "."
                                exp_flowables.append(Paragraph(f"• {sentence.strip()}", style_bullet))

                exp_flowables.append(Spacer(1, 0.06 * inch))

                if first_exp:
                    story.append(KeepTogether(exp_header + exp_flowables))
                    first_exp = False
                else:
                    story.append(KeepTogether(exp_flowables))

    def render_education_story(title: str = "EDUCATION"):
        if resume_data.education:
            edu_header = create_section_header(title)
            first_edu = True
            for edu in resume_data.education:
                edu_flowables = []
                degree_info = f"<b>{edu.degree}</b>" if edu.degree != "NA" else ""
                if edu.field_of_study and edu.field_of_study != "NA":
                    degree_info += f", {edu.field_of_study}"

                years = ""
                if (
                    edu.start_year
                    and edu.start_year != "NA"
                    and edu.end_year
                    and edu.end_year != "NA"
                ):
                    years = f"{edu.start_year} - {edu.end_year}"
                elif edu.start_year and edu.start_year != "NA":
                    years = f"Started {edu.start_year}"
                elif edu.end_year and edu.end_year != "NA":
                    years = f"Graduated {edu.end_year}"

                edu_rows = [
                    [Paragraph(degree_info, style_normal), Paragraph(years, style_dates)]
                ]
                if edu.institution and edu.institution != "NA":
                    edu_rows.append(
                        [Paragraph(edu.institution, style_normal), Paragraph("", style_dates)]
                    )

                tbl = Table(
                    edu_rows,
                    colWidths=[avail_width - 1.8 * inch, 1.8 * inch],
                    hAlign="LEFT",
                )
                tbl.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                            ("TOPPADDING", (0, 0), (-1, -1), 1),
                        ]
                    )
                )
                edu_flowables.append(tbl)
                edu_flowables.append(Spacer(1, 0.05 * inch))

                if first_edu:
                    story.append(KeepTogether(edu_header + edu_flowables))
                    first_edu = False
                else:
                    story.append(KeepTogether(edu_flowables))

    def render_projects_story(title: str = "PROJECTS"):
        if resume_data.projects:
            proj_header = create_section_header(title)
            first_proj = True
            for proj in resume_data.projects:
                proj_flowables = []
                if proj.name and proj.name != "NA":
                    proj_flowables.append(Paragraph(f"<b>{proj.name}</b>", style_job_title))

                if proj.technologies and proj.technologies != ["NA"]:
                    tech_list = [t for t in proj.technologies if t != "NA"]
                    if tech_list:
                        tech_text = f"<i>Technologies:</i> {', '.join(tech_list)}"
                        proj_flowables.append(Paragraph(tech_text, style_tech))

                if proj.description and proj.description != "NA":
                    if "\n" in proj.description:
                        bullets = proj.description.split("\n")
                        for bullet in bullets:
                            if bullet.strip():
                                b_text = bullet.strip()
                                if not b_text.startswith("-") and not b_text.startswith("•"):
                                    b_text = f"• {b_text}"
                                elif b_text.startswith("-"):
                                    b_text = f"• {b_text[1:].strip()}"
                                proj_flowables.append(Paragraph(b_text, style_bullet))
                    else:
                        text = proj.description.strip()
                        sentences = [s.strip() for s in text.split(".") if s.strip()]
                        for s in sentences:
                            proj_flowables.append(Paragraph(f"• {s}.", style_bullet))

                proj_flowables.append(Spacer(1, 0.05 * inch))

                if first_proj:
                    story.append(KeepTogether(proj_header + proj_flowables))
                    first_proj = False
                else:
                    story.append(KeepTogether(proj_flowables))

    def render_certifications_story(title: str = "CERTIFICATIONS"):
        if resume_data.certifications:
            cert_header = create_section_header(title)
            first_cert = True
            for cert in resume_data.certifications:
                if (not cert.name or cert.name == "NA") and (
                    not cert.issuer or cert.issuer == "NA"
                ):
                    continue

                cert_flowables = []
                cert_name = (
                    f"<b>{cert.name}</b>" if cert.name and cert.name != "NA" else ""
                )
                year_text = cert.year if cert.year and cert.year != "NA" else ""

                table_rows = [
                    [Paragraph(cert_name, style_normal), Paragraph(year_text, style_dates)]
                ]
                if cert.issuer and cert.issuer != "NA":
                    table_rows.append(
                        [Paragraph(cert.issuer, style_company), Paragraph("", style_dates)]
                    )

                tbl = Table(
                    table_rows,
                    colWidths=[avail_width - 1.8 * inch, 1.8 * inch],
                    hAlign="LEFT",
                )
                tbl.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                            ("TOPPADDING", (0, 0), (-1, -1), 1),
                        ]
                    )
                )
                cert_flowables.append(tbl)
                cert_flowables.append(Spacer(1, 0.04 * inch))

                if first_cert:
                    story.append(KeepTogether(cert_header + cert_flowables))
                    first_cert = False
                else:
                    story.append(KeepTogether(cert_flowables))

    def render_languages_story(title: str = "LANGUAGES"):
        if resume_data.languages and resume_data.languages != ["NA"]:
            lang_list = [l for l in resume_data.languages if l != "NA"]
            if lang_list:
                hdr = create_section_header(title)
                story.append(
                    KeepTogether(
                        hdr
                        + [
                            Paragraph(", ".join(lang_list), style_normal),
                            Spacer(1, 0.04 * inch),
                        ]
                    )
                )

    hidden_sections = set(layout_cfg.get("hiddenSections", []))
    custom_titles = layout_cfg.get("customSectionTitles", {})

    default_titles = {
        "summary": "PROFESSIONAL SUMMARY",
        "skills": "SKILLS",
        "experience": "PROFESSIONAL EXPERIENCE",
        "education": "EDUCATION",
        "projects": "PROJECTS",
        "certifications": "CERTIFICATIONS",
        "languages": "LANGUAGES",
    }

    # Dynamic loop through configured section order
    for section_name in section_order:
        if section_name in hidden_sections:
            continue
        sec_title = custom_titles.get(section_name, default_titles.get(section_name, section_name.upper()))

        if section_name == "summary":
            render_summary_story(sec_title)
        elif section_name == "skills":
            render_skills_story(sec_title)
        elif section_name == "experience":
            render_experience_story(sec_title)
        elif section_name == "education":
            render_education_story(sec_title)
        elif section_name == "projects":
            render_projects_story(sec_title)
        elif section_name == "certifications":
            render_certifications_story(sec_title)
        elif section_name == "languages":
            render_languages_story(sec_title)

    try:
        doc.build(story)
        logging.info("PDF generated successfully with dynamic style config.")
    except Exception as e:
        logging.error(f"Error building PDF: {e}")
        raise

    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
