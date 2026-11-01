"use client";

import { useState, useRef, useEffect } from "react";
import {
  Resume,
  ResumeThemeConfig,
  ResumeStyleSetting,
} from "@/types";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";
import {
  ONE_PAGE_TOLERANCE_PX,
} from "@/lib/resume-preview";
import { ResumeFormFields } from "@/components/resume/ResumeFormFields";
import ResumePreviewCanvas from "@/components/resume/ResumePreviewCanvas";
import ResumeStyleSidebar from "./ResumeStyleSidebar";
import {
  Download,
  Save,
  RotateCcw,
  Palette,
  FileText,
  Loader2,
  Info,
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

  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const selectedPersona = savedPresets.find((p) => p.id === selectedPersonaId);

  // UI status
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [paperHeight, setPaperHeight] = useState<number>(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Sync internal state if initialBaseResume updates asynchronously
  useEffect(() => {
    if (initialBaseResume?.name) {
      setFormData(initialBaseResume);
      baselineFormDataRef.current = JSON.parse(JSON.stringify(initialBaseResume));
    }
  }, [initialBaseResume]);

  // Sync theme if initialThemeConfig updates
  useEffect(() => {
    if (initialThemeConfig) {
      setTheme(initialThemeConfig);
      baselineThemeRef.current = JSON.parse(JSON.stringify(initialThemeConfig));
    }
  }, [initialThemeConfig]);

  // Sync presets if initialSavedSettings updates
  useEffect(() => {
    if (initialSavedSettings && initialSavedSettings.length > 0) {
      setSavedPresets(initialSavedSettings);
      const active = initialSavedSettings.find((p) => p.is_active);
      setSelectedPersonaId(active?.id || initialSavedSettings[0]?.id || null);
    }
  }, [initialSavedSettings]);

  useEffect(() => {
    if (paperRef.current) {
      setPaperHeight(paperRef.current.scrollHeight);
    }
  }, [theme, formData]);

  const isOnePage = paperHeight <= ONE_PAGE_TOLERANCE_PX;

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

  const updateLinkField = (field: keyof Resume["links"], value: string) => {
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

  // --- Persona Handlers (global style settings) ---
  const handleSelectPersona = (preset: ResumeStyleSetting) => {
    setSelectedPersonaId(preset.id || null);
    const cloned = JSON.parse(
      JSON.stringify(preset.theme_config || DEFAULT_THEME_CONFIG)
    );
    setTheme(cloned);
    // Selecting a persona only changes the Live View; the save baseline is
    // updated so "Reset Changes" reverts to this persona, not the old one.
    baselineThemeRef.current = JSON.parse(JSON.stringify(cloned));
  };

  const handleActivatePersona = async (presetRecord: ResumeStyleSetting) => {
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
          message: `✓ Persona "${presetRecord.name}" is now the active default!`,
          type: "success",
        });
      }
    } catch {
      setToast({ message: "Failed to switch active persona", type: "error" });
    }
  };

  const handleSaveAsNewPreset = async (name: string) => {
    const finalName =
      name ||
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

  const handleDeleteSavedPreset = async (id: string, name: string) => {
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

  // --- Reset Handler: Reverts unsaved changes back to the selected persona and baseline profile ---
  const handleResetToBaseline = () => {
    // Revert style to baseline for the selected persona
    setTheme(JSON.parse(JSON.stringify(baselineThemeRef.current)));
    // Revert form data to baseline
    setFormData(JSON.parse(JSON.stringify(baselineFormDataRef.current)));

    const personaName =
      savedPresets.find((p) => p.id === selectedPersonaId)?.name ||
      (theme.preset !== "custom" ? theme.preset : "your saved style");
    setToast({
      message: `Reverted unsaved changes. Style restored to "${personaName}" and content restored to your last saved profile.`,
      type: "success",
    });
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
            <ResumeStyleSidebar
              theme={theme}
              onThemeChange={setTheme}
              savedPresets={savedPresets}
              selectedPersonaId={selectedPersonaId}
              onSelectPersona={handleSelectPersona}
              onActivatePersona={handleActivatePersona}
              onDeletePersona={handleDeleteSavedPreset}
              onSaveAsNewPersona={handleSaveAsNewPreset}
              isSavingPersona={isSavingPreset}
              showPersonaManagement={true}
            />
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
            <ResumePreviewCanvas ref={paperRef} resume={formData} theme={theme} />
            <div className="pb-4 -mt-6 text-[10px] text-gray-400 select-none">
              — End of Preview Document —
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
