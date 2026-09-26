import { NextRequest, NextResponse } from "next/server";
import { openInstagramLogin } from "@/lib/outreach";

export async function POST(request: NextRequest) {
  try {
    await openInstagramLogin();
    return NextResponse.json({
      success: true,
      message: "Instagram browser window opened. Please log in if needed."
    });
  } catch (error: any) {
    console.error("Login Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to open Instagram browser" },
      { status: 500 }
    );
  }
}
