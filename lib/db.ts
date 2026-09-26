import { supabase } from "./supabase";
import { NormalizedLead } from "./csv";

/**
 * Filter a list of leads against the Supabase database to find unseen ones,
 * take the first `limit` unseen leads, persist them to the database, and return them.
 */
export async function filterAndSaveNewLeads(
  leads: NormalizedLead[],
  limit: number = 25
): Promise<NormalizedLead[]> {
  if (leads.length === 0) return [];

  // Extract all links to query the database
  const links = leads.map((l) => l.link);

  // Chunk links to avoid SQL parameter limits in extreme cases
  const existingLinks = new Set<string>();
  const chunkSize = 100;
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
      data.forEach((row) => existingLinks.add(row.link));
    }
  }

  // Filter out any leads that already exist in the database
  const unseenLeads = leads.filter((l) => !existingLinks.has(l.link));

  // Take the first 'limit' unseen leads
  const leadsToSave = unseenLeads.slice(0, limit);

  if (leadsToSave.length === 0) {
    return [];
  }

  // Map to database columns
  const dbLeads = leadsToSave.map((l) => ({
    platform: l.platform,
    name: l.name,
    link: l.link,
    description: l.description,
    price: l.price,
    audience_size: l.audienceSize,
    emails: l.emails,
    socials: l.socials,
  }));

  // Bulk insert the fresh leads, ignoring duplicates if any race conditions occur
  const { error: insertError } = await supabase
    .from("leads")
    .upsert(dbLeads, { onConflict: "link", ignoreDuplicates: true });

  if (insertError) {
    console.error("Database save error:", insertError);
    throw insertError;
  }

  return leadsToSave;
}
