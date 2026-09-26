export interface ContactInfo {
  emails: string[];
  socials: string[];
  websites: string[];
}

export async function enrichUrls(urls: string[]): Promise<Record<string, ContactInfo>> {
  const results: Record<string, ContactInfo> = {};

  // Process in small batches to avoid overwhelming the server or getting blocked
  const BATCH_SIZE = 5;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (url) => {
        try {
          // Fetch raw HTML. Add timeout and generic headers.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
          
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            results[url] = { emails: [], socials: [], websites: [] };
            return;
          }
          
          const html = await res.text();
          results[url] = extractContactInfo(html);
        } catch (err) {
          // Fallback to empty if fetch fails
          results[url] = { emails: [], socials: [], websites: [] };
        }
      })
    );
    
    // Small delay between batches
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}

export function extractContactInfo(text: string): ContactInfo {
  const emails: string[] = [];
  const socials: string[] = [];
  const websites: string[] = [];

  if (!text) return { emails, socials, websites };

  // Common domains to ignore for emails
  const ignoredEmailDomains = ['sentry.io', 'example.com', 'w3.org'];
  const ignoredEmails = ['johnappleseed@gmail.com', 'user@example.com', 'email@example.com', 'hello@skool.com', 'support@skool.com', 'support@whop.com'];

  // 1. Extract Emails
  // Basic email regex
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const foundEmails = text.match(emailRegex);
  
  if (foundEmails) {
    foundEmails.forEach(email => {
      const e = email.toLowerCase();
      // Filter out obvious false positives like .png/.jpg or common tech stack emails
      if (!e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp') && !e.includes('sentry') && !ignoredEmailDomains.some(d => e.endsWith(d)) && !ignoredEmails.includes(e)) {
        if (!emails.includes(e)) emails.push(e);
      }
    });
  }

  // 2. Extract Socials
  // Look for instagram, twitter/x, tiktok, linkedin links
  const socialRegex = /(https?:\/\/(?:www\.)?(?:instagram\.com|twitter\.com|x\.com|tiktok\.com|linkedin\.com)\/[a-zA-Z0-9_.-]+)/gi;
  const foundSocials = text.match(socialRegex);
  
  const ignoredSocials = [
    'https://x.com/whop', 'https://twitter.com/whop', 'https://instagram.com/whop', 'https://www.instagram.com/whop',
    'https://www.linkedin.com/company', 'https://tiktok.com/@whop',
    'https://x.com/skool', 'https://twitter.com/skool', 'https://instagram.com/skool', 'https://www.instagram.com/skool'
  ];
  
  if (foundSocials) {
    foundSocials.forEach(link => {
      // Remove trailing quotes, spaces, or slashes that might have been caught
      const clean = link.replace(/["'>)\\]/g, '').replace(/\/$/, '').toLowerCase();
      
      // Filter out generic paths and known placeholders
      if (!clean.endsWith('/home') && !clean.endsWith('/explore') && !clean.endsWith('/about') && !ignoredSocials.includes(clean)) {
        if (!socials.includes(clean)) socials.push(clean);
      }
    });
  }

  // 3. Extract generic websites (if they are explicitly listed as personal/company sites)
  // This is harder from raw HTML without getting a million links, so we'll look for specific keywords
  // like 'website":"https://...' or links with 'official' or 'portfolio'.
  // For simplicity, we rely mostly on emails and socials.
  
  return { emails, socials, websites };
}
