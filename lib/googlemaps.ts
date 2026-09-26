import vanillaPuppeteer from "puppeteer";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import path from "path";
import fs from "fs";

const puppeteer = addExtra(vanillaPuppeteer);
try {
  puppeteer.use(StealthPlugin());
} catch (e) {
  // Ignore errors if plugin is already registered
}

export interface GoogleMapsLead {
  name: string;
  link: string;
  rating?: string;
  reviewsCount?: string;
  address?: string;
  phone?: string;
  website?: string;
  category?: string;
}

/**
 * Scrapes Google Maps for local businesses and extracts their details.
 * Focuses on leads with phone numbers.
 */
export async function scrapeGoogleMaps(
  query: string,
  location: string,
  maxResults: number = 30,
  sendUpdate: (status: string, message: string) => void = () => {},
  existingLinks: string[] = []
): Promise<GoogleMapsLead[]> {
  let browser: any = null;
  try {
    sendUpdate("info", "Launching Puppeteer browser...");
    
    // Use user data directory to store profiles if wanted, but launch fresh is fine too
    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === "production" ? true : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query + " " + location)}`;
    sendUpdate("info", `Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 40000 });

    // Handle cookie consent
    sendUpdate("info", "Checking for Google Cookie Consent screens...");
    const consentClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => {
        const text = b.textContent?.trim() || "";
        return /accept all|agree|i agree|accept|tout accepter/i.test(text);
      });
      if (acceptBtn) {
        (acceptBtn as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (consentClicked) {
      sendUpdate("info", "Cookie consent accepted. Waiting for redirects...");
      await new Promise(r => setTimeout(r, 4000));
    }

    sendUpdate("info", "Waiting for search results feed...");
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch (err) {
      // Take screenshot of what went wrong
      const debugDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }
      await page.screenshot({ path: path.join(debugDir, "debug-maps-fail.png") });
      throw new Error("Timeout waiting for Maps place listings. Please ensure Google Maps loaded correctly or solve any captcha in the browser window.");
    }

    sendUpdate("info", "Scrolling sidebar results to load more businesses...");
    const feedSelector = 'div[role="feed"]';
    
    // Scroll loop
    let scrollCount = 0;
    const maxScrolls = 6;
    while (scrollCount < maxScrolls) {
      const currentLength = await page.evaluate(() => document.querySelectorAll('a[href*="/maps/place/"]').length);
      
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) el.scrollBy(0, el.scrollHeight);
      }, feedSelector);
      
      await new Promise(r => setTimeout(r, 2000));
      
      const newLength = await page.evaluate(() => document.querySelectorAll('a[href*="/maps/place/"]').length);
      
      // If we scroll and no new elements are loaded, we might have hit the end of list
      if (newLength === currentLength) {
        // Try scrolling one more time just in case, otherwise break
        scrollCount++;
        if (scrollCount >= 3) break;
      }
      
      scrollCount++;
    }

    sendUpdate("info", "Extracting unique business links...");
    const urls: string[] = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return links.map(link => (link as HTMLAnchorElement).href);
    });

    const uniqueUrls = Array.from(new Set(urls)).slice(0, maxResults);
    
    // Filter out already scraped links to save time and avoid duplicate detailed pages
    const linksToScrape = uniqueUrls.filter(url => !existingLinks.includes(url));
    const skippedCount = uniqueUrls.length - linksToScrape.length;
    sendUpdate("info", `Found ${uniqueUrls.length} unique businesses. Skipped ${skippedCount} already scraped. ${linksToScrape.length} to inspect.`);

    const leads: GoogleMapsLead[] = [];

    // Detailed extraction loop
    for (let i = 0; i < linksToScrape.length; i++) {
      const url = linksToScrape[i];
      sendUpdate("info", `[${i + 1}/${linksToScrape.length}] Navigating to place details...`);
      
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 10000 });

        // Add a small delay for details to render completely
        await new Promise(r => setTimeout(r, 1000));

        const details = await page.evaluate(() => {
          const name = document.querySelector('h1')?.textContent?.trim() || "";
          
          // Find phone (data-item-id^="phone:tel:")
          const phoneEl = document.querySelector('button[data-item-id^="phone:tel:"]');
          let phone = "";
          if (phoneEl) {
            const itemId = phoneEl.getAttribute('data-item-id') || "";
            phone = itemId.replace("phone:tel:", "").trim();
          } else {
            const allButtons = Array.from(document.querySelectorAll('button'));
            const phoneBtn = allButtons.find(b => b.getAttribute('aria-label')?.includes('Phone:'));
            if (phoneBtn) {
              phone = phoneBtn.getAttribute('aria-label')?.replace('Phone:', '').trim() || "";
            }
          }

          // Find website (data-item-id="authority")
          const websiteEl = document.querySelector('a[data-item-id="authority"]');
          let website = "";
          if (websiteEl) {
            website = websiteEl.getAttribute('href') || "";
          } else {
            const webBtn = document.querySelector('button[aria-label*="Website"]');
            if (webBtn) {
              website = webBtn.getAttribute('aria-label')?.replace('Website:', '').trim() || "";
            }
          }

          // Find address (data-item-id^="address")
          const addressEl = document.querySelector('button[data-item-id^="address"]');
          let address = "";
          if (addressEl) {
            address = addressEl.getAttribute('aria-label')?.replace('Address:', '').trim() || "";
          }

          // Find rating and reviews
          const ratingContainer = document.querySelector('div.F7nice');
          let rating = "";
          let reviewsCount = "";
          if (ratingContainer) {
            const text = ratingContainer.textContent || "";
            const match = text.match(/^([\d.]+)\(([\d,]+)\)/);
            if (match) {
              rating = match[1];
              reviewsCount = match[2];
            } else {
              const spans = Array.from(ratingContainer.querySelectorAll('span'));
              rating = spans[0]?.textContent?.trim() || "";
              const reviewSpan = spans.find(s => s.textContent?.includes('('));
              reviewsCount = reviewSpan ? reviewSpan.textContent.replace(/[()]/g, '').trim() : "";
            }
          }

          // Find category
          const categoryEl = document.querySelector('button[jsaction*="category"]');
          const category = categoryEl?.textContent?.trim() || "";

          return { name, phone, website, address, rating, reviewsCount, category };
        });

        const lead: GoogleMapsLead = {
          name: details.name,
          link: url,
          rating: details.rating || undefined,
          reviewsCount: details.reviewsCount || undefined,
          address: details.address || undefined,
          phone: details.phone || undefined,
          website: details.website || undefined,
          category: details.category || undefined
        };

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

        const reviewNum = parseInt((details.reviewsCount || "").replace(/[^\d]/g, ""), 10) || 0;

        if (!lead.phone) {
          sendUpdate("warning", `Skipped: "${lead.name}" (No phone number)`);
        } else if (isChainOrFranchise(lead.name)) {
          sendUpdate("warning", `Skipped: "${lead.name}" (Filtered: Chain/franchise business)`);
        } else if (reviewNum > 500) {
          sendUpdate("warning", `Skipped: "${lead.name}" (Filtered: too many reviews - ${reviewNum})`);
        } else {
          leads.push(lead);
          sendUpdate("success", `Found Phone for: "${lead.name}" (${lead.phone})`);
        }

      } catch (err: any) {
        sendUpdate("warning", `Failed to extract details for place: ${url.substring(0, 45)}... Error: ${err.message}`);
      }
    }

    sendUpdate("info", `Scrape complete. Found ${leads.length} leads with active phone numbers.`);
    return leads;

  } catch (err: any) {
    sendUpdate("error", `Scraping aborted due to error: ${err.message}`);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
