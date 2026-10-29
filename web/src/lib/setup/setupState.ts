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

/**
 * Returns current setup state with Supabase app_settings as the Single Source of Truth,
 * gracefully falling back to in-memory environment variables if offline.
 */
export async function getSetupState(): Promise<SetupState> {
  const envUrl =
    readEnvKeyValue("NEXT_PUBLIC_SUPABASE_URL") ||
    readEnvKeyValue("SUPABASE_URL") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const hasSupabase = Boolean(envUrl);
  if (!hasSupabase) {
    return { step: 1, isCompleted: false };
  }

  // 1. Authoritative check: Supabase app_settings table
  try {
    const settings = await getAppSettings();
    if (settings) {
      if ((settings as any).setup_completed) {
        return { step: 5, isCompleted: true };
      }
      if ((settings as any).setup_step) {
        const dbStep = (settings as any).setup_step;
        if (dbStep >= 1 && dbStep <= 5) {
          return { step: dbStep as 1 | 2 | 3 | 4 | 5, isCompleted: false };
        }
      }
    }
  } catch {
    // Ignore db read issues during early setup
  }

  return { step: 1, isCompleted: false };
}

/**
 * Saves active setup step directly to Supabase app_settings table (Single Source of Truth).
 * Does NOT touch .env files to prevent Next.js dev server hot-restarts.
 */
export async function saveSetupStep(step: 1 | 2 | 3 | 4 | 5): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await updateAppSettings({
        setup_step: step,
      } as any);
      break;
    } catch (err: any) {
      if (attempt < 3 && err.message?.includes("fetch failed")) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else if (attempt === 3) {
        if (!err.message?.includes("fetch failed")) {
          console.warn("Notice: Could not persist setup_step to Supabase table:", err.message);
        }
      }
    }
  }
}

/**
 * Marks setup completely finished in Supabase app_settings table (Single Source of Truth).
 * Does NOT touch .env files to ensure seamless, instant dashboard launch.
 */
export async function markSetupComplete(): Promise<void> {
  try {
    await updateAppSettings({
      setup_step: 5,
      setup_completed: true,
    } as any);
  } catch (err: any) {
    console.warn("Notice: Could not persist setup_completed to Supabase table:", err.message);
  }
}
