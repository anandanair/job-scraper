import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  // 2. Check setup completion status via persistent cookie or environment flag
  const isSetupComplete =
    request.cookies.get("jobtrack_setup_complete")?.value === "true" ||
    process.env.SETUP_COMPLETED === "true";

  // 3. If setup is NOT completed:
  if (!isSetupComplete) {
    // Allow setup page itself
    if (pathname === "/setup" || pathname.startsWith("/setup/")) {
      return NextResponse.next();
    }
    // Block all other pages (/, /jobs/*, /resume-studio, /settings, /profile) and redirect to /setup
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = "/setup";
    return NextResponse.redirect(setupUrl);
  }

  // 4. If setup IS completed:
  // Prevent navigating back to /setup (once completed, it's done!)
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
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
