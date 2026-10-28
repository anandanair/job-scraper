import PDFDocument from "pdfkit";
import { Resume, ResumeThemeConfig } from "@/types";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";

// The API receives a resume data object without technical metadata fields
export type ResumeInput = Omit<
  Resume,
  "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link"
>;

// Letter size in points: 8.5" x 11"
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

// --- Abbreviation-safe sentence splitter ---
const ABBREVIATIONS: Record<string, string> = {
  "e.g.": "TEMP_EG",
  "i.e.": "TEMP_IE",
  "etc.": "TEMP_ETC",
  "vs.": "TEMP_VS",
  "Mr.": "TEMP_MR",
  "Mrs.": "TEMP_MRS",
  "Ms.": "TEMP_MS",
  "Dr.": "TEMP_DR",
  "St.": "TEMP_ST",
  "Ph.D.": "TEMP_PHD",
  "U.S.": "TEMP_US",
  "U.K.": "TEMP_UK",
};

function protectAbbreviations(text: string): string {
  let result = text;
  for (const [abbr, placeholder] of Object.entries(ABBREVIATIONS)) {
    result = result.replaceAll(abbr, placeholder);
  }
  return result;
}

function restoreAbbreviations(text: string): string {
  let result = text;
  for (const [abbr, placeholder] of Object.entries(ABBREVIATIONS)) {
    result = result.replaceAll(placeholder, abbr);
  }
  return result;
}

function splitIntoSentences(text: string): string[] {
  const protectedText = protectAbbreviations(text.trim());
  const rawSentences = protectedText.split(". ");

  const sentences: string[] = [];
  for (let i = 0; i < rawSentences.length; i++) {
    let sentence = rawSentences[i];
    if (!sentence) continue;
    sentence = restoreAbbreviations(sentence);

    if (
      i < rawSentences.length - 1 ||
      ![".", "!", "?"].includes(sentence[sentence.length - 1])
    ) {
      sentence = sentence + ".";
    }

    sentences.push(sentence.trim());
  }
  return sentences;
}

function isNA(value: string | null | undefined): boolean {
  return !value || value === "NA";
}

// --- Font family helper ---
function getFontFamilyNames(font: string) {
  if (font === "Times-Roman") {
    return {
      regular: "Times-Roman",
      bold: "Times-Bold",
      italic: "Times-Italic",
      boldItalic: "Times-BoldItalic",
    };
  }
  if (font === "Courier") {
    return {
      regular: "Courier",
      bold: "Courier-Bold",
      italic: "Courier-Oblique",
      boldItalic: "Courier-BoldOblique",
    };
  }
  // Default: Helvetica
  return {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
    italic: "Helvetica-Oblique",
    boldItalic: "Helvetica-BoldOblique",
  };
}

// --- Font sizing scale helper ---
function getFontSizes(scale: string) {
  if (scale === "compact") {
    return {
      name: 22,
      heading: 10.5,
      jobTitle: 10.5,
      body: 9,
      contact: 8.5,
      meta: 8,
    };
  }
  if (scale === "spacious") {
    return {
      name: 26,
      heading: 12.5,
      jobTitle: 12,
      body: 10,
      contact: 9.5,
      meta: 9,
    };
  }
  // Normal
  return {
    name: 24,
    heading: 11.5,
    jobTitle: 11.5,
    body: 9.5,
    contact: 9,
    meta: 8.5,
  };
}

// --- Margin helper ---
function getMargins(margins: string) {
  if (margins === "compact") {
    return {
      top: 25.2, // ~0.35 in
      bottom: 25.2,
      left: 28.8, // ~0.4 in
      right: 28.8,
    };
  }
  if (margins === "wide") {
    return {
      top: 43.2, // 0.6 in
      bottom: 43.2,
      left: 43.2,
      right: 43.2,
    };
  }
  // Normal default
  return {
    top: 32.4, // 0.45 in
    bottom: 32.4,
    left: 36.0, // 0.5 in
    right: 36.0,
  };
}

