import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ==================== URL RESOLUTION & VALIDATION ====================

/**
 * Attempts to resolve a URL by following redirects and returns the final destination URL.
 * This is critical for fixing broken Google grounding redirect URLs.
 */
const resolveUrl = async (url, maxRedirects = 5) => {
  try {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount < maxRedirects) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual', // Don't auto-follow redirects
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        clearTimeout(timeout);

        // Check for redirect
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            // Handle relative URLs
            currentUrl = new URL(location, currentUrl).href;
            redirectCount++;
            console.log(`   ↪ Redirect ${redirectCount}: ${currentUrl}`);
            continue;
          }
        }

        // Check if URL is valid (2xx response)
        if (response.ok) {
          return { url: currentUrl, valid: true };
        }

        // Non-redirect, non-success response
        // Treat 403 as "valid" if we successfully followed redirects to a real URL
        // Many news sites block HEAD requests from bots but the URL is still valid
        if (response.status === 403 && redirectCount > 0) {
          return { url: currentUrl, valid: true, status: response.status };
        }
        return { url: currentUrl, valid: false, status: response.status };
      } catch (fetchError) {
        clearTimeout(timeout);
        // Try GET request if HEAD fails (some servers don't support HEAD)
        if (fetchError.name !== 'AbortError' && redirectCount === 0) {
          try {
            const getResponse = await fetch(currentUrl, {
              method: 'GET',
              redirect: 'follow',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            if (getResponse.ok) {
              return { url: getResponse.url, valid: true };
            }
          } catch {
            // Ignore GET error
          }
        }
        throw fetchError;
      }
    }

    return { url: currentUrl, valid: false, reason: 'Too many redirects' };
  } catch (error) {
    return { url: url, valid: false, reason: error.message };
  }
};

/**
 * Validates if a URL returns a successful response (2xx)
 */
const validateUrl = async (url) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeout);
    // Accept 403 as valid - many news sites block HEAD requests from bots
    // but the URL is still valid for end users clicking on it
    return response.ok || response.status === 403;
  } catch {
    return false;
  }
};

/**
 * Normalizes a title for comparison
 */
