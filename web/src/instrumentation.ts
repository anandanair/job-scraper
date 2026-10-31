/**
 * Next.js instrumentation hook - runs once per server process, before the app
 * starts serving requests.
 *
 * Applies any pending database migrations so a user who updates the code and
 * launches the app gets the matching schema without clicking anything.
 */
export async function register() {
  // Only run in the Node.js runtime; the edge runtime has no filesystem access
  // and cannot read .env.local.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { createSupabaseStaticClient, isSupabaseConfigured } = await import(
      "@/utils/supabase/server"
    );

    if (!isSupabaseConfigured()) {
      // Setup wizard has not run yet - nothing to migrate.
      return;
    }

    const { runPendingMigrations } = await import("@/lib/setup/runMigrations");
    const supabase = createSupabaseStaticClient();
    const result = await runPendingMigrations(supabase, true);

    if (result.appliedCount > 0) {
      console.log(
        `[JobTrack] Applied ${result.appliedCount} database migration(s).`
      );
    }

    if (!result.ok && result.remaining > 0) {
      console.warn(
        `[JobTrack] ${result.remaining} database migration(s) still pending. ${result.reason || ""}`.trim()
      );
    }
  } catch (error: any) {
    // Never block startup on a migration failure - the dashboard banner will
    // surface the problem and offer the manual SQL path.
    console.warn("[JobTrack] Startup migration check skipped:", error?.message || error);
  }
}
