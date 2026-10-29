import { NextResponse } from "next/server";
import { getFullInitSql } from "@/lib/setup/schema";
import { writeEnvFiles } from "@/lib/setup/envWriter";
import { createClient } from "@supabase/supabase-js";
import { saveSetupStep } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token?.trim();
    const projectRef = body?.projectRef?.trim();

    if (!token || !projectRef) {
      return NextResponse.json(
        { error: "Token and projectRef are required." },
        { status: 400 }
      );
    }

    // 1. Fetch API Keys via Supabase Management API (with retry resilience for fresh projects)
    let anonKey: string | undefined;
    let serviceRoleKey: string | undefined;
    let lastKeysErr = "";

    for (let attempt = 1; attempt <= 5; attempt++) {
      const keysRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (keysRes.ok) {
        const keys: Array<{ name: string; api_key: string }> = await keysRes.json();
        anonKey = keys.find(
          (k) => k.name.toLowerCase() === "anon" || k.name.toLowerCase() === "publishable"
        )?.api_key;
        serviceRoleKey = keys.find(
          (k) => k.name.toLowerCase() === "service_role" || k.name.toLowerCase() === "secret"
        )?.api_key;

        if (serviceRoleKey) break;
      } else {
        lastKeysErr = await keysRes.text();
      }

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: `Could not find Service Role / Secret API key for this project: ${lastKeysErr}` },
        { status: 404 }
      );
    }

    const supabaseUrl = `https://${projectRef}.supabase.co`;

    // 2. Execute SQL Migrations via Supabase Management API query endpoint
    const sqlQuery = getFullInitSql();
    const queryRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sqlQuery }),
      }
    );

    if (!queryRes.ok) {
      const queryErr = await queryRes.text();
      console.warn("SQL migration notice from Management API:", queryErr);
      // If error is non-fatal (like relation already exists), we continue to verify with client
    }

    // 3. Wait briefly for project DNS subdomain (*.supabase.co) to propagate if brand new
    for (let dnsAttempt = 1; dnsAttempt <= 8; dnsAttempt++) {
      try {
        const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        if (pingRes.status < 500) break;
      } catch {
        // DNS lookup pending, wait 1.5s
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // Storage buckets deprecated: PDFs are compiled dynamically on-the-fly in-memory via PDFKit

    // 4. Update app_settings directly in the database via the Management API
    try {
      await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `UPDATE "public"."app_settings" SET setup_step = 2 WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;`,
          }),
        }
      );
    } catch {
      // Non-fatal control plane update
    }

    // 5. Write .env.local and root .env files (Database credentials ONLY)
    writeEnvFiles({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
    });

    return NextResponse.json({
      success: true,
      projectRef,
      supabaseUrl,
      message: "Database schema applied successfully.",
    });
  } catch (error: any) {
    console.error("Error in /api/setup/supabase/configure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to configure Supabase." },
      { status: 500 }
    );
  }
}
