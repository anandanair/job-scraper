import { NextResponse } from "next/server";

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

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Could not check project status: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      id: data.id,
      name: data.name,
      status: data.status, // e.g. "COMING_UP", "ACTIVE_HEALTHY"
      region: data.region,
    });
  } catch (error: any) {
    console.error("Error in project-status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check project status." },
      { status: 500 }
    );
  }
}
