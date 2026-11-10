"use client";

import React, { useState } from "react";
import { X, Link as LinkIcon, FileText, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface JobImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (jobId: string) => void;
}

export function JobImportModal({ isOpen, onClose, onSuccess }: JobImportModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"url" | "manual">("url");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL mode state
  const [urlInput, setUrlInput] = useState("");

  // Manual mode state
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [workplaceType, setWorkplaceType] = useState<"remote" | "hybrid" | "onsite">("remote");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = activeTab === "url"
        ? { url: urlInput.trim() }
        : {
            title: title.trim(),
            company: company.trim(),
            location: location.trim(),
            description: description.trim(),
            workplace_type: workplaceType,
          };

      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import job");
      }

      const jobId = data.job?.job_id;
      onClose();
      if (onSuccess && jobId) {
        onSuccess(jobId);
      } else if (jobId) {
        router.push(`/jobs/${jobId}?source=${encodeURIComponent(`/jobs/new?selectedJobId=${jobId}`)}`);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Import Dream Job</h3>
              <p className="text-xs text-gray-500">Paste any job link or raw description to score and tailor for it</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex gap-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => { setActiveTab("url"); setError(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "url"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <LinkIcon size={15} />
            Paste Job URL
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("manual"); setError(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "manual"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <FileText size={15} />
            Paste Description
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-red-50 border border-red-200 text-red-700">
              {error}
            </div>
          )}

          {activeTab === "url" ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Job Posting URL
              </label>
              <input
                type="url"
                required
                placeholder="https://www.linkedin.com/jobs/view/... or Greenhouse, Lever, etc."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <p className="text-xs text-gray-500 leading-relaxed">
                Supports LinkedIn, MyCareersFuture, Greenhouse, Lever, Ashby, or direct company career pages. We automatically extract and convert the JD into clean markdown and score it with AI.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Senior Full Stack Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Stripe, Figma, etc."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="Singapore or Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Workplace Type
                  </label>
                  <select
                    value={workplaceType}
                    onChange={(e) => setWorkplaceType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="remote">100% Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-Site</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Full Job Description *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Paste the requirements, responsibilities, and qualifications..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing & Scoring...
                </>
              ) : (
                <>
                  Import & Score
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
