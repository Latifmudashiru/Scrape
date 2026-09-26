import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { saveLocalOutreachLog, getLocalOutreachLogs } from "@/lib/outreach";

export const dynamic = "force-dynamic";

// GET: Fetch all GoogleMaps leads
export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("platform", "GoogleMaps")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: leads || []
    });

  } catch (error: any) {
    console.error("GMT Fetch Leads Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch GMT leads" },
      { status: 500 }
    );
  }
}

// POST: Update CRM tracking data for a lead
// Stores a JSON blob in the `emails` column with all CRM fields:
// { called, caller, response, dateOutreached, notes }
// Stores call status in `price` column for quick filtering.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "add_manual") {
      const { name, phone, director, website, address, category, notes, scrapedBy } = body;
      if (!name) {
        return NextResponse.json({ error: "Business name is required" }, { status: 400 });
      }

      const uniqueLink = `https://manual-lead.com/${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const socialsStr = `Phone: ${phone || "N/A"} | Website: ${website || "N/A"}`;
      const descStr = `Category: ${category || "Manual"} | Address: ${address || "N/A"} | Rating: N/A`;
      
      const crmData = {
        called: false,
        caller: "",
        response: "",
        dateOutreached: "",
        notes: notes || "",
        directors: director ? [director] : [],
        companyUrl: website || "",
        callbackTime: ""
      };

      const { data, error } = await supabase
        .from("leads")
        .insert({
          name,
          link: uniqueLink,
          description: descStr,
          socials: socialsStr,
          emails: JSON.stringify(crmData),
          platform: "GoogleMaps",
          price: "Pending",
          audience_size: "0",
          is_pushed: true,
          scraped_by: scrapedBy || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: "Successfully created manual lead",
        data
      });
    }

    if (body.action === "insert") {
      const { leads } = body;
      const leadsArray = Array.isArray(leads) ? leads : [leads];
      
      const { data, error } = await supabase
        .from("leads")
        .upsert(leadsArray, { onConflict: "link", ignoreDuplicates: true })
        .select();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully inserted ${leadsArray.length} leads`,
        data
      });
    }

    if (body.action === "push") {
      const { leadLinks } = body;
      const linksArray = Array.isArray(leadLinks) ? leadLinks : [leadLinks];

      const { data, error } = await supabase
        .from("leads")
        .update({ is_pushed: true })
        .in("link", linksArray)
        .select();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully pushed ${linksArray.length} leads to Lead List`,
        data
      });
    }

    const { leadId, status, crmData } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    // crmData is a JSON object: { called, caller, response, dateOutreached, notes }
    const jsonBlob = JSON.stringify(crmData || {});

    let pipelineStatus = "none";
    if (status === "Email Follow Up") {
      pipelineStatus = "email_followup";
    } else if (status === "Text Follow Up") {
      pipelineStatus = "text_followup";
    } else if (status === "Meeting Scheduled") {
      pipelineStatus = "booked_call";
    }

    // Save locally
    const logs = getLocalOutreachLogs();
    const currentLog = logs[leadId] || { is_messaged: false };
    saveLocalOutreachLog(leadId, {
      ...currentLog,
      pipeline_status: pipelineStatus
    } as any);

    let { error } = await supabase
      .from("leads")
      .update({
        price: status || "Pending",
        emails: jsonBlob,
        pipeline_status: pipelineStatus
      })
      .eq("id", leadId);

    // Fallback if the pipeline_status column does not exist in the database yet
    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      console.warn("Retrying lead update without pipeline_status:", error.message);
      const { error: retryError } = await supabase
        .from("leads")
        .update({
          price: status || "Pending",
          emails: jsonBlob
        })
        .eq("id", leadId);
      error = retryError;
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Lead CRM data updated successfully"
    });

  } catch (error: any) {
    console.error("GMT Update Lead CRM Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lead CRM data" },
      { status: 500 }
    );
  }
}