// --- Helper: Check if we need a new page ---
function ensureSpace(
  doc: PDFKit.PDFDocument,
  neededHeight: number,
  marginBottom: number
) {
  if (doc.y + neededHeight > PAGE_HEIGHT - marginBottom) {
    doc.addPage();
  }
}

// --- Section heading with optional horizontal rule and orphan lookahead ---
function drawSectionHeading(
  doc: PDFKit.PDFDocument,
  title: string,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  lookaheadHeight: number = 70
) {
  ensureSpace(doc, lookaheadHeight, margins.bottom);
  doc.moveDown(0.5);

  const headingStyle = theme.layout.headingStyle || "underline";

  if (headingStyle === "left_bar") {
    const barY = doc.y;
    const barHeight = sizes.heading + 2;
    doc
      .rect(margins.left, barY + 1, 3.5, barHeight)
      .fillColor(theme.colors.primary)
      .fill();

    doc
      .font(fonts.bold)
      .fontSize(sizes.heading)
      .fillColor(theme.colors.primary)
      .text(title, margins.left + 8, barY, { width: contentWidth - 8 });
    doc.y = barY + barHeight + 4;
  } else if (headingStyle === "shaded_pill") {
    const pillY = doc.y;
    const pillHeight = sizes.heading + 6;
    doc
      .rect(margins.left, pillY - 1, contentWidth, pillHeight)
      .fillColor(theme.colors.primary)
      .fillOpacity(0.12)
      .fill()
      .fillOpacity(1);

    doc
      .font(fonts.bold)
      .fontSize(sizes.heading)
      .fillColor(theme.colors.primary)
      .text(title, margins.left + 6, pillY + 2, { width: contentWidth - 12 });
    doc.y = pillY + pillHeight + 5;
  } else if (headingStyle === "borderless") {
    doc
      .font(fonts.bold)
      .fontSize(sizes.heading)
      .fillColor(theme.colors.primary)
      .text(title, margins.left, doc.y, { width: contentWidth });
    doc.y += 5;
  } else {
    // Default: "underline"
    doc
      .font(fonts.bold)
      .fontSize(sizes.heading)
      .fillColor(theme.colors.primary)
      .text(title, margins.left, doc.y, { width: contentWidth });

    if (theme.layout.showDividers !== false) {
      const ruleY = doc.y + 2;
      doc
        .moveTo(margins.left, ruleY)
        .lineTo(PAGE_WIDTH - margins.right, ruleY)
        .strokeColor(theme.colors.divider)
        .lineWidth(theme.layout.dividerThickness || 1)
        .stroke();
      doc.y = ruleY + 6;
    } else {
      doc.y += 4;
    }
  }
}

// --- Helper: extract bullet lines safely from description ---
function getBulletLines(description: string): string[] {
  if (description.includes("\n")) {
    return description
      .split("\n")
      .map((b) => b.trim().replace(/^[•\-]\s*/, ""))
      .filter(Boolean);
  }
  return splitIntoSentences(description).filter(Boolean);
}

// --- Bullet point text ---
function drawBullet(
  doc: PDFKit.PDFDocument,
  text: string,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number
) {
  const lineGap =
    theme.typography.lineSpacing === "tight"
      ? 1
      : theme.typography.lineSpacing === "relaxed"
      ? 3
      : 2;

  doc.font(fonts.regular).fontSize(sizes.body);
  const bulletHeight = doc.heightOfString(`• ${text}`, {
    width: contentWidth - 12,
    lineGap,
  });

  // Ensure individual bullet doesn't split awkwardly across page bottom
  ensureSpace(doc, bulletHeight + 2, margins.bottom);

  doc
    .font(fonts.regular)
    .fontSize(sizes.body)
    .fillColor(theme.colors.text)
    .text(`• ${text}`, margins.left + 12, doc.y, {
      width: contentWidth - 12,
      lineGap,
    });
  doc.y += 2;
}

// --- Description handler: bullets from newlines or sentence splitting ---
function drawDescription(
  doc: PDFKit.PDFDocument,
  description: string,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number
) {
  const bullets = getBulletLines(description);
  for (const bulletText of bullets) {
    drawBullet(doc, bulletText, theme, fonts, sizes, margins, contentWidth);
  }
}

