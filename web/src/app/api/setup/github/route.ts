import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { seal } from "tweetsodium";

export const dynamic = "force-dynamic";

const UPSTREAM_OWNER = "anandanair";
const UPSTREAM_REPO = "job-scraper";

function getEnvCredentials() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    const candidatePaths = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), "..", ".env.local"),
      path.resolve(process.cwd(), "..", ".env"),
    ];

    for (const envPath of candidatePaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
            url = trimmed.split("=")[1].replace(/["']/g, "").trim();
          } else if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
            serviceKey = trimmed.split("=")[1].replace(/["']/g, "").trim();
          }
        }
      }
    }
  }

  return { url, serviceKey };
}

function detectGitRemote(): { owner?: string; repo?: string; isUpstream: boolean } {
  try {
    // 1. Check if configured in environment first (e.g. from Step 5 fork)
    let envOwner = process.env.GITHUB_REPO_OWNER;
    let envRepo = process.env.GITHUB_REPO_NAME;

    const candidateEnvPaths = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), "..", ".env.local"),
      path.resolve(process.cwd(), "..", ".env"),
    ];

    for (const envPath of candidateEnvPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("GITHUB_REPO_OWNER=")) {
            envOwner = trimmed.split("=")[1].replace(/["']/g, "").trim();
          } else if (trimmed.startsWith("GITHUB_REPO_NAME=")) {
            envRepo = trimmed.split("=")[1].replace(/["']/g, "").trim();
          }
        }
      }
    }

    if (envOwner) {
      const isUpstream = envOwner.toLowerCase() === UPSTREAM_OWNER.toLowerCase();
      return { owner: envOwner, repo: envRepo || "job-scraper", isUpstream };
    }

    // 2. Fallback to reading git remote config
    const candidatePaths = [
      path.resolve(process.cwd(), ".git", "config"),
      path.resolve(process.cwd(), "..", ".git", "config"),
    ];

    for (const configPath of candidatePaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const match = content.match(/url\s*=\s*.*github\.com[:/]([^/]+)\/([^/.]+)(\.git)?/i);
        if (match) {
          const owner = match[1];
          const repo = match[2];
          const isUpstream =
            owner.toLowerCase() === UPSTREAM_OWNER.toLowerCase() &&
            (repo.toLowerCase() === "job-scraper" || repo.toLowerCase() === "linkedin-jobs-scrapper");
          return { owner, repo, isUpstream };
        }
      }
    }
  } catch (err) {
    console.warn("Could not read git config:", err);
  }

  return { isUpstream: true };
}

function encryptSecret(secretValue: string, publicKeyBase64: string): string {
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(publicKeyBase64, "base64");
  const encryptedBytes = seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
}

/**
 * GET /api/setup/github
 * Auto-detects repository origin and fork status from local git config.
 */
