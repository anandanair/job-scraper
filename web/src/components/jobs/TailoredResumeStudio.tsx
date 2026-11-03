"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Resume,
  ResumeThemeConfig,
  ResumeStyleSetting,
  Links,
} from "@/types";
import {
  ONE_PAGE_TOLERANCE_PX,
} from "@/lib/resume-preview";
import ResumePreviewCanvas from "@/components/resume/ResumePreviewCanvas";
import ResumeStyleSidebar from "@/components/resume-studio/ResumeStyleSidebar";
import { ResumeFormFields } from "@/components/resume/ResumeFormFields";
import {
  Check,
  Download,
  Save,
  RotateCcw,
  Palette,
  FileText,
  Loader2,
  Info,
  X,
  PanelLeftOpen,
  PanelLeftClose,
  AlertTriangle,
  Mail,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface TailoredResumeStudioProps {
  jobId: string;
  resumeId: string;
  initialResume: Resume;
  initialThemeConfig: ResumeThemeConfig;
  savedPresets: ResumeStyleSetting[];
  fileName: string;
}

type StudioTab = "content" | "style";
type ViewMode = "pdf" | "preview";

/**
 * Per-job tailored resume studio.
 *
 * Opens as a focused PDF viewer (sidebar closed). Toggling the sidebar reveals
 * the Resume Studio editing experience (Content / Design & Style tabs) with a
 * live 1:1 preview. Every save is scoped to THIS customized resume only —
 * global personas and the master profile are never modified.
 */
export default function TailoredResumeStudio({
  jobId,
  resumeId,
  initialResume,
  initialThemeConfig,
  savedPresets,
  fileName,
}: TailoredResumeStudioProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Viewer state ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>("content");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfTimestamp, setPdfTimestamp] = useState<number>(() => Date.now());
  const [pdfError, setPdfError] = useState<string | null>(null);

  // --- Editable state (scoped to this customized resume) ---
  const [formData, setFormData] = useState<Resume>(initialResume);
  const [theme, setTheme] = useState<ResumeThemeConfig>(initialThemeConfig);

  // Baselines for Reset (last saved state of this resume)
  const baselineFormDataRef = useRef<Resume>(
    JSON.parse(JSON.stringify(initialResume))
  );
  const baselineThemeRef = useRef<ResumeThemeConfig>(
    JSON.parse(JSON.stringify(initialThemeConfig))
  );

  // --- UI status ---
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [paperHeight, setPaperHeight] = useState<number>(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const pdfUrl = `/api/customized_resumes/${resumeId}/pdf?t=${pdfTimestamp}`;

  // --- Dirty check: any unsaved content or design change? ---
  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(baselineFormDataRef.current) ||
    JSON.stringify(theme) !== JSON.stringify(baselineThemeRef.current);

  useEffect(() => {
    if (paperRef.current) {
      setPaperHeight(paperRef.current.scrollHeight);
    }
  }, [theme, formData, isSidebarOpen, activeTab]);

  const isOnePage = paperHeight <= ONE_PAGE_TOLERANCE_PX;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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

  // --- Persona selection: apply a COPY of a global persona to this resume ---
  const handleSelectPersona = (preset: ResumeStyleSetting) => {
    setTheme(JSON.parse(JSON.stringify(preset.theme_config)));
    setToast({
      message: `Applied "${preset.name}" to this resume's live view. Save to persist it here — your global default is untouched.`,
      type: "success",
    });
  };

  // --- Save: PATCH this customized resume only (content + theme snapshot) ---
  const handleSave = async () => {
    setIsSaving(true);
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

      const response = await fetch(`/api/customized_resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cleanData,
          theme_config: theme,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Failed to save (HTTP ${response.status})`);
      }

      const updated: Resume = await response.json();

      baselineFormDataRef.current = JSON.parse(
        JSON.stringify(updated || formData)
      );
      baselineThemeRef.current = JSON.parse(JSON.stringify(theme));
      setFormData((prev) => ({ ...prev, ...(updated || {}) }));
      // Bust the PDF cache so the true-PDF view reflects the new snapshot
      setPdfTimestamp(Date.now());

      setToast({
        message: "Saved! This tailored resume has been updated.",
        type: "success",
      });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to save changes",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToBaseline = () => {
    setFormData(JSON.parse(JSON.stringify(baselineFormDataRef.current)));
    setTheme(JSON.parse(JSON.stringify(baselineThemeRef.current)));
    setToast({
      message: "Reverted unsaved changes.",
      type: "success",
    });
  };

  // --- Download the persisted PDF snapshot ---
  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/customized_resumes/${resumeId}/pdf?download=true`
      );
      if (!response.ok) {
        throw new Error(`Failed to download PDF (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName.toLowerCase().endsWith(".pdf")
        ? fileName
        : `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      console.error("Error downloading PDF:", err);
      setToast({
        message: err.message || "Error downloading PDF",
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Close / navigation with unsaved-changes guard ---
  const getSourcePath = useCallback((): string => {
    const source = searchParams.get("source");
    if (source) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("source");
      const queryString = params.toString();
      return queryString ? `${source}?${queryString}` : source;
    }
    return `/jobs/${jobId}`;
  }, [searchParams, jobId]);

  const requestClose = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    router.push(getSourcePath());
  };

  const confirmClose = () => {
    setShowUnsavedDialog(false);
    router.push(getSourcePath());
  };

  // Escape closes the sidebar first (if open), then the viewer
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showUnsavedDialog) {
        setShowUnsavedDialog(false);
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false);
      } else {
        requestClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSidebarOpen, showUnsavedDialog, requestClose]);

  const onDocumentLoadSuccess = ({ numPages: next }: { numPages: number }) => {
    setNumPages(next);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Failed to load PDF:", error);
    setPdfError(error.message);
  };

  const jobContext = (() => {
    const source = searchParams.get("source") || "";
    if (source.includes("top-matches")) return "Top Matches";
    if (source.includes("applied")) return "Applied";
    if (source.includes("tailored")) return "Tailored";
    if (source.includes("new")) return "New Jobs";
    return null;
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Top Toolbar */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/50 py-3 px-4 sm:px-6 shadow-lg shrink-0">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Hide editor panel" : "Edit this resume"}
              className={`p-2 rounded-xl transition-all duration-200 shrink-0 ${
                isSidebarOpen
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/50"
              }`}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  Tailored Resume
                </h1>
                {isDirty && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                    Unsaved
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {jobContext ? `${jobContext} • ` : ""}Edits apply to this
                application only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View mode switch: live preview vs true PDF */}
            <div className="hidden sm:flex rounded-lg bg-gray-100/80 dark:bg-gray-700/40 p-0.5 border border-gray-200 dark:border-gray-600/50">
              <button
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "preview"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
                }`}
              >
                Live Preview
              </button>
              <button
                onClick={() => setViewMode("pdf")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "pdf"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
                }`}
              >
                True PDF
              </button>
            </div>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              title="Download PDF"
              className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>

            <Link
              href={`/jobs/${jobId}/cover-letter`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all"
              title="Go to Cover Letter for this job"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Cover Letter</span>
            </Link>

            <button
              onClick={requestClose}
              className="px-4 py-2 bg-gray-200/80 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300/80 dark:hover:bg-gray-600/50 transition-all duration-200 font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* EDITOR SIDEBAR (toggleable) */}
        {isSidebarOpen && (
          <div className="w-full lg:w-5/12 xl:w-5/12 flex-shrink-0 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4 pb-6">
              {/* Scoped-editing notice */}
              <div className="bg-violet-50/80 rounded-xl border border-violet-200 p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <p className="text-xs text-violet-900 leading-relaxed">
                  You are editing the tailored resume for{" "}
                  <strong>this application only</strong>. Your master profile
                  and global style personas are never modified here.
                </p>
              </div>

              {/* Dual-Mode Tab Switcher */}
              <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md pt-1 pb-2">
                <div className="flex rounded-xl bg-gray-200/80 dark:bg-gray-700/60 p-1 border border-gray-300/80 dark:border-gray-600/60 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("content")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === "content"
                        ? "bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
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
                        ? "bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Design &amp; Style</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: CONTENT */}
              {activeTab === "content" && (
                <div className="space-y-4">
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

              {/* TAB 2: DESIGN & STYLE (personas are read-only sources here) */}
              {activeTab === "style" && (
                <ResumeStyleSidebar
                  theme={theme}
                  onThemeChange={setTheme}
                  savedPresets={savedPresets}
                  selectedPersonaId={null}
                  onSelectPersona={handleSelectPersona}
                  onActivatePersona={() => {}}
                  onDeletePersona={() => {}}
                  onSaveAsNewPersona={() => {}}
                  isSavingPersona={false}
                  showPersonaManagement={false}
                />
              )}

              {/* Sticky Action Footer */}
              <div className="sticky bottom-0 z-20 pt-3 pb-1 -mx-1 px-1 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent dark:from-gray-900 dark:via-gray-900/95">
                <div className="p-2.5 rounded-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-lg flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToBaseline}
                    disabled={isSaving || !isDirty}
                    className="py-2.5 px-3 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                    title="Undo unsaved changes since last save"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || !isDirty}
                    onClick={handleSave}
                    className="flex-1 py-2.5 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENT AREA */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {viewMode === "preview" ? (
            <>
              {/* Canvas header with page-fit indicator */}
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 p-3 shadow-xs flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Live Interactive Preview
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
                {isDirty && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    Preview shows unsaved edits
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col items-center w-full">
                <ResumePreviewCanvas
                  ref={paperRef}
                  resume={formData}
                  theme={theme}
                />
                <div className="pb-4 -mt-6 text-[10px] text-gray-400 select-none">
                  — End of Preview Document —
                </div>
              </div>
            </>
          ) : (
            /* True PDF verification view (server-rendered PDFKit output) */
            <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 flex flex-col items-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              {pdfError ? (
                <div className="max-w-lg p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-2xl border border-red-200 text-center">
                  <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    Failed to load PDF: {pdfError}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-2xl p-2">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex flex-col items-center p-12">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="mt-3 text-sm text-gray-500">
                          Rendering true PDF...
                        </p>
                      </div>
                    }
                  >
                    {Array.from({ length: numPages || 0 }, (_, i) => (
                      <Page
                        key={`pdf_page_${i + 1}_${pdfTimestamp}`}
                        pageNumber={i + 1}
                        className="mb-4 rounded shadow"
                      />
                    ))}
                  </Document>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Unsaved changes
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  You have unsaved edits to this tailored resume. Closing now
                  will discard them.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Save &amp; close
              </button>
              <button
                onClick={confirmClose}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[70] p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-4 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
