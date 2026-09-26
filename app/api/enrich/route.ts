import { NextRequest, NextResponse } from "next/server";
import { enrichUrls, extractContactInfo } from "@/lib/enrich";

export async function POST(request: NextRequest) {
  try {
    const { items, platform } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Items array is required" }, { status: 400 });
    }

    if (platform === "youtube") {
      // For YouTube, we already have descriptions in the item payload, so we just run the regex
      // We don't need to fetch channel URLs because we already have snippet descriptions.
      const enriched = items.map((item: any) => {
        const contactInfo = extractContactInfo(item.description || "");
        return { ...item, contactInfo };
      });
      return NextResponse.json({ success: true, data: enriched });
    } 
    
    if (platform === "whop" || platform === "skool") {
      // For Whop and Skool, we need to fetch the URLs to get the raw HTML
      const urls = items.map((i: any) => i.url).filter(Boolean);
      const urlContacts = await enrichUrls(urls);
      
      const enriched = items.map((item: any) => ({
        ...item,
        contactInfo: urlContacts[item.url] || { emails: [], socials: [], websites: [] }
      }));
      
      return NextResponse.json({ success: true, data: enriched });
    }

    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });

  } catch (error: any) {
    console.error("Enrichment Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enrich data" },
      { status: 500 }
    );
  }
}
