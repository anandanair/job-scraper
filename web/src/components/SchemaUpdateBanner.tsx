"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Database,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface PendingMigration {
  id: string;
  title: string;
  description: string;
}

interface SchemaStatusResponse {
  state?: "not_configured" | "unreachable" | "up_to_date" | "pending";
  hasPendingMigrations: boolean;
  boosterAvailable?: boolean;
  pendingMigrations?: PendingMigration[];
  sql?: string;
  sqlEditorUrl?: string;
}

export default function SchemaUpdateBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<SchemaStatusResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showSqlDetails, setShowSqlDetails] = useState(false);

  useEffect(() => {
    // Skip checking on setup wizard pages
    if (pathname?.startsWith("/setup")) return;

    // Check once per page load. The endpoint is read-only, but there is no
    // reason to re-poll on every client-side navigation.
    let cancelled = false;
    fetch("/api/system/schema-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SchemaStatusResponse | null) => {
        if (!cancelled && data?.hasPendingMigrations) {
          setStatus(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    if (!status?.sql) return;
    navigator.clipboard.writeText(status.sql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/system/schema-status", { method: "POST" });
      const data = await res.json();
      if (data.verified) {
        setStatus(null);
        setIsOpen(false);
      } else if (data.state === "unreachable") {
        setVerifyError(
          "Could not reach your Supabase project. Check your connection and try again."
        );
      } else {
        setVerifyError(
          "Update not detected yet. Please make sure you pasted the SQL and clicked 'Run' in your Supabase SQL Editor."
        );
      }
    } catch {
      setVerifyError("Failed to verify database. Please check your connection and try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!status?.hasPendingMigrations || dismissed || pathname?.startsWith("/setup")) {
    return null;
  }

  return (
    <>
      {/* Top Notification Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto py-2.5 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center space-x-2.5">
            <div className="bg-white/20 p-1 rounded-md">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">
              {status.boosterAvailable ? "Database Update Ready:" : "Database Update Available:"}
            </span>
            <span className="hidden sm:inline text-amber-100">
              {status.boosterAvailable
                ? "New features ready to apply with 1-click automated update."
                : "New features require a quick database schema update."}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center px-3 py-1 bg-white text-amber-900 font-semibold rounded-md shadow-sm hover:bg-amber-50 transition-colors text-xs cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
              {status.boosterAvailable ? "Update Database" : "Review & Apply"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title="Dismiss banner for this session"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {status.boosterAvailable ? "Automatic Database Update" : "Database Schema Update"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {status.boosterAvailable
                      ? `${status.pendingMigrations?.length || 0} pending schema migration(s) ready to apply automatically`
                      : "One-time update to enable automated migrations & latest features"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {status.boosterAvailable ? (
                /* 1-Click Automated Flow */
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3">
                    <Sparkles className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 leading-relaxed">
                      <span className="font-bold text-sm block mb-1 text-emerald-900">1-Click Auto-Update Available</span>
                      Your database has the automated migration booster installed. Click below to apply all pending schema updates in seconds without leaving JobTrack or pasting SQL into Supabase.
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Pending Updates:</p>
                    <ul className="text-xs text-slate-600 space-y-1.5">
                      {status.pendingMigrations?.map((m) => (
                        <li key={m.id} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span>
                            <strong className="text-slate-800">{m.title}</strong>: {m.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Optional SQL Inspection Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSqlDetails(!showSqlDetails)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
                    >
                      {showSqlDetails ? "Hide SQL Preview" : "View SQL Details (Advanced)"}
                    </button>

                    {showSqlDetails && (
                      <div className="mt-2 space-y-2">
                        <div className="bg-gray-900 rounded-xl p-3.5 overflow-x-auto max-h-48 border border-gray-800">
                          <pre className="text-xs font-mono text-emerald-400 whitespace-pre">
                            {status.sql}
                          </pre>
                        </div>
                        <button
                          onClick={handleCopy}
                          className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copy SQL
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Legacy Manual SQL Flow */
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 flex items-start space-x-3">
                    <Sparkles className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-900 leading-relaxed">
                      <span className="font-semibold">Future Auto-Update Booster:</span>{" "}
                      This update installs the secure <code className="font-mono bg-white px-1.5 py-0.5 rounded text-indigo-800">exec_migration</code> helper.
                      Once applied, all future schema changes will happen <strong>100% automatically</strong> in the background without needing manual updates ever again!
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Follow these 2 steps to apply the update (~15 seconds):
                    </p>
                    <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1 mb-3">
                      <li>Click <strong>Copy SQL</strong> below.</li>
                      <li>Click <strong>Open Supabase SQL Editor</strong>, paste into the editor, and click <strong>Run</strong>.</li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1.5 text-emerald-300" />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1.5" />
                          Copy Migration SQL
                        </>
                      )}
                    </button>

                    {status.sqlEditorUrl && (
                      <a
                        href={status.sqlEditorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        Open Supabase SQL Editor
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </a>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                      <span>SQL PREVIEW</span>
                      <span className="text-[11px] font-normal text-gray-400">Read-only</span>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-3.5 overflow-x-auto max-h-48 border border-gray-800">
                      <pre className="text-xs font-mono text-emerald-400 whitespace-pre">
                        {status.sql}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Notice */}
              {verifyError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{verifyError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className={`inline-flex items-center px-5 py-2.5 text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer ${
                  status.boosterAvailable
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-white" />
                    {status.boosterAvailable ? "Applying Database Updates..." : "Verifying Database..."}
                  </>
                ) : status.boosterAvailable ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5 text-amber-300" />
                    Apply Updates Automatically
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
                    I've Run the SQL (Verify & Done)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