// --- Two-column row (left text + right-aligned text) ---
function drawTwoColumnRow(
  doc: PDFKit.PDFDocument,
  leftText: string,
  leftFont: string,
  leftSize: number,
  leftColor: string,
  rightText: string,
  rightFont: string,
  rightSize: number,
  rightColor: string,
  leftWidth: number,
  rightWidth: number,
  margins: ReturnType<typeof getMargins>,
  neededHeight: number = 20
) {
  ensureSpace(doc, neededHeight, margins.bottom);
  const startY = doc.y;

  // Draw left text
  doc.font(leftFont).fontSize(leftSize).fillColor(leftColor);
  const cleanLeftText = leftText.replace(/<\/?b>/g, "");
  doc.text(cleanLeftText, margins.left, startY, {
    width: leftWidth,
    continued: false,
  });
  const leftEndY = doc.y;

  // Draw right text (right-aligned)
  doc.font(rightFont).fontSize(rightSize).fillColor(rightColor);
  doc.text(rightText, margins.left + leftWidth, startY, {
    width: rightWidth,
    align: "right",
  });
  const rightEndY = doc.y;

  doc.y = Math.max(leftEndY, rightEndY);
}

// ==========================================
// SECTION RENDERERS
// ==========================================

function renderSummary(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "PROFESSIONAL SUMMARY"
) {
  if (!resumeData.summary || isNA(resumeData.summary)) return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    60
  );

  let cleanedSummary = resumeData.summary.replace(/<\/?b>/g, "");
  if (cleanedSummary.startsWith('"') && cleanedSummary.endsWith('"')) {
    cleanedSummary = cleanedSummary.slice(1, -1);
  }

  const lineGap =
    theme.typography.lineSpacing === "tight"
      ? 1
      : theme.typography.lineSpacing === "relaxed"
      ? 3
      : 2;

  ensureSpace(doc, 30, margins.bottom);
  doc
    .font(fonts.regular)
    .fontSize(sizes.body)
    .fillColor(theme.colors.text)
    .text(cleanedSummary, margins.left, doc.y, {
      width: contentWidth,
      lineGap,
    });
  doc.y += 4;
}

function renderSkills(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "SKILLS"
) {
  if (!resumeData.skills || resumeData.skills.length === 0) return;
  const skillsList = resumeData.skills.filter((s) => !isNA(s));
  if (skillsList.length === 0) return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    65
  );

  if (theme.layout.skillsLayout === "inline_wrap") {
    // Render inline comma-separated or bullet-separated skills
    ensureSpace(doc, 22, margins.bottom);
    doc
      .font(fonts.regular)
      .fontSize(sizes.body)
      .fillColor(theme.colors.text)
      .text(skillsList.join("  •  "), margins.left, doc.y, {
        width: contentWidth,
        lineGap: 3,
      });
    doc.y += 6;
  } else {
    // 3-column grid
    const numColumns = 3;
    const colWidth = contentWidth / numColumns;
    const rows = Math.ceil(skillsList.length / numColumns);

    for (let i = 0; i < rows; i++) {
      ensureSpace(doc, 16, margins.bottom);
      const rowY = doc.y;
      let maxHeight = 0;

      for (let j = 0; j < numColumns; j++) {
        const skillIndex = i * numColumns + j;
        if (skillIndex < skillsList.length) {
          const skillText = `• ${skillsList[skillIndex]}`;
          const colPad = j === 0 ? 0 : 8;
          const colX = margins.left + j * colWidth + colPad;
          const adjustedWidth = colWidth - colPad - 4;

          doc
            .font(fonts.regular)
            .fontSize(sizes.body)
            .fillColor(theme.colors.text)
            .text(skillText, colX, rowY, {
              width: adjustedWidth,
              lineGap: 2,
            });

          const cellHeight = doc.y - rowY;
          if (cellHeight > maxHeight) maxHeight = cellHeight;
        }
      }
      doc.y = rowY + maxHeight + 3;
    }
    doc.y += 5;
  }
}

