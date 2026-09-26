import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export interface SkoolProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  url: string;
  imageUrl: string;
  members?: string;
}

export async function scrapeSkoolDiscover(query: string, maxResults: number = 100): Promise<SkoolProduct[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Skool search URL
    const searchUrl = `https://www.skool.com/discovery?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for React to hydrate and load results
    await new Promise(r => setTimeout(r, 3000));

    // Scroll down to trigger lazy loading and infinite scroll
    let previousHeight = 0;
    for (let i = 0; i < 15; i++) {
      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollBy(0, 3000));
      await new Promise(r => setTimeout(r, 800)); // wait for load
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) break; // Reached bottom or no new content
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    const products: SkoolProduct[] = [];

    // Skool community cards are anchor tags
    $('a[href^="/"]').each((i, el) => {
      if (products.length >= maxResults) return false;

      const link = $(el);
      const path = link.attr('href') || '';
      const url = "https://www.skool.com" + path;
      
      // Filter out system links
      if (path === '/' || path.includes('/discovery') || path.includes('/login') || path.includes('/signup')) return;
      
      const text = link.text().replace(/\n/g, ' ').trim();
      
      // Look for indicators of a community card (usually has members count or price)
      // Example text: "Alex Hormozi's Community 100k Members Free"
      if (text.length > 20 && (text.includes(' Members') || text.includes(' Member') || text.includes('Free') || text.includes('/month'))) {
         
         const img = link.find('img').first();
         const imageUrl = img.attr('src') || img.attr('srcset')?.split(' ')[0] || "";

         // Try to extract title
         let title = "Skool Community";
         const possibleTitle = link.find('h3, h4, span[class*="Name"], strong').first().text().trim();
         if (possibleTitle && possibleTitle.length > 2) {
             title = possibleTitle;
         } else {
             title = text.substring(0, 40) + "...";
         }
         
         // Extract Price
         let price = "See on Skool";
         const priceMatch = text.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?(?:\/month)?|Free/i);
         if (priceMatch) {
           price = priceMatch[0].toLowerCase() === 'free' ? 'Free' : priceMatch[0];
         }

         // Extract Members
         let members = undefined;
         const membersMatch = text.match(/([\d,]+(?:k|m)?)\s+Members?/i);
         if (membersMatch) {
           members = membersMatch[1];
         }

         if (!products.some(p => p.url === url)) {
           products.push({
              id: Buffer.from(url).toString('base64').substring(0, 10),
              title,
              description: text.substring(0, 120) + "...",
              price,
              url,
              imageUrl,
              members
           });
         }
      }
    });

    return products;

  } catch (error) {
    console.error("Puppeteer Skool Scraping Error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
