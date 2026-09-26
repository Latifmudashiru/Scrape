import { NextRequest, NextResponse } from "next/server";
import { analyzeNiche } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const analysis = await analyzeNiche(query);
    return NextResponse.json(analysis);
  } catch (error: unknown) {
    console.error("Niche analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