function renderExperience(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "PROFESSIONAL EXPERIENCE"
) {
  if (!resumeData.experience || resumeData.experience.length === 0) return;

  // Orphan prevention: section heading + first entry (title, company, 1-2 bullets) must fit together
  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    95
  );

  const lineGap =
    theme.typography.lineSpacing === "tight"
      ? 1
      : theme.typography.lineSpacing === "relaxed"
      ? 3
      : 2;

  for (const exp of resumeData.experience) {
    const jobTitle = isNA(exp.job_title) ? "" : exp.job_title;
    const companyParts: string[] = [];
    if (!isNA(exp.company)) companyParts.push(exp.company!);
    if (!isNA(exp.location)) companyParts.push(exp.location!);
    const companyLocation = companyParts.join(" | ");

    let dates = "";
    if (!isNA(exp.start_date) && !isNA(exp.end_date)) {
      dates = `${exp.start_date} - ${exp.end_date}`;
    } else if (!isNA(exp.start_date)) {
      dates = `${exp.start_date} - Present`;
    }

    const rightWidth = 2.0 * 72;
    const leftWidth = contentWidth - rightWidth;

    // Calculate minimum keep-together height for this job entry:
    // Header (Job Title + Dates + Company) + at least the first 1-2 bullet points
    const bullets = !isNA(exp.description) ? getBulletLines(exp.description!) : [];
    doc.font(fonts.regular).fontSize(sizes.body);

    let firstBulletsHeight = 0;
    if (bullets.length > 0) {
      firstBulletsHeight +=
        doc.heightOfString(`• ${bullets[0]}`, {
          width: contentWidth - 12,
          lineGap,
        }) + 4;
      if (bullets.length > 1) {
        firstBulletsHeight +=
          doc.heightOfString(`• ${bullets[1]}`, {
            width: contentWidth - 12,
            lineGap,
          }) + 4;
      }
    } else {
      firstBulletsHeight = 20;
    }

    const entryHeaderHeight =
      sizes.jobTitle +
      4 +
      (companyLocation ? sizes.body + 6 : 0) +
      firstBulletsHeight +
      6;

    // If Title + Company + first 1-2 bullets don't fit, start this job on the new page
    ensureSpace(doc, entryHeaderHeight, margins.bottom);

    drawTwoColumnRow(
      doc,
      jobTitle,
      fonts.bold,
      sizes.jobTitle,
      theme.colors.primary,
      dates,
      fonts.italic,
      sizes.meta,
      theme.colors.light,
      leftWidth,
      rightWidth,
      margins,
      sizes.jobTitle + 2
    );

    // Company | Location
    if (companyLocation) {
      doc
        .font(fonts.bold)
        .fontSize(sizes.body)
        .fillColor(theme.colors.secondary)
        .text(companyLocation, margins.left, doc.y, { width: contentWidth });
      doc.y += 4;
    }

    // Description bullets (will naturally split across pages if there are many bullets)
    if (!isNA(exp.description)) {
      drawDescription(
        doc,
        exp.description!,
        theme,
        fonts,
        sizes,
        margins,
        contentWidth
      );
    }

    doc.y += 8;
  }
}

function renderEducation(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "EDUCATION"
) {
  if (!resumeData.education || resumeData.education.length === 0) return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    70
  );

  for (const edu of resumeData.education) {
    let degreeInfo = isNA(edu.degree) ? "" : edu.degree;
    if (!isNA(edu.field_of_study)) {
      degreeInfo += `, ${edu.field_of_study}`;
    }

    let years = "";
    if (!isNA(edu.start_year) && !isNA(edu.end_year)) {
      years = `${edu.start_year} - ${edu.end_year}`;
    } else if (!isNA(edu.start_year)) {
      years = `Started ${edu.start_year}`;
    } else if (!isNA(edu.end_year)) {
      years = `Graduated ${edu.end_year}`;
    }

    const rightWidth = 1.8 * 72;
    const leftWidth = contentWidth - rightWidth;

    // Keep entire education item together (Degree + Institution + Years)
    ensureSpace(doc, 45, margins.bottom);

    drawTwoColumnRow(
      doc,
      degreeInfo,
      fonts.bold,
      sizes.body,
      theme.colors.text,
      years,
      fonts.italic,
      sizes.meta,
      theme.colors.light,
      leftWidth,
      rightWidth,
      margins,
      sizes.body + 2
    );

    if (!isNA(edu.institution)) {
      doc
        .font(fonts.regular)
        .fontSize(sizes.body)
        .fillColor(theme.colors.secondary)
        .text(edu.institution!, margins.left, doc.y, { width: contentWidth });
    }

    doc.y += 8;
  }
}

