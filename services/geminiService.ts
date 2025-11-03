import { GoogleGenAI, Modality } from "@google/genai";
import { NewsData, Presentation, Slide, BuzzSumoArticle, NewsArticle } from "../types";

/**
 * Converts a BuzzSumo article to NewsArticle format
 */
const convertBuzzSumoToNewsArticle = (article: BuzzSumoArticle): NewsArticle => {
    return {
        title: article.title,
        date: article.published_date,
        summary: article.excerpt || `Trending article from ${article.domain_name} with ${article.engagement.total_shares} social shares.`,
        takeaways: [
            `High engagement: ${article.engagement.total_shares} total shares across social platforms`,
            `Source: ${article.domain_name}`
        ],
        source: {
            title: article.domain_name,
            uri: article.url
        },
        thumbnailUrl: article.thumbnail // Preserve BuzzSumo thumbnail
    };
};

/**
 * Normalizes a URL for comparison by removing protocol, www, trailing slashes, and query parameters
 */
const normalizeUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        // Remove protocol, www, trailing slash, and query parameters
        return urlObj.hostname.replace(/^www\./, '') + urlObj.pathname.replace(/\/$/, '');
    } catch {
        // If URL is invalid, return normalized version
        return url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .split('?')[0];
    }
};

/**
 * Normalizes a title for comparison by removing extra whitespace and punctuation
 */
