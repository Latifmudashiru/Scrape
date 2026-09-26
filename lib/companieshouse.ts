import * as cheerio from "cheerio";

/**
 * Searches the public UK Companies House website for a business name
 * and returns a list of active Directors.
 * Requies ZERO API keys as it scrapes the public site directly.
 */
export async function getCompanyDirectors(companyName: string, address?: string): Promise<{ directors: string[]; companyUrl: string }> {
  try {
    // Clean name of locations or categories for a better search match
    // e.g. "Cake Your Day Manchester" -> "Cake Your Day"
    const cleanedName = companyName
      .replace(/[-]/g, " ")
      .replace(/\b(manchester|london|birmingham|leeds|glasgow|sheffield|liverpool|bristol|cardiff|edinburgh|reading|salford|chorlton|didsbury|ancoats|fallowfield|upton park|Chingford|seven kings|romford|bethnal green|mile end|ilford|canning town|barking|dagenham|walthamstow|dalston|farringdon|leyton|leytonstone|bow|little ilford|east london|stratford|forest gate|upton park|whitechapel|neasden|gallions reach|kingsbury|wembley|marylebone|canary wharf|gants hill)\b/gi, "")
      .replace(/\b(cafe|café|bakery|desserts|dessert|gelato|express|ltd|limited|creperie|studio|junction|bar|parlour|waffles|waffle|ice creams|cave|delicacy|dons|dune|inn|on demand|treatz|sweet shop|sweet|chocolatier|spoon|lounge|shop|house|connection|corner|kitchen|co|group)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const queryName = cleanedName || companyName;

    // 1. Search for company
    const searchUrl = `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(queryName)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (!searchRes.ok) return { directors: [], companyUrl: "" };
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    // Levenshtein distance helper
    const getLevenshteinDistance = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              )
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Postcode cross-referencing logic
    const extractPostcode = (text: string): string | null => {
      if (!text) return null;
      const match = text.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
      return match ? match[0].toUpperCase().replace(/\s+/g, "") : null;
    };

    // Name similarity check helper (fuzzy token-based word matching)
    const isNameSimilar = (resName: string, qName: string): boolean => {
      const getTokens = (str: string): string[] => {
        return str.toLowerCase()
          .replace(/\b(limited|ltd|c\.i\.c\.|cic|plc|llp|group|services|holdings|uk)\b/g, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(t => t.length > 0);
      };

      const resTokens = getTokens(resName);
      const qTokens = getTokens(qName);

      if (qTokens.length === 0 || resTokens.length === 0) return false;

      return qTokens.every(qToken => {
        return resTokens.some(resToken => {
          if (qToken === resToken) return true;
          // Allow 1-character spelling variant for words of length >= 4
          if (qToken.length >= 4 && resToken.length >= 4) {
            const dist = getLevenshteinDistance(qToken, resToken);
            return dist <= 1;
          }
          return false;
        });
      });
    };

    const targetPostcode = address ? extractPostcode(address) : null;
    const targetOutcode = targetPostcode ? targetPostcode.substring(0, targetPostcode.length - 3) : null;

    let bestCompanyNumber: string | null = null;
    let highestScore = 0;

    // Loop through name search results
    $('.type-company').each((_, element) => {
      const nameText = $(element).find('h3 a').text().trim();
      const href = $(element).find('h3 a').attr("href");
      const metaText = $(element).find('.meta.crumbtrail').text();
      const addressText = $(element).find('p').not('.meta').text();

      const companyNumber = href ? href.split("/")[2] : null;
      if (!companyNumber) return;

      const isDissolved = metaText.toLowerCase().includes("dissolved");
      const resultPostcode = extractPostcode(addressText);
      const resultOutcode = resultPostcode ? resultPostcode.substring(0, resultPostcode.length - 3) : null;

      let score = 0;
      if (!isDissolved) {
        score += 10;
      }

      if (targetPostcode && resultPostcode) {
        if (targetPostcode === resultPostcode) {
          score += 100;
        } else if (targetOutcode && resultOutcode && targetOutcode !== resultOutcode) {
          score -= 1000; // Outcode conflict
        }
      } else if (targetOutcode && resultOutcode && targetOutcode === resultOutcode) {
        score += 50;
      }

      if (isNameSimilar(nameText, queryName)) {
        score += 30;
      }

      if (score >= 30 && score > highestScore) {
        highestScore = score;
        bestCompanyNumber = companyNumber;
      }
    });

    // 2. Postcode fallback search with scored results (up to page 3)
    if (!bestCompanyNumber && targetPostcode && address) {
      const formattedPostcodeMatch = address.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
      const formattedPostcode = formattedPostcodeMatch ? formattedPostcodeMatch[0].toUpperCase() : null;

      if (formattedPostcode) {
        for (let page = 1; page <= 10; page++) {
          const postcodeSearchUrl = `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(formattedPostcode)}&page=${page}`;
          const postcodeRes = await fetch(postcodeSearchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
          });

          if (postcodeRes.ok) {
            const postcodeHtml = await postcodeRes.text();
            const $postcode = cheerio.load(postcodeHtml);
            const targetStreetNumber = address.match(/(?:^|\b)(\d+)\b/)?.[1];

            $postcode('.type-company').each((_, element) => {
              const href = $postcode(element).find('h3 a').attr("href");
              const metaText = $postcode(element).find('.meta.crumbtrail').text();
              const addressText = $postcode(element).find('p').not('.meta').text().trim();
              const companyNameResult = $postcode(element).find('h3 a').text().trim();

              const compNum = href ? href.split("/")[2] : null;
              if (!compNum) return;

              const isDissolved = metaText.toLowerCase().includes("dissolved");
              const resultStreetNumber = addressText.match(/(?:^|\b)(\d+)\b/)?.[1];

              // Street number match at this postcode - strictly require name similarity to avoid false matches on commercial addresses
              if (targetStreetNumber && resultStreetNumber && targetStreetNumber === resultStreetNumber) {
                if (isNameSimilar(companyNameResult, queryName)) {
                  let score = 80; // Base score for street number + name match
                  if (!isDissolved) {
                    score += 10;
                  }
                  if (score > highestScore) {
                    highestScore = score;
                    bestCompanyNumber = compNum;
                  }
                }
              }
            });
          }
        }
      }
    }

    const companyNumber = bestCompanyNumber;
    if (!companyNumber) return { directors: [], companyUrl: "" };

    const isNiche = await verifyCompanyNiche(companyNumber);
    if (!isNiche) {
      return { directors: [], companyUrl: "" };
    }

    const companyUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

    // 2. Fetch officers (directors) page
    const officersUrl = `${companyUrl}/officers`;
    const officersRes = await fetch(officersUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (!officersRes.ok) return { directors: [], companyUrl };
    const officersHtml = await officersRes.text();
    const $$ = cheerio.load(officersHtml);

    const directors: string[] = [];

    // Parse officers list items
    $$('.appointments-list .appointment-1').each((_, element) => {
      const roleText = $$(element).find('dd[id^="officer-role-"]').text().toLowerCase();
      const statusText = $$(element).find('dd[id^="officer-status-"]').text().toLowerCase();

      const isDirector = roleText.includes("director");
      const isResigned = roleText.includes("resigned") || statusText.includes("resigned");

      if (isDirector && !isResigned) {
        const nameLink = $$(element).find('h2 span[id^="officer-name-"] a').text().trim();
        const nameSpan = $$(element).find('h2 span[id^="officer-name-"]').text().trim();
        const name = nameLink || nameSpan;

        if (name) {
          // Clean name formatting (names are often stored as "SURNAME, Firstnames")
          // e.g. "SMITH, John Paul" -> "John Paul Smith"
          const cleanName = formatDirectorName(name);
          directors.push(cleanName);
        }
      }
    });

    return { directors: directors.slice(0, 3), companyUrl };
  } catch (error) {
    console.error("Error fetching directors from Companies House:", error);
    return { directors: [], companyUrl: "" };
  }
}

function formatDirectorName(rawName: string): string {
  if (!rawName.includes(",")) return rawName;
  const parts = rawName.split(",").map(p => p.trim());
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`; // Firstname Surname
  }
  return rawName;
}

