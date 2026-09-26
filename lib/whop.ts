import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export interface WhopProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  url: string;
  imageUrl: string;
  rating?: string;
  reviews?: string;
}

export async function scrapeWhopMarketplace(query: string, maxResults: number = 100): Promise<WhopProduct[]> {
  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Whop search URL
    const searchUrl = `https://whop.com/discover/search/?q=${encodeURIComponent(query)}`;
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

    // Get the page HTML after JS execution
    const html = await page.content();
    const $ = cheerio.load(html);

    const products: WhopProduct[] = [];

    // Whop product cards are anchor tags
    $('a[href^="/"]').each((i, el) => {
      if (products.length >= maxResults) return false;

      const link = $(el);
      const url = "https://whop.com" + link.attr('href');
      
      // Ignore navigation links
      if (url.includes('/marketplace') || url.includes('/discover/search') || url.length < 30) return;
      
      // Filter out blog or generic links
      if (!url.includes('/blog/') && !url.includes('/affiliates/')) {
        const text = link.text().replace(/\n/g, ' ').trim();
        
        // We consider it a product card if the text contains 'by ' (creator) or 'Launched '
        if (text.includes('by ') || text.includes('Launched ') || url.includes('?ref=discover') || url.includes('?ref=search')) {
           
           const img = link.find('img').first();
           const imageUrl = img.attr('src') || img.attr('srcset')?.split(' ')[0] || "";

           // Extract title. The title is usually the text before 'by '
           let title = "Whop Digital Product";
           let price = "See on Whop";

           if (text.includes(' by ')) {
              title = text.split(' by ')[0].trim();
           } else {
              title = link.find('h3, h4, strong, p.font-bold, p.font-semibold').first().text().trim() || text.substring(0, 40) + "...";
           }
           
           // Clean up title length
           if (title.length > 60) {
               title = title.substring(0, 60) + "...";
           }

           // Check if there is a price in the text anyway
           const priceMatch = text.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?|Free/i);
           if (priceMatch) {
             price = priceMatch[0].toLowerCase() === 'free' ? 'Free' : priceMatch[0];
           }

           // Extract rating if possible
           let rating = undefined;
           const ratingMatch = text.match(/([0-5]\.[0-9]) \(\d+\)/);
           if (ratingMatch) {
             rating = ratingMatch[0];
           }

           // Check for duplicates
           if (!products.some(p => p.url === url)) {
             products.push({
                id: Buffer.from(url).toString('base64').substring(0, 10),
                title,
                description: text.substring(0, 120) + "...",
                price,
                url,
                imageUrl,
                rating
             });
           }
        }
      }
    });

    return products;

  } catch (error) {
    console.error("Puppeteer Scraping Error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
