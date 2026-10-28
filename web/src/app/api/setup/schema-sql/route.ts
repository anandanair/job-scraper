import { NextResponse } from "next/server";
import { getFullInitSql } from "@/lib/setup/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getFullInitSql();
    return NextResponse.json({ sql });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load schema SQL." },
      { status: 500 }
    );
  }
}