export async function verifyCompanyNiche(companyNumber: string): Promise<boolean> {
  try {
    const url = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return false;
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const sics: string[] = [];
    $('span[id^="sic"]').each((_, el) => {
      const text = $(el).text().trim();
      const match = text.match(/^(\d+)/);
      if (match) {
        sics.push(match[1]);
      }
    });

    if (sics.length === 0) return true;

    const FOOD_NICHE_SIC_PREFIXES = ["107", "108", "472", "561", "562"];
    const FOOD_NICHE_SIC_CODES = new Set(["47240", "56101", "56102", "56103", "10710", "10720", "10820", "56210", "56290"]);

    const hasFoodNiche = sics.some(sic => {
      return FOOD_NICHE_SIC_CODES.has(sic) || FOOD_NICHE_SIC_PREFIXES.some(pref => sic.startsWith(pref));
    });

    if (hasFoodNiche) {
      return true;
    }

    const MISMATCH_PREFIXES = [
      "41", "42", "43", // Construction
      "62", "63",       // IT / Software
      "64", "65", "66", // Finance / holding
      "68",             // Real estate
      "69", "70", "71", "72", "73", "74", // Prof services (law, consulting, marketing, etc.)
      "81", "82"        // Admin/office support
    ];

    const isMismatch = sics.every(sic => {
      return MISMATCH_PREFIXES.some(pref => sic.startsWith(pref));
    });

    if (isMismatch) {
      console.log(`Company ${companyNumber} rejected due to mismatching SIC codes: ${sics.join(", ")}`);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Error verifying company niche:", e);
    return true;
  }
}