const normalizeTitle = (title) => {
  return title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates similarity between two titles (0-1)
 */
const calculateTitleSimilarity = (title1, title2) => {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (norm1 === norm2) return 1.0;

  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return union > 0 ? intersection / union : 0;
};

/**
 * Finds the best matching BuzzSumo article for a given title
 */
const findMatchingBuzzSumoUrl = (title, buzzsumoArticles) => {
  if (!buzzsumoArticles || buzzsumoArticles.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const article of buzzsumoArticles) {
    const similarity = calculateTitleSimilarity(title, article.title);
    if (similarity > bestSimilarity && similarity >= 0.5) { // 50% threshold
      bestSimilarity = similarity;
      bestMatch = article;
    }
  }

  if (bestMatch) {
    console.log(`   📰 Found BuzzSumo match (${(bestSimilarity * 100).toFixed(0)}% similar): "${bestMatch.title}"`);
    return bestMatch.url;
  }

  return null;
};

/**
 * Checks if a URL is a broken Google grounding redirect URL
 */
const isBrokenGroundingUrl = (url) => {
  return url.includes('vertexaisearch') ||
         url.includes('grounding-api-redirect') ||
         url.includes('googleusercontent.com/grounding');
};

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// ==================== BUZZSUMO SERVICE ====================

const BUZZSUMO_API_BASE = "https://api.buzzsumo.com/search/articles.json";

const dateToUnixTimestamp = (dateString) => {
  return Math.floor(new Date(dateString).getTime() / 1000);
};

const formatDate = (unixTimestamp) => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const validateTelcoRelevance = (article) => {
  const title = article.title.toLowerCase();
  const excerpt = (article.excerpt || '').toLowerCase();
  const combined = `${title} ${excerpt}`;

  const telcoCompanyIndicators = [
    'pldt', 'globe telecom', 'dito telecommunity', 'dito telecoms',
    'converge ict', 'smart communications',
    'telecommunications', 'telecom', 'telecoms',
    'mobile network', 'broadband', 'internet service provider', 'isp',
    '5g network', 'fiber network', 'cellular',
    'dict', 'ntc', 'telco', 'telcos'
  ];

  // Check for ambiguous "smart" usage
  if (title.includes('smart') && !title.includes('smart communications')) {
    const smartFalsePositives = [
      'smart meter', 'smart grid', 'smart city', 'smart home',
      'smart device', 'smart tv', 'smart watch', 'smart phone',
      'smart technology', 'smart monitoring', 'smart system',
      'smart economics', 'smart solution', 'smart app',
      'smart card', 'be smart', 'work smart', 'smart choice'
    ];

    if (smartFalsePositives.some(fp => title.includes(fp))) {
      const hasTelcoContext = telcoCompanyIndicators.some(indicator => combined.includes(indicator));
      if (!hasTelcoContext) return false;
    }
  }

  // Check for ambiguous "dito" usage
  if (title.includes('dito') && !title.includes('dito telecom') && !title.includes('dito network')) {
    const ditoFalsePositives = ['dito sa', 'dito ang', 'dito na', 'dito pa', 'pumunta dito', 'magtungo dito', 'dumating dito'];
    if (ditoFalsePositives.some(fp => title.includes(fp))) return false;

    const words = title.split(/\s+/);
    const ditoIndex = words.findIndex(w => w.includes('dito'));
    if (ditoIndex !== -1) {
      const nextWord = words[ditoIndex + 1];
      if (nextWord && ['sa', 'ang', 'na', 'pa', 'ay'].includes(nextWord)) return false;

      const hasTelcoContext = telcoCompanyIndicators.some(indicator => combined.includes(indicator));
      if (!hasTelcoContext) return false;
    }
  }

  // Check for ambiguous "globe" usage
  if (title.includes('globe') && !title.includes('globe telecom')) {
    const globeFalsePositives = ['vendée globe', 'golden globe', 'globe award', 'around the globe', 'across the globe', 'globe trot'];
    if (globeFalsePositives.some(fp => title.includes(fp))) return false;
  }

  // Check for ambiguous "converge" usage
  if (title.includes('converge') && !title.includes('converge ict')) {
    const convergeFalsePositives = ['fiberxers', 'fiber xers', 'basketball', 'pba'];
    if (convergeFalsePositives.some(fp => title.includes(fp))) return false;
  }

  return true;
};

const filterImportantArticles = (articles) => {
  return articles.filter((article) => {
    const title = article.title.toLowerCase();
    const url = article.url.toLowerCase();
    const domain = article.domain_name.toLowerCase();

    if (!validateTelcoRelevance(article)) return false;

    if (domain.includes('youtube.com') || domain.includes('youtu.be')) return false;

    const sportsKeywords = [
      'pba', 'pvl', 'uaap', 'ncaa', 'nba', 'fiba',
      'basketball', 'volleyball', 'gilas',
      'traded', 'debut', 'match', 'game', 'score',
      'fiberxers', 'high speed hitters', 'tropang',
      'golden', 'tournament', 'championship', 'playoffs',
      'injured', 'injures', 'triple-double', 'season',
      'coach', 'player', 'team', 'win', 'loss', 'defeat'
    ];

    if (sportsKeywords.some(keyword => title.includes(keyword))) return false;

    const lowImportanceKeywords = [
      'promo', 'sale', 'discount', 'voucher', 'giveaway',
      'celebrity', 'endorsement', 'ambassador',
      'raffle', 'contest', 'prize',
      'csr', 'charity', 'donation', 'scholarship',
      'award ceremony', 'recognition event',
      'new plan', 'price cut', 'special offer',
      'bundle', 'freebie', 'limited time'
    ];

    if (lowImportanceKeywords.some(keyword => title.includes(keyword))) return false;

    const highImportanceKeywords = [
      'billion', 'million', 'investment', 'capex',
      'infrastructure', 'subsea cable', 'fiber', 'data center',
      'network expansion', 'rollout', 'deployment',
      'dict', 'ntc', 'regulatory', 'policy', 'law',
      'spectrum', 'license', 'permit', 'circular',
      '5g', 'fiber', 'broadband', 'satellite', 'starlink',
      'cybersecurity', 'breach', 'hack', 'outage',
      'merger', 'acquisition', 'partnership', 'alliance',
      'earnings', 'revenue', 'profit', 'quarterly',
      'stock', 'ipo', 'shares',
      'outage', 'disruption', 'complaint', 'npc',
      'data breach', 'privacy', 'security'
    ];

    const hasImportantKeyword = highImportanceKeywords.some(keyword => title.includes(keyword));

    const majorNewsSources = [
      'philstar.com', 'mb.com.ph', 'bworldonline.com',
      'rappler.com', 'inquirer.net', 'gmanetwork.com',
      'abs-cbn.com', 'manilatimes.net', 'manilabulletin.com',
      'newsbytes.ph', 'bilyonaryo.com'
    ];

    const isMajorNewsSource = majorNewsSources.some(source => domain.includes(source));

    return hasImportantKeyword || (isMajorNewsSource && !title.includes('ad') && !title.includes('sponsored'));
  });
};

const deduplicateArticles = (articles) => {
  const seen = new Set();
  return articles.filter((article) => {
    const normalizedUrl = article.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);
    return true;
  });
};

