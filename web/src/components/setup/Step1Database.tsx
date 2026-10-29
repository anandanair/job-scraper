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
  Layers,
  PlusCircle,
  RefreshCw,
} from "lucide-react";

interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: string;
  organization_id?: string;
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
  connectedServiceRoleKey?: string;
  initialMissingTables?: string[];
  onConnected: (url: string) => void;
  onNextStep: () => void;
}

export function Step1Database({
  supabaseConnected,
  connectedSupabaseUrl,
  connectedServiceRoleKey = "",
  initialMissingTables = [],
  onConnected,
  onNextStep,
}: Step1DatabaseProps) {
  const hasInitialMissing = initialMissingTables.length > 0;
  const [step1Mode, setStep1Mode] = useState<"token" | "direct">(
    hasInitialMissing ? "direct" : "token"
  );
  const [patToken, setPatToken] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ap-southeast-1");
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProjectRef, setSelectedProjectRef] = useState("");
  const [projectAction, setProjectAction] = useState<"connect_existing" | "create_new">("connect_existing");
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

      const fetchedOrgs: Array<{ id: string; name: string }> = data.organizations || [];
      const fetchedProjects: SupabaseProject[] = data.projects || [];

      setOrganizations(fetchedOrgs);
      setProjects(fetchedProjects);
      setTokenValidated(true);

      const defaultOrg = fetchedOrgs.length > 0 ? fetchedOrgs[0].id : "__CREATE_NEW_ORG__";
      setSelectedOrgId((prev) => (prev ? prev : defaultOrg));

      // Find 'jobtrack' project or default to the first project found
      const jobtrackProj = fetchedProjects.find(
        (p) => p.name && p.name.toLowerCase() === "jobtrack"
      );

      if (jobtrackProj) {
        setSelectedProjectRef(jobtrackProj.id);
        setProjectAction("connect_existing");
      } else if (fetchedProjects.length > 0) {
        setSelectedProjectRef(fetchedProjects[0].id);
        setProjectAction("connect_existing");
      } else {
        setSelectedProjectRef("__CREATE_NEW__");
        setProjectAction("create_new");
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

  // Handle Organization Change
  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    if (newOrgId === "__CREATE_NEW_ORG__") {
      setProjectAction("create_new");
      setSelectedProjectRef("__CREATE_NEW__");
      return;
    }

    const orgProjects = projects.filter(
      (p) => !p.organization_id || p.organization_id === newOrgId
    );
    const jobtrackProj = orgProjects.find(
      (p) => p.name && p.name.toLowerCase() === "jobtrack"
    );

    if (jobtrackProj) {
      setSelectedProjectRef(jobtrackProj.id);
      setProjectAction("connect_existing");
    } else if (orgProjects.length > 0) {
      setSelectedProjectRef(orgProjects[0].id);
      setProjectAction("connect_existing");
    } else {
      setSelectedProjectRef("__CREATE_NEW__");
      setProjectAction("create_new");
    }
  };

  // Direct keys state
  const [manualUrl, setManualUrl] = useState(connectedSupabaseUrl || "");
  const [manualServiceKey, setManualServiceKey] = useState(connectedServiceRoleKey || "");
  const [manualAnonKey, setManualAnonKey] = useState("");
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualConnected, setManualConnected] = useState(
    Boolean(connectedSupabaseUrl && hasInitialMissing)
  );
  const [missingTables, setMissingTables] = useState<string[]>(initialMissingTables);
  const [isVerifyingTables, setIsVerifyingTables] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (initialMissingTables && initialMissingTables.length > 0) {
      setMissingTables(initialMissingTables);
      setManualConnected(true);
      setStep1Mode("direct");
      if (connectedSupabaseUrl) setManualUrl(connectedSupabaseUrl);
      if (connectedServiceRoleKey) setManualServiceKey(connectedServiceRoleKey);
    }
  }, [initialMissingTables, connectedSupabaseUrl, connectedServiceRoleKey]);

  // Handler: Connect Existing Project
  const handleConnectExistingProject = async () => {
    if (!selectedProjectRef || selectedProjectRef === "__CREATE_NEW__") {
      setStep1Error("Please select a valid Supabase project from the list.");
      return;
    }
    setStep1Error(null);
    setIsConfiguringDb(true);
    setDbConfigStatus("Verifying project & retrieving API keys...");

    try {
      setDbConfigStatus("Executing database schema & triggers via Management API...");
      const res = await fetch("/api/setup/supabase/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: patToken.trim(),
          projectRef: selectedProjectRef,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Database configuration failed.");
      }

      setDbConfigStatus("Verifying database schema...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      setDbConfigStatus("Writing .env.local configuration file...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      onConnected(data.supabaseUrl || `https://${selectedProjectRef}.supabase.co`);
      onNextStep();
    } catch (err: any) {
      setStep1Error(err.message);
    } finally {
      setIsConfiguringDb(false);
      setDbConfigStatus("");
    }
  };

  // Handler: Create Fresh Project on Free Tier
  const handleCreateNewProject = async () => {
    if (!patToken.trim()) {
      setStep1Error("Please enter your Supabase Personal Access Token.");
      return;
    }
    setStep1Error(null);
    setIsConfiguringDb(true);

    try {
      const orgName = organizations.find((o) => o.id === selectedOrgId)?.name;
      setDbConfigStatus(
        selectedOrgId === "__CREATE_NEW_ORG__"
          ? "Creating 'JobTrack Org' & provisioning 'jobtrack' database on Supabase Free Tier..."
          : `Creating 'jobtrack' project inside organization "${orgName || "selected"}"...`
      );

      const createRes = await fetch("/api/setup/supabase/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: patToken.trim(),
          region: selectedRegion,
          projectName: "jobtrack",
          organizationId: selectedOrgId,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to create project via Supabase Management API.");
      }

      const targetProjectRef = createData.project.id;
      setSelectedProjectRef(targetProjectRef);

      // Poll until database status is ACTIVE_HEALTHY
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
          "Supabase project is taking longer than expected to provision. Please wait 10 seconds and try again."
        );
      }

      // Configure Database schema & write .env.local
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

      setDbConfigStatus("Configuring database environment...");
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

  // Find currently selected project details for display
  const currentProject = projects.find((p) => p.id === selectedProjectRef);
  const isJobtrackProjectSelected =
    currentProject && currentProject.name.toLowerCase() === "jobtrack";

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
              <p className="font-bold text-sm text-emerald-950">Database Already Configured &amp; Verified!</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Connected to Supabase {connectedSupabaseUrl ? `(${connectedSupabaseUrl})` : ""}. All required database tables and triggers are already initialized.
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

      {/* Schema Migration Notice for Existing Users */}
      {hasInitialMissing && !supabaseConnected && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-amber-950">Database Schema Update Required</p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Your Supabase credentials are connected, but some required database tables are missing from earlier versions ({missingTables.join(", ")}). Please run the SQL schema below in Direct Keys mode, or use 1-Click Auto-Setup to upgrade your database automatically.
            </p>
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
          <span>Auto-Connect via Token (Recommended)</span>
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
          <span>Connect with Project URL &amp; Secret Key</span>
        </button>
      </div>

      {/* TAB 1: TOKEN MAGIC SETUP */}
      {step1Mode === "token" && (
        <div className="space-y-5">
          {/* Instructions Card (shown when token is not yet validated) */}
          {!tokenValidated && (
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
                    Click <strong>&quot;Generate new token&quot;</strong>:
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
                    Pro-Tip: Click &quot;Create legacy token&quot; for instant 1-click access
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
                      ⚠️ Important: Supabase only shows the token value once! Copy it before clicking &quot;Done&quot;.
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
                    ) into the field below:
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Token Input Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span>Supabase Personal Access Token</span>
                </label>
                {isValidatingToken ? (
                  <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Validating token...
                  </span>
                ) : tokenValidated ? (
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Authenticated ✓
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                  placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={isConfiguringDb}
                  className="block w-full pl-3.5 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                {!tokenValidated && patToken.trim() && (
                  <div className="absolute inset-y-1 right-1">
                    <button
                      type="button"
                      onClick={() => fetchAccountInfo(patToken)}
                      disabled={isValidatingToken}
                      className="h-full px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition flex items-center gap-1 shadow-sm"
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

            {tokenValidated && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{organizations.length} organization(s) • {projects.length} project(s) detected</span>
                </span>
                <button
                  type="button"
                  onClick={() => fetchAccountInfo(patToken, false)}
                  disabled={isValidatingToken || isConfiguringDb}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Unified Context-Aware Project Configuration Card */}
          {tokenValidated && (
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-5 shadow-sm">
              {/* Card Header & Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Database Configuration</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {projectAction === "connect_existing"
                      ? "Connect an existing Supabase database project to JobTrack"
                      : "Provision a fresh 'jobtrack' database on Supabase Free Tier"}
                  </p>
                </div>

                {/* Mode Selector Tabs (only shown if user has projects) */}
                {projects.length > 0 && (
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectAction("connect_existing");
                        setStep1Error(null);
                        if (!selectedProjectRef || selectedProjectRef === "__CREATE_NEW__") {
                          const jobtrackProj = projects.find(
                            (p) => p.name && p.name.toLowerCase() === "jobtrack"
                          );
                          setSelectedProjectRef(jobtrackProj ? jobtrackProj.id : projects[0].id);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                        projectAction === "connect_existing"
                          ? "bg-white text-indigo-700 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Use Existing ({projects.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectAction("create_new");
                        setStep1Error(null);
                        setSelectedProjectRef("__CREATE_NEW__");
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                        projectAction === "create_new"
                          ? "bg-white text-indigo-700 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Target Organization Selector (shared across modes) */}
              {organizations.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Target Organization
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {organizations.length === 1 ? "1 organization available" : `${organizations.length} organizations`}
                    </span>
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    disabled={isConfiguringDb}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
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
                </div>
              )}

              {/* VIEW A: CONNECT EXISTING PROJECT */}
              {projectAction === "connect_existing" && projects.length > 0 && (
                <div className="space-y-4">
                  {/* Existing Project Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-500" />
                        Select Supabase Project
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {projects.length} project(s) found in account
                      </span>
                    </label>
                    <select
                      value={selectedProjectRef}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__CREATE_NEW__") {
                          setProjectAction("create_new");
                          setSelectedProjectRef("__CREATE_NEW__");
                        } else {
                          setSelectedProjectRef(val);
                        }
                      }}
                      disabled={isConfiguringDb}
                      className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name} ({proj.region}) — {proj.status}
                        </option>
                      ))}
                      <option value="__CREATE_NEW__">
                        + Create a fresh &quot;jobtrack&quot; project instead
                      </option>
                    </select>
                  </div>

                  {/* Selected Project Status Summary Box */}
                  {currentProject && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                        isJobtrackProjectSelected
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                          : "bg-indigo-50/60 border-indigo-200 text-indigo-950"
                      }`}
                    >
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          isJobtrackProjectSelected ? "text-emerald-600" : "text-indigo-600"
                        }`}
                      />
                      <div className="space-y-1">
                        <p className="font-bold text-xs">
                          {isJobtrackProjectSelected
                            ? "Existing \"jobtrack\" database detected!"
                            : `Selected project: "${currentProject.name}"`}
                        </p>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          {isJobtrackProjectSelected
                            ? "Ready to connect. We will verify database tables and configure your local environment."
                            : "This project will be initialized with JobTrack database tables and RPC functions."}
                        </p>
                        <div className="flex items-center gap-2 pt-1 font-mono text-[10px]">
                          <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                            Ref: {currentProject.id}
                          </span>
                          <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                            Region: {currentProject.region}
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                            ● {currentProject.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline Error Notice */}
                  {step1Error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Setup Notice</p>
                        <p className="mt-0.5 text-[11px]">{step1Error}</p>
                      </div>
                    </div>
                  )}

                  {/* Single Action Button: Connect Existing */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleConnectExistingProject}
                      disabled={isConfiguringDb || !selectedProjectRef}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-sm"
                    >
                      {isConfiguringDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{dbConfigStatus || "Configuring Database..."}</span>
                        </>
                      ) : (
                        <>
                          <span>Connect &amp; Auto-Configure Database</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                      Retrieves API keys, applies database schema &amp; triggers, and writes .env.local
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW B: CREATE NEW PROJECT */}
              {(projectAction === "create_new" || projects.length === 0) && (
                <div className="space-y-4">
                  {/* Informational Callout */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Automated Supabase Free Tier Provisioning</p>
                      <p className="text-[11px] text-indigo-900/80 mt-0.5 leading-relaxed">
                        A new project named <strong>&quot;jobtrack&quot;</strong> will be created in your selected organization. PostgreSQL will be provisioned, tables created, and credentials saved automatically.
                      </p>
                    </div>
                  </div>

                  {/* Cloud Region Selector */}
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
                      className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      {REGION_OPTIONS.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Inline Error Notice */}
                  {step1Error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Setup Notice</p>
                        <p className="mt-0.5 text-[11px]">{step1Error}</p>
                      </div>
                    </div>
                  )}

                  {/* Single Action Button: Create New */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCreateNewProject}
                      disabled={isConfiguringDb || !patToken.trim()}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-sm"
                    >
                      {isConfiguringDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{dbConfigStatus || "Provisioning Database..."}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>1-Click Auto-Create &amp; Provision Database</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                      {selectedOrgId && selectedOrgId !== "__CREATE_NEW_ORG__"
                        ? `Provisions "jobtrack" inside "${organizations.find((o) => o.id === selectedOrgId)?.name || "selected organization"}" on Supabase Free Tier`
                        : "Provisions project on Supabase Free Tier and applies SQL schema"}
                    </p>
                  </div>
                </div>
              )}

              {/* Live Multi-Step Execution Banner */}
              {isConfiguringDb && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2.5">
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
                    Cloud PostgreSQL takes ~20–45s to initialize. As soon as it is online, we will automatically run schema migrations and advance to Step 2.
                  </p>
                </div>
              )}

              {/* Collapsible Manual Alternative */}
              <div className="pt-2 border-t border-slate-100">
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium hover:text-slate-900 select-none text-[11px] text-slate-500">
                    Prefer to create or manage the project manually in the Supabase Dashboard? Click here
                  </summary>
                  <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          1. Open the project creation screen on Supabase:
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {organizations.length > 0
                            ? `Pre-configured for "${organizations[0].name}"`
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
                    <div className="bg-white p-3 rounded-lg text-xs space-y-2 border border-slate-200">
                      <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                        Recommended settings for your project:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 font-mono text-xs">
                        <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span>Name: <strong>jobtrack</strong></span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("jobtrack", "name")}
                            className="text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            {copiedField === "name" ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
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
                      <div className="text-xs text-slate-700 leading-relaxed">
                        <p className="font-semibold">2. Once created on Supabase:</p>
                        <p className="text-[11px] text-slate-500">Wait ~45s for provisioning to finish, then click refresh below:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchAccountInfo(patToken, false)}
                        disabled={isValidatingToken || isConfiguringDb}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isValidatingToken ? "animate-spin" : ""}`} />
                        <span>Refresh Projects</span>
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}
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
              In your Supabase project dashboard, click the <strong>&quot;Connect&quot;</strong> button at the top header (or navigate to <em>Project Settings &gt; API</em>) to view your credentials:
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

              {step1Error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{step1Error}</span>
                </div>
              )}

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
                      <span>Validating &amp; Connecting...</span>
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
                            <span>I have run the SQL — Verify &amp; Continue</span>
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
