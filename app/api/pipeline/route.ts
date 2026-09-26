import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { updateLeadPipelineStatus, updateLeadEmailStatus } from "@/lib/outreach";

export async function POST(request: NextRequest) {
  try {
    const { leadId, status, emailDetails } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: "Missing leadId" },
        { status: 400 }
      );
    }

    // 1. Update pipeline stage status if provided
    if (status) {
      if (!["booked_call", "email_followup", "text_followup", "none", "Closed / Won"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      updateLeadPipelineStatus(leadId, status);
    }

    // 2. Update email/reminder properties if provided
    if (emailDetails) {
      updateLeadEmailStatus(leadId, emailDetails);
    }

    // 3. Fetch lead details from Supabase to send to n8n webhook
    let leadData = null;
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      
      if (!error && data) {
        leadData = data;
      }
    } catch (dbErr) {
      console.warn("Could not fetch lead from Supabase, sending webhook with basic info:", dbErr);
    }

    // 4. Trigger n8n webhook if N8N_WEBHOOK_URL is set and an event is triggered
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    let webhookTriggered = false;

    // Define webhook trigger conditions
    const hasStatusTrigger = status && (status === "booked_call" || status === "email_followup");
    const hasEmailTrigger = emailDetails && (
      emailDetails.email_status === "sent" || 
      emailDetails.email_status === "scheduled" ||
      emailDetails.booked_reminder_status === "sent" ||
      emailDetails.booked_reminder_status === "scheduled" ||
      emailDetails.booked_call_time
    );

    if (webhookUrl && (hasStatusTrigger || hasEmailTrigger)) {
      try {
        let event = `pipeline_${status || "update"}`;
        let reminders = null;

        if (emailDetails) {
          if (emailDetails.email_status === "sent") event = "email_sent";
          else if (emailDetails.email_status === "scheduled") event = "email_scheduled";
          else if (emailDetails.booked_reminder_status === "sent") event = "reminder_sent";
          else if (emailDetails.booked_reminder_status === "scheduled") event = "reminder_scheduled";
          
          if (emailDetails.booked_call_time) {
            event = "call_scheduled";
            const callDate = new Date(emailDetails.booked_call_time);
            
            // 9:00 AM of the day of the call
            const date9AM = new Date(callDate);
            date9AM.setHours(9, 0, 0, 0);
            
            // 1 hour before the call
            const date1H = new Date(callDate.getTime() - 60 * 60 * 1000);
            
            // 30 minutes before the call
            const date30M = new Date(callDate.getTime() - 30 * 60 * 1000);
            
            reminders = [
              { label: "9am_day_of_call", time: date9AM.toISOString() },
              { label: "1h_before_call", time: date1H.toISOString() },
              { label: "30m_before_call", time: date30M.toISOString() }
            ];
          }
        }

        const payload: any = {
          event,
          timestamp: new Date().toISOString(),
          leadId,
          status: status || null,
          emailDetails: emailDetails || null,
          lead: leadData ? {
            name: leadData.name,
            emails: leadData.emails,
            platform: leadData.platform,
            link: leadData.link,
            description: leadData.description,
            price: leadData.price,
            audience_size: leadData.audience_size,
            socials: leadData.socials
          } : { id: leadId }
        };

        if (reminders) {
          payload.reminders = reminders;
        }

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          webhookTriggered = true;
        } else {
          console.error(`n8n webhook returned status: ${res.status}`);
        }
      } catch (webhookErr) {
        console.error("Error triggering n8n webhook:", webhookErr);
      }
    }

    return NextResponse.json({
      success: true,
      status: status || null,
      emailDetails: emailDetails || null,
      webhookTriggered,
      webhookConfigured: !!webhookUrl
    });

  } catch (error: any) {
    console.error("Pipeline Transition API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
