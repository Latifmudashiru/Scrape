import { NextRequest, NextResponse } from "next/server";
import { filterAndSaveNewLeads } from "@/lib/db";
import { NormalizedLead } from "@/lib/csv";

export async function POST(request: NextRequest) {
  try {
    const { leads } = await request.json();

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: "Leads array is required" },
        { status: 400 }
      );
    }

    const platforms = ["YouTube", "Whop", "Skool", "Instagram"] as const;
    const finalFreshLeads: NormalizedLead[] = [];

    // Filter and limit to 25 fresh results per platform
    for (const platform of platforms) {
      const platformLeads = leads.filter((l) => l.platform === platform);
      const freshLeads = await filterAndSaveNewLeads(platformLeads, 25);
      finalFreshLeads.push(...freshLeads);
    }

    return NextResponse.json({
      success: true,
      data: finalFreshLeads,
      metadata: {
        totalFresh: finalFreshLeads.length,
        breakdown: {
          youtube: finalFreshLeads.filter((l) => l.platform === "YouTube").length,
          whop: finalFreshLeads.filter((l) => l.platform === "Whop").length,
          skool: finalFreshLeads.filter((l) => l.platform === "Skool").length,
          instagram: finalFreshLeads.filter((l) => l.platform === "Instagram").length,
        },
      },
    });

  } catch (error: any) {
    console.error("Leads Filter Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to filter leads" },
      { status: 500 }
    );
  }
}
