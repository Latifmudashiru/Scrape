import { NextRequest, NextResponse } from "next/server";
import { scrapeWhopMarketplace } from "@/lib/whop";

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 50 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const results = await scrapeWhopMarketplace(query, maxResults);

    return NextResponse.json({ results, query });
  } catch (error: unknown) {
    console.error("Whop scrape error:", error);
    const message = error instanceof Error ? error.message : "Scraping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
