import { NextRequest, NextResponse } from "next/server";
import { scrapeSkoolDiscover } from "@/lib/skool";

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 50 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    const results = await scrapeSkoolDiscover(query, maxResults);

    return NextResponse.json({
      success: true,
      data: results,
      metadata: {
        totalFound: results.length,
        query,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("Skool Scrape Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scrape Skool" },
      { status: 500 }
    );
  }
}
