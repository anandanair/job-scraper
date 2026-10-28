"use client";

import { useState, useRef, useEffect } from "react";
import {
  Resume,
  ResumeThemeConfig,
  ResumeStyleSetting,
  FontFamilyOption,
  FontSizeScaleOption,
  LineSpacingOption,
  HeaderAlignmentOption,
  HeaderStyleOption,
  SkillsLayoutOption,
  MarginsOption,
  HeadingStyleOption,
  ResumeSectionKey,
} from "@/types";
import {
  RESUME_PRESETS,
  DEFAULT_THEME_CONFIG,
  DEFAULT_SECTION_ORDER,
} from "@/lib/resume-presets";
import {
  Check,
  Download,
  Save,
  RotateCcw,
  MoveUp,
  MoveDown,
  Palette,
  Type,
  Layout,
  ListOrdered,
  FileText,
  Loader2,
  Sparkles,
  Info,
  Eye,
  EyeOff,
  Pencil,
  X,
  Trash2,
  Plus,
  Bookmark,
  Layers,
} from "lucide-react";

interface ResumeStyleClientProps {
  initialBaseResume: Resume | null;
  initialThemeConfig: ResumeThemeConfig;
  initialSavedSettings?: ResumeStyleSetting[];
}

// Fallback sample resume data if the user's base resume is not populated yet
const SAMPLE_RESUME_DATA: Resume = {
  id: "sample",
  name: "Alex Morgan",
  email: "alex.morgan@example.com",
  phone: "+65 9123 4567",
  location: "Singapore",
  created_at: "",
  parsed_at: "",
  summary:
    "Senior Full-Stack Software Engineer with 7+ years of experience architecting resilient cloud services, high-throughput distributed systems, and modern web applications. Proven track record leading agile engineering teams and scaling mission-critical platforms.",
  skills: [
    "TypeScript",
    "React / Next.js",
    "Python",
    "Node.js",
    "PostgreSQL",
    "Docker & Kubernetes",
    "AWS Cloud Services",
    "REST & GraphQL APIs",
    "System Architecture",
    "CI/CD Pipelines",
    "Tailwind CSS",
    "Microservices",
  ],
  experience: [
    {
      job_title: "Lead Full-Stack Engineer",
      company: "Nexus Cloud Solutions",
      location: "Singapore",
      start_date: "2022",
      end_date: "Present",
      description:
        "Architected scalable microservices supporting 2M+ active monthly users.\nLed migration from monolithic architecture to serverless microservices, cutting infrastructure costs by 34%.\nMentored 8 junior and mid-level engineers in production-grade code reviews and testing standards.",
    },
    {
      job_title: "Software Engineer",
      company: "Apex Digital Systems",
      location: "Singapore",
      start_date: "2019",
      end_date: "2022",
      description:
        "Developed high-performance frontend interfaces with React, Next.js, and TypeScript.\nDesigned real-time data streaming pipelines with Redis and PostgreSQL, achieving sub-50ms latency.",
    },
  ],
  education: [
    {
      degree: "Bachelor of Science",
      field_of_study: "Computer Science",
      institution: "National University of Singapore (NUS)",
      start_year: "2015",
      end_year: "2019",
    },
  ],
  projects: [
    {
      name: "Distributed Task Scheduler",
      technologies: ["Go", "Redis", "gRPC", "Docker"],
      description:
        "Engineered an open-source fault-tolerant task queue handling over 50,000 asynchronous jobs per second.",
    },
  ],
  certifications: [
    {
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services",
      year: "2023",
    },
  ],
  languages: ["English (Native)", "Mandarin (Professional)"],
  links: {
    linkedin: "linkedin.com/in/alexmorgan",
    github: "github.com/alexmorgan",
    portfolio: "alexmorgan.dev",
  },
};

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
};

