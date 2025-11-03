export interface NewsArticle {
  title: string;
  date: string;
  summary: string;
  takeaways: string[];
  source: {
    title: string;
    uri: string;
  };
  thumbnailUrl?: string; // From BuzzSumo or other sources
}

export interface CompanyNewsSection {
  companyName: string;
  articles: NewsArticle[];
}

export interface NewsData {
  internationalNews: NewsArticle[];
  generalNews: NewsArticle[];
  companyNews: CompanyNewsSection[];
}

// Types for the Presentation feature
export type Slide =
  | {
      type: 'title';
      title: string;
      subtitle: string;
    }
  | {
      type: 'news';
      company?: string;
      headline: string;
      summary: string;
      imageDescription: string;
      imageUrl?: string;
      sourceUrl?: string;
      sourceTitle?: string;
    }
  | {
      type: 'significance';
      title: string;
      points: string[];
    }
  | {
      type: 'end';
      title: string;
    };

export interface Presentation {
  slides: Slide[];
}

// BuzzSumo types
export interface EngagementMetrics {
  total_shares: number;
  facebook_shares?: number;
  pinterest_shares?: number;
  twitter_shares?: number;
  total_links?: number;
  evergreen_score?: number;
}

export interface BuzzSumoArticle {
  title: string;
  url: string;
  published_date: string;
  author?: string;
  domain_name: string;
  engagement: EngagementMetrics;
  thumbnail?: string;
  excerpt?: string;
}

export interface BuzzSumoResponse {
  results: BuzzSumoArticle[];
  total_results?: number;
}

export type NewsSource = 'google' | 'buzzsumo';