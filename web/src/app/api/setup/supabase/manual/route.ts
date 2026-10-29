import { NextResponse } from "next/server";
import { writeEnvFiles } from "@/lib/setup/envWriter";
import { createClient } from "@supabase/supabase-js";
import { saveSetupStep } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabaseUrl = body?.supabaseUrl?.trim();
    const serviceRoleKey = body?.serviceRoleKey?.trim();
    const anonKey = body?.anonKey?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase Project URL and Service Role Key are required." },
        { status: 400 }
      );
    }

    // 1. Verify connection with Supabase client
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: testErr } = await supabaseClient
      .from("jobs")
      .select("count", { count: "exact", head: true });

    // Note: If 'jobs' table doesn't exist yet, it will return PGRST205 or similar,
    // which confirms the credentials are valid even if schema hasn't run yet.
    if (testErr && testErr.code === "PGRST301") {
      return NextResponse.json(
        { error: "Invalid API credentials. Please check your Project URL and Secret key." },
        { status: 401 }
      );
    }

    // 2. Ensure Storage Buckets exist
    try {
      const { data: buckets } = await supabaseClient.storage.listBuckets();
      const existingBucketNames = (buckets || []).map((b) => b.name);

      if (!existingBucketNames.includes("resumes")) {
        await supabaseClient.storage.createBucket("resumes", { public: false });
      }
      if (!existingBucketNames.includes("personalized_resumes")) {
        await supabaseClient.storage.createBucket("personalized_resumes", { public: false });
      }
    } catch (bucketErr: any) {
      console.warn("Notice ensuring storage buckets:", bucketErr.message);
    }

    // 3. Write files & set environment variables
    writeEnvFiles({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
    });

    // 4. Verify all core database tables exist
    const checkTable = async (tableName: string) => {
      const { error } = await supabaseClient.from(tableName).select("*").limit(1);
      return !error || error.code === "PGRST116";
    };

    const [hasJobs, hasAppSettings, hasBaseResume, hasStyles] = await Promise.all([
      checkTable("jobs"),
      checkTable("app_settings"),
      checkTable("base_resume"),
      checkTable("resume_style_settings"),
    ]);

    const missingTables = Object.entries({
      jobs: hasJobs,
      app_settings: hasAppSettings,
      base_resume: hasBaseResume,
      resume_style_settings: hasStyles,
    })
      .filter(([_, exists]) => !exists)
      .map(([name]) => name);

    const allTablesExist = missingTables.length === 0;

    if (allTablesExist) {
      await saveSetupStep(2);
    }

    return NextResponse.json({
      success: true,
      supabaseUrl,
      missingTables,
      allTablesExist,
      message: allTablesExist
        ? "Connected and credentials saved successfully."
        : "Connected, but some database tables are missing. Please run the setup SQL schema.",
    });
  } catch (error: any) {
    console.error("Error in /api/setup/supabase/manual:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect to Supabase." },
      { status: 500 }
    );
  }
}
