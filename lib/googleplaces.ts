import { GoogleMapsLead } from "./googlemaps";

/**
 * Scrapes local business leads using the Google Places API (Text Search + Place Details).
 * Provides a high-speed, captcha-free alternative to Puppeteer.
 */
export async function scrapeGooglePlaces(
  query: string,
  location: string,
  maxResults: number = 30,
  sendUpdate: (status: string, message: string) => void = () => {},
  existingLinks: string[] = []
): Promise<GoogleMapsLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY in .env.local file");
  }

  sendUpdate("info", `Initiating Google Places API search for "${query}" in "${location}"...`);

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " " + location)}&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) {
      throw new Error(`Google Places API returned status ${res.status}`);
    }

    const searchData = await res.json();
    if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API Search error: ${searchData.error_message || searchData.status}`);
    }

    const results = searchData.results || [];
    sendUpdate("info", `Found ${results.length} total raw listings from Google Places API.`);

    const leads: GoogleMapsLead[] = [];

    for (let i = 0; i < results.length; i++) {
      if (leads.length >= maxResults) break;

      const place = results[i];
      const placeId = place.place_id;
      const placeName = place.name;
      const reviewsCount = place.user_ratings_total || 0;
      const rating = place.rating || 0;

      // Construct a unified link using the place ID to identify the Google Maps place
      const placeUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

      // 1. Check if already scraped
      if (existingLinks.includes(placeUrl)) {
        continue;
      }

      // 2. Filter chains/franchises
      if (isChainOrFranchise(placeName)) {
        sendUpdate("warning", `Skipped: "${placeName}" (Filtered: Chain/franchise business)`);
        continue;
      }

      // 3. Filter review count (< 500)
      if (reviewsCount > 500) {
        sendUpdate("warning", `Skipped: "${placeName}" (Filtered: too many reviews - ${reviewsCount})`);
        continue;
      }

      sendUpdate("info", `[${i + 1}/${results.length}] Fetching Details for: "${placeName}"...`);

      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,vicinity,types&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        if (!detailsRes.ok) continue;

        const detailsData = await detailsRes.json();
        if (detailsData.status !== "OK") continue;

        const details = detailsData.result || {};
        const phone = details.formatted_phone_number || "";
        const website = details.website || "";
        const address = details.vicinity || place.formatted_address || "";
        
        // Capitalize category name nicely
        let category = "Dessert Shop";
        if (details.types && details.types.length > 0) {
          category = details.types[0].replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }

        if (phone) {
          leads.push({
            name: placeName,
            link: placeUrl,
            rating: String(rating),
            reviewsCount: String(reviewsCount),
            address: address,
            phone: phone,
            website: website,
            category: category
          });
          sendUpdate("success", `Found Phone for: "${placeName}" (${phone})`);
        } else {
          sendUpdate("warning", `Skipped: "${placeName}" (No phone number)`);
        }
      } catch (err: any) {
        console.error(`Error fetching details for place ${placeName} (${placeId}):`, err.message);
      }

      // Small throttling delay to stay safe on Google Cloud API limits
      await new Promise(r => setTimeout(r, 100));
    }

    return leads;
  } catch (error: any) {
    sendUpdate("error", `Places API scrape aborted: ${error.message}`);
    throw error;
  }
}

function isChainOrFranchise(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  const blacklist = [
    "kaspa",
    "cream's",
    "creams",
    "heavenly dessert",
    "little dessert shop",
    "sprinkles gelato",
    "icestone gelato",
    "krispy kreme",
    "shakeaway",
    "lola's cupcakes",
    "lolas cupcakes",
    "haagen-dazs",
    "haagen dazs",
    "häagen-dazs",
    "cinnabon",
    "thorntons",
    "hotel chocolat",
    "mycookiedough",
    "my cookie dough",
    "gelato passion",
    "mcdonald",
    "burger king",
    "starbucks",
    "costa coffee",
    "costa express",
    "nando's",
    "nandos",
    "subway"
  ];
  
  return blacklist.some(chain => {
    const regex = new RegExp(`\\b${chain}\\b`, 'i');
    return regex.test(normalized) || normalized.includes(chain);
  });
}