const normalizeTitle = (title: string): string => {
    return title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Checks if two articles are duplicates based on URL or title similarity
 */
const areDuplicateArticles = (article1: NewsArticle, article2: NewsArticle): boolean => {
    const url1 = normalizeUrl(article1.source.uri);
    const url2 = normalizeUrl(article2.source.uri);

    // Check URL match
    if (url1 === url2) {
        return true;
    }

    // Check title similarity (>80% match)
    const title1 = normalizeTitle(article1.title);
    const title2 = normalizeTitle(article2.title);

    if (title1 === title2) {
        return true;
    }

    // Check if one title contains most of the other (for slight variations)
    const longerTitle = title1.length > title2.length ? title1 : title2;
    const shorterTitle = title1.length > title2.length ? title2 : title1;

    if (shorterTitle.length > 10 && longerTitle.includes(shorterTitle)) {
        return true;
    }

    return false;
};

/**
 * Merges BuzzSumo articles into NewsData with deduplication
 */
export const mergeNewsWithBuzzSumo = (googleNews: NewsData, buzzsumoArticles: BuzzSumoArticle[]): NewsData => {
    // Convert BuzzSumo articles to NewsArticle format
    const buzzsumoNewsArticles = buzzsumoArticles.map(convertBuzzSumoToNewsArticle);

    // Collect all existing articles from Google News for deduplication
    const existingArticles = [
        ...googleNews.internationalNews,
        ...googleNews.generalNews,
        ...googleNews.companyNews.flatMap(section => section.articles)
    ];

    // Filter out duplicate BuzzSumo articles
    const uniqueBuzzsumoArticles = buzzsumoNewsArticles.filter(buzzsumoArticle => {
        return !existingArticles.some(existingArticle =>
            areDuplicateArticles(existingArticle, buzzsumoArticle)
        );
    });

    console.log(`Merged ${uniqueBuzzsumoArticles.length} unique BuzzSumo articles (${buzzsumoArticles.length - uniqueBuzzsumoArticles.length} duplicates removed)`);

    // Add unique BuzzSumo articles to generalNews section
    return {
        ...googleNews,
        generalNews: [...googleNews.generalNews, ...uniqueBuzzsumoArticles]
    };
};

/**
 * Creates a prompt for Gemini to use Google Search to find and process news.
 */
const createPrompt = (startDate: string, endDate: string) => `
You are a world-class investigative intelligence AI. Your mission is to conduct an exhaustive search of Google News to uncover the MOST IMPORTANT and STRATEGICALLY RELEVANT telecommunications news from the Philippines. Leave no stone unturned.

**MANDATORY VERIFICATION PROTOCOL (NON-NEGOTIABLE):**

1.  **ON-PAGE DATE VERIFICATION:** You are REQUIRED to visit every single potential article link. You must locate the publication date ON THE PAGE CONTENT ITSELF. This date must fall strictly between **${startDate} and ${endDate}**. Dates from Google search results are NOT acceptable. Any article outside the date range or without a visible date on the page is to be DISCARDED.
2.  **LINK INTEGRITY CHECK:** You MUST confirm that every link is live and resolves correctly. DISCARD all articles with "404 Not Found" errors, broken links, or paywalls that prevent content access.
3.  **CORROBORATION MANDATE:** For any event you classify as 'High Importance' (see below), you MUST attempt to find at least one other reputable source reporting the same event. This is crucial for verifying its significance. Note the corroborating source, even if you don't include it in the final output.

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

**EXHAUSTIVE SEARCH PLAYBOOK: A Multi-Vector Investigative Workflow**

**Phase 1: High-Level Intelligence Sweep**
*   **Goal:** Establish a baseline understanding of the key events in the date range.
*   **Initial Queries:**
    *   \`philippine telecommunications industry news ${startDate}..${endDate}\`
    *   \`DICT OR NTC major announcements philippines ${startDate}..${endDate}\`
    *   \`philippine telco news ${startDate}..${endDate} (site:philstar.com OR site:mb.com.ph OR site:bworldonline.com OR site:rappler.com OR site:inquirer.net)\`
*   **Noise-Filtering Queries:**
    *   \`philippine telco news ${startDate}..${endDate} -promo -plan -csr -award -celebrity\`
    *   \`philippines telecommunications after:${startDate} before:${endDate} ("breaking news" OR "announced" OR "launched")\`

**Phase 2: Thematic & Regional Deep Dives**
*   **Goal:** Investigate specific high-impact themes and geographic areas.
*   **High-Priority Search Vectors (Use advanced operators):**
    *   **Infrastructure:** \`("subsea cable" OR "fiber backbone" OR "data center" OR "cell tower" OR "base station") AND (philippines OR luzon OR visayas OR mindanao) after:${startDate} before:${endDate}\`
    *   **Technology:** \`("5G SA" OR "5G standalone" OR "Open RAN" OR "LEO satellite" OR "Starlink" OR "WiFi 6" OR "WiFi 7" OR "IoT" OR "edge computing" OR "cloud infrastructure") AND (PLDT OR Globe OR Converge OR DITO) after:${startDate} before:${endDate}\`
    *   **Regulatory:** \`(DICT OR NTC OR "Department of ICT" OR "National Telecommunications Commission") AND ("spectrum auction" OR "policy" OR "circular" OR "national security" OR "license" OR "permit") site:gov.ph OR site:officialgazette.gov.ph after:${startDate} before:${endDate}\`
    *   **Financial:** \`("billion peso" OR "million dollar" OR "investment" OR "capex" OR "capital expenditure" OR "earnings" OR "revenue growth") AND ("PLDT" OR "Globe Telecom" OR "Converge ICT" OR "DITO Telecommunity") after:${startDate} before:${endDate}\`
    *   **Partnerships & M&A:** \`("partnership" OR "alliance" OR "acquisition" OR "merger" OR "joint venture" OR "collaboration") AND (PLDT OR Globe OR Converge OR DITO) AND philippines after:${startDate} before:${endDate}\`
*   **Regional Focus:** Conduct specific searches for developments outside Metro Manila:
    *   \`(DITO OR PLDT OR Globe OR Converge) AND ("Cebu" OR "Davao" OR "Iloilo" OR "Cagayan de Oro" OR "Bacolod" OR "General Santos") AND ("network expansion" OR "fiber rollout" OR "5G") after:${startDate} before:${endDate}\`
    *   \`philippine telecommunications AND ("provincial" OR "rural" OR "underserved areas") after:${startDate} before:${endDate}\`
*   **Global Context:** Search for global trends with direct Philippine impact:
    *   \`"southeast asia" ("subsea cable" OR "data center" OR "cloud region") AND (philippines OR manila) after:${startDate} before:${endDate}\`
    *   \`("Starlink" OR "SpaceX" OR "LEO satellite") AND philippines after:${startDate} before:${endDate}\`

**Phase 3: Forensic Company-Level Investigation**
*   **Goal:** Uncover all significant news for PLDT, Globe Telecom, Converge ICT, and DITO Telecommunity.
*   **PERSISTENCE MANDATE:** An empty result is a sign of an incomplete search. Before concluding no news exists for a company, you **MUST execute at least EIGHT different, complex search queries** combining the company name with keywords from the 'High Importance' list.
*   **Example Query Chains for PLDT (Apply similar logic to Globe, Converge, DITO):**
    1.  \`(PLDT OR "PLDT Inc." OR Smart OR TNT OR "TM") AND ("billion peso" OR "capex" OR "net income" OR "quarterly results" OR partnership OR acquisition) after:${startDate} before:${endDate}\`
    2.  \`(PLDT OR "PLDT Inc.") AND ("5G network" OR "fiber expansion" OR "subsea cable" OR "data center" OR "base station" OR "fiber optic") after:${startDate} before:${endDate}\`
    3.  \`(PLDT OR "PLDT Inc.") AND (DICT OR NTC OR "regulatory filing" OR "spectrum" OR "license") after:${startDate} before:${endDate}\`
    4.  \`(PLDT OR "PLDT Inc.") filetype:pdf ("press release" OR "investor relations" OR "earnings report") after:${startDate} before:${endDate}\`
    5.  \`"Manuel Pangilinan" OR "Manny Pangilinan" OR "MVP" AND (PLDT OR Smart) AND ("announced" OR "said" OR "investment" OR "expansion") after:${startDate} before:${endDate}\`
    6.  \`(PLDT OR "PLDT Inc.") AND ("network outage" OR "service disruption" OR "cybersecurity" OR "customer complaint" OR "NTC complaint") after:${startDate} before:${endDate}\`
    7.  \`(PLDT OR "PLDT Inc.") AND ("cloud services" OR "enterprise" OR "SME" OR "corporate clients" OR "digital transformation") after:${startDate} before:${endDate}\`
    8.  \`(PLDT OR "PLDT Inc.") AND ("awards" OR "recognition") AND ("network quality" OR "fastest" OR "best") after:${startDate} before:${endDate}\`

*   **Key Executive Names to Search:**
    *   **PLDT:** "Manuel Pangilinan" OR "Manny Pangilinan" OR "MVP", "Alfredo Panlilio", "Anabelle Chua"
    *   **Globe:** "Ernest Cu", "Gerhard Tan"
    *   **Converge:** "Dennis Anthony Uy", "Maria Grace Uy"
    *   **DITO:** "Dennis Uy", "Adel Tamano"

**Phase 4: Final Review & Synthesis (Self-Correction Loop)**
*   **Goal:** Before generating the JSON, review all your findings.
*   **Critical Questions:** "Have I missed an angle? Have I over-relied on a single source for a major story? Could a different combination of keywords reveal something new? Is my final selection truly the most strategic news, or just the easiest to find?"

**Instructions for Output:**

*   After this exhaustive process, select up to three (3) of the most important articles for the "Global News" category and up to five (5) for the "General Industry News" category.
*   Your entire response MUST be a single, valid JSON object. No introductory text, comments, or markdown.
*   **CRITICAL JSON SYNTAX**: The JSON must be perfectly valid. Ensure there are **no trailing commas**. This is a mission-critical requirement.

**JSON Output Structure (Strictly Enforced):**

The top-level JSON object must have three keys: "internationalNews", "generalNews", and "companyNews".

- \`"internationalNews"\`: An array of article objects for global news with Philippine impact. If none found, return an empty array \`[]\`.
- \`"generalNews"\`: An array of article objects for the general industry news. If no important news is found, return an empty array \`[]\`.
- \`"companyNews"\`: An array of objects. **You MUST create an object for EACH of the four companies listed above.**
    *   Each object in this array must have two keys:
        *   \`"companyName"\`: The name of the company (e.g., "PLDT").
        *   \`"articles"\`: An array of article objects for that company. If, after a thorough search, you find no *important* news for a company that meets all verification criteria, this MUST be an empty array \`[]\`.

**Article Object Structure (must be exact):**
- "title": The exact title of the article.
- "date": The verified on-page date (e.g., "October 22, 2025").
- "summary": A concise summary of the article's main points.
- "takeaways": An array of exactly two distinct, insightful bullet points.
- "source": An object with "title" (source website name) and "uri" (the article's URL).
`;

export const fetchTelcoNews = async (startDate: string, endDate: string): Promise<{ data: NewsData }> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please set it in your environment.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = createPrompt(startDate, endDate);
    let responseText = '';

    try {
        console.log('Fetching telco news from Gemini API...');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2, // Lower temperature for more deterministic, factual output
            },
        });

        console.log('Response received:', {
            hasText: !!response.text,
            hasCandidates: !!response.candidates,
            candidatesLength: response.candidates?.length,
            finishReason: response.candidates?.[0]?.finishReason,
            fullResponse: JSON.stringify(response, null, 2)
        });

        responseText = response.text;
        if (!responseText) {
            // Check if there's a finish reason that explains the empty response
            const finishReason = response.candidates?.[0]?.finishReason;
            if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
                throw new Error(`API response blocked due to: ${finishReason}. Please try a different date range.`);
            }
            throw new Error("Received an empty response from the API. This might be due to rate limiting or API issues. Please try again in a moment.");
        }
        
        const startIndex = responseText.indexOf('{');
        const endIndex = responseText.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
            throw new Error(`Could not find a valid JSON object in the AI's response. Response text: "${responseText}"`);
        }

        const jsonString = responseText.substring(startIndex, endIndex + 1);
        const parsedData: NewsData = JSON.parse(jsonString);
        
        if (typeof parsedData !== 'object' || parsedData === null || 
            !Array.isArray(parsedData.internationalNews) ||
            !Array.isArray(parsedData.generalNews) || 
            !Array.isArray(parsedData.companyNews)) {
            throw new Error("API response is not in the expected NewsData format.");
        }


        for (const section of parsedData.companyNews) {
            if (typeof section.companyName !== 'string' || !Array.isArray(section.articles)) {
                throw new Error("A company news section is malformed.");
            }
        }

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const companyArticles = parsedData.companyNews.flatMap(section => section.articles);
            const allNews = [...parsedData.internationalNews, ...parsedData.generalNews, ...companyArticles];

            for (const article of allNews) {
                // Check if the URI is a problematic grounding redirect
                if (article.source.uri.includes('vertexaisearch.cloud.google.com')) {
                    // Find the correct grounding chunk by matching the article title.
                    // This is more reliable than matching the URI which we know is wrong.
                    const matchedChunk = groundingChunks.find(chunk => 
                        'web' in chunk && chunk.web.title && article.title.trim() === chunk.web.title.trim()
                    );

                    if (matchedChunk && 'web' in matchedChunk) {
                        // Found a match. Replace the broken URI with the correct one.
                        article.source.uri = matchedChunk.web.uri;
                        // Also update the source title for consistency.
                        article.source.title = matchedChunk.web.title;
                    } else {
                        // If exact match fails, try a more lenient search.
                        const lenientMatchedChunk = groundingChunks.find(chunk => 
                            'web' in chunk && chunk.web.title && 
                            (article.title.includes(chunk.web.title) || chunk.web.title.includes(article.title))
                        );
                        if (lenientMatchedChunk && 'web' in lenientMatchedChunk) {
                            article.source.uri = lenientMatchedChunk.web.uri;
                            article.source.title = lenientMatchedChunk.web.title;
                        } else {
                            // Log a warning if no match is found, the link will remain broken.
                            console.warn(`Could not fix a broken grounding link for article: "${article.title}" as no matching source was found in the metadata.`);
                        }
                    }
                }
            }
        }
        
        return { data: parsedData };

    } catch (error) {
        console.error("Error fetching or parsing telco news:", error);
        if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse the response from the AI. The format was invalid. Parser error: ${error.message}. Received text: "${responseText}"`);
        }
        throw new Error(`An error occurred while communicating with the Gemini API: ${error.message}`);
    }
};

const createPresentationPrompt = (newsData: NewsData, dateRange: string): string => `
You are a corporate communications expert and presentation designer for a major telecommunications company. Your task is to transform the provided JSON news data into a compelling and professional slide deck presentation. The presentation is for an internal executive briefing.

**Input News Data:**
${JSON.stringify(newsData, null, 2)}

**Instructions:**
1.  **Analyze the Data:** Carefully review all the news articles provided in the JSON.
2.  **Structure the Presentation:** Create a sequence of slides based on the following structure.
3.  **Be Concise:** Headlines and summaries should be clear, direct, and impactful for a busy executive audience.
4.  **Strategic Focus:** The "Significance" slide is the most important. Synthesize all the news to provide actionable insights.
5.  **Image Handling:**
    - Some articles may already have a \`thumbnailUrl\` field with an existing image URL.
    - For slides based on articles WITH a \`thumbnailUrl\`, include it in the slide's \`imageUrl\` field and still provide an \`imageDescription\`.
    - For slides without a \`thumbnailUrl\`, only provide an \`imageDescription\` (the image will be sourced later).
    - Image descriptions should be detailed, specific, and visually interesting for stock photo search. Example: "A sleek, modern fiber optic cable glowing with blue light against a dark, abstract background, symbolizing high-speed connectivity."
6.  **Output Format:** Your entire response MUST be a single, valid JSON object conforming to the specified structure. Do not include any introductory text, comments, or markdown. Ensure there are no trailing commas.

**Presentation Structure:**

1.  **Slide 1: Title Slide**
    *   Type: \`title\`
    *   Title: "Top Industry News"
    *   Subtitle: The date range: "${dateRange}"

2.  **PLDT News Slides**
    *   Identify the news for "PLDT" from the \`companyNews\` array.
    *   For each PLDT article, create one \`news\` slide.
    *   \`company\`: "PLDT"
    *   \`headline\`: A concise, powerful headline summarizing the article's core message.
    *   \`summary\`: A brief paragraph explaining the news.
    *   \`imageDescription\`: A short description for a relevant, professional stock photo WITHOUT ANY TEXT (e.g., "A modern data center with rows of servers glowing in blue light", "Business executives shaking hands in a modern office").
    *   \`sourceUrl\`: The exact URL from the article's \`source.uri\` field.
    *   \`sourceTitle\`: The source website name from the article's \`source.title\` field.

3.  **Philippines Market & Global Industry News Slides**
    *   Identify articles from \`generalNews\` (Philippines market news) and \`internationalNews\` (global industry news).
    *   These should appear UNDER "Top Industry News" section, NOT in the competitor section.
    *   For each article, create one \`news\` slide.
    *   \`company\`: Leave undefined or set to "Philippines Market" for generalNews, "Global Industry" for internationalNews.
    *   \`headline\`: A concise, powerful headline summarizing the article's core message.
    *   \`summary\`: A brief paragraph explaining the news.
    *   \`imageDescription\`: A short description for a relevant, professional stock photo WITHOUT ANY TEXT.
    *   \`sourceUrl\`: The exact URL from the article's \`source.uri\` field.
    *   \`sourceTitle\`: The source website name from the article's \`source.title\` field.

4.  **Slide N: Competitor Title Slide**
    *   Type: \`title\`
    *   Title: "Top Competitor News"
    *   Subtitle: The date range: "${dateRange}"

5.  **Competitor News Slides**
    *   Identify news for "Globe Telecom", "Converge ICT", and "DITO Telecommunity" ONLY.
    *   DO NOT include generalNews or internationalNews here - they belong in the Industry section above.
    *   For each significant competitor article, create one \`news\` slide with the same structure as the PLDT slides (\`company\`, \`headline\`, \`summary\`, \`imageDescription\`, \`sourceUrl\`, \`sourceTitle\`).

6.  **Slide X: Significance Slide**
    *   Type: \`significance\`
    *   Title: "Significance to Our Business"
    *   Analyze ALL the provided news items collectively.
    *   Generate an array of 5 insightful bullet points in the \`points\` field, explaining the strategic implications. These points should cover:
        *   Market reach and competitive positioning.
        *   Financial implications or opportunities.
        *   Regulatory and market protection efforts.
        *   Pressure for innovation and infrastructure development.
        *   New opportunities or potential threats.

7.  **Final Slide: End Slide**
    *   Type: \`end\`
    *   Title: "End of Report"

**JSON Output Structure (must be exact):**
\`\`\`json
{
  "slides": [
    {
      "type": "title",
      "title": "...",
      "subtitle": "..."
    },
    {
      "type": "news",
      "company": "PLDT",
      "headline": "...",
      "summary": "...",
      "imageDescription": "...",
      "imageUrl": "..." // Optional: Include if article had thumbnailUrl
      "sourceUrl": "...",
      "sourceTitle": "..."
    },
    // ... more slides
    {
      "type": "significance",
      "title": "Significance to Our Business",
      "points": [
        "...",
        "..."
      ]
    },
    {
      "type": "end",
      "title": "End of Report"
    }
  ]
}
\`\`\`
`;


/**
 * Searches Unsplash for a relevant image based on keywords
 */
const searchUnsplashImage = async (searchQuery: string): Promise<string | null> => {
    // Note: Unsplash API requires an API key. For now, we'll use a fallback approach.
    // Users can set VITE_UNSPLASH_ACCESS_KEY environment variable to enable this feature.
    const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

    if (!accessKey) {
        console.log('Unsplash API key not set. Skipping image search.');
        return null;
    }

    try {
        const query = encodeURIComponent(searchQuery);
        const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Client-ID ${accessKey}`
            }
        });

        if (!response.ok) {
            console.warn(`Unsplash API returned ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const imageUrl = data.results[0].urls.regular; // 1080px width
            console.log(`Found Unsplash image: ${imageUrl}`);
            return imageUrl;
        }

        return null;
    } catch (error) {
        console.error(`Unsplash search failed: ${error.message}`);
        return null;
    }
};

