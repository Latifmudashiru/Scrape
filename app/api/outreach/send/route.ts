import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateOutreachMessage } from "@/lib/llm";
import { sendInstagramDM, updateLeadOutreachStatus, getBrowser } from "@/lib/outreach";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { leadIds, niche, customPrompt, geminiApiKey } = await request.json();

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return new Response(JSON.stringify({ error: "leadIds array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const envGeminiKey = process.env.GEMINI_API_KEY;

  if (!openaiKey && !envGeminiKey && !geminiApiKey) {
    return new Response(JSON.stringify({ error: "An LLM API Key is required. Please set OPENAI_API_KEY in your .env.local file or enter a Gemini API Key." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendUpdate({ status: "info", message: `Found ${leadIds.length} leads selected. Launching browser...` });

        // Ensure browser is running and check login
        const browser = await getBrowser(false);
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        sendUpdate({ status: "info", message: "Checking Instagram login session..." });
        await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        const bodyText = await page.evaluate(() => document.body.innerText);
        const isLoggedIn = !(
          bodyText.includes("Phone number, username, or email") || 
          bodyText.includes("Log in with Facebook") || 
          page.url().includes("/accounts/login/")
        );

        if (!isLoggedIn) {
          sendUpdate({ 
            status: "error", 
            message: "Not logged in! Please click 'Open Instagram Login' in NicheScope first and log in manually." 
          });
          controller.close();
          return;
        }

        await page.close(); // Close login check page to keep clean
        sendUpdate({ status: "info", message: "Session verified! Starting campaign..." });

        for (let i = 0; i < leadIds.length; i++) {
          const leadId = leadIds[i];
          sendUpdate({ status: "info", message: `[${i + 1}/${leadIds.length}] Processing lead...` });

          // 1. Fetch Lead details
          const { data: lead, error: dbError } = await supabase
            .from("leads")
            .select("*")
            .eq("id", leadId)
            .single();

          if (dbError || !lead) {
            sendUpdate({ status: "warning", message: `Could not fetch details for lead ID ${leadId}` });
            continue;
          }

          // Extract username
          let igUsername = null;
          if (lead.platform === "Instagram" && lead.link) {
            const parts = lead.link.split("/").filter(Boolean);
            const lastPart = parts[parts.length - 1];
            if (lastPart && !lastPart.includes("instagram.com")) {
              igUsername = lastPart.split("?")[0];
            }
          }
          if (!igUsername && lead.socials) {
            const socialsList = lead.socials.split("|").map((s: string) => s.trim());
            for (const social of socialsList) {
              if (social.includes("instagram.com/")) {
                const parts = social.split("/").filter(Boolean);
                const lastPart = parts[parts.length - 1];
                if (lastPart && !lastPart.includes("instagram.com")) {
                  igUsername = lastPart.split("?")[0];
                  break;
                }
              }
            }
          }

          if (!igUsername) {
            sendUpdate({ status: "warning", message: `Skipping '${lead.name}' (No Instagram username found)` });
            await updateLeadOutreachStatus(leadId, false, undefined, "No Instagram username found");
            continue;
          }

          // Normalize lead shape for LLM
          const normalizedLead = {
            platform: lead.platform,
            name: lead.name,
            link: lead.link,
            description: lead.description,
            price: lead.price,
            audienceSize: lead.audience_size,
            emails: lead.emails,
            socials: lead.socials
          };

          // 2. Generate personalized message via LLM
          sendUpdate({ status: "info", message: `Generating personalized message for @${igUsername} via AI...` });
          let message = "";
          try {
            message = await generateOutreachMessage(normalizedLead, niche || "Coaching", customPrompt, geminiApiKey);
            sendUpdate({ status: "info", message: `AI Message Generated: "${message.substring(0, 60)}..."` });
          } catch (aiError: any) {
            sendUpdate({ status: "warning", message: `AI message generation failed: ${aiError.message}. Skipping.` });
            await updateLeadOutreachStatus(leadId, false, undefined, `AI generation failed: ${aiError.message}`);
            continue;
          }

          // 3. Send via Puppeteer
          sendUpdate({ status: "sending", username: igUsername, message: `Navigating and sending DM to @${igUsername}...` });
          try {
            await sendInstagramDM(igUsername, message);
            sendUpdate({ status: "success", leadId, username: igUsername, message: `Message successfully sent to @${igUsername}!` });
            
            // Mark as messaged
            await updateLeadOutreachStatus(leadId, true, message);
          } catch (dmError: any) {
            sendUpdate({ status: "failed", leadId, username: igUsername, message: `Failed to message @${igUsername}: ${dmError.message}` });
            await updateLeadOutreachStatus(leadId, false, undefined, dmError.message);
          }

          // 4. Random Delay to prevent spam blocks (except for the last item)
          if (i < leadIds.length - 1) {
            const delaySeconds = Math.floor(Math.random() * 30) + 30; // 30 - 60 seconds
            sendUpdate({ status: "delay", message: `Anti-detection delay: waiting ${delaySeconds} seconds before next DM...` });
            
            for (let d = delaySeconds; d > 0; d--) {
              // Sleep 1 second
              await new Promise(r => setTimeout(r, 1000));
              if (d % 10 === 0 || d <= 5) {
                sendUpdate({ status: "delay-countdown", remaining: d });
              }
            }
          }
        }

        sendUpdate({ status: "complete", message: "Campaign execution complete! All selected leads processed." });
      } catch (err: any) {
        console.error("Runner Error:", err);
        sendUpdate({ status: "error", message: `Outreach campaign aborted: ${err.message}` });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