function renderProjects(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "PROJECTS"
) {
  if (!resumeData.projects || resumeData.projects.length === 0) return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    75
  );

  for (const proj of resumeData.projects) {
    if (isNA(proj.name)) continue;

    const projBullets = !isNA(proj.description)
      ? getBulletLines(proj.description!)
      : [];
    doc.font(fonts.regular).fontSize(sizes.body);
    const lineGap =
      theme.typography.lineSpacing === "tight"
        ? 1
        : theme.typography.lineSpacing === "relaxed"
        ? 3
        : 2;
    const firstBulletH =
      projBullets.length > 0
        ? doc.heightOfString(`• ${projBullets[0]}`, {
            width: contentWidth - 12,
            lineGap,
          }) + 4
        : 18;

    const hasTech =
      proj.technologies &&
      proj.technologies.length > 0 &&
      !(proj.technologies.length === 1 && proj.technologies[0] === "NA");

    const projHeaderHeight =
      sizes.jobTitle +
      4 +
      (hasTech ? sizes.meta + 5 : 0) +
      firstBulletH +
      6;

    // Keep project title + technologies + first bullet together
    ensureSpace(doc, projHeaderHeight, margins.bottom);

    doc
      .font(fonts.bold)
      .fontSize(sizes.jobTitle)
      .fillColor(theme.colors.primary)
      .text(proj.name, margins.left, doc.y, { width: contentWidth });
    doc.y += 2;

    if (hasTech && proj.technologies) {
      const techList = proj.technologies.filter((t) => !isNA(t));
      if (techList.length > 0) {
        doc
          .font(fonts.italic)
          .fontSize(sizes.meta)
          .fillColor(theme.colors.light);
        doc.text(`Technologies: ${techList.join(", ")}`, margins.left, doc.y, {
          width: contentWidth,
        });
        doc.y += 3;
      }
    }

    if (!isNA(proj.description)) {
      drawDescription(
        doc,
        proj.description!,
        theme,
        fonts,
        sizes,
        margins,
        contentWidth
      );
    }

    doc.y += 8;
  }
}

function renderCertifications(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "CERTIFICATIONS"
) {
  if (!resumeData.certifications || resumeData.certifications.length === 0)
    return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    65
  );

  for (const cert of resumeData.certifications) {
    if (isNA(cert.name) && isNA(cert.issuer)) continue;

    const certName = isNA(cert.name) ? "" : cert.name;
    const yearText = isNA(cert.year) ? "" : cert.year!;

    const rightWidth = 1.8 * 72;
    const leftWidth = contentWidth - rightWidth;

    // Keep entire certification entry together
    ensureSpace(doc, 42, margins.bottom);

    drawTwoColumnRow(
      doc,
      certName,
      fonts.bold,
      sizes.body,
      theme.colors.text,
      yearText,
      fonts.italic,
      sizes.meta,
      theme.colors.light,
      leftWidth,
      rightWidth,
      margins,
      sizes.body + 2
    );

    if (!isNA(cert.issuer)) {
      doc
        .font(fonts.regular)
        .fontSize(sizes.body)
        .fillColor(theme.colors.secondary)
        .text(cert.issuer!, margins.left, doc.y, { width: contentWidth });
    }

    doc.y += 6;
  }
}

