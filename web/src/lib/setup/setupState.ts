import fs from "fs";
import path from "path";
import { updateAppSettings, getAppSettings } from "@/lib/supabase/queries";

export interface SetupState {
  step: 1 | 2 | 3 | 4 | 5;
  isCompleted: boolean;
}

function getWebEnvPath(): string {
  const isWebCwd =
    fs.existsSync(path.resolve(process.cwd(), "next.config.ts")) ||
    fs.existsSync(path.resolve(process.cwd(), "next.config.js"));

  return isWebCwd
    ? path.resolve(process.cwd(), ".env.local")
    : path.resolve(process.cwd(), "web", ".env.local");
}

function readEnvKeyValue(key: string): string | null {
  const envPath = getWebEnvPath();
  if (!fs.existsSync(envPath)) return null;

  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${key}=`)) {
        return trimmed.split("=")[1].replace(/["']/g, "").trim();
      }
    }
  } catch (err) {
    console.warn(`Error reading ${key} from env:`, err);
  }
  return null;
}

function updateEnvKey(key: string, value: string): void {
  const envPath = getWebEnvPath();
  if (!fs.existsSync(envPath)) return;

  try {
    let content = fs.readFileSync(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    const newLine = `${key}="${value}"`;

    if (regex.test(content)) {
      content = content.replace(regex, newLine);
    } else {
      content = content.trimEnd() + "\n" + newLine + "\n";
    }

    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err) {
    console.warn(`Error updating ${key} in env:`, err);
  }
}

/**
 * Returns current setup state from local env and/or Supabase.
 */
export async function getSetupState(): Promise<SetupState> {
  const envCompleted = readEnvKeyValue("SETUP_COMPLETED") || process.env.SETUP_COMPLETED;
  const envStepStr = readEnvKeyValue("SETUP_STEP") || process.env.SETUP_STEP;

  const isCompleted = envCompleted === "true";
  let step: 1 | 2 | 3 | 4 | 5 = 1;

  if (envStepStr) {
    const parsed = parseInt(envStepStr, 10);
    if (parsed >= 1 && parsed <= 5) {
      step = parsed as 1 | 2 | 3 | 4 | 5;
    }
  }

  // Also query Supabase app_settings if available to complement
  try {
    const settings = await getAppSettings();
    if (settings) {
      if ((settings as any).setup_completed) {
        return { step: 5, isCompleted: true };
      }
      if ((settings as any).setup_step) {
        const dbStep = (settings as any).setup_step;
        if (dbStep >= 1 && dbStep <= 5 && dbStep > step) {
          step = dbStep as 1 | 2 | 3 | 4 | 5;
        }
      }
    }
  } catch {
    // Ignore db read issues during early setup
  }

  return { step, isCompleted };
}

/**
 * Saves active setup step to .env.local and attempts to sync to Supabase.
 */
export async function saveSetupStep(step: 1 | 2 | 3 | 4 | 5): Promise<void> {
  process.env.SETUP_STEP = String(step);
  updateEnvKey("SETUP_STEP", String(step));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await updateAppSettings({
        setup_step: step,
      } as any);
      break;
    } catch (err: any) {
      if (attempt < 3 && err.message?.includes("fetch failed")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (attempt === 3) {
        // Graceful: column might not exist in older Supabase schemas or DNS still warming up
        if (!err.message?.includes("fetch failed")) {
          console.warn("Notice: Could not persist setup_step to Supabase table (saved to local env):", err.message);
        }
      }
    }
  }
}

/**
 * Marks setup completely finished in .env.local and attempts to sync to Supabase.
 */
export async function markSetupComplete(): Promise<void> {
  process.env.SETUP_COMPLETED = "true";
  process.env.SETUP_STEP = "5";

  updateEnvKey("SETUP_COMPLETED", "true");
  updateEnvKey("SETUP_STEP", "5");

  try {
    await updateAppSettings({
      setup_step: 5,
      setup_completed: true,
    } as any);
  } catch (err: any) {
    console.warn("Notice: Could not persist setup_completed to Supabase table (saved to local env):", err.message);
  }
}
