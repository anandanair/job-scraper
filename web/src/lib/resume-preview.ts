import { ResumeThemeConfig, ResumeSectionKey } from "@/types";

/**
 * Shared calibration constants for the 1:1 HTML resume preview.
 *
 * These values mirror the PDFKit typesetting engine (web/src/lib/pdf.ts) at
 * 72dpi, where 1 PDF point == 1 CSS pixel on a 612px-wide US Letter page.
 * Any change here must be reflected in the PDF engine to stay pixel-accurate.
 */

export const PAGE_WIDTH_PX = 612; // 8.5" letter at 72dpi
export const PAGE_HEIGHT_PX = 792; // 11" letter at 72dpi
export const ONE_PAGE_TOLERANCE_PX = 795; // Small buffer for rounding

export const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
};

export interface PreviewFontSizes {
  name: string;
  heading: string;
  jobTitle: string;
  body: string;
  contact: string;
  meta: string;
}

const FONT_SIZE_SCALES: Record<
  ResumeThemeConfig["typography"]["fontSizeScale"],
  PreviewFontSizes
> = {
  compact: {
    name: "22px",
    heading: "10.5px",
    jobTitle: "10.5px",
    body: "9px",
    contact: "8.5px",
    meta: "8px",
  },
  normal: {
    name: "24px",
    heading: "11.5px",
    jobTitle: "11.5px",
    body: "9.5px",
    contact: "9px",
    meta: "8.5px",
  },
  spacious: {
    name: "26px",
    heading: "12.5px",
    jobTitle: "12px",
    body: "10px",
    contact: "9.5px",
    meta: "9px",
  },
};

export function getPreviewFontSizes(
  scale: ResumeThemeConfig["typography"]["fontSizeScale"]
): PreviewFontSizes {
  return FONT_SIZE_SCALES[scale] || FONT_SIZE_SCALES.normal;
}

export function getPreviewFontFamily(
  fontFamily: ResumeThemeConfig["typography"]["fontFamily"]
): string {
  switch (fontFamily) {
    case "Times-Roman":
      return "Georgia, 'Times New Roman', Times, serif";
    case "Courier":
      return "'Courier New', Courier, monospace";
    default:
      return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
}

export function getPreviewPadding(
  margins: ResumeThemeConfig["layout"]["margins"]
): string {
  switch (margins) {
    case "compact":
      return "25px 29px";
    case "wide":
      return "43px 43px";
    default:
      return "32px 36px";
  }
}

export function getPreviewLineSpacing(
  lineSpacing: ResumeThemeConfig["typography"]["lineSpacing"]
): string {
  switch (lineSpacing) {
    case "tight":
      return "1.15";
    case "relaxed":
      return "1.35";
    default:
      return "1.22";
  }
}

export function getEffectiveHeaderStyle(
  theme: ResumeThemeConfig
): NonNullable<ResumeThemeConfig["layout"]["headerStyle"]> {
  return (
    theme.layout.headerStyle ||
    (theme.layout.headerAlignment === "center" ? "stacked_center" : "stacked_left")
  );
}

/**
 * Returns true when a string value is a real entry (not empty / placeholder
 * tokens like "NA", "N/A", "NONE", "NULL" that legacy data may contain).
 */
export function isRealValue(value: string | null | undefined): boolean {
  return Boolean(
    value &&
      value.trim() &&
      !["NA", "N/A", "NONE", "NULL"].includes(value.trim().toUpperCase())
  );
}