const fetchBuzzSumoNews = async ({ query, startDate, endDate, limit = 10, country }) => {
  if (!process.env.BUZZSUMO_API_KEY) {
    throw new Error("BUZZSUMO_API_KEY environment variable not set");
  }

  const beginTimestamp = dateToUnixTimestamp(startDate);
  const endTimestamp = dateToUnixTimestamp(endDate);

  const paramsObj = {
    q: query,
    begin_date: beginTimestamp.toString(),
    end_date: endTimestamp.toString(),
    num_results: limit.toString(),
    page: "0",
    api_key: process.env.BUZZSUMO_API_KEY,
  };

  if (country) {
    paramsObj.country = country;
  }

  const params = new URLSearchParams(paramsObj);
  const url = `${BUZZSUMO_API_BASE}?${params.toString()}`;

  console.log(`Fetching BuzzSumo news: ${query}`);

  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BuzzSumo API request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  const articles = (data.results || []).map((item) => ({
    title: item.title || "Untitled",
    url: item.url || "",
    published_date: formatDate(item.published_date || Date.now() / 1000),
    author: item.author_name || undefined,
    domain_name: item.domain_name || new URL(item.url).hostname,
    engagement: {
      total_shares: item.total_shares || 0,
      facebook_shares: item.facebook_shares || 0,
      pinterest_shares: item.pinterest_shares || 0,
      twitter_shares: item.twitter_shares || 0,
      total_links: item.num_linking_domains || 0,
      evergreen_score: item.evergreen_score || undefined,
    },
    thumbnail: item.thumbnail || undefined,
    excerpt: item.description || undefined,
  }));

  console.log(`BuzzSumo returned ${articles.length} articles`);
  return articles;
};

const fetchPhilippineTelcoNews = async (startDate, endDate) => {
  const comprehensiveQuery =
    'telecom OR telecoms OR telecommunications OR dict OR ntc OR ' +
    '"globe telecom" OR "dito telecoms" OR "dito telecommunity" OR ' +
    '"converge ict" OR "smart communications" OR pldt OR "sky fiber" OR ' +
    'globe OR smart OR converge OR dito ' +
    '-golden -pvl -pba -basketball -volleyball -nba -fiba -uaap -ncaa ' +
    '-gilas -"converge fiberxers" -traded -debut -match -"high speed hitters"';

  try {
    const articles = await fetchBuzzSumoNews({
      query: comprehensiveQuery,
      startDate,
      endDate,
      country: "Philippines",
      limit: 50,
    });

    const uniqueArticles = deduplicateArticles(articles);
    const importantArticles = filterImportantArticles(uniqueArticles);

    importantArticles.sort((a, b) => b.engagement.total_shares - a.engagement.total_shares);

    return importantArticles.slice(0, 15);
  } catch (error) {
    console.error("Error in fetchPhilippineTelcoNews:", error);
    return [];
  }
};