/**
 * Searches Pexels for a relevant image based on keywords
 * Pexels offers instant API access with 200 requests/hour
 */
const searchPexelsImage = async (searchQuery: string): Promise<string | null> => {
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;

    if (!apiKey) {
        console.log('Pexels API key not set. Skipping Pexels search.');
        return null;
    }

    try {
        const query = encodeURIComponent(searchQuery);
        const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;

        const response = await fetch(url, {
            headers: {
                'Authorization': apiKey
            }
        });

        if (!response.ok) {
            console.warn(`Pexels API returned ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.photos && data.photos.length > 0) {
            const imageUrl = data.photos[0].src.large; // 1280px width
            console.log(`Found Pexels image: ${imageUrl}`);
            return imageUrl;
        }

        return null;
    } catch (error) {
        console.error(`Pexels search failed: ${error.message}`);
        return null;
    }
};

/**
 * Finds or uses an existing image for an article slide
 * Priority: 1) Existing imageUrl (from BuzzSumo), 2) Pexels search, 3) Unsplash search
 */
const findImageForArticle = async (slide: { imageUrl?: string; headline: string; imageDescription: string }): Promise<string | null> => {
    try {
        // Priority 1: Use existing imageUrl if available (from BuzzSumo thumbnail)
        if (slide.imageUrl) {
            console.log(`Using existing thumbnail for: "${slide.headline}"`);
            return slide.imageUrl;
        }

        // Extract key terms from headline for better search results
        const searchTerms = slide.headline
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(' ')
            .filter(word => word.length > 4 && !['about', 'their', 'which', 'where', 'these'].includes(word))
            .slice(0, 3) // Use top 3 meaningful words
            .join(' ');

        const searchQuery = `${searchTerms} technology business`;

        // Priority 2: Search Pexels (instant access, 200 req/hour)
        console.log(`Searching Pexels for: "${slide.headline}"`);
        const pexelsUrl = await searchPexelsImage(searchQuery);
        if (pexelsUrl) {
            return pexelsUrl;
        }

        // Priority 3: Search Unsplash as fallback (requires approval, 50 req/hour)
        console.log(`Searching Unsplash for: "${slide.headline}"`);
        const unsplashUrl = await searchUnsplashImage(searchQuery);
        if (unsplashUrl) {
            return unsplashUrl;
        }

        console.warn(`No image found for: "${slide.headline}"`);
        return null;
    } catch (error) {
        console.error(`Failed to find image for headline: "${slide.headline}"`, error);
        return null;
    }
};


export const generatePresentationFromNews = async (newsData: NewsData, dateRange: string): Promise<Presentation> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = createPresentationPrompt(newsData, dateRange);
    let responseText = '';

    try {
        console.log('Generating presentation from Gemini API...');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.3,
            },
        });

        console.log('Presentation response received:', {
            hasText: !!response.text,
            hasCandidates: !!response.candidates,
            candidatesLength: response.candidates?.length,
            finishReason: response.candidates?.[0]?.finishReason
        });

        responseText = response.text;
        if (!responseText) {
            const finishReason = response.candidates?.[0]?.finishReason;
            if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
                throw new Error(`Presentation generation blocked due to: ${finishReason}. Please try again.`);
            }
            throw new Error("Received an empty response from the API while generating presentation. Please try again in a moment.");
        }

        const startIndex = responseText.indexOf('{');
        const endIndex = responseText.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
            throw new Error(`Could not find a valid JSON object in the AI's presentation response. Response text: "${responseText}"`);
        }

        const jsonString = responseText.substring(startIndex, endIndex + 1);
        const presentationStructure: Presentation = JSON.parse(jsonString);

        if (!presentationStructure || !Array.isArray(presentationStructure.slides)) {
             throw new Error("API response for presentation is not in the expected format.");
        }

        // Find images for all news slides sequentially to avoid rate limiting
        const slidesWithImages: Slide[] = [];
        for (const slide of presentationStructure.slides) {
            if (slide.type === 'news') {
                // Check if slide already has imageUrl or search for one
                const imageUrl = await findImageForArticle(slide);
                slidesWithImages.push({ ...slide, imageUrl: imageUrl || slide.imageUrl || undefined });
            } else {
                slidesWithImages.push(slide);
            }
        }

        return { ...presentationStructure, slides: slidesWithImages };

    } catch (error) {
        console.error("Error fetching or parsing presentation data:", error);
        if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse the presentation response from the AI. The format was invalid. Parser error: ${error.message}. Received text: "${responseText}"`);
        }
        throw new Error(`An error occurred while generating the presentation: ${error.message}`);
    }
};