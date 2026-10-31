import { NextResponse } from "next/server";
import { createSupabaseStaticClient } from "@/utils/supabase/server";
import {
  getMigrationStatus,
  tryAutoApplyMigrations,
  getSupabaseSqlEditorUrl,
} from "@/lib/setup/migrations";

export const dynamic = "force-dynamic";

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

/**
 * GET /api/system/schema-status
 *
 * Read-only. Reports whether the database needs a schema update. Never executes
 * DDL, so it is safe to call from prefetching, polling, or repeated navigation.
 */
export async function GET() {
  try {
    const supabase = createSupabaseStaticClient();
    const status = await getMigrationStatus(supabase, Boolean(getSupabaseUrl()));

    if (status.state === "not_configured" || status.state === "unreachable") {
      return NextResponse.json({
        state: status.state,
        hasPendingMigrations: false,
        error: status.error,
      });
    }

    if (status.state === "up_to_date") {
      return NextResponse.json({
        state: status.state,
        hasPendingMigrations: false,
        pendingMigrations: [],
      });
    }

    return NextResponse.json({
      state: status.state,
      hasPendingMigrations: true,
      boosterAvailable: status.boosterAvailable,
      pendingMigrations: status.pending.map(({ id, title, description }) => ({
        id,
        title,
        description,
      })),
      sql: status.pending.map((m) => m.sql).join("\n\n"),
      sqlEditorUrl: getSupabaseSqlEditorUrl(getSupabaseUrl()),
    });
  } catch (error: any) {
    console.warn("Schema status check warning:", error.message);
    return NextResponse.json(
      { state: "unreachable", hasPendingMigrations: false, error: error.message },
      { status: 200 }
    );
  }
}

/**
 * POST /api/system/schema-status
 *
 * Applies pending migrations when the booster RPC is available, then re-reads
 * the database to report the true remaining state.
 */
export async function POST() {
  try {
    const supabase = createSupabaseStaticClient();
    const status = await getMigrationStatus(supabase, Boolean(getSupabaseUrl()));

    if (status.state === "not_configured" || status.state === "unreachable") {
      return NextResponse.json(
        { verified: false, state: status.state, error: status.error },
        { status: 200 }
      );
    }

    if (status.state === "up_to_date") {
      return NextResponse.json({ verified: true, state: status.state, remainingCount: 0 });
    }

    const result = await tryAutoApplyMigrations(supabase, status.pending);
    const after = await getMigrationStatus(supabase, true);

    return NextResponse.json({
      verified: after.state === "up_to_date",
      state: after.state,
      appliedCount: result.appliedCount,
      remainingCount: after.pending.length,
      boosterAvailable: after.boosterAvailable,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json(
      { verified: false, error: error.message },
      { status: 500 }
    );
  }
}