export default function ResumeStyleClient({
  initialBaseResume,
  initialThemeConfig,
  initialSavedSettings,
}: ResumeStyleClientProps) {
  const [theme, setTheme] = useState<ResumeThemeConfig>(initialThemeConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedPresets, setSavedPresets] = useState<ResumeStyleSetting[]>(
    initialSavedSettings || []
  );
  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [paperHeight, setPaperHeight] = useState<number>(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const displayData = initialBaseResume?.name ? initialBaseResume : SAMPLE_RESUME_DATA;

  useEffect(() => {
    if (paperRef.current) {
      setPaperHeight(paperRef.current.scrollHeight);
    }
  }, [theme, displayData]);

  const isOnePage = paperHeight <= 795;

  const handleActivateSavedPreset = async (presetRecord: ResumeStyleSetting) => {
    if (!presetRecord.id) return;
    try {
      setTheme({ ...presetRecord.theme_config });
      const res = await fetch("/api/resume-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", id: presetRecord.id }),
      });
      if (res.ok) {
        setSavedPresets((prev) =>
          prev.map((p) => ({
            ...p,
            is_active: p.id === presetRecord.id,
          }))
        );
        setToast({
          message: `Activated persona "${presetRecord.name}"!`,
          type: "success",
        });
      }
    } catch (err: any) {
      setToast({ message: "Failed to switch active persona", type: "error" });
    }
  };

  const handleSaveAsNewPreset = async () => {
    const finalName =
      newPresetName.trim() ||
      (theme.preset === "custom" ? "Custom Persona" : `${theme.preset} Persona`);
    setIsSavingPreset(true);
    try {
      const res = await fetch("/api/resume-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          themeConfig: theme,
          name: finalName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save persona");

      if (data.record) {
        setSavedPresets((prev) => [
          data.record,
          ...prev.map((p) => ({ ...p, is_active: false })),
        ]);
        setNewPresetName("");
        setToast({
          message: `Saved persona "${finalName}" successfully!`,
          type: "success",
        });
      }
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to save new persona",
        type: "error",
      });
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleDeleteSavedPreset = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/resume-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        setSavedPresets((prev) => prev.filter((p) => p.id !== id));
        setToast({
          message: `Deleted persona "${name}".`,
          type: "success",
        });
      }
    } catch (err) {
      setToast({ message: "Failed to delete persona", type: "error" });
    }
  };

  // Preset selection
  const handleSelectPreset = (presetId: string) => {
    const selected = RESUME_PRESETS.find((p) => p.id === presetId);
    if (selected) {
      setTheme({ ...selected.config });
    }
  };

  const [editingTitleKey, setEditingTitleKey] = useState<ResumeSectionKey | null>(null);
  const [tempTitleText, setTempTitleText] = useState<string>("");

  const toggleSectionVisibility = (sectionKey: ResumeSectionKey) => {
    setTheme((prev) => {
      const hidden = new Set(prev.layout.hiddenSections || []);
      if (hidden.has(sectionKey)) {
        hidden.delete(sectionKey);
      } else {
        hidden.add(sectionKey);
      }
      return {
        ...prev,
        preset: "custom",
        layout: {
          ...prev.layout,
          hiddenSections: Array.from(hidden),
        },
      };
    });
  };

  const handleStartEditTitle = (sectionKey: ResumeSectionKey) => {
    setEditingTitleKey(sectionKey);
    setTempTitleText(
      theme.layout.customSectionTitles?.[sectionKey] || SECTION_LABELS[sectionKey] || ""
    );
  };

  const handleSaveCustomTitle = (sectionKey: ResumeSectionKey) => {
    setTheme((prev) => {
      const updatedTitles = { ...(prev.layout.customSectionTitles || {}) };
      if (tempTitleText.trim()) {
        updatedTitles[sectionKey] = tempTitleText.trim();
      } else {
        delete updatedTitles[sectionKey];
      }
      return {
        ...prev,
        preset: "custom",
        layout: {
          ...prev.layout,
          customSectionTitles: updatedTitles,
        },
      };
    });
    setEditingTitleKey(null);
  };

  // Color updates
  const updateColor = (key: keyof ResumeThemeConfig["colors"], value: string) => {
    setTheme((prev) => ({
      ...prev,
      preset: "custom",
      colors: { ...prev.colors, [key]: value },
    }));
  };

  // Move section in order
  const moveSection = (index: number, direction: "up" | "down") => {
    const currentOrder = [...theme.layout.sectionOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;

    setTheme((prev) => ({
      ...prev,
      preset: "custom",
      layout: { ...prev.layout, sectionOrder: currentOrder },
    }));
  };

  // Reset to default
  const handleReset = () => {
    setTheme({ ...DEFAULT_THEME_CONFIG });
    setToast({ message: "Reset to default Modern Tech style.", type: "success" });
  };

  // Save as default style in Supabase
  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/resume-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeConfig: theme,
          name: theme.preset === "custom" ? "Custom User Style" : theme.preset,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to save style");
      }

      setToast({
        message: "Resume style successfully saved as default!",
        type: "success",
      });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to save style settings",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download test PDF
  const handleDownloadTestPdf = async () => {
    setIsDownloading(true);
    try {
      const { id, created_at, parsed_at, last_updated, resume_link, ...cleanData } =
        displayData;

      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData: cleanData,
          styleConfig: theme,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to compile test PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_preview_${theme.preset || "styled"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({
        message: "Test PDF generated and downloaded successfully!",
        type: "success",
      });
    } catch (err: any) {
      setToast({
        message: err.message || "Error generating test PDF",
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // CSS mappings for Live Preview
  const fontStyleFamily =
    theme.typography.fontFamily === "Times-Roman"
      ? "Georgia, 'Times New Roman', Times, serif"
      : theme.typography.fontFamily === "Courier"
      ? "'Courier New', Courier, monospace"
      : "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const paddingScale =
    theme.layout.margins === "compact"
      ? "25px 29px"
      : theme.layout.margins === "wide"
      ? "43px 43px"
      : "32px 36px";

  // Calibrated 1:1 with PDFKit points (at 72dpi, 1 point = 1 CSS pixel on a 612px page)
  const fontSizeScaleMultipliers = {
    compact: { name: "22px", heading: "10.5px", jobTitle: "10.5px", body: "9px", contact: "8.5px", meta: "8px" },
    normal: { name: "24px", heading: "11.5px", jobTitle: "11.5px", body: "9.5px", contact: "9px", meta: "8.5px" },
    spacious: { name: "26px", heading: "12.5px", jobTitle: "12px", body: "10px", contact: "9.5px", meta: "9px" },
  };
  const currentSizes = fontSizeScaleMultipliers[theme.typography.fontSizeScale] || fontSizeScaleMultipliers.normal;

  const lineSpacingStyle =
    theme.typography.lineSpacing === "tight"
      ? "1.15"
      : theme.typography.lineSpacing === "relaxed"
      ? "1.35"
      : "1.22";

  const renderCanvasSectionHeading = (title: string) => {
    const headingStyle = theme.layout.headingStyle || "underline";

    if (headingStyle === "left_bar") {
      return (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div
            className="w-1 rounded-sm shrink-0"
            style={{
              height: currentSizes.heading,
              backgroundColor: theme.colors.primary,
            }}
          />
          <span
            className="font-bold uppercase tracking-wider"
            style={{
              fontSize: currentSizes.heading,
              color: theme.colors.primary,
            }}
          >
            {title}
          </span>
        </div>
      );
    }

    if (headingStyle === "shaded_pill") {
      return (
        <div
          className="mb-1.5 px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${theme.colors.primary}18`,
          }}
        >
          <span
            className="font-bold uppercase tracking-wider"
            style={{
              fontSize: currentSizes.heading,
              color: theme.colors.primary,
            }}
          >
            {title}
          </span>
        </div>
      );
    }

    if (headingStyle === "borderless") {
      return (
        <div className="mb-1.5">
          <span
            className="font-bold uppercase tracking-wider"
            style={{
              fontSize: currentSizes.heading,
              color: theme.colors.primary,
            }}
          >
            {title}
          </span>
        </div>
      );
    }

    // Default: "underline"
    return (
      <div className="mb-1.5">
        <div
          className="font-bold uppercase tracking-wider mb-0.5"
          style={{
            fontSize: currentSizes.heading,
            color: theme.colors.primary,
          }}
        >
          {title}
        </div>
        {theme.layout.showDividers !== false && (
          <div
            className="w-full mb-1"
            style={{
              height: `${theme.layout.dividerThickness || 1}px`,
              backgroundColor: theme.colors.divider,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`shrink-0 mb-3 p-3.5 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Split Pane: Left controls and Right preview - independently scrollable on desktop */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch lg:overflow-hidden">
        {/* LEFT COLUMN: Controls (5 columns on large screens) */}
        <div className="lg:col-span-5 lg:h-full lg:overflow-y-auto custom-scrollbar pr-1 sm:pr-2 space-y-4 pb-6">
          {/* Saved Personas & Custom Profiles */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-gray-900 font-semibold">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-violet-600" />
                <span>Saved Personas &amp; Styles</span>
              </div>
              <span className="text-[11px] text-gray-400 font-normal">
                {savedPresets.length} saved
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Save distinct resume styling personas for different roles or industries, and switch between them anytime.
            </p>

            {/* List of Saved Personas */}
            {savedPresets.length > 0 && (
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {savedPresets.map((sp) => {
                  const isActive = sp.is_active;
                  return (
                    <div
                      key={sp.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                        isActive
                          ? "border-violet-600 bg-violet-50/60 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 bg-gray-50/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 truncate">
                            {sp.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-violet-600 text-white rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          Preset: {sp.preset}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleActivateSavedPreset(sp)}
                            className="px-2 py-1 text-[11px] font-medium text-violet-700 bg-white hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => sp.id && handleDeleteSavedPreset(sp.id, sp.name)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Persona"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save Current as New Persona Input */}
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Persona name e.g. Frontend Tech Lead"
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="button"
                disabled={isSavingPreset}
                onClick={handleSaveAsNewPreset}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0"
              >
                {isSavingPreset ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Save New</span>
              </button>
            </div>
          </div>

          {/* Preset Cards */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Preset Styles</span>
          </div>
          <p className="text-xs text-gray-500">
            Pick a pre-configured ATS template as a baseline, then customize any parameter below.
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-1">
            {RESUME_PRESETS.map((preset) => {
              const isSelected = theme.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  type="button"
                  className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full mt-0.5 shrink-0 border border-black/10 shadow-inner"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <Palette className="w-4 h-4 text-indigo-600" />
            <span>Color Palette</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Primary Accent (Titles/Name)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.primary}
                  onChange={(e) => updateColor("primary", e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={theme.colors.primary}
                  onChange={(e) => updateColor("primary", e.target.value)}
                  className="font-mono text-xs uppercase px-2 py-1.5 border border-gray-200 rounded-lg w-24"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Secondary (Roles/Company)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.secondary}
                  onChange={(e) => updateColor("secondary", e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={theme.colors.secondary}
                  onChange={(e) => updateColor("secondary", e.target.value)}
                  className="font-mono text-xs uppercase px-2 py-1.5 border border-gray-200 rounded-lg w-24"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Body Text
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.text}
                  onChange={(e) => updateColor("text", e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={theme.colors.text}
                  onChange={(e) => updateColor("text", e.target.value)}
                  className="font-mono text-xs uppercase px-2 py-1.5 border border-gray-200 rounded-lg w-24"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Muted (Dates/Tags)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.light}
                  onChange={(e) => updateColor("light", e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={theme.colors.light}
                  onChange={(e) => updateColor("light", e.target.value)}
                  className="font-mono text-xs uppercase px-2 py-1.5 border border-gray-200 rounded-lg w-24"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Section Divider Line
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.divider}
                  onChange={(e) => updateColor("divider", e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={theme.colors.divider}
                  onChange={(e) => updateColor("divider", e.target.value)}
                  className="font-mono text-xs uppercase px-2 py-1.5 border border-gray-200 rounded-lg w-24"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Typography & Spacing */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <Type className="w-4 h-4 text-emerald-600" />
            <span>Typography &amp; Scale</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Font Family */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Font Family (Universal ATS Standard)
              </label>
              <select
                value={theme.typography.fontFamily}
                onChange={(e) =>
                  setTheme((prev) => ({
                    ...prev,
                    preset: "custom",
                    typography: {
                      ...prev.typography,
                      fontFamily: e.target.value as FontFamilyOption,
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
              >
                <option value="Helvetica">Helvetica / Arial (Modern Sans-Serif)</option>
                <option value="Times-Roman">Times-Roman / Serif (Classic Corporate)</option>
                <option value="Courier">Courier (Technical Monospace)</option>
              </select>
            </div>

            {/* Font Size Scale */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Font Size Scale
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["compact", "normal", "spacious"] as FontSizeScaleOption[]).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() =>
                      setTheme((prev) => ({
                        ...prev,
                        preset: "custom",
                        typography: { ...prev.typography, fontSizeScale: scale },
                      }))
                    }
                    className={`py-1.5 px-3 rounded-lg border capitalize font-medium ${
                      theme.typography.fontSizeScale === scale
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Spacing */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Line Spacing
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["tight", "normal", "relaxed"] as LineSpacingOption[]).map((spacing) => (
                  <button
                    key={spacing}
                    type="button"
                    onClick={() =>
                      setTheme((prev) => ({
                        ...prev,
                        preset: "custom",
                        typography: { ...prev.typography, lineSpacing: spacing },
                      }))
                    }
                    className={`py-1.5 px-3 rounded-lg border capitalize font-medium ${
                      theme.typography.lineSpacing === spacing
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {spacing}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layout & Structure */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <Layout className="w-4 h-4 text-purple-600" />
            <span>Layout &amp; Dividers</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Header Style & Layout */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-medium">
                  Header Style &amp; Layout
                </label>
                <span className="text-[10px] text-gray-400">ATS Compliant</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      layout: {
                        ...prev.layout,
                        headerStyle: "stacked_left",
                        headerAlignment: "left",
                      },
                    }))
                  }
                  className={`py-1.5 px-2 rounded-lg border font-medium text-center text-[11px] ${
                    (theme.layout.headerStyle ||
                      (theme.layout.headerAlignment === "center"
                        ? "stacked_center"
                        : "stacked_left")) === "stacked_left"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Stacked Left
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      layout: {
                        ...prev.layout,
                        headerStyle: "stacked_center",
                        headerAlignment: "center",
                      },
                    }))
                  }
                  className={`py-1.5 px-2 rounded-lg border font-medium text-center text-[11px] ${
                    (theme.layout.headerStyle ||
                      (theme.layout.headerAlignment === "center"
                        ? "stacked_center"
                        : "stacked_left")) === "stacked_center"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Centered
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      layout: {
                        ...prev.layout,
                        headerStyle: "split_twocol",
                        headerAlignment: "left",
                      },
                    }))
                  }
                  className={`py-1.5 px-2 rounded-lg border font-medium text-center text-[11px] relative ${
                    theme.layout.headerStyle === "split_twocol"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Split 2-Col
                  <span className="block text-[9px] text-blue-500 font-normal">Space-saver</span>
                </button>
              </div>
            </div>

            {/* Target Professional Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-medium">
                  Target Professional Title
                </label>
                <span className="text-[10px] text-gray-400">Optional subtitle</span>
              </div>
              <input
                type="text"
                value={theme.layout.professionalTitle || ""}
                onChange={(e) =>
                  setTheme((prev) => ({
                    ...prev,
                    preset: "custom",
                    layout: { ...prev.layout, professionalTitle: e.target.value },
                  }))
                }
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Skills Layout */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Skills Display Layout
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      layout: { ...prev.layout, skillsLayout: "grid_3col" },
                    }))
                  }
                  className={`py-1.5 px-3 rounded-lg border font-medium ${
                    theme.layout.skillsLayout === "grid_3col"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  3-Column Grid
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => ({
                      ...prev,
                      preset: "custom",
                      layout: { ...prev.layout, skillsLayout: "inline_wrap" },
                    }))
                  }
                  className={`py-1.5 px-3 rounded-lg border font-medium ${
                    theme.layout.skillsLayout === "inline_wrap"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Inline Wrapped
                </button>
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Page Margins
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["compact", "normal", "wide"] as MarginsOption[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setTheme((prev) => ({
                        ...prev,
                        preset: "custom",
                        layout: { ...prev.layout, margins: m },
                      }))
                    }
                    className={`py-1.5 px-3 rounded-lg border capitalize font-medium ${
                      theme.layout.margins === m
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Section Heading Style */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-gray-700 font-medium mb-1.5">
                Section Heading Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "underline", label: "Underline Rule", desc: "Classic line divider" },
                  { id: "left_bar", label: "Left Accent Bar", desc: "Modern tech style" },
                  { id: "shaded_pill", label: "Shaded Pill", desc: "Subtle tinted band" },
                  { id: "borderless", label: "Minimal Borderless", desc: "Clean whitespace" },
                ].map((item) => {
                  const isSelected = (theme.layout.headingStyle || "underline") === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setTheme((prev) => ({
                          ...prev,
                          preset: "custom",
                          layout: {
                            ...prev.layout,
                            headingStyle: item.id as HeadingStyleOption,
                          },
                        }))
                      }
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-xs font-medium">{item.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dividers Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-gray-700 font-medium">Show Section Divider Rules</span>
              <input
                type="checkbox"
                checked={theme.layout.showDividers}
                onChange={(e) =>
                  setTheme((prev) => ({
                    ...prev,
                    preset: "custom",
                    layout: { ...prev.layout, showDividers: e.target.checked },
                  }))
                }
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section Ordering & Visibility */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <ListOrdered className="w-4 h-4 text-amber-600" />
              <span>Section Ordering &amp; Visibility</span>
            </div>
            <span className="text-[11px] text-gray-400">Reorder &amp; toggle</span>
          </div>

          <p className="text-xs text-gray-500">
            Show, hide, rename, and drag/reorder sections. Hide sections like Languages or Certifications to keep your resume within target page limits.
          </p>

          <div className="space-y-2 pt-1">
            {theme.layout.sectionOrder.map((sectionKey, index) => {
              const isHidden = Boolean(theme.layout.hiddenSections?.includes(sectionKey));
              const customTitle = theme.layout.customSectionTitles?.[sectionKey];
              const displayLabel = customTitle || SECTION_LABELS[sectionKey] || sectionKey;
              const isEditing = editingTitleKey === sectionKey;

              return (
                <div
                  key={sectionKey}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    isHidden
                      ? "bg-gray-100/70 border-dashed border-gray-300 text-gray-400"
                      : "bg-gray-50/90 border-gray-200 text-gray-800 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <button
                      type="button"
                      onClick={() => toggleSectionVisibility(sectionKey)}
                      className={`p-1 rounded-md transition-colors ${
                        isHidden
                          ? "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                          : "text-blue-600 hover:bg-blue-100"
                      }`}
                      title={isHidden ? "Click to Show Section" : "Click to Hide Section"}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={tempTitleText}
                          onChange={(e) => setTempTitleText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCustomTitle(sectionKey);
                            if (e.key === "Escape") setEditingTitleKey(null);
                          }}
                          className="px-2 py-0.5 border border-blue-400 rounded bg-white text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                          placeholder={SECTION_LABELS[sectionKey]}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomTitle(sectionKey)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Save Title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTitleKey(null)}
                          className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`${isHidden ? "line-through opacity-70" : ""}`}>
                          {index + 1}. {displayLabel}
                        </span>
                        {isHidden && (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.2 rounded font-normal">
                            Hidden
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditTitle(sectionKey)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded opacity-60 hover:opacity-100"
                          title="Rename Section Heading"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSection(index, "up")}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === theme.layout.sectionOrder.length - 1}
                      onClick={() => moveSection(index, "down")}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons Bar - Sticky at bottom with clean fade gradient mask & elevated glassmorphism */}
        <div className="sticky bottom-0 z-20 pt-4 pb-1 -mt-2 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent">
          <div className="bg-white/95 backdrop-blur-xl border border-gray-200/90 p-3 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-3 ring-1 ring-black/5">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="w-full flex-1 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Cloud...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save as Default Style</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Document Canvas - self-contained viewport with seamless canvas background */}
      <div className="lg:col-span-7 lg:h-full flex flex-col bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-inner overflow-hidden min-h-0">
        {/* Pinned Canvas Header */}
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 p-3 shadow-xs flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-800">
              Interactive Live Preview
            </span>
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isOnePage
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {isOnePage
                ? "Length: 1 Page (ATS Optimal)"
                : "Length: ~2 Pages"}
            </div>
          </div>

          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadTestPdf}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download Test PDF</span>
          </button>
        </div>

        {/* Scrollable Canvas Viewport - background seamlessly extends across full scrollable document */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col items-center w-full">
          {/* The Physical Paper Sheet - exactly 612px (8.5" letter at 72dpi) matching PDF print engine */}
          <div
            ref={paperRef}
            className="bg-white shadow-2xl rounded-sm w-[612px] max-w-full min-h-[792px] h-fit shrink-0 transition-all duration-200 relative mb-8"
            style={{
              fontFamily: fontStyleFamily,
              padding: paddingScale,
              lineHeight: lineSpacingStyle,
              color: theme.colors.text,
            }}
          >
            {/* Visual Page 1 End Marker (US Letter 8.5" x 11" exact 792px cutoff) */}
            <div
              className="absolute left-0 right-0 pointer-events-none select-none flex items-center justify-center z-10"
              style={{ top: "792px" }}
            >
              <div className="w-full border-b-2 border-dashed border-rose-300 relative">
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-xs tracking-wider uppercase">
                  Page 1 End (8.5&quot; &times; 11&quot;) &bull; Content below prints on Page 2
                </span>
              </div>
            </div>

            {/* HEADER */}
            {(() => {
              const currentHeaderStyle =
                theme.layout.headerStyle ||
                (theme.layout.headerAlignment === "center"
                  ? "stacked_center"
                  : "stacked_left");

              if (currentHeaderStyle === "split_twocol") {
                return (
                  <div className="mb-4 flex items-start justify-between gap-4">
                    {/* Left: Name + Target Professional Title */}
                    <div className="flex-1 text-left min-w-0">
                      <h1
                        className="font-bold tracking-tight uppercase leading-none"
                        style={{
                          fontSize: `calc(${currentSizes.name} * 0.95)`,
                          color: theme.colors.primary,
                        }}
                      >
                        {displayData.name || "Your Full Name"}
                      </h1>
                      {theme.layout.professionalTitle && (
                        <div
                          className="font-bold tracking-wide mt-1"
                          style={{
                            fontSize: currentSizes.heading,
                            color: theme.colors.secondary,
                          }}
                        >
                          {theme.layout.professionalTitle}
                        </div>
                      )}
                    </div>

                    {/* Right: Contact Information & Links (Right-Aligned) */}
                    <div className="text-right shrink-0 max-w-[45%]">
                      <div
                        className="font-medium"
                        style={{
                          fontSize: currentSizes.meta,
                          color: theme.colors.secondary,
                        }}
                      >
                        {[displayData.email, displayData.phone, displayData.location]
                          .filter(Boolean)
                          .join("  |  ")}
                      </div>

                      {displayData.links && (
                        <div
                          className="mt-1 font-medium space-x-2"
                          style={{ fontSize: currentSizes.meta }}
                        >
                          {Boolean(
                            displayData.links.linkedin &&
                              displayData.links.linkedin.trim() &&
                              !["NA", "N/A", "NONE", "NULL"].includes(
                                displayData.links.linkedin.trim().toUpperCase()
                              )
                          ) && (
                            <span
                              style={{ color: theme.colors.primary }}
                              className="underline"
                            >
                              LinkedIn
                            </span>
                          )}
                          {Boolean(
                            displayData.links.github &&
                              displayData.links.github.trim() &&
                              !["NA", "N/A", "NONE", "NULL"].includes(
                                displayData.links.github.trim().toUpperCase()
                              )
                          ) && (
                            <>
                              {Boolean(
                                displayData.links.linkedin &&
                                  displayData.links.linkedin.trim() &&
                                  !["NA", "N/A", "NONE", "NULL"].includes(
                                    displayData.links.linkedin.trim().toUpperCase()
                                  )
                              ) && <span className="text-gray-400">|</span>}
                              <span
                                style={{ color: theme.colors.primary }}
                                className="underline"
                              >
                                GitHub
                              </span>
                            </>
                          )}
                          {Boolean(
                            displayData.links.portfolio &&
                              displayData.links.portfolio.trim() &&
                              !["NA", "N/A", "NONE", "NULL"].includes(
                                displayData.links.portfolio.trim().toUpperCase()
                              )
                          ) && (
                            <>
                              {(Boolean(
                                displayData.links.linkedin &&
                                  displayData.links.linkedin.trim() &&
                                  !["NA", "N/A", "NONE", "NULL"].includes(
                                    displayData.links.linkedin.trim().toUpperCase()
                                  )
                              ) ||
                                Boolean(
                                  displayData.links.github &&
                                    displayData.links.github.trim() &&
                                    !["NA", "N/A", "NONE", "NULL"].includes(
                                      displayData.links.github.trim().toUpperCase()
                                    )
                                )) && <span className="text-gray-400">|</span>}
                              <span
                                style={{ color: theme.colors.primary }}
                                className="underline"
                              >
                                Portfolio
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Stacked Header (Left or Center)
              const isCentered = currentHeaderStyle === "stacked_center";
              return (
                <div className={`mb-4 ${isCentered ? "text-center" : "text-left"}`}>
                  <h1
                    className="font-bold tracking-tight uppercase"
                    style={{
                      fontSize: currentSizes.name,
                      color: theme.colors.primary,
                      lineHeight: "1.1",
                    }}
                  >
                    {displayData.name || "Your Full Name"}
                  </h1>

                  {theme.layout.professionalTitle && (
                    <div
                      className="font-bold tracking-wide mt-1 mb-1"
                      style={{
                        fontSize: currentSizes.heading,
                        color: theme.colors.secondary,
                      }}
                    >
                      {theme.layout.professionalTitle}
                    </div>
                  )}

                  <div
                    className="mt-1 font-medium"
                    style={{
                      fontSize: currentSizes.meta,
                      color: theme.colors.secondary,
                    }}
                  >
                    {[displayData.email, displayData.phone, displayData.location]
                      .filter(Boolean)
                      .join("  |  ")}
                  </div>

                  {displayData.links && (
                    <div
                      className="mt-1 font-medium space-x-2"
                      style={{ fontSize: currentSizes.meta }}
                    >
                      {Boolean(
                        displayData.links.linkedin &&
                          displayData.links.linkedin.trim() &&
                          !["NA", "N/A", "NONE", "NULL"].includes(
                            displayData.links.linkedin.trim().toUpperCase()
                          )
                      ) && (
                        <span
                          style={{ color: theme.colors.primary }}
                          className="underline"
                        >
                          LinkedIn
                        </span>
                      )}
                      {Boolean(
                        displayData.links.github &&
                          displayData.links.github.trim() &&
                          !["NA", "N/A", "NONE", "NULL"].includes(
                            displayData.links.github.trim().toUpperCase()
                          )
                      ) && (
                        <>
                          {Boolean(
                            displayData.links.linkedin &&
                              displayData.links.linkedin.trim() &&
                              !["NA", "N/A", "NONE", "NULL"].includes(
                                displayData.links.linkedin.trim().toUpperCase()
                              )
                          ) && <span className="text-gray-400">|</span>}
                          <span
                            style={{ color: theme.colors.primary }}
                            className="underline"
                          >
                            GitHub
                          </span>
                        </>
                      )}
                      {Boolean(
                        displayData.links.portfolio &&
                          displayData.links.portfolio.trim() &&
                          !["NA", "N/A", "NONE", "NULL"].includes(
                            displayData.links.portfolio.trim().toUpperCase()
                          )
                      ) && (
                        <>
                          {(Boolean(
                            displayData.links.linkedin &&
                              displayData.links.linkedin.trim() &&
                              !["NA", "N/A", "NONE", "NULL"].includes(
                                displayData.links.linkedin.trim().toUpperCase()
                              )
                          ) ||
                            Boolean(
                              displayData.links.github &&
                                displayData.links.github.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  displayData.links.github.trim().toUpperCase()
                                )
                            )) && <span className="text-gray-400">|</span>}
                          <span
                            style={{ color: theme.colors.primary }}
                            className="underline"
                          >
                            Portfolio
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SECTIONS IN DYNAMIC ORDER */}
            {theme.layout.sectionOrder.map((sectionKey) => {
              if (theme.layout.hiddenSections?.includes(sectionKey)) return null;
              const sectionHeading = (
                theme.layout.customSectionTitles?.[sectionKey] ||
                SECTION_LABELS[sectionKey] ||
                sectionKey
              ).toUpperCase();

              switch (sectionKey) {
                case "summary":
                  if (!displayData.summary) return null;
                  return (
                    <div key="summary" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}
                      <p
                        className="text-justify"
                        style={{ fontSize: currentSizes.body }}
                      >
                        {displayData.summary}
                      </p>
                    </div>
                  );

                case "skills":
                  if (!displayData.skills || displayData.skills.length === 0)
                    return null;
                  return (
                    <div key="skills" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}

                      {theme.layout.skillsLayout === "inline_wrap" ? (
                        <p style={{ fontSize: currentSizes.body }}>
                          {displayData.skills.join("  •  ")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                          {displayData.skills.map((skill, i) => (
                            <div
                              key={i}
                              className="truncate"
                              style={{ fontSize: currentSizes.body }}
                            >
                              • {skill}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );

                case "experience":
                  if (!displayData.experience || displayData.experience.length === 0)
                    return null;
                  return (
                    <div key="experience" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}

                      <div className="space-y-2">
                        {displayData.experience.map((exp, idx) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <span
                                className="font-bold"
                                style={{
                                  fontSize: currentSizes.body,
                                  color: theme.colors.primary,
                                }}
                              >
                                {exp.job_title}
                              </span>
                              <span
                                className="italic"
                                style={{
                                  fontSize: currentSizes.meta,
                                  color: theme.colors.light,
                                }}
                              >
                                {exp.start_date} - {exp.end_date || "Present"}
                              </span>
                            </div>

                            <div
                              className="font-semibold"
                              style={{
                                fontSize: currentSizes.body,
                                color: theme.colors.secondary,
                              }}
                            >
                              {[exp.company, exp.location]
                                .filter(Boolean)
                                .join(" | ")}
                            </div>

                            {exp.description && (
                              <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                                {exp.description.split("\n").map((line, lIdx) => {
                                  const text = line.replace(/^[•\-]\s*/, "");
                                  if (!text.trim()) return null;
                                  return (
                                    <li
                                      key={lIdx}
                                      style={{ fontSize: currentSizes.body }}
                                    >
                                      {text}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case "education":
                  if (!displayData.education || displayData.education.length === 0)
                    return null;
                  return (
                    <div key="education" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}

                      <div className="space-y-1.5">
                        {displayData.education.map((edu, idx) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <span
                                className="font-bold"
                                style={{
                                  fontSize: currentSizes.body,
                                  color: theme.colors.text,
                                }}
                              >
                                {edu.degree}
                                {edu.field_of_study ? `, ${edu.field_of_study}` : ""}
                              </span>
                              <span
                                className="italic"
                                style={{
                                  fontSize: currentSizes.meta,
                                  color: theme.colors.light,
                                }}
                              >
                                {edu.start_year && edu.end_year
                                  ? `${edu.start_year} - ${edu.end_year}`
                                  : edu.end_year || ""}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: currentSizes.body,
                                color: theme.colors.secondary,
                              }}
                            >
                              {edu.institution}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case "projects":
                  if (!displayData.projects || displayData.projects.length === 0)
                    return null;
                  return (
                    <div key="projects" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}

                      <div className="space-y-1.5">
                        {displayData.projects.map((proj, idx) => (
                          <div key={idx}>
                            <div
                              className="font-bold"
                              style={{
                                fontSize: currentSizes.body,
                                color: theme.colors.primary,
                              }}
                            >
                              {proj.name}
                            </div>
                            {proj.technologies && proj.technologies.length > 0 && (
                              <div
                                className="italic"
                                style={{
                                  fontSize: currentSizes.meta,
                                  color: theme.colors.light,
                                }}
                              >
                                Technologies: {proj.technologies.join(", ")}
                              </div>
                            )}
                            {proj.description && (
                              <p
                                className="mt-0.5"
                                style={{ fontSize: currentSizes.body }}
                              >
                                {proj.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case "certifications":
                  if (!displayData.certifications || displayData.certifications.length === 0)
                    return null;
                  return (
                    <div key="certifications" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}

                      <div className="space-y-1">
                        {displayData.certifications.map((cert, idx) => (
                          <div key={idx} className="flex justify-between items-baseline">
                            <div>
                              <span
                                className="font-bold"
                                style={{ fontSize: currentSizes.body }}
                              >
                                {cert.name}
                              </span>
                              {cert.issuer && (
                                <span
                                  className="ml-2"
                                  style={{
                                    fontSize: currentSizes.meta,
                                    color: theme.colors.secondary,
                                  }}
                                >
                                  ({cert.issuer})
                                </span>
                              )}
                            </div>
                            {cert.year && (
                              <span
                                className="italic"
                                style={{
                                  fontSize: currentSizes.meta,
                                  color: theme.colors.light,
                                }}
                              >
                                {cert.year}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case "languages":
                  if (!displayData.languages || displayData.languages.length === 0)
                    return null;
                  return (
                    <div key="languages" className="mb-2.5">
                      {renderCanvasSectionHeading(sectionHeading)}
                      <p style={{ fontSize: currentSizes.body }}>
                        {displayData.languages.join(", ")}
                      </p>
                    </div>
                  );

                default:
                  return null;
              }
            })}

            {/* Subtle Page Boundary Guide */}
            <div className="pt-4 border-t border-dashed border-gray-300 text-center text-[10px] text-gray-400 select-none">
              — End of Preview Document —
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
