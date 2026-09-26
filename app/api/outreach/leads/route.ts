import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLocalOutreachLogs } from "@/lib/outreach";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch all leads from Supabase
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // 2. Fetch local logs
    const localLogs = getLocalOutreachLogs();

    // Helper to extract Instagram username from url or socials list
    const getInstagramUsername = (lead: any): string | null => {
      if (lead.platform === "Instagram" && lead.link) {
        // e.g., https://instagram.com/username
        const parts = lead.link.split("/").filter(Boolean);
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.includes("instagram.com")) {
          return lastPart.split("?")[0];
        }
      }
      
      // Look in socials (format is "URL1 | URL2")
      if (lead.socials) {
        const socialsList = lead.socials.split("|").map((s: string) => s.trim());
        for (const social of socialsList) {
          if (social.includes("instagram.com/")) {
            const parts = social.split("/").filter(Boolean);
            const lastPart = parts[parts.length - 1];
            if (lastPart && !lastPart.includes("instagram.com")) {
              return lastPart.split("?")[0];
            }
          }
        }
      }
      
      return null;
    };

    // 3. Merge leads with local logs and extract IG username
    const enrichedLeads = (leads || []).map((lead: any) => {
      const localLog = (localLogs[lead.id] || {}) as any;
      const igUsername = getInstagramUsername(lead);
      
      // Map price column to pipeline_status if pipeline_status is not set in DB or local log
      let pipelineStatus = lead.pipeline_status || localLog.pipeline_status;
      if (!pipelineStatus) {
        if (lead.price === "Email Follow Up") {
          pipelineStatus = "email_followup";
        } else if (lead.price === "Text Follow Up") {
          pipelineStatus = "text_followup";
        } else if (lead.price === "Meeting Scheduled") {
          pipelineStatus = "booked_call";
        }
      }

      return {
        ...lead,
        igUsername,
        is_messaged: localLog.is_messaged || lead.is_messaged || false,
        messaged_at: localLog.messaged_at || lead.messaged_at || null,
        message_sent: localLog.message_sent || lead.message_sent || null,
        outreach_error: localLog.error || null,
        // Pipeline fields from localLog or database
        pipeline_status: pipelineStatus || null,
        email_template_id: localLog.email_template_id || lead.email_template_id || null,
        email_status: localLog.email_status || lead.email_status || null,
        email_scheduled_at: localLog.email_scheduled_at || lead.email_scheduled_at || null,
        email_sent_at: localLog.email_sent_at || lead.email_sent_at || null,
        booked_reminder_template_id: localLog.booked_reminder_template_id || lead.booked_reminder_template_id || null,
        booked_reminder_status: localLog.booked_reminder_status || lead.booked_reminder_status || null,
        booked_reminder_scheduled_at: localLog.booked_reminder_scheduled_at || lead.booked_reminder_scheduled_at || null,
        booked_call_time: localLog.booked_call_time || lead.booked_call_time || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedLeads
    });

  } catch (error: any) {
    console.error("Leads Fetch Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
