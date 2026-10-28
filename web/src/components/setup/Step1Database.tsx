"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Key,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Info,
  Zap,
  Copy,
  Check,
  Sparkles,
  Globe,
  Building2,
} from "lucide-react";

interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: string;
}

const REGION_OPTIONS = [
  { id: "ap-southeast-1", label: "Southeast Asia (Singapore) — Recommended" },
  { id: "us-east-1", label: "US East (North Virginia)" },
  { id: "us-west-1", label: "US West (North California)" },
  { id: "eu-central-1", label: "Central Europe (Frankfurt)" },
  { id: "eu-west-2", label: "Western Europe (London)" },
  { id: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { id: "ap-south-1", label: "South Asia (Mumbai)" },
  { id: "ap-southeast-2", label: "Oceania (Sydney)" },
];

interface Step1DatabaseProps {
  supabaseConnected: boolean;
  connectedSupabaseUrl: string;
  onConnected: (url: string) => void;
  onNextStep: () => void;
}

export function Step1Database({
  supabaseConnected,
  connectedSupabaseUrl,
  onConnected,
  onNextStep,
}: Step1DatabaseProps) {
  const [step1Mode, setStep1Mode] = useState<"token" | "direct">("token");
  const [patToken, setPatToken] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ap-southeast-1");
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProjectRef, setSelectedProjectRef] = useState("");
  const [isConfiguringDb, setIsConfiguringDb] = useState(false);
  const [dbConfigStatus, setDbConfigStatus] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Suggested secure password for new Supabase project creation
  const [suggestedPassword] = useState(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let rand = "";
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `JTrack_${rand}!26`;
  });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Inspect user's Supabase account (organizations and projects)
  const fetchAccountInfo = async (token: string, silent = false) => {
    if (!token.trim()) return;
    setIsValidatingToken(true);
    if (!silent) setStep1Error(null);

    try {
      const res = await fetch("/api/setup/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to authenticate with Supabase.");
      }

      const fetchedOrgs = data.organizations || [];
      const fetchedProjects = data.projects || [];

      setOrganizations(fetchedOrgs);
      setProjects(fetchedProjects);
      setTokenValidated(true);
      setHasFetchedOnce(true);

      if (fetchedOrgs.length > 0) {
        setSelectedOrgId((prev) => (prev ? prev : fetchedOrgs[0].id));
      } else {
        setSelectedOrgId("__CREATE_NEW_ORG__");
      }
    } catch (err: any) {
      setTokenValidated(false);
      if (!silent) {
        setStep1Error(err.message);
      }
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Auto-verify token when user finishes typing or pastes token
  useEffect(() => {
    const trimmed = patToken.trim();
    if (trimmed.startsWith("sbp_") && trimmed.length >= 25) {
      const timer = setTimeout(() => {
        fetchAccountInfo(trimmed, true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTokenValidated(false);
    }
  }, [patToken]);

  // Direct keys state
  const [manualUrl, setManualUrl] = useState("");
  const [manualServiceKey, setManualServiceKey] = useState("");
  const [manualAnonKey, setManualAnonKey] = useState("");
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualConnected, setManualConnected] = useState(false);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [isVerifyingTables, setIsVerifyingTables] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Handlers: Token Magic Setup
  const handleAutoSetupDatabase = async () => {
    if (!patToken.trim()) {
      setStep1Error("Please enter your Supabase Personal Access Token.");
      return;
    }
    setStep1Error(null);
    setIsConfiguringDb(true);

    try {
      // 1. Fetch existing projects to see if one is already available
      setDbConfigStatus("Checking Supabase account & organizations...");
      const checkRes = await fetch("/api/setup/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patToken.trim() }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.error || "Failed to authenticate with Supabase.");
      }

      const existingProjects = checkData.projects || [];
      const existingOrgs = checkData.organizations || [];
      setProjects(existingProjects);
      setOrganizations(existingOrgs);
      setTokenValidated(true);

      const targetOrg = selectedOrgId || (existingOrgs.length > 0 ? existingOrgs[0].id : "__CREATE_NEW_ORG__");
      let targetProjectRef = "";

      // Check if project named 'jobtrack' exists in the selected organization
      const isExplicitNew = selectedProjectRef === "__CREATE_NEW__";
      
      if (!isExplicitNew && targetOrg !== "__CREATE_NEW_ORG__") {
        const orgProjects = existingProjects.filter(
          (p: any) => !p.organization_id || p.organization_id === targetOrg
        );
        const jobtrackProj = orgProjects.find(
          (p: any) => p.name && p.name.toLowerCase() === "jobtrack"
        );

        if (jobtrackProj) {
          targetProjectRef = jobtrackProj.id;
          setSelectedProjectRef(jobtrackProj.id);
          setDbConfigStatus(`Found existing "jobtrack" project (${jobtrackProj.id})...`);
        } else if (selectedProjectRef) {
          targetProjectRef = selectedProjectRef;
        } else if (orgProjects.length === 1) {
          targetProjectRef = orgProjects[0].id;
          setSelectedProjectRef(orgProjects[0].id);
        }
      }

      // If user has not selected an existing project, auto-create 'jobtrack' via Management API in the target org!
      if (!targetProjectRef) {
        const orgName = existingOrgs.find((o: any) => o.id === targetOrg)?.name;
        setDbConfigStatus(
          targetOrg === "__CREATE_NEW_ORG__"
            ? "Creating new organization & 'jobtrack' project on Supabase Free Tier..."
            : `Creating 'jobtrack' project inside organization "${orgName || "selected"}"...`
        );

        const createRes = await fetch("/api/setup/supabase/create-project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: patToken.trim(),
            region: selectedRegion,
            projectName: "jobtrack",
            organizationId: targetOrg,
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || "Failed to create project via API.");
        }

        targetProjectRef = createData.project.id;
        setSelectedProjectRef(targetProjectRef);
      }

      // 2. Poll until database status is ACTIVE_HEALTHY
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 35; // 35 * 3s = ~105s

      while (!isReady && attempts < maxAttempts) {
        attempts++;
        setDbConfigStatus(
          `Waiting for PostgreSQL to provision (attempt ${attempts}/${maxAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusRes = await fetch("/api/setup/supabase/project-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: patToken.trim(),
            projectRef: targetProjectRef,
          }),
        });

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "ACTIVE_HEALTHY") {
            isReady = true;
            break;
          }
        }
      }

      if (!isReady) {
        throw new Error(
          "Supabase project is taking longer than expected to provision. Please wait 10 seconds and click '1-Click Auto-Setup Database' again."
        );
      }

      // 3. Configure Database schema & write .env.local
      setDbConfigStatus("Database online! Executing schema migrations & triggers...");
      const configRes = await fetch("/api/setup/supabase/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: patToken.trim(),
          projectRef: targetProjectRef,
        }),
      });

      const configData = await configRes.json();
      if (!configRes.ok) {
        throw new Error(configData.error || "Database configuration failed.");
      }

      setDbConfigStatus("Setting up storage buckets (resumes)...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      setDbConfigStatus("Writing .env.local configuration file...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      onConnected(configData.supabaseUrl || `https://${targetProjectRef}.supabase.co`);
      onNextStep();
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsConfiguringDb(false);
      setDbConfigStatus("");
    }
  };

  const handleFetchProjects = async () => {
    if (!patToken.trim()) {
      setStep1Error("Please enter your Supabase Personal Access Token.");
      return;
    }
    setStep1Error(null);
    setIsFetchingProjects(true);

    try {
      const res = await fetch("/api/setup/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch projects.");
      }

      const fetchedProjects = data.projects || [];
      const fetchedOrgs = data.organizations || [];

      setProjects(fetchedProjects);
      setOrganizations(fetchedOrgs);
      setHasFetchedOnce(true);
      setTokenValidated(true);

      if (fetchedOrgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(fetchedOrgs[0].id);
      }

      if (fetchedProjects.length > 0) {
        setSelectedProjectRef(fetchedProjects[0].id);
        setStep1Error(null);
      } else {
        // Zero projects found - don't show a harsh red error!
        // The interactive "No Database Project Found Yet" guided card renders cleanly below.
        setStep1Error(null);
      }
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const handleAutoConfigureDatabase = async () => {
    if (!selectedProjectRef) {
      setStep1Error("Please select a Supabase project.");
      return;
    }
    setStep1Error(null);
    setIsConfiguringDb(true);
    setDbConfigStatus("Retrieving API keys from Supabase...");

    try {
      setDbConfigStatus("Executing database schema & triggers via Management API...");
      const res = await fetch("/api/setup/supabase/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: patToken,
          projectRef: selectedProjectRef,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Database configuration failed.");
      }

      setDbConfigStatus("Creating storage buckets (resumes, personalized_resumes)...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      setDbConfigStatus("Writing .env.local configuration file...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      onConnected(data.supabaseUrl || "");
      onNextStep();
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsConfiguringDb(false);
    }
  };

  // Handlers: Direct Keys Setup
  const handleDirectConnect = async () => {
    if (!manualUrl.trim() || !manualServiceKey.trim()) {
      setStep1Error("Project URL and Service Role Key are required.");
      return;
    }
    setStep1Error(null);
    setIsManualSaving(true);

    try {
      const res = await fetch("/api/setup/supabase/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: manualUrl.trim(),
          serviceRoleKey: manualServiceKey.trim(),
          anonKey: manualAnonKey.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save Supabase credentials.");
      }

      setManualConnected(true);
      if (data.missingTables && data.missingTables.length > 0) {
        setMissingTables(data.missingTables);
      } else {
        onConnected(manualUrl.trim());
        onNextStep();
      }
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsManualSaving(false);
    }
  };

  const handleCopySql = async () => {
    try {
      const res = await fetch("/api/setup/schema-sql");
      const data = await res.json();
      if (data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      }
    } catch {
      setStep1Error("Failed to fetch SQL schema.");
    }
  };

  const handleVerifyTables = async () => {
    setIsVerifyingTables(true);
    setStep1Error(null);

    try {
      const verifyRes = await fetch("/api/setup/supabase/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: manualUrl.trim(),
          serviceRoleKey: manualServiceKey.trim(),
        }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.allTablesExist) {
        onConnected(manualUrl.trim());
        onNextStep();
      } else {
        const missing = Object.entries(verifyData.tables || {})
          .filter(([_, exists]) => !exists)
          .map(([t]) => t);
        setMissingTables(missing);
        setStep1Error(
          `Some tables are still missing: ${missing.join(", ")}. Please paste and run the SQL in your Supabase SQL Editor.`
        );
      }
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsVerifyingTables(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Connect your Supabase Database</h2>
          <p className="text-xs text-slate-500">
            Stores your scraped jobs, structured resume data, and custom ATS PDFs securely.
          </p>
        </div>
      </div>

      {/* Already Configured Callout */}
      {supabaseConnected && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-950">Database Already Configured & Verified!</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Connected to Supabase {connectedSupabaseUrl ? `(${connectedSupabaseUrl})` : ""}. All required database tables and storage buckets are already initialized.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNextStep}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 text-xs"
          >
            <span>Continue to Step 2</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step1Error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Setup Notice</p>
            <p className="mt-0.5">{step1Error}</p>
          </div>
        </div>
      )}

      {/* Tabs for Mode Selection */}
      <div className="flex items-center border-b border-slate-200 mb-6">
        <button
          type="button"
          onClick={() => {
            setStep1Mode("token");
            setStep1Error(null);
          }}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            step1Mode === "token"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Auto-Connect via Token (Runs SQL Automatically)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setStep1Mode("direct");
            setStep1Error(null);
          }}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            step1Mode === "direct"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Connect with Project URL & Secret Key</span>
        </button>
      </div>

      {/* TAB 1: TOKEN MAGIC SETUP */}
      {step1Mode === "token" && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              How to generate your token in 30 seconds:
            </h3>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <span className="font-bold bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  Click to open{" "}
                  <a
                    href="https://supabase.com/dashboard/account/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-indigo-600 underline inline-flex items-center gap-1"
                  >
                    <span>Supabase Account Tokens</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  Click <strong>"Generate new token"</strong>:
                  <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                    <li>Name: type <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-indigo-700 font-bold">JobTrack</code></li>
                    <li>Expires in: change from default (7 days) to <strong>No expiration</strong> (or 1 year)</li>
                  </ul>
                </div>
              </div>

              {/* Pro-Tip for Legacy Token */}
              <div className="ml-7 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Pro-Tip: Click "Create legacy token" for instant 1-click access
                </p>
                <p className="mt-1 leading-relaxed text-[11px] text-amber-900">
                  In the token popup, look under <em>Resource access</em> and click{" "}
                  <strong className="underline">Create legacy token</strong>. Enter name <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-950 font-bold">JobTrack</code>, set <em>Expires in</em> to <strong>No expiration</strong>, and click Generate.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  Click <strong>Copy</strong> to copy the generated token immediately.
                  <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
                    ⚠️ Important: Supabase only shows the token value once! Copy it before clicking "Done".
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">
                  4
                </span>
                <div>
                  Paste the copied token (starts with{" "}
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">
                    sbp_...
                  </code>
                  ) below and click <strong>1-Click Auto-Setup Database</strong>:
                </div>
              </div>
            </div>

            {/* Token Input & Region Selector Card */}
            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Supabase Personal Access Token</span>
                  {isValidatingToken ? (
                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking token...
                    </span>
                  ) : tokenValidated ? (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Authenticated ✓
                    </span>
                  ) : null}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={patToken}
                    onChange={(e) => setPatToken(e.target.value)}
                    placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={isConfiguringDb}
                    className="block w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  {!tokenValidated && patToken.trim() && (
                    <div className="absolute inset-y-1 right-1">
                      <button
                        type="button"
                        onClick={() => fetchAccountInfo(patToken)}
                        disabled={isValidatingToken}
                        className="h-full px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-200 transition flex items-center gap-1"
                      >
                        {isValidatingToken ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <span>Verify</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Organization Selector (shown once token is validated) */}
              {tokenValidated && organizations.length > 0 && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-indigo-950 font-bold">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      Target Organization
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Choose existing or create new</span>
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    disabled={isConfiguringDb}
                    className="block w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                    <option value="__CREATE_NEW_ORG__">
                      + Create a new organization (&quot;JobTrack Org&quot;)
                    </option>
                  </select>

                  {selectedOrgId && selectedOrgId !== "__CREATE_NEW_ORG__" && (
                    <div className="text-[11px] text-slate-600 pl-0.5">
                      {(() => {
                        const orgProjects = projects.filter(
                          (p: any) => !p.organization_id || p.organization_id === selectedOrgId
                        );
                        const hasJobtrack = orgProjects.some(
                          (p: any) => p.name && p.name.toLowerCase() === "jobtrack"
                        );

                        if (hasJobtrack) {
                          return (
                            <span className="text-emerald-700 font-medium">
                              ✓ Existing &quot;jobtrack&quot; database detected in this organization. It will be connected!
                            </span>
                          );
                        } else if (orgProjects.length > 0) {
                          return (
                            <span>
                              {orgProjects.length} existing project(s) found in this organization. A new &quot;jobtrack&quot; project will be added.
                            </span>
                          );
                        } else {
                          return (
                            <span>
                              0 database projects in this organization yet. A new &quot;jobtrack&quot; project will be created on the Free Tier.
                            </span>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Notice if brand new account with 0 organizations */}
              {tokenValidated && organizations.length === 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-950">Brand-New Supabase Account</p>
                    <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                      No existing organizations found. We will automatically create <strong>JobTrack Org</strong> and provision your free database.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    Database Cloud Region
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Choose closest to your location</span>
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  disabled={isConfiguringDb}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {REGION_OPTIONS.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary Action: 1-Click Auto-Setup Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAutoSetupDatabase}
                  disabled={isConfiguringDb || !patToken.trim()}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-sm"
                >
                  {isConfiguringDb ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{dbConfigStatus || "Setting Up Database..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>1-Click Auto-Setup Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  {selectedOrgId && selectedOrgId !== "__CREATE_NEW_ORG__"
                    ? `Provisions project inside "${organizations.find((o) => o.id === selectedOrgId)?.name || "selected organization"}" on Supabase Free Tier`
                    : "Automatically provisions project on Supabase Free Tier, applies SQL schema & sets up storage buckets"}
                </p>
              </div>

              {/* Secondary Option: Inspect existing projects */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Already have an existing project?
                </span>
                <button
                  type="button"
                  onClick={handleFetchProjects}
                  disabled={isFetchingProjects || isConfiguringDb || !patToken.trim()}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition flex items-center gap-1"
                >
                  {isFetchingProjects ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Fetching projects...</span>
                    </>
                  ) : (
                    <span>Inspect Existing Projects</span>
                  )}
                </button>
              </div>
            </div>

            {/* Live Progress Banner during Auto-Setup */}
            {isConfiguringDb && (
              <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-950">
                      Automating Supabase Setup...
                    </h5>
                    <p className="text-xs text-indigo-700 font-mono mt-0.5">
                      {dbConfigStatus || "Connecting to Supabase Management API..."}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-800/80 leading-relaxed pl-1">
                  Cloud PostgreSQL takes ~30–45s to provision. As soon as it is active, we&apos;ll apply schema migrations and advance to Step 2.
                </p>
              </div>
            )}

            {/* Zero Projects Detected Card */}
            {hasFetchedOnce && projects.length === 0 && (
              <div className="mt-5 p-5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 mt-0.5 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                      <span>Token Connected! Ready to create &quot;jobtrack&quot; database</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Token Authenticated ✓
                      </span>
                    </h4>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      {organizations.length > 0 ? (
                        <>
                          Connected to organization <strong>&quot;{organizations[0].name}&quot;</strong>. We didn&apos;t find an existing database project in this organization yet.
                        </>
                      ) : (
                        <>
                          We authenticated your token. No active database project was found in your Supabase account yet.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* 1-Click Auto-Create via API button directly inside the card */}
                <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Recommended: Auto-Create via Management API
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Provisions &quot;jobtrack&quot; on the Free Tier and runs migrations automatically without leaving this page.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoSetupDatabase}
                      disabled={isConfiguringDb}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {isConfiguringDb ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Database...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>1-Click Auto-Create &amp; Provision</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Manual Alternative */}
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium hover:text-slate-900 select-none text-[11px] text-amber-900/80">
                    Prefer to create it manually on the Supabase Dashboard? Click here
                  </summary>
                  <div className="mt-3 bg-white p-4 rounded-xl border border-amber-200/90 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          1. Open the project creation screen in Supabase:
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {organizations.length > 0
                            ? `Pre-configured for "${organizations[0].name}" (bypasses the organization screen)`
                            : "Opens your Supabase project creation form"}
                        </p>
                      </div>
                      <a
                        href={
                          organizations.length > 0 && organizations[0]?.id
                            ? `https://supabase.com/dashboard/project/new?orgId=${organizations[0].id}`
                            : "https://supabase.com/dashboard"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition shadow-sm shrink-0"
                      >
                        <span>Create Project on Supabase</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Cheat-Sheet Values */}
                    <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2 border border-slate-200/80">
                      <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                        Recommended settings for your project:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 font-mono text-xs">
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                          <span>Name: <strong>jobtrack</strong></span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("jobtrack", "name")}
                            className="text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            {copiedField === "name" ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                          <span className="truncate mr-2">Pass: <strong>{suggestedPassword}</strong></span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(suggestedPassword, "pass")}
                            className="text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 transition shrink-0"
                          >
                            {copiedField === "pass" ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 font-sans leading-relaxed">
                        Select <strong>Free Plan</strong> and choose your closest Region (e.g. <em>Singapore</em>). Then click <em>&quot;Create new project&quot;</em>.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-amber-900 leading-relaxed">
                        <p className="font-semibold">2. Once created on Supabase:</p>
                        <p className="text-[11px] text-amber-800">Supabase takes ~45–60s to provision. When ready, click refresh below!</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchProjects}
                        disabled={isFetchingProjects}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 shrink-0"
                      >
                        {isFetchingProjects ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking for Database...</span>
                          </>
                        ) : (
                          <>
                            <span>↻ I&apos;ve Created It — Refresh Projects</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Projects Dropdown & Auto-Configure Button */}
            {projects.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Select your Supabase Project ({projects.length} found):
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchProjects}
                      disabled={isFetchingProjects}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                    >
                      {isFetchingProjects ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Refreshing...</span>
                        </>
                      ) : (
                        <span>↻ Refresh Projects</span>
                      )}
                    </button>
                  </div>
                  <select
                    value={selectedProjectRef}
                    onChange={(e) => setSelectedProjectRef(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.region}) — {proj.status}
                      </option>
                    ))}
                    <option value="__CREATE_NEW__">
                      + Create a fresh &quot;jobtrack&quot; project via API
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={
                    selectedProjectRef === "__CREATE_NEW__"
                      ? handleAutoSetupDatabase
                      : handleAutoConfigureDatabase
                  }
                  disabled={isConfiguringDb}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-sm"
                >
                  {isConfiguringDb ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{dbConfigStatus || "Configuring Database..."}</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {selectedProjectRef === "__CREATE_NEW__"
                          ? "Create 'jobtrack' Project & Auto-Configure"
                          : "Auto-Configure Selected Project & Write .env.local"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT PROJECT URL + SECRET KEY */}
      {step1Mode === "direct" && (
        <div className="space-y-4">
          {/* Notice for Creating Supabase Database Projects Manually */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <p className="font-bold text-sm text-blue-900">Need a Supabase database project?</p>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    <span>Open Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="mt-1 text-blue-800">
                  Supabase offers 2 free PostgreSQL database projects:
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Box 1: Existing Account */}
                  <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950 mb-1">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                      <span>Already have a Supabase account?</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-700 font-bold underline">Supabase Dashboard</a> and click <strong>&quot;+ New project&quot;</strong> in your organization. Name it <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-900 font-bold">jobtrack</code>.
                    </p>
                  </div>

                  {/* Box 2: First Time User */}
                  <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950 mb-1">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>Brand new to Supabase?</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Sign up for free at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-700 font-bold underline">supabase.com</a>. Create an organization (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-900 font-bold">Personal</code>), then create your project.
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-blue-900/90 font-medium">
                  💡 Once your project is created on Supabase, copy the Project URL and Service Role Key below to connect.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-xs text-slate-600 mb-4">
              In your Supabase project dashboard, click the <strong>"Connect"</strong> button at the top header (or navigate to <em>Project Settings &gt; API</em>) to view your credentials:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://abcdefghijklm.supabase.co"
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Secret Key / Service Role Key
                </label>
                <input
                  type="password"
                  value={manualServiceKey}
                  onChange={(e) => setManualServiceKey(e.target.value)}
                  placeholder="sb_secret_... or eyJhbGciOi..."
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Anon / Publishable Key (Optional)
                </label>
                <input
                  type="password"
                  value={manualAnonKey}
                  onChange={(e) => setManualAnonKey(e.target.value)}
                  placeholder="sb_publishable_... (Optional)"
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {!manualConnected ? (
                <button
                  type="button"
                  onClick={handleDirectConnect}
                  disabled={isManualSaving || !manualUrl.trim() || !manualServiceKey.trim()}
                  className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isManualSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating & Connecting...</span>
                    </>
                  ) : (
                    <span>Connect Project</span>
                  )}
                </button>
              ) : (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Project credentials connected!</span>
                  </div>

                  {missingTables.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-700">
                        Some database tables are missing:{" "}
                        <span className="font-mono text-rose-600">{missingTables.join(", ")}</span>.
                        Please run the setup SQL schema in your Supabase SQL Editor:
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCopySql}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                        >
                          {copiedSql ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>SQL Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Setup SQL</span>
                            </>
                          )}
                        </button>
                        <a
                          href="https://supabase.com/dashboard/project/_/sql/new"
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                        >
                          <span>Open Supabase SQL Editor</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifyTables}
                        disabled={isVerifyingTables}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {isVerifyingTables ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Verifying Database Tables...</span>
                          </>
                        ) : (
                          <>
                            <span>I have run the SQL — Verify & Continue</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