// ==================== GEMINI SERVICE ====================

const createGeminiPrompt = (startDate, endDate) => `
You are a world-class investigative intelligence AI. Your mission is to search Google News to uncover the MOST IMPORTANT and STRATEGICALLY RELEVANT telecommunications news from the Philippines between **${startDate} and ${endDate}**.

**SEARCH QUALITY GUIDELINES:**

1.  **Date Filtering:** Focus your search on articles published between ${startDate} and ${endDate}. Use date operators in your queries (after:${startDate} before:${endDate}).
2.  **Source Quality:** Prioritize reputable Philippine news sources like PhilStar, BusinessWorld, Manila Bulletin, Rappler, Inquirer, and official government sites (gov.ph, officialgazette.gov.ph).
3.  **Relevance Verification:** For major stories, look for multiple sources reporting the same event to confirm significance.

**PRIMARY DIRECTIVE: Distinguishing Signal from Noise**

Your primary function is to filter out routine announcements and focus only on news of strategic importance. Adhere strictly to these classifications:

*   **INCLUDE (High Importance / Signal):**
    *   **Regulatory & Policy Shifts:** Major new laws, DICT/NTC circulars, significant policy changes impacting the entire industry (e.g., spectrum allocation, foreign ownership, national security reviews).
    *   **Massive Infrastructure Projects & Investments:** Multi-billion peso investments, new subsea cable landings (e.g., Bifrost, Apricot), nationwide fiber backbone expansions, large-scale data center constructions, major satellite internet partnerships (e.g., with Starlink).
    *   **Mergers, Acquisitions & Strategic Alliances:** Significant M&A activities, joint ventures between major players, or partnerships that create new market dynamics.
    *   **Major Financial & Market Movements:** Quarterly financial results ONLY if they indicate a significant trend deviation (e.g., record profits/losses, major revenue shifts between business segments). Entry or exit of a major market player.
    *   **Transformative Technology Deployments:** Large-scale 5G network activations in new regions, successful trials of next-gen tech (e.g., Open RAN, 6G precursors), major cybersecurity incidents with national impact.

*   **EXCLUDE (Low Importance / Noise):**
    *   **Routine Corporate Affairs:** Minor executive appointments, CSR events, winning standard industry awards, rebranding announcements.
    *   **Standard Marketing & Promotions:** Launch of new mobile/broadband plans, device bundles, celebrity endorsements, price adjustments, local marketing campaigns.
    *   **Minor Operational Updates:** Small, localized service expansions or network maintenance announcements.
    *   **Daily Stock Price Changes:** Do not report on stock fluctuations unless directly tied to a 'High Importance' event.

**SEARCH STRATEGY:**

Conduct focused searches covering these key areas:

1.  **General Industry News:**
    *   \`philippine telecommunications news after:${startDate} before:${endDate}\`
    *   \`philippines telco infrastructure 5G fiber after:${startDate} before:${endDate}\`
    *   \`DICT NTC policy regulation philippines after:${startDate} before:${endDate}\`

2.  **Major Telco Companies (PLDT, Globe Telecom, Converge ICT, DITO Telecommunity):**
    *   Search for each company using multiple queries:
    *   \`"[Company Name]" philippines news after:${startDate} before:${endDate}\`
    *   \`"[Company Name]" (investment OR expansion OR 5G OR fiber) after:${startDate} before:${endDate}\`
    *   \`"[Company Name]" (earnings OR financial OR revenue) philippines after:${startDate} before:${endDate}\`

3.  **Global News with Philippine Impact:**
    *   \`"southeast asia" telecommunications philippines after:${startDate} before:${endDate}\`
    *   \`subsea cable data center philippines after:${startDate} before:${endDate}\`

**Search Tips:**
*   Use negative keywords to filter noise: \`-promo -celebrity -award -csr\`
*   Try different keyword combinations if initial results are limited
*   If a company has no important news, it's acceptable to return an empty array for that company

**Instructions for Output:**

*   Select the most important and strategic articles for each category
*   Focus on quality over quantity - it's better to have fewer high-quality articles than many mediocre ones
*   Your entire response MUST be a single, valid JSON object. No introductory text, comments, or markdown.
*   **CRITICAL JSON SYNTAX**: The JSON must be perfectly valid. Ensure there are **no trailing commas**.

**JSON Output Structure (Strictly Enforced):**

The top-level JSON object must have three keys: "internationalNews", "generalNews", and "companyNews".

- \`"internationalNews"\`: An array of article objects for global news with Philippine impact. If none found, return an empty array \`[]\`.
- \`"generalNews"\`: An array of article objects for the general industry news. If no important news is found, return an empty array \`[]\`.
- \`"companyNews"\`: An array of objects. **You MUST create an object for EACH of the four companies: PLDT, Globe Telecom, Converge ICT, and DITO Telecommunity.**
    *   Each object in this array must have two keys:
        *   \`"companyName"\`: The name of the company (e.g., "PLDT", "Globe Telecom", "Converge ICT", "DITO Telecommunity").
        *   \`"articles"\`: An array of article objects for that company. If you find no important news for a company in the date range, this MUST be an empty array \`[]\`.

**Article Object Structure (must be exact):**
- "title": The exact title of the article.
- "date": The publication date from the search results (e.g., "October 22, 2025" or "Oct 22, 2025").
- "summary": A concise summary of the article's main points (2-3 sentences).
- "takeaways": An array of exactly two distinct, insightful bullet points highlighting key implications.
- "source": An object with "title" (source website name like "PhilStar" or "Manila Bulletin") and "uri" (the article's URL from search results).
`;

