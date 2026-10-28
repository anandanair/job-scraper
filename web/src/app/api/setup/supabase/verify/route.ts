import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabaseUrl = body?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = body?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase URL and Service Role Key are required to verify database schema." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const checkTable = async (tableName: string) => {
      const { error } = await supabase.from(tableName).select("*").limit(1);
      return !error || error.code === "PGRST116"; // PGRST116 = zero rows found, but table exists
    };

    const [hasJobs, hasAppSettings, hasBaseResume, hasStyles] = await Promise.all([
      checkTable("jobs"),
      checkTable("app_settings"),
      checkTable("base_resume"),
      checkTable("resume_style_settings"),
    ]);

    const allTablesExist = hasJobs && hasAppSettings && hasBaseResume && hasStyles;

    return NextResponse.json({
      allTablesExist,
      tables: {
        jobs: hasJobs,
        app_settings: hasAppSettings,
        base_resume: hasBaseResume,
        resume_style_settings: hasStyles,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to verify database tables." },
      { status: 500 }
    );
  }
}
