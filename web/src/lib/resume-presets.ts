import { ResumeThemeConfig, ResumeSectionKey } from "@/types";

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "certifications",
  "languages",
];

export const DEFAULT_SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: "PROFESSIONAL SUMMARY",
  skills: "SKILLS",
  experience: "PROFESSIONAL EXPERIENCE",
  education: "EDUCATION",
  projects: "PROJECTS",
  certifications: "CERTIFICATIONS",
  languages: "LANGUAGES",
};

export const DEFAULT_THEME_CONFIG: ResumeThemeConfig = {
  preset: "modern_tech",
  typography: {
    fontFamily: "Helvetica",
    fontSizeScale: "normal",
    lineSpacing: "normal",
  },
  colors: {
    primary: "#1976D2",    // Modern blue
    secondary: "#455A64",  // Dark blue-gray
    text: "#212121",       // Near black
    light: "#757575",      // Medium gray
    divider: "#2C3E50",    // Section divider color
  },
  layout: {
    headerAlignment: "left",
    showDividers: true,
    dividerThickness: 1,
    skillsLayout: "grid_3col",
    margins: "normal",
    headingStyle: "underline",
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    customSectionTitles: {},
  },
};

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  config: ResumeThemeConfig;
}

export const RESUME_PRESETS: PresetDefinition[] = [
  {
    id: "modern_tech",
    name: "Modern Tech",
    description: "Vibrant blue accents with crisp sans-serif headings. Standard for tech and engineering.",
    accentColor: "#1976D2",
    config: {
      ...DEFAULT_THEME_CONFIG,
      preset: "modern_tech",
      layout: {
        ...DEFAULT_THEME_CONFIG.layout,
        headingStyle: "left_bar",
      },
    },
  },
  {
    id: "executive_slate",
    name: "Executive Slate",
    description: "Deep charcoal and midnight slate with centered header. Ideal for senior management.",
    accentColor: "#0F172A",
    config: {
      preset: "executive_slate",
      typography: {
        fontFamily: "Helvetica",
        fontSizeScale: "normal",
        lineSpacing: "normal",
      },
      colors: {
        primary: "#0F172A",
        secondary: "#334155",
        text: "#1E293B",
        light: "#64748B",
        divider: "#0F172A",
      },
      layout: {
        headerAlignment: "center",
        showDividers: true,
        dividerThickness: 1.5,
        skillsLayout: "grid_3col",
        margins: "normal",
        headingStyle: "underline",
        sectionOrder: [
          "summary",
          "experience",
          "skills",
          "projects",
          "education",
          "certifications",
          "languages",
        ],
      },
    },
  },
  {
    id: "classic_corporate",
    name: "Classic Corporate",
    description: "Traditional Times-Roman serif typography with centered header. Perfect for finance, legal, and academia.",
    accentColor: "#111827",
    config: {
      preset: "classic_corporate",
      typography: {
        fontFamily: "Times-Roman",
        fontSizeScale: "normal",
        lineSpacing: "normal",
      },
      colors: {
        primary: "#111827",
        secondary: "#374151",
        text: "#1F2937",
        light: "#4B5563",
        divider: "#9CA3AF",
      },
      layout: {
        headerAlignment: "center",
        showDividers: true,
        dividerThickness: 0.75,
        skillsLayout: "grid_3col",
        margins: "normal",
        headingStyle: "underline",
        sectionOrder: [
          "summary",
          "experience",
          "education",
          "skills",
          "projects",
          "certifications",
          "languages",
        ],
      },
    },
  },
  {
    id: "emerald_minimalist",
    name: "Emerald Minimalist",
    description: "Deep forest green accent with clean divider rules. Elegant, fresh, and modern.",
    accentColor: "#065F46",
    config: {
      preset: "emerald_minimalist",
      typography: {
        fontFamily: "Helvetica",
        fontSizeScale: "normal",
        lineSpacing: "normal",
      },
      colors: {
        primary: "#065F46",
        secondary: "#1E293B",
        text: "#111827",
        light: "#6B7280",
        divider: "#10B981",
      },
      layout: {
        headerAlignment: "left",
        showDividers: true,
        dividerThickness: 1,
        skillsLayout: "grid_3col",
        margins: "normal",
        headingStyle: "shaded_pill",
        sectionOrder: [...DEFAULT_SECTION_ORDER],
      },
    },
  },
  {
    id: "pure_monochrome",
    name: "Pure Monochrome",
    description: "100% black and grayscale. Zero color distractions for strict corporate ATS portals.",
    accentColor: "#000000",
    config: {
      preset: "pure_monochrome",
      typography: {
        fontFamily: "Helvetica",
        fontSizeScale: "normal",
        lineSpacing: "tight",
      },
      colors: {
        primary: "#000000",
        secondary: "#262626",
        text: "#171717",
        light: "#525252",
        divider: "#000000",
      },
      layout: {
        headerAlignment: "left",
        showDividers: true,
        dividerThickness: 1,
        skillsLayout: "grid_3col",
        margins: "normal",
        headingStyle: "borderless",
        sectionOrder: [...DEFAULT_SECTION_ORDER],
      },
    },
  },
];