const fetchGeminiNews = async (startDate, endDate) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = createGeminiPrompt(startDate, endDate);

  try {
    console.log('Fetching telco news from Gemini API...');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
        throw new Error(`API response blocked due to: ${finishReason}. Please try a different date range.`);
      }
      throw new Error("Received an empty response from the API");
    }

    const startIndex = responseText.indexOf('{');
    const endIndex = responseText.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      throw new Error(`Could not find a valid JSON object in the AI's response`);
    }

    const jsonString = responseText.substring(startIndex, endIndex + 1);
    const parsedData = JSON.parse(jsonString);

    if (typeof parsedData !== 'object' || parsedData === null ||
      !Array.isArray(parsedData.internationalNews) ||
      !Array.isArray(parsedData.generalNews) ||
      !Array.isArray(parsedData.companyNews)) {
      throw new Error("API response is not in the expected NewsData format");
    }

    // Extract grounding chunks for potential URL fixing
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { parsedData, groundingChunks };
  } catch (error) {
    console.error("Error fetching Gemini news:", error);
    throw error;
  }
};

/**
 * Fixes and validates all article URLs in the news data.
 * Uses multiple strategies:
 * 1. Resolve redirect URLs by following them
 * 2. Match against grounding metadata chunks
 * 3. Fall back to BuzzSumo articles with matching titles
 * 4. Validate final URLs actually work
 */
