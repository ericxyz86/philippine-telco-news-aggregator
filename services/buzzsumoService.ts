import { BuzzSumoArticle, BuzzSumoResponse } from "../types";

/**
 * BuzzSumo API service for fetching trending and popular Philippine telco news
 */

const BUZZSUMO_API_BASE = "https://api.buzzsumo.com/search/articles.json";

interface BuzzSumoSearchParams {
  query: string;
  startDate: string;
  endDate: string;
  limit?: number;
  country?: string;
}

/**
 * Converts date string to BuzzSumo format (Unix timestamp)
 */
const dateToUnixTimestamp = (dateString: string): number => {
  return Math.floor(new Date(dateString).getTime() / 1000);
};

/**
 * Formats Unix timestamp to readable date
 */
const formatDate = (unixTimestamp: number): string => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Fetches trending Philippine telco news from BuzzSumo API
 */
export const fetchBuzzSumoNews = async ({
  query,
  startDate,
  endDate,
  limit = 10,
  country,
}: BuzzSumoSearchParams): Promise<BuzzSumoArticle[]> => {
  if (!process.env.BUZZSUMO_API_KEY) {
    throw new Error("BUZZSUMO_API_KEY environment variable not set. Please set it in your environment.");
  }

  try {
    const beginTimestamp = dateToUnixTimestamp(startDate);
    const endTimestamp = dateToUnixTimestamp(endDate);

    // Build query parameters - API key is passed as a query parameter
    const paramsObj: Record<string, string> = {
      q: query,
      begin_date: beginTimestamp.toString(),
      end_date: endTimestamp.toString(),
      num_results: limit.toString(),
      page: "0",
      api_key: process.env.BUZZSUMO_API_KEY || "",
    };

    // Add country filter if specified
    if (country) {
      paramsObj.country = country;
    }

    const params = new URLSearchParams(paramsObj);

    const url = `${BUZZSUMO_API_BASE}?${params.toString()}`;

    console.log(`Fetching BuzzSumo news: ${query}`);

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `BuzzSumo API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    // Parse and transform BuzzSumo response to our format
    const articles: BuzzSumoArticle[] = (data.results || []).map((item: any) => ({
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
  } catch (error) {
    console.error("Error fetching BuzzSumo news:", error);
    throw new Error(`Failed to fetch BuzzSumo news: ${error.message}`);
  }
};

/**
 * Fetches comprehensive Philippine telco news from BuzzSumo Content Analyzer
 * Uses boolean search operators with country filtering and negative keywords to exclude sports content
 */
export const fetchPhilippineTelcoNews = async (
  startDate: string,
  endDate: string
): Promise<BuzzSumoArticle[]> => {
  // Comprehensive boolean query covering all major Philippine telco companies and terms
  // Excludes sports content (basketball, volleyball) that causes false positives
  const comprehensiveQuery =
    'telecom OR telecoms OR telecommunications OR dict OR ntc OR ' +
    '"globe telecom" OR "dito telecoms" OR "dito telecommunity" OR ' +
    '"converge ict" OR "smart communications" OR pldt OR "sky fiber" OR ' +
    'globe OR smart OR converge OR dito ' +
    '-golden -pvl -pba -basketball -volleyball -nba -fiba -uaap -ncaa ' +
    '-gilas -"converge fiberxers" -traded -debut -match -"high speed hitters"';

  try {
    // Single comprehensive search with country filter
    // Fetch more articles since we have aggressive filtering
    const articles = await fetchBuzzSumoNews({
      query: comprehensiveQuery,
      startDate,
      endDate,
      country: "Philippines",
      limit: 50, // Increased limit for more comprehensive results
    });

    // Remove duplicates based on URL
    const uniqueArticles = deduplicateArticles(articles);

    // Filter for important articles only (exclude sports, YouTube, low-importance)
    const importantArticles = filterImportantArticles(uniqueArticles);

    // Sort by total shares (most popular first)
    importantArticles.sort((a, b) =>
      b.engagement.total_shares - a.engagement.total_shares
    );

    // Return top 15 articles
    return importantArticles.slice(0, 15);
  } catch (error) {
    console.error("Error in fetchPhilippineTelcoNews:", error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
};

/**
 * Removes duplicate articles based on URL
 */
const deduplicateArticles = (articles: BuzzSumoArticle[]): BuzzSumoArticle[] => {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const normalizedUrl = article.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(normalizedUrl)) {
      return false;
    }
    seen.add(normalizedUrl);
    return true;
  });
};

/**
 * Validates that articles with ambiguous terms are actually about Philippine telco companies
 * Filters out false positives like "smart meter", "dito" (Tagalog for "here"), etc.
 */
const validateTelcoRelevance = (article: BuzzSumoArticle): boolean => {
  const title = article.title.toLowerCase();
  const excerpt = (article.excerpt || '').toLowerCase();
  const combined = `${title} ${excerpt}`;

  // Telco company indicators
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

    // If title has "smart" + false positive term, check if there's telco context
    if (smartFalsePositives.some(fp => title.includes(fp))) {
      // Require strong telco indicators if "smart" is ambiguous
      const hasTelcoContext = telcoCompanyIndicators.some(indicator =>
        combined.includes(indicator)
      );
      if (!hasTelcoContext) {
        return false;
      }
    }
  }

  // Check for ambiguous "dito" usage (Tagalog word meaning "here")
  if (title.includes('dito') && !title.includes('dito telecom') && !title.includes('dito network')) {
    const ditoFalsePositives = [
      'dito sa', 'dito ang', 'dito na', 'dito pa',
      'pumunta dito', 'magtungo dito', 'dumating dito'
    ];

    if (ditoFalsePositives.some(fp => title.includes(fp))) {
      return false;
    }

    // If "dito" appears alone, require telco context
    const words = title.split(/\s+/);
    const ditoIndex = words.findIndex(w => w.includes('dito'));
    if (ditoIndex !== -1) {
      // Check if it's likely Tagalog usage (not part of "Dito Telecommunity")
      const nextWord = words[ditoIndex + 1];
      const prevWord = words[ditoIndex - 1];

      // Common Tagalog patterns
      if (nextWord && ['sa', 'ang', 'na', 'pa', 'ay'].includes(nextWord)) {
        return false;
      }

      // Require telco context for standalone "dito"
      const hasTelcoContext = telcoCompanyIndicators.some(indicator =>
        combined.includes(indicator)
      );
      if (!hasTelcoContext) {
        return false;
      }
    }
  }

  // Check for ambiguous "globe" usage
  if (title.includes('globe') && !title.includes('globe telecom')) {
    const globeFalsePositives = [
      'vendée globe', 'golden globe', 'globe award',
      'around the globe', 'across the globe', 'globe trot'
    ];

    if (globeFalsePositives.some(fp => title.includes(fp))) {
      return false;
    }
  }

  // Check for ambiguous "converge" usage
  if (title.includes('converge') && !title.includes('converge ict')) {
    const convergeFalsePositives = [
      'fiberxers', 'fiber xers', 'basketball', 'pba'
    ];

    if (convergeFalsePositives.some(fp => title.includes(fp))) {
      return false;
    }
  }

  return true;
};

/**
 * Filters BuzzSumo articles to show only important news (similar to Gemini filtering)
 * Excludes sports, YouTube, and low-importance content
 */
const filterImportantArticles = (articles: BuzzSumoArticle[]): BuzzSumoArticle[] => {
  return articles.filter((article) => {
    const title = article.title.toLowerCase();
    const url = article.url.toLowerCase();
    const domain = article.domain_name.toLowerCase();

    // FIRST: Validate telco relevance (filter out false positives)
    if (!validateTelcoRelevance(article)) {
      return false;
    }

    // EXCLUDE: YouTube videos
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return false;
    }

    // EXCLUDE: Sports content (comprehensive list)
    const sportsKeywords = [
      'pba', 'pvl', 'uaap', 'ncaa', 'nba', 'fiba',
      'basketball', 'volleyball', 'gilas',
      'traded', 'debut', 'match', 'game', 'score',
      'fiberxers', 'high speed hitters', 'tropang',
      'golden', 'tournament', 'championship', 'playoffs',
      'injured', 'injures', 'triple-double', 'season',
      'coach', 'player', 'team', 'win', 'loss', 'defeat'
    ];

    if (sportsKeywords.some(keyword => title.includes(keyword))) {
      return false;
    }

    // EXCLUDE: Low-importance content
    const lowImportanceKeywords = [
      'promo', 'sale', 'discount', 'voucher', 'giveaway',
      'celebrity', 'endorsement', 'ambassador',
      'raffle', 'contest', 'prize',
      'csr', 'charity', 'donation', 'scholarship',
      'award ceremony', 'recognition event',
      'new plan', 'price cut', 'special offer',
      'bundle', 'freebie', 'limited time'
    ];

    if (lowImportanceKeywords.some(keyword => title.includes(keyword))) {
      return false;
    }

    // INCLUDE: High-importance indicators
    const highImportanceKeywords = [
      // Infrastructure & Investment
      'billion', 'million', 'investment', 'capex',
      'infrastructure', 'subsea cable', 'fiber', 'data center',
      'network expansion', 'rollout', 'deployment',

      // Regulatory & Policy
      'dict', 'ntc', 'regulatory', 'policy', 'law',
      'spectrum', 'license', 'permit', 'circular',

      // Technology
      '5g', 'fiber', 'broadband', 'satellite', 'starlink',
      'cybersecurity', 'breach', 'hack', 'outage',

      // Corporate & Financial
      'merger', 'acquisition', 'partnership', 'alliance',
      'earnings', 'revenue', 'profit', 'quarterly',
      'stock', 'ipo', 'shares',

      // Service Issues
      'outage', 'disruption', 'complaint', 'npc',
      'data breach', 'privacy', 'security'
    ];

    // Article is important if it contains at least one high-importance keyword
    const hasImportantKeyword = highImportanceKeywords.some(keyword =>
      title.includes(keyword)
    );

    // Also include if domain is a major Philippine news source
    const majorNewsSources = [
      'philstar.com', 'mb.com.ph', 'bworldonline.com',
      'rappler.com', 'inquirer.net', 'gmanetwork.com',
      'abs-cbn.com', 'manilatimes.net', 'manilabulletin.com',
      'newsbytes.ph', 'bilyonaryo.com'
    ];

    const isMajorNewsSource = majorNewsSources.some(source =>
      domain.includes(source)
    );

    // Keep if it has important keywords OR is from a major news source covering telco
    return hasImportantKeyword || (isMajorNewsSource && !title.includes('ad') && !title.includes('sponsored'));
  });
};
