"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Download,
  Save,
  RotateCcw,
  Edit3,
  Eye,
  Building,
  MapPin,
  Trash2,
  Loader2,
  FileText,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Job, Resume, CoverLetter, CoverLetterTone } from "@/types";
import Toast, { ToastData } from "./applied/Toast";

interface CoverLetterStudioClientProps {
  job: Job;
  baseResume: Resume | null;
  initialCoverLetter: CoverLetter | null;
}

const TONE_OPTIONS: { id: CoverLetterTone; label: string; desc: string }[] = [
  {
    id: "confident_professional",
    label: "Confident & Professional",
    desc: "Balanced, assertive, and results-backed (Standard ATS)",
  },
  {
    id: "executive",
    label: "Executive & Strategic",
    desc: "Vision-focused, leadership, and high-level ROI",
  },
  {
    id: "technical",
    label: "Technical Deep-Dive",
    desc: "Architecture, engineering rigor, and stack mastery",
  },
  {
    id: "short_note",
    label: "Short Note / InMail",
    desc: "Concise elevator pitch (~150-180 words)",
  },
];

export default function CoverLetterStudioClient({
  job,
  baseResume,
  initialCoverLetter,
}: CoverLetterStudioClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const backHref = source || `/jobs/${job.job_id}`;
  const backLabel = useMemo(() => {
    if (!source) return "Back to Job";
    if (source.includes("/applied")) return "Back to Applications";
    if (
      source.includes("/jobs/new") ||
      source.includes("/jobs/top-matches") ||
      source.includes("/jobs/tailored")
    ) {
      return "Back to Jobs";
    }
    if (source.startsWith("/jobs/")) return "Back to Job Details";
    return "Back";
  }, [source]);

  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(
    initialCoverLetter
  );
  const [content, setContent] = useState<string>(
    initialCoverLetter?.content || ""
  );
  const [tone, setTone] = useState<CoverLetterTone>(
    initialCoverLetter?.tone || "confident_professional"
  );
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showOptions, setShowOptions] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Dirty state detection
  const isDirty = useMemo(() => {
    if (!coverLetter) return Boolean(content.trim());
    return content !== coverLetter.content || tone !== coverLetter.tone;
  }, [coverLetter, content, tone]);

  // Statistics
  const stats = useMemo(() => {
    const text = content.trim();
    if (!text) return { words: 0, chars: 0, readMinutes: 0 };
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readMinutes };
  }, [content]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ id: Date.now(), message, type });
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isSaving && coverLetter) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isSaving, coverLetter, content, tone]);

  // 1. Generate or Regenerate
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          customInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to generate cover letter");
      }

      setCoverLetter(data.cover_letter);
      setContent(data.cover_letter.content);
      setTone(data.cover_letter.tone);
      setShowOptions(false);
      showToast("Cover letter drafted successfully!", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error generating cover letter:", err);
      showToast(err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Save manual edits
  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/cover-letter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to save changes");
      }

      setCoverLetter(data.cover_letter);
      showToast("Changes saved successfully!", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error saving cover letter:", err);
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Delete draft
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this cover letter draft?")) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/cover-letter`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete draft");
      }
      setCoverLetter(null);
      setContent("");
      showToast("Cover letter deleted", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error deleting cover letter:", err);
      showToast(err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // 4. Copy to Clipboard
  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      showToast("Cover letter copied to clipboard!", "success");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  // Candidate info display
  const candidateName = baseResume?.name || "Your Name";
  const contactParts: string[] = [];
  if (baseResume?.email) contactParts.push(baseResume.email);
  if (baseResume?.phone) contactParts.push(baseResume.phone);
  if (baseResume?.location) contactParts.push(baseResume.location);

  const formattedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Left: Back Link & Context */}
          <div className="flex items-center space-x-3">
            <Link
              href={backHref}
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <div>
              <h1 className="text-sm font-semibold text-gray-900 sm:text-base leading-tight line-clamp-1">
                Cover Letter: {job.job_title}
              </h1>
              <p className="text-xs text-gray-500 flex items-center space-x-2">
                <span>{job.company}</span>
                {job.location && (
                  <>
                    <span>•</span>
                    <span>{job.location}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Status badge & primary actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {coverLetter && (
              <>
                {/* Stats badge */}
                <div className="hidden md:flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                  {stats.words} words • ~{stats.readMinutes} min
                </div>

                {/* Dirty indicator */}
                {isDirty && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                    Unsaved
                  </span>
                )}

                {/* Copy to Clipboard */}
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  title="Copy full cover letter to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4 text-gray-500" />
                      <span className="hidden sm:inline">Copy Text</span>
                    </>
                  )}
                </button>

                {/* Download ATS PDF */}
                <a
                  href={`/api/jobs/${job.job_id}/cover-letter/pdf?download=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  title="Download ATS-standard PDF"
                >
                  <Download className="mr-1.5 h-4 w-4 text-gray-500" />
                  <span className="hidden sm:inline">Download PDF</span>
                </a>

                {/* Save Changes */}
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="inline-flex items-center px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-6">
        {/* If no cover letter exists yet: Empty State / Initial Generator */}
        {!coverLetter ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 sm:p-10 max-w-2xl mx-auto my-8">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 mb-5">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Draft a Tailored Cover Letter
              </h2>
              <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                Generate an on-demand, ATS-optimized cover letter specifically crafted
                from your master resume and this job’s exact requirements.
              </p>
            </div>

            {/* Target Role Pill */}
            <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs sm:text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="font-semibold text-gray-900">{job.company}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{job.job_title}</span>
              </div>
            </div>

            {/* Tone Selection */}
            <div className="mt-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Select Tone
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTone(opt.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                      tone === opt.id
                        ? "border-purple-600 bg-purple-50/50 text-purple-900 ring-2 ring-purple-600/20"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    <span className="font-semibold flex items-center justify-between">
                      {opt.label}
                      {tone === opt.id && (
                        <CheckCircle2 className="h-4 w-4 text-purple-600 ml-1.5" />
                      )}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Custom Guidance */}
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Special Context or Focus (Optional)
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Highlight my 5 years of remote work, or emphasize experience leading Kubernetes migrations..."
                rows={2}
                className="w-full text-xs sm:text-sm rounded-xl border border-gray-300 p-3 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder-gray-400"
              />
            </div>

            {/* Generate Action Button */}
            <div className="mt-8">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center px-5 py-3 text-sm sm:text-base font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors shadow-md shadow-purple-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Profile & Crafting Letter...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Cover Letter with AI
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Active Studio: View & Edit Experience */
          <div className="space-y-4">
            {/* Toolbar row: View Toggle, Tone Selector & Options */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
              {/* Tab Switcher: Edit vs Preview */}
              <div className="inline-flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === "edit"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Edit Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === "preview"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Clean Preview
                </button>
              </div>

              {/* Tone display & Re-draft Drawer Toggle */}
              <div className="flex items-center space-x-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    showOptions
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Sliders className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
                  Tone & Regenerate
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete cover letter draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Inline Regeneration Panel */}
            {showOptions && (
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center">
                    <Sparkles className="mr-1.5 h-4 w-4 text-purple-600" />
                    Regenerate with AI
                  </h3>
                  <button
                    onClick={() => setShowOptions(false)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTone(opt.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                        tone === opt.id
                          ? "border-purple-600 bg-white text-purple-900 font-semibold shadow-xs"
                          : "border-purple-200/60 bg-purple-50/40 text-gray-700 hover:bg-white"
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[11px] text-gray-500 font-normal">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Specific tweaks? (e.g. 'Shorten the intro', 'Emphasize cloud architecture', etc.)"
                    rows={2}
                    className="w-full text-xs rounded-lg border border-purple-200 bg-white p-2.5 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                    )}
                    Regenerate Draft
                  </button>
                </div>
              </div>
            )}

            {/* Letter Stationery Canvas */}
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md p-6 sm:p-12 transition-all">
              {/* Header Letterhead */}
              <div className="border-b border-gray-200 pb-5 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-gray-900">
                  {candidateName}
                </h2>
                {contactParts.length > 0 && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {contactParts.map((item, idx) => (
                      <span key={idx}>
                        {item}
                        {idx < contactParts.length - 1 && "  •  "}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {/* Date & Employer Block */}
              <div className="text-xs sm:text-sm text-gray-600 mb-6 space-y-1">
                <p className="text-gray-500">{formattedDate}</p>
                <div className="pt-2 font-medium text-gray-900">Hiring Team</div>
                <div className="text-gray-600">{job.company}</div>
                {job.location && <div className="text-gray-500">{job.location}</div>}
              </div>

              {/* Subject Line */}
              <div className="text-sm sm:text-base font-semibold text-gray-900 mb-6">
                RE: Application for {job.job_title}
              </div>

              {/* Main Content Area */}
              {activeTab === "edit" ? (
                <div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write or edit your cover letter..."
                    rows={18}
                    className="w-full resize-y font-sans text-sm sm:text-base leading-relaxed text-gray-800 border-0 p-0 focus:ring-0 focus:outline-none placeholder-gray-400"
                  />
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>Pro tip: Press Ctrl+S / Cmd+S to save changes.</span>
                    <span>{stats.chars} characters</span>
                  </div>
                </div>
              ) : (
                /* Formatted Preview Mode */
                <div className="space-y-4 text-sm sm:text-base leading-relaxed text-gray-800 font-sans">
                  {content
                    .split(/\n\s*\n/)
                    .map((paragraph, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
