export interface Source {
  id: string;
  name: string;
  slug: string;
  url: string;
  country_code: string;
  region: Region;
  funding_model: FundingModel;
  editorial_lean: EditorialLean;
  factual_rating: FactualRating;
  ownership: string;
  article_count_24h?: number;
}

export interface TopicScore {
  topic: string;
  sub_topic: string;
  confidence: number;
}

export interface Article {
  id: string;
  title: string;
  original_title?: string | null;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  language: string | null;
  topic: string | null;
  sub_topic: string | null;
  topics?: TopicScore[];
  published_at: string | null;
  ingested_at: string;
  source: Source;
}

export interface StoryCluster {
  id: string;
  canonical_title: string | null;
  summary: string | null;
  topic: string | null;
  sub_topic: string | null;
  topics: TopicScore[];
  source_count: number;
  country_count: number;
  region_count: number;
  significance: number;
  velocity: number;
  acceleration: number;
  hours_since_update: number;
  regions: Region[];
  countries: string[];
  article_count: number;
  image_url: string | null;
  framing_type: 'multi_region' | 'multi_lean' | 'multi_country' | 'full' | null;
  first_seen: string;
  last_updated: string;
}

export interface StoryDetail extends StoryCluster {
  articles: Article[];
  articles_by_region: Record<string, Article[]>;
}

export interface FramingAnalysis {
  story_id: string;
  canonical_title: string | null;
  framing_analysis: string | null;
  source_count?: number;
  region_count?: number;
  regions?: Region[];
  ai_generated: boolean;
  message?: string;
}

export interface RegionStat {
  region: Region;
  count: number;
}

export interface TopicStat {
  topic: string;
  count: number;
}

export interface OverviewStats {
  total_articles: number;
  articles_last_24h: number;
  active_sources: number;
  topics: TopicStat[];
  regions: RegionStat[];
}

export type Region = 'americas' | 'europe' | 'asia_pacific' | 'mideast_africa';
export type FundingModel = 'state_funded' | 'public' | 'private' | 'nonprofit' | 'unknown';
export type EditorialLean = 'left' | 'center_left' | 'center' | 'center_right' | 'right' | 'unknown';
export type FactualRating = 'very_high' | 'high' | 'mostly_factual' | 'mixed' | 'low' | 'unknown';

export interface PsychologyTactic {
  name: string;
  count: number;
  percentage: number;
  description: string;
  why_used: string;
  examples: string[];
}

export interface PsychologyMap {
  tactics: PsychologyTactic[];
  story_count: number;
  generated_at: string;
  error?: string;
}
