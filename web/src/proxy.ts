import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

function isSupabaseConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) {
    return true;
  }
  try {
    const isWebCwd =
      fs.existsSync(path.resolve(process.cwd(), "next.config.ts")) ||
      fs.existsSync(path.resolve(process.cwd(), "next.config.js"));

    const webEnvPath = isWebCwd
      ? path.resolve(process.cwd(), ".env.local")
      : path.resolve(process.cwd(), "web", ".env.local");

    if (fs.existsSync(webEnvPath)) {
      const content = fs.readFileSync(webEnvPath, "utf-8");
      return (
        content.includes("NEXT_PUBLIC_SUPABASE_URL=") &&
        content.split("\n").some((l) => {
          const t = l.trim();
          return (
            (t.startsWith("NEXT_PUBLIC_SUPABASE_URL=") || t.startsWith("SUPABASE_URL=")) &&
            (t.split("=")[1]?.replace(/["']/g, "").trim().length ?? 0) > 0
          );
        })
      );
    }
  } catch {
    // Non-fatal fallback
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow internal Next.js assets, public files, and all API endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // static assets like favicon.ico, images, fonts
  ) {
    return NextResponse.next();
  }

  // 2. Check setup completion status:
  const hasSupabase = isSupabaseConfigured();

  // If Supabase is not configured at all, redirect to /setup
  if (!hasSupabase) {
    if (pathname === "/setup" || pathname.startsWith("/setup/")) {
      return NextResponse.next();
    }
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = "/setup";
    const response = NextResponse.redirect(setupUrl);
    if (request.cookies.has("jobtrack_setup_complete")) {
      response.cookies.delete("jobtrack_setup_complete");
    }
    return response;
  }

  const isSetupComplete =
    request.cookies.get("jobtrack_setup_complete")?.value === "true";

  // If cookie confirms completion:
  if (isSetupComplete) {
    // Prevent navigating back to /setup (unless explicitly forced via ?force=true)
    if (pathname === "/setup" || pathname.startsWith("/setup/")) {
      if (!request.nextUrl.searchParams.has("force")) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        return NextResponse.redirect(homeUrl);
      }
    }
    return NextResponse.next();
  }

  // If cookie is not present yet, but Supabase IS configured:
  // Allow the request to pass to server components (which verify against app_settings in Supabase)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
