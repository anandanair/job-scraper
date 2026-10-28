import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Personal Access Token is required." },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const [projectsRes, orgsRes] = await Promise.all([
      fetch("https://api.supabase.com/v1/projects", { headers }),
      fetch("https://api.supabase.com/v1/organizations", { headers }),
    ]);

    if (!projectsRes.ok) {
      const errText = await projectsRes.text();
      let message = "Failed to authenticate with Supabase.";
      if (projectsRes.status === 401) {
        message = "Invalid or expired Personal Access Token. Please verify the token from your Supabase account settings.";
      } else if (projectsRes.status === 403) {
        message = "Access token lacks sufficient permissions to read projects.";
      }
      return NextResponse.json({ error: message, details: errText }, { status: projectsRes.status });
    }

    const projects = await projectsRes.json();
    let organizations: Array<{ id: string; name: string }> = [];
    if (orgsRes.ok) {
      try {
        organizations = await orgsRes.json();
      } catch {
        organizations = [];
      }
    }

    return NextResponse.json({ projects, organizations });
  } catch (error: any) {
    console.error("Error in /api/setup/supabase/projects:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error fetching projects." },
      { status: 500 }
    );
  }
}
