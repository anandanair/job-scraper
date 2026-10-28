"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import {
  Resume,
  Education,
  Experience,
  Project,
  Certification,
  Links,
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
import { ResumeFormFields } from "@/components/resume/ResumeFormFields";
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

interface ResumeStudioClientProps {
  initialBaseResume: Resume | null;
  initialThemeConfig: ResumeThemeConfig;
  initialSavedSettings?: ResumeStyleSetting[];
  defaultTab?: "content" | "style";
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
        "- Architected scalable microservices supporting 2M+ active monthly users.\n- Led migration from monolithic architecture to serverless microservices, cutting infrastructure costs by 34%.\n- Mentored 8 junior and mid-level engineers in production-grade code reviews and testing standards.",
    },
    {
      job_title: "Software Engineer",
      company: "Apex Digital Systems",
      location: "Singapore",
      start_date: "2019",
      end_date: "2022",
      description:
        "- Developed high-performance frontend interfaces with React, Next.js, and TypeScript.\n- Designed real-time data streaming pipelines with Redis and PostgreSQL, achieving sub-50ms latency.",
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

export default function ResumeStudioClient({
  initialBaseResume,
  initialThemeConfig,
  initialSavedSettings,
  defaultTab = "content",
}: ResumeStudioClientProps) {
  // Tab Mode: Content editing vs Design & Style
  const [activeTab, setActiveTab] = useState<"content" | "style">(defaultTab);

  // Content state (Base Resume)
  const [formData, setFormData] = useState<Resume>(
    initialBaseResume?.name ? initialBaseResume : SAMPLE_RESUME_DATA
  );

  // Style state
  const [theme, setTheme] = useState<ResumeThemeConfig>(initialThemeConfig);
  const [savedPresets, setSavedPresets] = useState<ResumeStyleSetting[]>(
    initialSavedSettings || []
  );

  // Selected persona state (which persona is currently selected and showing in Live View)
  const initialActive = (initialSavedSettings || []).find((p) => p.is_active);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    initialActive?.id || initialSavedSettings?.[0]?.id || null
  );

  // Baselines for undoing unsaved changes (Reset)
  const baselineThemeRef = useRef<ResumeThemeConfig>(
    JSON.parse(JSON.stringify(initialActive?.theme_config || initialThemeConfig))
  );
  const baselineFormDataRef = useRef<Resume>(
    JSON.parse(
      JSON.stringify(
        initialBaseResume?.name ? initialBaseResume : SAMPLE_RESUME_DATA
      )
    )
  );

  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // UI status
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [paperHeight, setPaperHeight] = useState<number>(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (paperRef.current) {
      setPaperHeight(paperRef.current.scrollHeight);
    }
  }, [theme, formData]);

  const isOnePage = paperHeight <= 795;

  // --- Content Form Handlers ---
  const updateField = (field: keyof Resume, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNestedField = <T extends object>(
    section: keyof Resume,
    index: number,
    field: keyof T,
    value: string
  ) => {
    setFormData((prev) => {
      const arr = [...((prev[section] as any[]) || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [section]: arr };
    });
  };

  const updateLinkField = (field: keyof Links, value: string) => {
    setFormData((prev) => ({
      ...prev,
      links: { ...prev.links, [field]: value },
    }));
  };

  const addArrayItem = (section: keyof Resume, template: object) => {
    setFormData((prev) => ({
      ...prev,
      [section]: [...((prev[section] as any[]) || []), template],
    }));
  };

  const removeArrayItem = (section: keyof Resume, index: number) => {
    setFormData((prev) => {
      const arr = [...((prev[section] as any[]) || [])];
      arr.splice(index, 1);
      return { ...prev, [section]: arr };
    });
  };

  // --- Preset Selection ---
  const handleSelectPreset = (presetId: string) => {
    const selected = RESUME_PRESETS.find((p) => p.id === presetId);
    if (selected) {
      const cloned = JSON.parse(JSON.stringify(selected.config));
      setTheme(cloned);
      if (!selectedPersonaId) {
        baselineThemeRef.current = JSON.parse(JSON.stringify(cloned));
      }
      setToast({
        message: `Applied "${selected.name}" preset to Live View.`,
        type: "success",
      });
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

  const updateColor = (key: keyof ResumeThemeConfig["colors"], value: string) => {
    setTheme((prev) => ({
      ...prev,
      preset: "custom",
      colors: { ...prev.colors, [key]: value },
    }));
  };

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

  // --- Reset Handler: Reverts unsaved changes back to the selected persona and baseline profile ---
  const handleResetToBaseline = () => {
    // Revert style to baseline for the selected persona
    setTheme(JSON.parse(JSON.stringify(baselineThemeRef.current)));
    // Revert form data to baseline
    setFormData(JSON.parse(JSON.stringify(baselineFormDataRef.current)));

    const personaName =
      savedPresets.find((p) => p.id === selectedPersonaId)?.name ||
      (theme.preset ? `${theme.preset} Preset` : "Selected Persona");

    setToast({
      message: `Reverted unsaved changes back to "${personaName}".`,
      type: "success",
    });
  };

  // --- Saved Personas Handlers ---
  const handleSelectPersona = (sp: ResumeStyleSetting) => {
    if (!sp.id) return;
    setSelectedPersonaId(sp.id);
    const cloned = JSON.parse(JSON.stringify(sp.theme_config));
    setTheme(cloned);
    baselineThemeRef.current = JSON.parse(JSON.stringify(cloned));
    setToast({
      message: `Loaded persona "${sp.name}" into Live View.`,
      type: "success",
    });
  };

  const handleActivateSavedPreset = async (
    presetRecord: ResumeStyleSetting,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!presetRecord.id) return;
    try {
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
          message: `Persona "${presetRecord.name}" is now the active default!`,
          type: "success",
        });
      }
    } catch {
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
          makeActive: savedPresets.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save persona");

      if (data.record) {
        const newRecord: ResumeStyleSetting = data.record;
        setSavedPresets((prev) => [newRecord, ...prev]);
        setSelectedPersonaId(newRecord.id || null);
        baselineThemeRef.current = JSON.parse(JSON.stringify(newRecord.theme_config));
        setNewPresetName("");
        setToast({
          message: `Saved and selected new persona "${finalName}"!`,
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

  const handleDeleteSavedPreset = async (
    id: string,
    name: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch("/api/resume-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        setSavedPresets((prev) => prev.filter((p) => p.id !== id));
        if (selectedPersonaId === id) {
          const remaining = savedPresets.filter((p) => p.id !== id);
          if (remaining.length > 0) {
            setSelectedPersonaId(remaining[0].id || null);
            setTheme(remaining[0].theme_config);
            baselineThemeRef.current = JSON.parse(
              JSON.stringify(remaining[0].theme_config)
            );
          } else {
            setSelectedPersonaId(null);
          }
        }
        setToast({
          message: `Deleted persona "${name}".`,
          type: "success",
        });
      }
    } catch {
      setToast({ message: "Failed to delete persona", type: "error" });
    }
  };

  // --- UNIFIED SAVE: Saves BOTH base resume content AND style settings ---
  // Style is saved specifically to the SELECTED persona!
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    setToast(null);
    try {
      const {
        id,
        created_at,
        parsed_at,
        last_updated,
        resume_link,
        ...cleanData
      } = formData;

      // 1. Content Save (global master resume)
      const contentPromise = fetch("/api/base-resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });

      // 2. Style Save (saved to the SELECTED persona)
      let stylePromise: Promise<Response>;
      const selectedPersona = savedPresets.find(
        (p) => p.id === selectedPersonaId
      );

      if (selectedPersonaId && selectedPersona) {
        stylePromise = fetch("/api/resume-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: selectedPersonaId,
            themeConfig: theme,
            name: selectedPersona.name,
          }),
        });
      } else {
        stylePromise = fetch("/api/resume-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            themeConfig: theme,
            name:
              theme.preset === "custom"
                ? "Custom Persona"
                : `${theme.preset} Persona`,
            makeActive: savedPresets.length === 0,
          }),
        });
      }

      const [resContent, resStyle] = await Promise.all([
        contentPromise,
        stylePromise,
      ]);

      if (!resContent.ok) {
        const err = await resContent.json().catch(() => null);
        throw new Error(err?.error || "Failed to save base resume content");
      }
      if (!resStyle.ok) {
        const err = await resStyle.json().catch(() => null);
        throw new Error(err?.error || "Failed to save persona style settings");
      }

      const styleData = await resStyle.json();

      // Update baselines
      baselineFormDataRef.current = JSON.parse(JSON.stringify(formData));
      baselineThemeRef.current = JSON.parse(JSON.stringify(theme));

      if (styleData.record) {
        const updatedRecord: ResumeStyleSetting = styleData.record;
        setSavedPresets((prev) => {
          const index = prev.findIndex((p) => p.id === updatedRecord.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedRecord;
            return next;
          }
          return [updatedRecord, ...prev];
        });
        if (!selectedPersonaId && updatedRecord.id) {
          setSelectedPersonaId(updatedRecord.id);
        }
      }

      const targetPersonaName = selectedPersona?.name || "Selected Persona";
      setToast({
        message: `Saved all changes! Profile content updated, and design saved to "${targetPersonaName}".`,
        type: "success",
      });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to save changes",
        type: "error",
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  // --- Download PDF with current content + current style ---
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const { id, created_at, parsed_at, last_updated, resume_link, ...cleanData } =
        formData;

      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData: cleanData,
          styleConfig: theme,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to compile PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formData.name?.replace(/\s+/g, "_") || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({
        message: "Resume PDF generated and downloaded successfully!",
        type: "success",
      });
    } catch (err: any) {
      setToast({
        message: err.message || "Error generating PDF",
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Calibrated 1:1 CSS mappings matching PDFKit points at 72dpi ---
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
          className={`shrink-0 mb-2 p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Split Pane: Left controls and Right preview */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch lg:overflow-hidden">
        {/* LEFT COLUMN: Dual-Mode Sidebar */}
        <div className="lg:col-span-5 lg:h-full lg:overflow-y-auto custom-scrollbar pr-1 sm:pr-2 space-y-4 pb-6">
          {/* Dual-Mode Tab Switcher */}
          <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-md pt-1 pb-2">
            <div className="flex rounded-xl bg-gray-200/80 p-1 border border-gray-300/80 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "content"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Resume Content</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("style")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "style"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Design &amp; Style</span>
              </button>
            </div>
          </div>

          {/* TAB 1: RESUME CONTENT MODE */}
          {activeTab === "content" && (
            <div className="space-y-4">
              <div className="bg-blue-50/80 rounded-xl border border-blue-200 p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  Editing your base resume below updates the live preview on the right instantly. Click <strong>&quot;Save All Changes&quot;</strong> when finished to persist changes to your master profile.
                </p>
              </div>

              <ResumeFormFields
                formData={formData}
                updateField={updateField}
                updateNestedField={updateNestedField}
                updateLinkField={updateLinkField}
                addArrayItem={addArrayItem}
                removeArrayItem={removeArrayItem}
              />
            </div>
          )}

          {/* TAB 2: DESIGN & STYLE MODE */}
          {activeTab === "style" && (
            <div className="space-y-4">
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
                  Save distinct styling personas for different roles or industries, and switch between them anytime.
                </p>

                {/* List of Saved Personas */}
                {savedPresets.length > 0 && (
                  <div className="space-y-2 pt-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {savedPresets.map((sp) => {
                      const isActive = sp.is_active;
                      const isSelected = selectedPersonaId === sp.id;
                      return (
                        <div
                          key={sp.id}
                          onClick={() => handleSelectPersona(sp)}
                          className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/30 shadow-xs"
                              : "border-gray-200 hover:border-violet-300 hover:bg-gray-50/80 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0 mr-2 flex-wrap">
                              <span className="font-semibold text-gray-900 truncate">
                                {sp.name}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-600 text-white rounded-md shrink-0 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  Active Default
                                </span>
                              )}
                              {isSelected && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-600 text-white rounded-md shrink-0">
                                  Live View
                                </span>
                              )}
                            </div>

                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={(e) => handleActivateSavedPreset(sp, e)}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                                  title="Set as global active default for AI job generation"
                                >
                                  Set as Active
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sp.id) handleDeleteSavedPreset(sp.id, sp.name, e);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Persona"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                            <span>Preset: {sp.preset}</span>
                            <span className="text-[10px] font-medium text-violet-600">
                              {isSelected ? "● Selected & Live" : "Click to view & edit"}
                            </span>
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
                      <span className="text-gray-500 font-mono text-xs uppercase">
                        {theme.colors.primary}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Secondary (Roles/Subtitles)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.colors.secondary}
                        onChange={(e) => updateColor("secondary", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-gray-500 font-mono text-xs uppercase">
                        {theme.colors.secondary}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Body Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.colors.text}
                        onChange={(e) => updateColor("text", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-gray-500 font-mono text-xs uppercase">
                        {theme.colors.text}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Muted / Dates Text
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.colors.light}
                        onChange={(e) => updateColor("light", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-gray-500 font-mono text-xs uppercase">
                        {theme.colors.light}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-gray-700 font-medium mb-1">
                      Divider Rules Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.colors.divider}
                        onChange={(e) => updateColor("divider", e.target.value)}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-gray-500 font-mono text-xs uppercase">
                        {theme.colors.divider}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  <Type className="w-4 h-4 text-emerald-600" />
                  <span>Typography</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Standard ATS Font Family
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Helvetica">Helvetica / Arial (Universal Sans-Serif)</option>
                      <option value="Times-Roman">Times New Roman (Classic Editorial Serif)</option>
                      <option value="Courier">Courier (Monospace Technical)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Font Sizing Scale
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
                          className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
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
                          className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
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

              {/* Section Heading Style */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Section Heading Style</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "underline", label: "Full Underline", desc: "Classic rule beneath heading" },
                    { id: "left_bar", label: "Left Pillar Bar", desc: "Modern vertical accent bar" },
                    { id: "shaded_pill", label: "Shaded Pill", desc: "Pastel background box" },
                    { id: "borderless", label: "Borderless Minimal", desc: "Clean typography-only" },
                  ].map((styleOpt) => {
                    const isSelected = (theme.layout.headingStyle || "underline") === styleOpt.id;
                    return (
                      <button
                        key={styleOpt.id}
                        type="button"
                        onClick={() =>
                          setTheme((prev) => ({
                            ...prev,
                            preset: "custom",
                            layout: { ...prev.layout, headingStyle: styleOpt.id as HeadingStyleOption },
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-amber-600 bg-amber-50/60 shadow-xs"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{styleOpt.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{styleOpt.desc}</div>
                      </button>
                    );
                  })}
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
                        Inline Bullet Tags
                      </button>
                    </div>
                  </div>

                  {/* Page Margins */}
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">
                      Page Margins
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["compact", "normal", "wide"] as MarginsOption[]).map((margin) => (
                        <button
                          key={margin}
                          type="button"
                          onClick={() =>
                            setTheme((prev) => ({
                              ...prev,
                              preset: "custom",
                              layout: { ...prev.layout, margins: margin },
                            }))
                          }
                          className={`py-1.5 px-2 rounded-lg border font-medium capitalize text-center ${
                            theme.layout.margins === margin
                              ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {margin}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dividers */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800">
                        Section Divider Lines
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Render clean horizontal rules between resume sections
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={theme.layout.showDividers}
                        onChange={(e) =>
                          setTheme((prev) => ({
                            ...prev,
                            preset: "custom",
                            layout: {
                              ...prev.layout,
                              showDividers: e.target.checked,
                            },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Section Order & Visibility */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <ListOrdered className="w-4 h-4 text-orange-600" />
                    <span>Section Order &amp; Visibility</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Rename, hide, or reorder
                  </span>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  {theme.layout.sectionOrder.map((sectionKey, index) => {
                    const isHidden = theme.layout.hiddenSections?.includes(sectionKey);
                    const customTitle = theme.layout.customSectionTitles?.[sectionKey];
                    const displayLabel = customTitle || SECTION_LABELS[sectionKey] || sectionKey;
                    const isEditing = editingTitleKey === sectionKey;

                    return (
                      <div
                        key={sectionKey}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isHidden
                            ? "bg-gray-100/70 border-gray-200 text-gray-400"
                            : "bg-gray-50 border-gray-200 text-gray-800"
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
                            className="p-1 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move section up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === theme.layout.sectionOrder.length - 1}
                            onClick={() => moveSection(index, "down")}
                            className="p-1 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move section down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Unified Action Footer */}
          <div className="sticky bottom-0 z-20 pt-3 pb-1 -mx-1 px-1 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent">
            <div className="p-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-gray-200 shadow-lg flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToBaseline}
                disabled={isSavingAll}
                className="py-2.5 px-3 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
                title="Undo unsaved changes since last save"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                <span>Reset Changes</span>
              </button>

              <button
                type="button"
                disabled={isSavingAll}
                onClick={handleSaveAll}
                className="flex-1 py-2.5 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving All Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Document Canvas Viewport */}
        <div className="lg:col-span-7 lg:h-full flex flex-col bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-inner overflow-hidden min-h-0">
          {/* Pinned Canvas Header */}
          <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 p-3 shadow-xs flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-800">
                Live Interactive Preview
              </span>
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isOnePage
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {isOnePage ? "Length: 1 Page (ATS Optimal)" : "Length: ~2 Pages"}
              </div>
            </div>

            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>
          </div>

          {/* Scrollable Canvas Viewport */}
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
                          {formData.name || "Your Full Name"}
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
                          {[formData.email, formData.phone, formData.location]
                            .filter(Boolean)
                            .join("  |  ")}
                        </div>

                        {formData.links && (
                          <div
                            className="mt-1 font-medium space-x-2"
                            style={{ fontSize: currentSizes.meta }}
                          >
                            {Boolean(
                              formData.links.linkedin &&
                                formData.links.linkedin.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  formData.links.linkedin.trim().toUpperCase()
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
                              formData.links.github &&
                                formData.links.github.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  formData.links.github.trim().toUpperCase()
                                )
                            ) && (
                              <>
                                {Boolean(
                                  formData.links.linkedin &&
                                    formData.links.linkedin.trim() &&
                                    !["NA", "N/A", "NONE", "NULL"].includes(
                                      formData.links.linkedin.trim().toUpperCase()
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
                              formData.links.portfolio &&
                                formData.links.portfolio.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  formData.links.portfolio.trim().toUpperCase()
                                )
                            ) && (
                              <>
                                {(Boolean(
                                  formData.links.linkedin &&
                                    formData.links.linkedin.trim() &&
                                    !["NA", "N/A", "NONE", "NULL"].includes(
                                      formData.links.linkedin.trim().toUpperCase()
                                    )
                                ) ||
                                  Boolean(
                                    formData.links.github &&
                                      formData.links.github.trim() &&
                                      !["NA", "N/A", "NONE", "NULL"].includes(
                                        formData.links.github.trim().toUpperCase()
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
                      {formData.name || "Your Full Name"}
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
                      {[formData.email, formData.phone, formData.location]
                        .filter(Boolean)
                        .join("  |  ")}
                    </div>

                    {formData.links && (
                      <div
                        className="mt-1 font-medium space-x-2"
                        style={{ fontSize: currentSizes.meta }}
                      >
                        {Boolean(
                          formData.links.linkedin &&
                            formData.links.linkedin.trim() &&
                            !["NA", "N/A", "NONE", "NULL"].includes(
                              formData.links.linkedin.trim().toUpperCase()
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
                          formData.links.github &&
                            formData.links.github.trim() &&
                            !["NA", "N/A", "NONE", "NULL"].includes(
                              formData.links.github.trim().toUpperCase()
                            )
                        ) && (
                          <>
                            {Boolean(
                              formData.links.linkedin &&
                                formData.links.linkedin.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  formData.links.linkedin.trim().toUpperCase()
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
                          formData.links.portfolio &&
                            formData.links.portfolio.trim() &&
                            !["NA", "N/A", "NONE", "NULL"].includes(
                              formData.links.portfolio.trim().toUpperCase()
                            )
                        ) && (
                          <>
                            {(Boolean(
                              formData.links.linkedin &&
                                formData.links.linkedin.trim() &&
                                !["NA", "N/A", "NONE", "NULL"].includes(
                                  formData.links.linkedin.trim().toUpperCase()
                                )
                            ) ||
                              Boolean(
                                formData.links.github &&
                                  formData.links.github.trim() &&
                                  !["NA", "N/A", "NONE", "NULL"].includes(
                                    formData.links.github.trim().toUpperCase()
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
                    if (!formData.summary) return null;
                    return (
                      <div key="summary" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}
                        <p
                          className="text-justify"
                          style={{ fontSize: currentSizes.body }}
                        >
                          {formData.summary}
                        </p>
                      </div>
                    );

                  case "skills":
                    if (!formData.skills || formData.skills.length === 0)
                      return null;
                    return (
                      <div key="skills" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}

                        {theme.layout.skillsLayout === "inline_wrap" ? (
                          <p style={{ fontSize: currentSizes.body }}>
                            {formData.skills.join("  •  ")}
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                            {formData.skills.map((skill, i) => (
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
                    if (!formData.experience || formData.experience.length === 0)
                      return null;
                    return (
                      <div key="experience" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}

                        <div className="space-y-2">
                          {formData.experience.map((exp, idx) => (
                            <div key={idx} className="break-inside-avoid">
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
                    if (!formData.education || formData.education.length === 0)
                      return null;
                    return (
                      <div key="education" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}

                        <div className="space-y-1.5">
                          {formData.education.map((edu, idx) => (
                            <div key={idx} className="break-inside-avoid">
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
                    if (!formData.projects || formData.projects.length === 0)
                      return null;
                    return (
                      <div key="projects" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}

                        <div className="space-y-1.5">
                          {formData.projects.map((proj, idx) => (
                            <div key={idx} className="break-inside-avoid">
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
                    if (!formData.certifications || formData.certifications.length === 0)
                      return null;
                    return (
                      <div key="certifications" className="mb-2.5">
                        {renderCanvasSectionHeading(sectionHeading)}

                        <div className="space-y-1">
                          {formData.certifications.map((cert, idx) => (
                            <div key={idx} className="flex justify-between items-baseline break-inside-avoid">
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
                    if (!formData.languages || formData.languages.length === 0)
                      return null;
                    return (
                      <div key="languages" className="mb-2.5 break-inside-avoid">
                        {renderCanvasSectionHeading(sectionHeading)}
                        <p style={{ fontSize: currentSizes.body }}>
                          {formData.languages.join(", ")}
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
