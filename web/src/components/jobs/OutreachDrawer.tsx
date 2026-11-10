"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Linkedin,
  Mail,
  Users,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { Job, OutreachVariants } from "@/types";

interface OutreachDrawerProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

const TONE_OPTIONS = [
  {
    id: "direct_impactful",
    label: "Direct & Impactful",
    desc: "Concise, value-focused pitch solving immediate team pain points",
  },
  {
    id: "friendly_warm",
    label: "Warm & Conversational",
    desc: "Approachable, relationship-first tone focusing on shared interests",
  },
  {
    id: "executive",
    label: "Strategic / Executive",
    desc: "High-level, leadership-oriented, emphasizing organizational alignment",
  },
];

export function OutreachDrawer({ job, isOpen, onClose }: OutreachDrawerProps) {
  const [activeTab, setActiveTab] = useState<"linkedin" | "cold_email" | "referral">("linkedin");
  const [recipientName, setRecipientName] = useState("");
  const [tone, setTone] = useState("direct_impactful");
  const [customNote, setCustomNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [outreach, setOutreach] = useState<OutreachVariants | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Reset when job changes
  useEffect(() => {
    setOutreach(null);
    setRecipientName("");
    setCustomNote("");
    setError(null);
    setShowSettings(false);
  }, [job.job_id]);

  const fetchOutreach = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${job.job_id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          tone,
          customNote: customNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate outreach");
      }

      setOutreach(data.outreach);
      setShowSettings(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate outreach notes.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedToneObj = TONE_OPTIONS.find((t) => t.id === tone) || TONE_OPTIONS[0];
  const linkedinLength = outreach?.linkedin_connection_note?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Outreach Copilot</h3>
              <p className="text-xs text-gray-500">
                Direct networking notes for <span className="font-semibold text-gray-700">{job.job_title}</span> at <span className="font-semibold text-gray-700">{job.company}</span>
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

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* View 1: Initial Setup / Configuration Screen (before generation) */}
          {!outreach && !isLoading && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900">
                <span className="font-semibold block mb-0.5">Customize Your Networking Angle</span>
                Select the recipient details and tone below. AI will tailor 3 high-converting networking notes (LinkedIn connection request, cold InMail, and referral request) aligned with your resume experience.
              </div>

              {/* Recruiter Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Recruiter / Hiring Manager Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins or Engineering Hiring Team"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Tone Selection Cards */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                  Select Tone
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {TONE_OPTIONS.map((opt) => {
                    const isSelected = tone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTone(opt.id)}
                        className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20"
                            : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                        }`}
                      >
                        <span className="font-semibold flex items-center justify-between">
                          {opt.label}
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-1.5 shrink-0" />}
                        </span>
                        <span className="text-[11px] text-gray-500 mt-1 leading-snug">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Context / Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Custom Context / Mention (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mention mutual connection Alex, or our conversation at TechConf"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
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
                onClick={fetchOutreach}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                Generate Outreach Notes
              </button>
            </div>
          )}

          {/* View 2: Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 space-y-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-gray-800">Crafting tailored outreach messages with AI...</p>
              <p className="text-xs text-gray-400">
                Generating LinkedIn note, cold email, and referral pitch in <span className="font-semibold text-gray-600">{selectedToneObj.label}</span> tone
              </p>
            </div>
          )}

          {/* View 3: Generated Results */}
          {!isLoading && outreach && (
            <div className="space-y-4">
              {/* Optional Settings Drawer / Quick Bar */}
              {showSettings ? (
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                    <span className="font-bold text-gray-800">Adjust Settings & Regenerate</span>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Recruiter Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah or Hiring Team"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Tone</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {TONE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Custom Context (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Mention mutual connection Alex"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={fetchOutreach}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <RefreshCw size={13} />
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-gray-50/70 rounded-xl border border-gray-100 text-xs">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <span className="font-semibold text-gray-700">Tone:</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">{selectedToneObj.label}</span>
                    {recipientName && (
                      <span className="text-gray-500">• To: <span className="font-medium text-gray-700">{recipientName}</span></span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <SlidersHorizontal size={13} />
                    Adjust Tone & Details
                  </button>
                </div>
              )}

              {/* Tab Selector */}
              <div className="flex border-b border-gray-200 gap-2">
                <button
                  onClick={() => setActiveTab("linkedin")}
                  className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === "linkedin"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Linkedin size={15} />
                  LinkedIn Note
                  {linkedinLength > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${linkedinLength > 300 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-600"}`}>
                      {linkedinLength}/300
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("cold_email")}
                  className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === "cold_email"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Mail size={15} />
                  Cold InMail / Email
                </button>
                <button
                  onClick={() => setActiveTab("referral")}
                  className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === "referral"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Users size={15} />
                  Alumni / Referral
                </button>
              </div>

              {/* Display Active Tab Content */}
              {activeTab === "linkedin" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Connection Request Note (300 Char Limit)
                    </span>
                    <button
                      onClick={() => handleCopy(outreach.linkedin_connection_note, "linkedin")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {copiedKey === "linkedin" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy Note
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-all">
                    {outreach.linkedin_connection_note}
                  </div>
                  <p className="text-xs text-gray-400">
                    Paste this into LinkedIn when clicking &quot;Add a note&quot; before sending a connection invitation to the recruiter.
                  </p>
                </div>
              )}

              {activeTab === "cold_email" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Direct Pitch (~140 words)
                    </span>
                    <button
                      onClick={() => handleCopy(outreach.cold_inmail, "cold_email")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {copiedKey === "cold_email" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy Email
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-all">
                    {outreach.cold_inmail}
                  </div>
                  <p className="text-xs text-gray-400">
                    Use this for direct LinkedIn InMail or a cold email to the hiring manager.
                  </p>
                </div>
              )}

              {activeTab === "referral" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Warm Referral / Chat Request
                    </span>
                    <button
                      onClick={() => handleCopy(outreach.referral_request, "referral")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {copiedKey === "referral" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy Message
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-all">
                    {outreach.referral_request}
                  </div>
                  <p className="text-xs text-gray-400">
                    Send this to a current engineer or school alumni at the company to request an internal referral.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          {outreach ? (
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              {showSettings ? "Hide Settings" : "Regenerate with New Settings"}
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
