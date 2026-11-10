"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Award,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Building2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { Job, JobInterviewPrep } from "@/types";

interface InterviewPrepModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

const INTERVIEW_TONE_OPTIONS = [
  {
    id: "balanced",
    label: "Comprehensive & Balanced",
    desc: "Balanced mix of core technical architecture, system design, and STAR behavioral answers.",
  },
  {
    id: "technical",
    label: "Technical Deep-Dive",
    desc: "Rigorous technical questions, architectural trade-offs, coding patterns, and debugging mechanics.",
  },
  {
    id: "behavioral",
    label: "Behavioral & Leadership",
    desc: "Heavy emphasis on STAR frameworks, conflict resolution, leadership principles, and team culture.",
  },
  {
    id: "executive",
    label: "Executive & Strategic",
    desc: "Focus on business alignment, technical strategy, engineering leadership, and scaling challenges.",
  },
];

export function InterviewPrepModal({ job, isOpen, onClose }: InterviewPrepModalProps) {
  const [activeTab, setActiveTab] = useState<"technical" | "behavioral" | "reverse" | "brief">("technical");
  const [prep, setPrep] = useState<JobInterviewPrep | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTechIdx, setExpandedTechIdx] = useState<number | null>(0);
  const [tone, setTone] = useState<string>("balanced");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  // Reset when job changes
  useEffect(() => {
    setPrep(null);
    setError(null);
    setHasCheckedExisting(false);
    setShowSettings(false);
    setCustomNotes("");
  }, [job.job_id]);

  // Check if prep was already generated in the database (GET - does not call LLM)
  useEffect(() => {
    if (isOpen && !prep && !hasCheckedExisting) {
      const checkExisting = async () => {
        setIsCheckingExisting(true);
        try {
          const res = await fetch(`/api/jobs/${job.job_id}/interview-prep`);
          const data = await res.json();
          if (res.ok && data.prep) {
            setPrep(data.prep);
          }
        } catch (err) {
          console.warn("Could not check existing interview prep:", err);
        } finally {
          setIsCheckingExisting(false);
          setHasCheckedExisting(true);
        }
      };
      checkExisting();
    }
  }, [isOpen, job.job_id, prep, hasCheckedExisting]);

  const generatePrep = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/interview-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceRefresh: true,
          tone,
          customNotes: customNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate interview prep");
      }

      setPrep(data.prep);
      setShowSettings(false);
    } catch (err: any) {
      setError(err.message || "Failed to load interview preparation guide.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedToneObj = INTERVIEW_TONE_OPTIONS.find((t) => t.id === tone) || INTERVIEW_TONE_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI Interview Prep Copilot</h3>
              <p className="text-xs text-gray-500">
                Tailored interview preparation for <span className="font-semibold text-gray-700">{job.job_title}</span> at <span className="font-semibold text-gray-700">{job.company}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher - only show if prep exists and not in setup mode */}
        {prep && !isLoading && (
          <div className="px-6 pt-3 flex gap-2 border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setActiveTab("technical")}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "technical"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <BookOpen size={15} />
              Technical Questions ({prep?.technical_questions?.length || 5})
            </button>
            <button
              onClick={() => setActiveTab("behavioral")}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "behavioral"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <MessageSquare size={15} />
              Behavioral STAR Answers ({prep?.behavioral_star?.length || 5})
            </button>
            <button
              onClick={() => setActiveTab("reverse")}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "reverse"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <HelpCircle size={15} />
              Reverse Questions
            </button>
            {prep?.company_brief && (
              <button
                onClick={() => setActiveTab("brief")}
                className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "brief"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Building2 size={15} />
                Company Brief
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* State 0: Checking DB for existing prep */}
          {isCheckingExisting && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 space-y-3">
              <Loader2 size={28} className="animate-spin text-purple-600" />
              <p className="text-sm font-medium">Checking for saved interview prep...</p>
            </div>
          )}

          {/* State 1: Setup / Configuration Screen (before generation) */}
          {!prep && !isLoading && !isCheckingExisting && (
            <div className="space-y-5">
              <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-900">
                <span className="font-semibold block mb-0.5">Customize Your Interview Pack</span>
                Select your interview focus and tone below. AI will synthesize predicted technical questions, customized STAR behavioral talking points from your real experience, and smart reverse questions to ask the interviewer.
              </div>

              {/* Tone Selection Cards */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                  Select Interview Tone & Focus
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {INTERVIEW_TONE_OPTIONS.map((opt) => {
                    const isSelected = tone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTone(opt.id)}
                        className={`flex flex-col text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "border-purple-600 bg-purple-50/50 text-purple-900 ring-2 ring-purple-600/20"
                            : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                        }`}
                      >
                        <span className="font-semibold flex items-center justify-between text-sm">
                          {opt.label}
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-purple-600 ml-1.5 shrink-0" />}
                        </span>
                        <span className="text-xs text-gray-500 mt-1 leading-snug">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Focus / Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Specific Focus or Target Areas (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Focus on distributed systems, or emphasize recent team lead accomplishments"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={generatePrep}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                Generate Interview Pack
              </button>
            </div>
          )}

          {/* State 2: Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 space-y-3">
              <Loader2 size={32} className="animate-spin text-purple-600" />
              <p className="text-sm font-semibold text-gray-800">Synthesizing role-specific interview pack...</p>
              <p className="text-xs text-gray-400">
                Aligning JD requirements with your real projects and accomplishments in <span className="font-semibold text-gray-600">{selectedToneObj.label}</span> tone
              </p>
            </div>
          )}

          {/* State 3: Generated Guide */}
          {!isLoading && prep && (
            <div className="space-y-4">
              {/* Optional Settings Drawer / Quick Bar */}
              {showSettings ? (
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                    <span className="font-bold text-gray-800">Adjust Tone & Regenerate</span>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Interview Tone & Focus</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {INTERVIEW_TONE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label} — {opt.desc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Custom Focus / Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Focus on distributed databases, or system design trade-offs"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={generatePrep}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <RefreshCw size={13} />
                      Regenerate Pack
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-gray-50/70 rounded-xl border border-gray-100 text-xs">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <span className="font-semibold text-gray-700">Interview Tone:</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">{selectedToneObj.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 cursor-pointer"
                  >
                    <SlidersHorizontal size={13} />
                    Adjust Tone & Focus
                  </button>
                </div>
              )}

              {/* Tab 1: Technical Questions */}
              {activeTab === "technical" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Predicted technical questions based on the specific architecture, tools, and responsibilities in this job description.
                  </p>
                  {(prep.technical_questions || []).map((tq, idx) => {
                    const isExpanded = expandedTechIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden transition-all"
                      >
                        <button
                          onClick={() => setExpandedTechIdx(isExpanded ? null : idx)}
                          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-100/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">
                                {tq.topic}
                              </span>
                              <h4 className="text-sm font-semibold text-gray-900">{tq.question}</h4>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3.5 pt-1 text-xs text-gray-700 bg-white border-t border-gray-100 leading-relaxed">
                            <span className="font-semibold text-gray-900 block mb-1">Key Talking Points to Hit:</span>
                            <p className="whitespace-pre-wrap">{tq.answer_guide}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Behavioral STAR Answers */}
              {activeTab === "behavioral" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    High-impact behavioral questions mapped directly to the accomplishments and projects on your master resume.
                  </p>
                  {(prep.behavioral_star || []).map((b, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900">{b.question}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100">
                          <span className="font-bold text-blue-700 block mb-0.5">S (Situation)</span>
                          <span className="text-gray-700">{b.situation}</span>
                        </div>
                        <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
                          <span className="font-bold text-amber-700 block mb-0.5">T (Task)</span>
                          <span className="text-gray-700">{b.task}</span>
                        </div>
                        <div className="p-2.5 bg-purple-50/60 rounded-lg border border-purple-100">
                          <span className="font-bold text-purple-700 block mb-0.5">A (Action)</span>
                          <span className="text-gray-700">{b.action}</span>
                        </div>
                        <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                          <span className="font-bold text-emerald-700 block mb-0.5">R (Result)</span>
                          <span className="text-gray-700">{b.result}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Reverse Questions */}
              {activeTab === "reverse" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Questions for you to ask the hiring team to evaluate team health, engineering excellence, and screen for red flags.
                  </p>
                  {(prep.reverse_questions || []).map((rq, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 flex items-start space-x-3 text-xs text-gray-800"
                    >
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed font-medium">{rq}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Company Brief */}
              {activeTab === "brief" && prep.company_brief && (
                <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  <h4 className="font-bold text-gray-900 mb-2">Company Background & Domain Context</h4>
                  {prep.company_brief}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          {prep ? (
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              {showSettings ? "Hide Settings" : "Adjust Tone & Regenerate"}
            </button>
          ) : (
            <span className="text-xs text-gray-400">Select options above and click Generate</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
