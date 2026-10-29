import { NextResponse } from "next/server";

// Backward compatibility: Redirect/alias any legacy signed-url calls to the on-demand PDF streaming route
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Resume ID is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      signedUrl: `/api/customized_resumes/${id}/pdf`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