const fixAndValidateArticleUrls = async (parsedData, groundingChunks, buzzsumoArticles) => {
  const companyArticles = parsedData.companyNews.flatMap(section => section.articles);
  const allNews = [...parsedData.internationalNews, ...parsedData.generalNews, ...companyArticles];

  console.log(`\n🔗 Validating ${allNews.length} article URLs...`);

  let fixedCount = 0;
  let validatedCount = 0;
  let failedArticles = [];

  for (const article of allNews) {
    const originalUrl = article.source.uri;
    let currentUrl = originalUrl;
    let urlFixed = false;

    console.log(`\n📰 "${article.title.substring(0, 50)}..."`);
    console.log(`   Original URL: ${originalUrl.substring(0, 80)}...`);

    // Step 1: Check if it's a broken grounding URL
    if (isBrokenGroundingUrl(currentUrl)) {
      console.log(`   ⚠️  Detected broken grounding redirect URL`);

      // Step 2a: Try to resolve the redirect URL
      console.log(`   🔄 Attempting to resolve redirect...`);
      const resolved = await resolveUrl(currentUrl);

      if (resolved.valid && !isBrokenGroundingUrl(resolved.url)) {
        console.log(`   ✅ Resolved to: ${resolved.url}`);
        currentUrl = resolved.url;
        urlFixed = true;
      } else {
        console.log(`   ❌ Redirect resolution failed: ${resolved.reason || `Status ${resolved.status}`}`);

        // Step 2b: Try to find URL in grounding chunks by title matching
        if (groundingChunks.length > 0) {
          console.log(`   🔍 Searching grounding chunks for match...`);
          const matchedChunk = groundingChunks.find(chunk => {
            if (!('web' in chunk) || !chunk.web.title || !chunk.web.uri) return false;
            // Check if grounding chunk URL is also broken
            if (isBrokenGroundingUrl(chunk.web.uri)) return false;
            const similarity = calculateTitleSimilarity(article.title, chunk.web.title);
            return similarity >= 0.6;
          });

          if (matchedChunk && 'web' in matchedChunk) {
            console.log(`   ✅ Found grounding chunk match: ${matchedChunk.web.uri}`);
            currentUrl = matchedChunk.web.uri;
            article.source.title = matchedChunk.web.title;
            urlFixed = true;
          }
        }

        // Step 2c: Try to find matching BuzzSumo article
        if (!urlFixed) {
          console.log(`   🔍 Searching BuzzSumo articles for match...`);
          const buzzsumoUrl = findMatchingBuzzSumoUrl(article.title, buzzsumoArticles);
          if (buzzsumoUrl) {
            console.log(`   ✅ Found BuzzSumo match: ${buzzsumoUrl}`);
            currentUrl = buzzsumoUrl;
            urlFixed = true;
          }
        }
      }
    }

    // Step 3: Validate the URL (whether original or fixed)
    if (currentUrl !== originalUrl || !isBrokenGroundingUrl(currentUrl)) {
      console.log(`   🔍 Validating URL...`);
      const isValid = await validateUrl(currentUrl);

      if (isValid) {
        console.log(`   ✅ URL validated successfully`);
        article.source.uri = currentUrl;
        validatedCount++;
        if (urlFixed) fixedCount++;
      } else {
        console.log(`   ❌ URL validation failed`);

        // Last resort: Try BuzzSumo if we haven't already
        if (!urlFixed) {
          const buzzsumoUrl = findMatchingBuzzSumoUrl(article.title, buzzsumoArticles);
          if (buzzsumoUrl) {
            const buzzValid = await validateUrl(buzzsumoUrl);
            if (buzzValid) {
              console.log(`   ✅ BuzzSumo fallback succeeded: ${buzzsumoUrl}`);
              article.source.uri = buzzsumoUrl;
              validatedCount++;
              fixedCount++;
            } else {
              failedArticles.push(article);
            }
          } else {
            failedArticles.push(article);
          }
        } else {
          failedArticles.push(article);
        }
      }
    } else {
      failedArticles.push(article);
    }
  }

  console.log(`\n📊 URL Validation Summary:`);
  console.log(`   Total articles: ${allNews.length}`);
  console.log(`   Successfully validated: ${validatedCount}`);
  console.log(`   URLs fixed: ${fixedCount}`);
  console.log(`   Failed to fix: ${failedArticles.length}`);

  // Mark failed articles so frontend can handle them
  for (const article of failedArticles) {
    article._urlBroken = true;
    console.log(`   ⚠️  Broken URL for: "${article.title.substring(0, 50)}..."`);
  }

  return parsedData;
};

