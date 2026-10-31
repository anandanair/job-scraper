import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

function readEnvKeyFromDisk(key: string): string {
  try {
    const isWebCwd =
      fs.existsSync(path.resolve(process.cwd(), "next.config.ts")) ||
      fs.existsSync(path.resolve(process.cwd(), "next.config.js"));

    const candidatePaths = [
      isWebCwd ? path.resolve(process.cwd(), ".env.local") : path.resolve(process.cwd(), "web", ".env.local"),

      isWebCwd ? path.resolve(process.cwd(), "..", ".env") : path.resolve(process.cwd(), ".env"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith(`${key}=`)) {
            const val = trimmed.split("=")[1].replace(/["']/g, "").trim();
            if (val) return val;
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }
  return "";
}

function getCredentials() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    readEnvKeyFromDisk("NEXT_PUBLIC_SUPABASE_URL") ||
    readEnvKeyFromDisk("SUPABASE_URL");

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    readEnvKeyFromDisk("SUPABASE_SERVICE_ROLE_KEY") ||
    readEnvKeyFromDisk("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    readEnvKeyFromDisk("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    serviceKey;

  const effectiveKey = serviceKey || anonKey;

  // If unconfigured, provide a fallback placeholder so calls do not throw fatal sync "supabaseUrl is required"
  const isConfigured = Boolean(url && effectiveKey);
  const safeUrl = isConfigured ? url! : "https://unconfigured.supabase.co";
  const safeKey = isConfigured ? effectiveKey! : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.unconfigured";

  return {
    url: safeUrl,
    key: safeKey,
    isConfigured,
  };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getCredentials();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Client for static / cached operations that do not require cookies or user session
export function createSupabaseStaticClient() {
  const { url, key } = getCredentials();
  return createSupabaseClient(url, key);
}

/**
 * Returns whether Supabase credentials are present, without creating a client.
 * Used by startup hooks that must not attempt a network call when unconfigured.
 */
export function isSupabaseConfigured(): boolean {
  return getCredentials().isConfigured;
}
