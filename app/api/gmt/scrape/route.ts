import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeGoogleMaps } from "@/lib/googlemaps";
import { scrapeGooglePlaces } from "@/lib/googleplaces";
import { getCompanyDirectors } from "@/lib/companieshouse";

export const dynamic = "force-dynamic";

async function expandLocation(location: string): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return [location];
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a geography helper. Return a JSON array of 5 specific sub-areas, neighborhoods, or adjacent towns/boroughs for the given location to search for local businesses. Provide ONLY the JSON array of strings, e.g. [\"Area 1\", \"Area 2\"]. Do not include markdown code block formatting or anything other than the JSON array."
          },
          {
            role: "user",
            content: `Location: "${location}"`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim() || "";
      const cleanContent = content.replace(/```json|```/g, "").trim();
      const areas = JSON.parse(cleanContent);
      if (Array.isArray(areas) && areas.length > 0) {
        return [location, ...areas.map(a => String(a))];
      }
    }
  } catch (err) {
    console.error("Error expanding location via OpenAI:", err);
  }

  return [location];
}

export async function POST(request: NextRequest) {
  const { query, location, maxResults = 20, scrapedBy } = await request.json();

  if (!query || !location) {
    return new Response(JSON.stringify({ error: "query and location are required parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (status: string, message: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status, message })}\n\n`));
      };

      try {
        sendUpdate("info", `Starting scrape for "${query}" in "${location}"...`);

        // Fetch existing GoogleMaps links from database to prevent duplicate navigation/scraping
        sendUpdate("info", "Checking database for already scraped leads...");
        const { data: existingLeads, error: fetchError } = await supabase
          .from("leads")
          .select("link")
          .eq("platform", "GoogleMaps");

        if (fetchError) {
          console.error("Database fetch error:", fetchError);
        }
        const existingLinks = (existingLeads || []).map(l => l.link);

        // Expand locations to span out the search if we don't find enough leads in one place
        sendUpdate("info", `Generating nearby locations to span out search if needed...`);
        const locationQueue = await expandLocation(location);
        sendUpdate("info", `Location search queue: ${locationQueue.join(", ")}`);

        let allAccumulatedLeads: any[] = [];
        const scrapedLinks = new Set<string>();
        let queueIndex = 0;

        while (allAccumulatedLeads.length < maxResults && queueIndex < locationQueue.length) {
          const currentLoc = locationQueue[queueIndex];
          const remainingCount = maxResults - allAccumulatedLeads.length;

          sendUpdate("info", `[Queue ${queueIndex + 1}/${locationQueue.length}] Scraping in "${currentLoc}" (target remaining: ${remainingCount})...`);

          let currentLocLeads = [];
          try {
            const hasPlacesKey = !!process.env.GOOGLE_PLACES_API_KEY;
            if (hasPlacesKey) {
              currentLocLeads = await scrapeGooglePlaces(
                query,
                currentLoc,
                Math.min(remainingCount + 10, 40),
                sendUpdate,
                [...existingLinks, ...Array.from(scrapedLinks)]
              );
            } else {
              currentLocLeads = await scrapeGoogleMaps(
                query,
                currentLoc,
                Math.min(remainingCount + 10, 40), // Pull slightly more to account for filters
                sendUpdate,
                [...existingLinks, ...Array.from(scrapedLinks)]
              );
            }
          } catch (scrapeErr: any) {
            sendUpdate("warning", `Warning: Scraping for location "${currentLoc}" failed or timed out: ${scrapeErr.message || scrapeErr}. Preserving current leads and moving to next location.`);
            queueIndex++;
            if (allAccumulatedLeads.length < maxResults && queueIndex < locationQueue.length) {
              await new Promise(r => setTimeout(r, 4000));
            }
            continue;
          }

          for (const lead of currentLocLeads) {
            if (!scrapedLinks.has(lead.link) && allAccumulatedLeads.length < maxResults) {
              scrapedLinks.add(lead.link);
              allAccumulatedLeads.push(lead);
            }
          }

          sendUpdate("info", `Completed "${currentLoc}". Currently collected ${allAccumulatedLeads.length}/${maxResults} valid leads.`);
          queueIndex++;

          if (allAccumulatedLeads.length < maxResults && queueIndex < locationQueue.length) {
            sendUpdate("info", `Target of ${maxResults} leads not met yet. Spanning out to next location: "${locationQueue[queueIndex]}"...`);
            await new Promise(r => setTimeout(r, 4000)); // Delay between locations to be gentle
          }
        }

        if (allAccumulatedLeads.length === 0) {
          sendUpdate("info", "No leads were found with phone numbers.");
          sendUpdate("complete", "Scrape completed. 0 new leads saved.");
          controller.close();
          return;
        }

        sendUpdate("info", `Checking ${allAccumulatedLeads.length} leads against database duplicates...`);

        // Check duplicates and save
        const links = allAccumulatedLeads.map(l => l.link);
        const dbExistingLinksSet = new Set<string>();

        // Query Supabase for existing links in batches of 50
        const chunkSize = 50;
        for (let i = 0; i < links.length; i += chunkSize) {
          const chunk = links.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("leads")
            .select("link")
            .in("link", chunk);

          if (error) {
            console.error("Database check error:", error);
            throw error;
          }

          if (data) {
            data.forEach(row => dbExistingLinksSet.add(row.link));
          }
        }

        const freshLeads = allAccumulatedLeads.filter(l => !dbExistingLinksSet.has(l.link));
        sendUpdate("info", `Filtered out ${allAccumulatedLeads.length - freshLeads.length} duplicates. ${freshLeads.length} brand-new leads to save.`);

        if (freshLeads.length > 0) {
          sendUpdate("info", `Enriching ${freshLeads.length} leads with Companies House Director details...`);
          
          // Map to database columns and fetch Director names in parallel
          const dbLeads = await Promise.all(freshLeads.map(async (l) => {
            const { directors, companyUrl } = await getCompanyDirectors(l.name, l.address);
            const directorsStr = directors.length > 0 ? directors.join(", ") : "Not Found";
            
            // Put Director names in the default JSON CRM blob
            const initialCRM = {
              called: false,
              caller: "",
              response: "",
              dateOutreached: "",
              notes: "",
              directors: directors, // Save array of directors
              companyUrl: companyUrl // Save companyUrl
            };

            return {
              platform: "GoogleMaps",
              name: l.name,
              link: l.link,
              description: `Category: ${l.category || "Cleaning Company"} | Address: ${l.address || "N/A"} | Rating: ${l.rating || "N/A"} (${l.reviewsCount || "0"} reviews) | Director: ${directorsStr}`,
              price: "Pending", // Default Call Status
              audience_size: l.reviewsCount || "0", // Store reviews count here for sorting
              emails: JSON.stringify(initialCRM), // Store CRM JSON with directors
              socials: `Phone: ${l.phone || ""} | Website: ${l.website || "N/A"}`,
              is_pushed: false,
              scraped_by: scrapedBy || null
            };
          }));

          const { error: insertError } = await supabase
            .from("leads")
            .upsert(dbLeads, { onConflict: "link", ignoreDuplicates: true });

          if (insertError) {
            console.error("Database save error:", insertError);
            throw insertError;
          }

          sendUpdate("success", `Scraped and saved ${freshLeads.length} new leads! You can now review and push them to your official Lead List.`);
          
          sendUpdate("complete", JSON.stringify({
            message: `Scrape complete! Found ${freshLeads.length} new leads.`,
            leads: dbLeads
          }));
        } else {
          sendUpdate("info", "All scraped leads were already registered in the database.");
          sendUpdate("complete", JSON.stringify({
            message: "Scrape complete! 0 new leads found.",
            leads: []
          }));
        }
      } catch (err: any) {
        console.error("Scrape API Route Error:", err);
        sendUpdate("error", `Scrape process failed: ${err.message}`);
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