// ==================== API ENDPOINTS ====================

// Endpoint to fetch news from both BuzzSumo and Gemini
app.get('/api/news', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: startDate and endDate'
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Fetching news for ${startDate} to ${endDate}`);
    console.log(`${'='.repeat(60)}\n`);

    // Fetch from both sources in parallel
    const [geminiResult, buzzsumoResult] = await Promise.allSettled([
      fetchGeminiNews(startDate, endDate),
      fetchPhilippineTelcoNews(startDate, endDate)
    ]);

    // Handle Gemini result (critical)
    if (geminiResult.status === 'rejected') {
      console.error('Gemini API failed:', geminiResult.reason);
      return res.status(500).json({
        error: 'Failed to fetch news from Gemini API',
        details: geminiResult.reason.message
      });
    }

    // Handle BuzzSumo result (non-critical)
    const buzzsumoArticles = buzzsumoResult.status === 'fulfilled' ? buzzsumoResult.value : [];
    if (buzzsumoResult.status === 'rejected') {
      console.warn('BuzzSumo API failed (non-critical):', buzzsumoResult.reason);
    }

    // Extract parsed data and grounding chunks from Gemini result
    const { parsedData, groundingChunks } = geminiResult.value;

    // Fix and validate all article URLs
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting URL validation and fixing...`);
    console.log(`${'='.repeat(60)}`);

    const validatedNewsData = await fixAndValidateArticleUrls(
      parsedData,
      groundingChunks,
      buzzsumoArticles
    );

    // Filter out articles with broken URLs (optional - uncomment to remove them entirely)
    // This keeps articles but marks them so frontend can handle gracefully
    /*
    const filterBrokenUrls = (articles) => articles.filter(a => !a._urlBroken);
    validatedNewsData.internationalNews = filterBrokenUrls(validatedNewsData.internationalNews);
    validatedNewsData.generalNews = filterBrokenUrls(validatedNewsData.generalNews);
    for (const section of validatedNewsData.companyNews) {
      section.articles = filterBrokenUrls(section.articles);
    }
    */

    console.log(`\n${'='.repeat(60)}`);
    console.log(`News fetch complete!`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      geminiNews: validatedNewsData,
      buzzsumoArticles: buzzsumoArticles
    });
  } catch (error) {
    console.error('Error in /api/news:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Endpoint to generate presentation
app.post('/api/presentation', async (req, res) => {
  try {
    const { newsData, dateRange } = req.body;

    if (!newsData || !dateRange) {
      return res.status(400).json({
        error: 'Missing required parameters: newsData and dateRange'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY not configured on server'
      });
    }

    console.log('Generating presentation...');

    // Note: The presentation generation and image search logic
    // is complex and calls client-side APIs (Pexels, Unsplash).
    // For now, we'll keep that on the frontend and only move
    // the Gemini API call to the backend.

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are a corporate communications expert...
[Full prompt would go here - truncated for brevity]
${JSON.stringify(newsData, null, 2)}
Date Range: ${dateRange}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.3 },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const startIndex = responseText.indexOf('{');
    const endIndex = responseText.lastIndexOf('}');
    const jsonString = responseText.substring(startIndex, endIndex + 1);
    const presentation = JSON.parse(jsonString);

    res.json(presentation);
  } catch (error) {
    console.error('Error in /api/presentation:', error);
    res.status(500).json({
      error: 'Failed to generate presentation',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`News API: http://localhost:${PORT}/api/news`);
  console.log(`Presentation API: http://localhost:${PORT}/api/presentation`);
});