export async function GET() {
  try {
    const gitInfo = detectGitRemote();
    const { url, serviceKey } = getEnvCredentials();

    return NextResponse.json({
      detected: Boolean(gitInfo.owner && gitInfo.repo),
      owner: gitInfo.owner || null,
      repo: gitInfo.repo || "job-scraper",
      isUpstream: gitInfo.isUpstream,
      upstreamOwner: UPSTREAM_OWNER,
      upstreamRepo: UPSTREAM_REPO,
      hasSupabaseUrl: Boolean(url),
      hasServiceKey: Boolean(serviceKey),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to detect repository" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/setup/github
 * Validates token, auto-forks if needed, encrypts and sets repository secrets.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "GitHub Personal Access Token is required." },
        { status: 400 }
      );
    }

    const { url: supabaseUrl, serviceKey: supabaseServiceKey } = getEnvCredentials();
    const finalUrl = body.supabaseUrl || supabaseUrl;
    const finalKey = body.supabaseServiceRoleKey || supabaseServiceKey;

    if (!finalUrl || !finalKey) {
      return NextResponse.json(
        { error: "Supabase connection details not found. Please complete Step 1 first." },
        { status: 400 }
      );
    }

    const githubHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "JobTrack-AutoSetup",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // 1. Verify token & get authenticated user
    const userRes = await fetch("https://api.github.com/user", {
      headers: githubHeaders,
    });

    if (!userRes.ok) {
      const errData = await userRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `GitHub Authentication Failed: ${errData.message || userRes.statusText}. Please verify token has 'repo' scope.` },
        { status: 401 }
      );
    }

    const userData = await userRes.json();
    const username = userData.login;
    let targetOwner = body.targetOwner || username;
    let targetRepo = body.targetRepo || "job-scraper";
    let forkCreated = false;
    let defaultBranch = "main";

    // 2. Check if target repo exists under user account; if not, auto-fork
    const checkRepoRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}`, {
      headers: githubHeaders,
    });

    if (checkRepoRes.status === 404) {
      // User doesn't have a fork yet -> call GitHub API to auto-fork!
      console.log(`Auto-forking https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO} to ${username}...`);
      const forkRes = await fetch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
        method: "POST",
        headers: githubHeaders,
        body: JSON.stringify({ default_branch_only: true }),
      });

      if (!forkRes.ok && forkRes.status !== 202) {
        const forkErr = await forkRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: `Failed to auto-fork repository: ${forkErr.message || forkRes.statusText}` },
          { status: 400 }
        );
      }

      forkCreated = true;
      targetOwner = username;

      // Wait 3 seconds for GitHub to provision the fork
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else if (checkRepoRes.ok) {
      const repoMeta = await checkRepoRes.json().catch(() => ({}));
      if (repoMeta.default_branch) {
        defaultBranch = repoMeta.default_branch;
      }
    }

    // 3. Fetch public key for Secrets encryption
    let pubKeyRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/secrets/public-key`, {
      headers: githubHeaders,
    });

    // If fork was just created, it might take another moment to become ready
    if (!pubKeyRes.ok && forkCreated) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      pubKeyRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/secrets/public-key`, {
        headers: githubHeaders,
      });

      // Also grab default branch for the newly created fork
      try {
        const newRepoRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}`, {
          headers: githubHeaders,
        });
        if (newRepoRes.ok) {
          const newRepoData = await newRepoRes.json();
          if (newRepoData.default_branch) defaultBranch = newRepoData.default_branch;
        }
      } catch {}
    }

    if (!pubKeyRes.ok) {
      const keyErr = await pubKeyRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Could not access GitHub Actions Secrets on ${targetOwner}/${targetRepo}: ${keyErr.message || pubKeyRes.statusText}. Ensure token has 'repo' scope.` },
        { status: 403 }
      );
    }

    const { key_id, key: publicKeyBase64 } = await pubKeyRes.json();

    // 4. Encrypt and upload the 2 secrets
    const secretsToSet = [
      { name: "SUPABASE_URL", value: finalUrl },
      { name: "SUPABASE_SERVICE_ROLE_KEY", value: finalKey },
    ];

    const syncedSecrets: string[] = [];

    for (const secret of secretsToSet) {
      const encryptedValue = encryptSecret(secret.value, publicKeyBase64);
      const putRes = await fetch(
        `https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/secrets/${secret.name}`,
        {
          method: "PUT",
          headers: githubHeaders,
          body: JSON.stringify({
            encrypted_value: encryptedValue,
            key_id: key_id,
          }),
        }
      );

      if (!putRes.ok) {
        const putErr = await putRes.json().catch(() => ({}));
        throw new Error(`Failed to save secret ${secret.name}: ${putErr.message || putRes.statusText}`);
      }

      syncedSecrets.push(secret.name);
    }

    // 5. Enable GitHub Actions on the target repository (forks have Actions disabled by default)
    let actionsEnabled = false;
    try {
      const actionsPermRes = await fetch(
        `https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/permissions`,
        {
          method: "PUT",
          headers: githubHeaders,
          body: JSON.stringify({
            enabled: true,
            allowed_actions: "all",
          }),
        }
      );
      actionsEnabled = actionsPermRes.ok || actionsPermRes.status === 204;
    } catch (e) {
      console.warn("Notice enabling repository Actions permissions:", e);
    }

    // 6. Enable all 4 automation workflows
    const workflowsToEnable = [
      "scrape_jobs.yml",
      "score_jobs.yml",
      "hourly_resume_customization.yml",
      "job_manager.yml",
    ];

    for (const wf of workflowsToEnable) {
      try {
        await fetch(
          `https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/workflows/${wf}/enable`,
          {
            method: "PUT",
            headers: githubHeaders,
          }
        );
      } catch (e) {
        console.warn(`Notice enabling workflow ${wf}:`, e);
      }
    }

    // 7. Dispatch the initial Job Scraper run immediately so new jobs are populated right away
    let workflowDispatched = false;
    try {
      const dispatchRes = await fetch(
        `https://api.github.com/repos/${targetOwner}/${targetRepo}/actions/workflows/scrape_jobs.yml/dispatches`,
        {
          method: "POST",
          headers: githubHeaders,
          body: JSON.stringify({
            ref: defaultBranch,
          }),
        }
      );
      workflowDispatched = dispatchRes.status === 204 || dispatchRes.ok;
      if (workflowDispatched) {
        console.log(`✓ Successfully dispatched initial scrape_jobs.yml on ref: ${defaultBranch}`);
      }
    } catch (e) {
      console.warn("Notice dispatching initial scraper run:", e);
    }

    // 8. Persist target owner to memory so the dashboard links to the forked repository
    try {
      process.env.GITHUB_REPO_OWNER = targetOwner;
      process.env.GITHUB_REPO_NAME = targetRepo;
    } catch (e) {
      console.warn("Notice persisting GITHUB_REPO_OWNER:", e);
    }

    // 9. Update local git remote origin to the user's personal fork
    let localRemoteUpdated = false;
    try {
      const forkGitUrl = `https://github.com/${targetOwner}/${targetRepo}.git`;
      const repoRoot = fs.existsSync(path.resolve(process.cwd(), ".git"))
        ? process.cwd()
        : fs.existsSync(path.resolve(process.cwd(), "..", ".git"))
        ? path.resolve(process.cwd(), "..")
        : process.cwd();

      execSync(`git remote set-url origin ${forkGitUrl}`, { cwd: repoRoot, stdio: "ignore" });
      localRemoteUpdated = true;
      console.log(`✓ Updated local git remote origin to ${forkGitUrl}`);
    } catch (gitErr) {
      console.warn("Could not update local git remote (non-fatal):", gitErr);
    }

    return NextResponse.json({
      success: true,
      username,
      targetOwner,
      targetRepo,
      repoUrl: `https://github.com/${targetOwner}/${targetRepo}`,
      forkCreated,
      syncedSecrets,
      actionsEnabled,
      workflowDispatched,
      localRemoteUpdated,
      message: `Successfully configured secrets and initiated cloud scraper on ${targetOwner}/${targetRepo}!`,
    });
  } catch (error: any) {
    console.error("Error in /api/setup/github:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync secrets to GitHub." },
      { status: 500 }
    );
  }
}
