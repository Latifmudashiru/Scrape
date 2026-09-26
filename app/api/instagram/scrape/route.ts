import { NextRequest, NextResponse } from "next/server";
import { scrapeInstagramLeads } from "@/lib/instagram";

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 30 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    const results = await scrapeInstagramLeads(query, maxResults);

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
    console.error("Instagram Scrape Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scrape Instagram" },
      { status: 500 }
    );
  }
}
