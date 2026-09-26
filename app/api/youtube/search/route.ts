import { NextRequest, NextResponse } from "next/server";
import { searchChannels, searchVideos } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const { query, type = "channel", maxResults = 10 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    let results;
    if (type === "channel") {
      results = await searchChannels(query, maxResults);
    } else {
      results = await searchVideos(query, maxResults);
    }

    return NextResponse.json({ results, type, query });
  } catch (error: unknown) {
    console.error("YouTube search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