function renderLanguages(
  doc: PDFKit.PDFDocument,
  resumeData: ResumeInput,
  theme: ResumeThemeConfig,
  fonts: ReturnType<typeof getFontFamilyNames>,
  sizes: ReturnType<typeof getFontSizes>,
  margins: ReturnType<typeof getMargins>,
  contentWidth: number,
  title: string = "LANGUAGES"
) {
  if (!resumeData.languages || resumeData.languages.length === 0) return;
  const langList = resumeData.languages.filter((l) => !isNA(l));
  if (langList.length === 0) return;

  drawSectionHeading(
    doc,
    title,
    theme,
    fonts,
    sizes,
    margins,
    contentWidth,
    55
  );

  ensureSpace(doc, 25, margins.bottom);
  doc
    .font(fonts.regular)
    .fontSize(sizes.body)
    .fillColor(theme.colors.text)
    .text(langList.join(", "), margins.left, doc.y, {
      width: contentWidth,
    });
  doc.y += 6;
}

// ==========================================
// MAIN PDF BUILDER
// ==========================================

export async function buildPdfBuffer(
  resumeData: ResumeInput,
  styleConfig?: ResumeThemeConfig
): Promise<Buffer> {
  const theme: ResumeThemeConfig = styleConfig || DEFAULT_THEME_CONFIG;
  const fonts = getFontFamilyNames(theme.typography.fontFamily);
  const sizes = getFontSizes(theme.typography.fontSizeScale);
  const margins = getMargins(theme.layout.margins);
  const contentWidth = PAGE_WIDTH - margins.left - margins.right;

  const doc = new PDFDocument({
    size: "LETTER",
    margins: {
      top: margins.top,
      bottom: margins.bottom,
      left: margins.left,
      right: margins.right,
    },
    autoFirstPage: true,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const headerStyle =
    theme.layout.headerStyle ||
    (theme.layout.headerAlignment === "center" ? "stacked_center" : "stacked_left");
  const isCentered = headerStyle === "stacked_center";
  const professionalTitle = theme.layout.professionalTitle?.trim();

  // ===== CONTACT INFORMATION =====
  const contactParts: string[] = [];
  if (!isNA(resumeData.email)) contactParts.push(resumeData.email);
  if (!isNA(resumeData.phone)) contactParts.push(resumeData.phone);
  if (!isNA(resumeData.location)) contactParts.push(resumeData.location);

  // ===== LINKS =====
  const linkItems: { label: string; url: string }[] = [];
  if (resumeData.links) {
    if (!isNA(resumeData.links.linkedin)) {
      const url = resumeData.links.linkedin!.startsWith("http")
        ? resumeData.links.linkedin!
        : `https://${resumeData.links.linkedin}`;
      linkItems.push({ label: "LinkedIn", url });
    }
    if (!isNA(resumeData.links.github)) {
      const url = resumeData.links.github!.startsWith("http")
        ? resumeData.links.github!
        : `https://${resumeData.links.github}`;
      linkItems.push({ label: "GitHub", url });
    }
    if (!isNA(resumeData.links.portfolio)) {
      const url = resumeData.links.portfolio!.startsWith("http")
        ? resumeData.links.portfolio!
        : `https://${resumeData.links.portfolio}`;
      linkItems.push({ label: "Portfolio", url });
    }
  }

  if (headerStyle === "split_twocol") {
    // Two-Column Modern ATS Header
    const leftWidth = Math.floor(contentWidth * 0.58);
    const rightWidth = contentWidth - leftWidth - 10;
    const rightX = margins.left + leftWidth + 10;
    const topY = margins.top;

    // LEFT: Name & Professional Title
    let leftEndY = topY;
    if (resumeData.name) {
      doc
        .font(fonts.bold)
        .fontSize(sizes.name * 0.95)
        .fillColor(theme.colors.primary)
        .text(resumeData.name.toUpperCase(), margins.left, topY, {
          width: leftWidth,
          align: "left",
        });
      leftEndY = doc.y;
    }
    if (professionalTitle) {
      doc
        .font(fonts.bold)
        .fontSize(sizes.heading)
        .fillColor(theme.colors.secondary)
        .text(professionalTitle, margins.left, leftEndY + 2, {
          width: leftWidth,
          align: "left",
        });
      leftEndY = doc.y;
    }

    // RIGHT: Contact Info & Links (right-aligned)
    let rightEndY = topY;
    if (contactParts.length > 0) {
      doc
        .font(fonts.regular)
        .fontSize(sizes.contact)
        .fillColor(theme.colors.secondary)
        .text(contactParts.join(" | "), rightX, topY, {
          width: rightWidth,
          align: "right",
        });
      rightEndY = doc.y;
    }

    if (linkItems.length > 0) {
      const linkLabels = linkItems.map((item) => item.label).join(" | ");
      doc
        .font(fonts.regular)
        .fontSize(sizes.contact)
        .fillColor(theme.colors.primary)
        .text(linkLabels, rightX, rightEndY + 2, {
          width: rightWidth,
          align: "right",
        });
      rightEndY = doc.y;
    }

    doc.y = Math.max(leftEndY, rightEndY) + 8;
  } else {
    // Stacked (Left or Center)
    if (resumeData.name) {
      doc
        .font(fonts.bold)
        .fontSize(sizes.name)
        .fillColor(theme.colors.primary)
        .text(resumeData.name.toUpperCase(), margins.left, margins.top, {
          width: contentWidth,
          align: isCentered ? "center" : "left",
        });
      doc.moveDown(0.15);
    }

    if (professionalTitle) {
      doc
        .font(fonts.bold)
        .fontSize(sizes.heading + 1)
        .fillColor(theme.colors.secondary)
        .text(professionalTitle, margins.left, doc.y, {
          width: contentWidth,
          align: isCentered ? "center" : "left",
        });
      doc.moveDown(0.2);
    }

    if (contactParts.length > 0) {
      doc
        .font(fonts.regular)
        .fontSize(sizes.contact)
        .fillColor(theme.colors.secondary)
        .text(contactParts.join(" | "), margins.left, doc.y, {
          width: contentWidth,
          align: isCentered ? "center" : "left",
        });
      doc.y += 2;
    }

    if (linkItems.length > 0) {
      doc.font(fonts.regular).fontSize(sizes.contact).fillColor(theme.colors.primary);

      if (isCentered) {
        const linkLabels = linkItems.map((item) => item.label).join(" | ");
        doc.text(linkLabels, margins.left, doc.y, {
          width: contentWidth,
          align: "center",
        });
        doc.y += 4;
      } else {
        const startX = margins.left;
        let currentX = startX;
        const lineY = doc.y;

        for (let i = 0; i < linkItems.length; i++) {
          const item = linkItems[i];
          const labelWidth = doc.widthOfString(item.label);

          doc.fillColor(theme.colors.primary).text(item.label, currentX, lineY, {
            link: item.url,
            underline: true,
            continued: false,
          });

          if (i < linkItems.length - 1) {
            doc.y = lineY;
            currentX += labelWidth;
            const separator = " | ";
            const sepWidth = doc.widthOfString(separator);
            doc.fillColor(theme.colors.secondary).text(separator, currentX, lineY, {
              continued: false,
            });
            doc.y = lineY;
            currentX += sepWidth;
          }
        }
        doc.y += 4;
      }
    }
  }

  // ===== DYNAMIC SECTIONS =====
  const sectionOrder = theme.layout.sectionOrder || [
    "summary",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "languages",
  ];

  const hiddenSections = new Set(theme.layout.hiddenSections || []);
  const customTitles = theme.layout.customSectionTitles || {};

  const defaultTitles: Record<string, string> = {
    summary: "PROFESSIONAL SUMMARY",
    skills: "SKILLS",
    experience: "PROFESSIONAL EXPERIENCE",
    education: "EDUCATION",
    projects: "PROJECTS",
    certifications: "CERTIFICATIONS",
    languages: "LANGUAGES",
  };

  for (const section of sectionOrder) {
    if (hiddenSections.has(section as any)) continue;
    const title = (customTitles[section as keyof typeof customTitles] || defaultTitles[section] || section).toUpperCase();

    switch (section) {
      case "summary":
        renderSummary(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "skills":
        renderSkills(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "experience":
        renderExperience(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "education":
        renderEducation(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "projects":
        renderProjects(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "certifications":
        renderCertifications(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
      case "languages":
        renderLanguages(
          doc,
          resumeData,
          theme,
          fonts,
          sizes,
          margins,
          contentWidth,
          title
        );
        break;
    }
  }

  // Finalize PDF
  doc.end();
  return await pdfPromise;
}
