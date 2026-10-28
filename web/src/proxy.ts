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
  // Setup CANNOT be considered complete if Supabase is not configured!
  const hasSupabase = isSupabaseConfigured();
  const isSetupComplete =
    hasSupabase &&
    (request.cookies.get("jobtrack_setup_complete")?.value === "true" ||
      process.env.SETUP_COMPLETED === "true");

  // 3. If setup is NOT completed:
  if (!isSetupComplete) {
    // Allow setup page itself
    if (pathname === "/setup" || pathname.startsWith("/setup/")) {
      return NextResponse.next();
    }
    // Block all other pages (/, /jobs/*, /resume-studio, /settings, /profile) and redirect to /setup
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = "/setup";
    const response = NextResponse.redirect(setupUrl);

    // If an orphan/stale cookie exists while Supabase isn't configured, delete it
    if (!hasSupabase && request.cookies.has("jobtrack_setup_complete")) {
      response.cookies.delete("jobtrack_setup_complete");
    }

    return response;
  }

  // 4. If setup IS completed:
  // Prevent navigating back to /setup (unless explicitly forced via query param ?force=true)
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    if (!request.nextUrl.searchParams.has("force")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

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
