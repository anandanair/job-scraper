import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Endpoint to invalidate the dashboard stats cache.
 * Can be called by backend scripts (e.g., Python job scraper, score_jobs.py)
 * or webhooks after new jobs are inserted or updated.
 *
 * Example usage from Python or curl:
 *   POST /api/revalidate-stats
 */
export async function POST(request: Request) {
  try {
    // Optional bearer token check if REVALIDATE_SECRET is configured
    const expectedSecret = process.env.REVALIDATE_SECRET;
    if (expectedSecret) {
      const authHeader = request.headers.get("authorization");
      const urlSecret = new URL(request.url).searchParams.get("secret");
      if (
        authHeader !== `Bearer ${expectedSecret}` &&
        urlSecret !== expectedSecret
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    revalidateTag("dashboard-stats", "default");
    revalidatePath("/");

    return NextResponse.json(
      {
        revalidated: true,
        tag: "dashboard-stats",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error revalidating stats:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to revalidate stats", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Also support GET for quick testing in browser or curl
  return POST(request);
}
