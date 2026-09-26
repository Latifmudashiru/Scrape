import vanillaPuppeteer from "puppeteer";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { extractContactInfo } from "./enrich";

const puppeteer = addExtra(vanillaPuppeteer);

// Initialize stealth plugin once
try {
  puppeteer.use(StealthPlugin());
} catch (e) {
  // Ignore errors if plugin is already registered
}

export interface InstagramLead {
  id: string;
  name: string;
  username: string;
  followers?: string;
  following?: string;
  posts?: string;
  description: string;
  url: string;
  emails: string[];
  socials: string[];
}

export async function scrapeInstagramLeads(query: string, maxResults: number = 100): Promise<InstagramLead[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === "production" ? true : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // DuckDuckGo Lite search query construction
    // Construct search with common email providers to force dorking
    const searchQuery = `site:instagram.com "${query}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`;
    const searchUrl = 'https://lite.duckduckgo.com/lite/';

    console.log(`Navigating to DDG Lite for query: ${searchQuery}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Type and search
    await page.type('input[name="q"]', searchQuery);
    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    // Check if a CAPTCHA was triggered
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("confirm this search was made by a human") || bodyText.includes("bots use DuckDuckGo too")) {
      console.log(" DuckDuckGo CAPTCHA detected! Please complete the challenge in the browser window...");
      // Wait for up to 120 seconds for the search results page to load
      await page.waitForSelector('a.result-link', { timeout: 120000 });
      console.log(" CAPTCHA solved successfully! Extracting leads...");
    }

    interface RawLead {
      title: string;
      url: string;
      snippet: string;
    }

    const allLeads: RawLead[] = [];

    // Loop to scrape up to 3 pages of DDG Lite results (approx 90 results)
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      console.log(`Scraping DDG Lite result page ${pageNum}...`);
      
      // Parse the results from the DDG Lite results table
      const pageLeads: RawLead[] = await page.evaluate(() => {
        const items: { title: string; url: string; snippet: string }[] = [];
        const tables = Array.from(document.querySelectorAll('table'));
        
        // Find the table that contains result rows (indicated by containing a.result-link)
        const resultsTable = tables.find(t => t.querySelector('a.result-link'));
        if (!resultsTable) return [];
        
        const trs = Array.from(resultsTable.querySelectorAll('tr'));
        
        for (let i = 0; i < trs.length; i++) {
          const tr = trs[i];
          const linkEl = tr.querySelector('a.result-link') as HTMLAnchorElement;
          if (linkEl) {
            const title = linkEl.innerText;
            const url = linkEl.href;
            
            // In DDG Lite, the description is in the very next TR
            const snippetTr = trs[i + 1];
            const snippet = snippetTr ? snippetTr.innerText.trim() : '';
            
            // Verify that it is actually an Instagram profile link (not home page)
            if (url.includes('instagram.com/') && !url.endsWith('instagram.com/')) {
              items.push({ title, url, snippet });
            }
          }
        }
        return items;
      });

      allLeads.push(...pageLeads);

      if (allLeads.length >= maxResults) {
        break;
      }

      // Check if there is a "Next" page button to navigate
      const nextButton = await page.$('input[value="Next"], input[value="next"], button[value="Next"]');
      if (!nextButton) {
        console.log("No Next page button found. Stopping.");
        break;
      }

      console.log("Navigating to the next page of DDG Lite results...");
      try {
        await Promise.all([
          nextButton.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
        ]);
      } catch (err) {
        console.log("Navigation timeout or error going to next page. Stopping page loop.", err);
        break;
      }
    }

    // Clean, enrich and structure the parsed leads
    const enrichedLeads: InstagramLead[] = allLeads.map((lead: RawLead) => {
      // 1. Extract username from title, e.g. "Coach HardgainZ (@coach_hardgainz)" -> "coach_hardgainz"
      const usernameMatch = lead.title.match(/\(@([a-zA-Z0-9._]+)\)/i);
      const username = usernameMatch ? usernameMatch[1] : lead.url.split('/').filter(Boolean).pop() || 'unknown';

      // 2. Extract name
      const name = lead.title.split('(')[0].replace(/•/g, '').trim() || username;

      // 3. Parse stats from snippet
      const followersMatch = lead.snippet.match(/([\d.]+[KkMm]?) Followers/i);
      const followingMatch = lead.snippet.match(/([\d.]+[KkMm]?) Following/i);
      const postsMatch = lead.snippet.match(/([\d.]+[KkMm]?) Posts/i);

      const followers = followersMatch ? followersMatch[1] : undefined;
      const following = followingMatch ? followingMatch[1] : undefined;
      const posts = postsMatch ? postsMatch[1] : undefined;

      // 4. Extract contacts using our pre-built robust helper
      const contacts = extractContactInfo(lead.snippet);

      return {
        id: Buffer.from(lead.url).toString('base64').substring(0, 10),
        name,
        username,
        followers,
        following,
        posts,
        description: lead.snippet,
        url: lead.url,
        emails: contacts.emails,
        socials: contacts.socials
      };
    });

    // If 0 leads were parsed, save a debug screenshot of what Puppeteer saw
    if (enrichedLeads.length === 0) {
      console.log("No leads parsed. Saving debug screenshot to public/debug-instagram.png");
      const fs = require('fs');
      if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
      }
      await page.screenshot({ path: 'public/debug-instagram.png' });
    }

    // Deduplicate array based on URL
    const uniqueLeads: InstagramLead[] = [];
    const seenUrls = new Set<string>();
    for (const lead of enrichedLeads) {
      if (!seenUrls.has(lead.url)) {
        seenUrls.add(lead.url);
        uniqueLeads.push(lead);
      }
    }

    // Filter down to the requested max results
    return uniqueLeads.slice(0, maxResults);

  } catch (error) {
    console.error("Puppeteer Instagram Dorking Error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
