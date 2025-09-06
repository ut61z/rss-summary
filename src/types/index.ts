export interface Article {
  id: number;
  title: string;
  url: string;
  published_date: string;
  feed_source: 'aws' | 'martinfowler';
  original_content?: string;
  summary_ja?: string;
  created_at: string;
  updated_at: string;
}

export interface RSSFeedItem {
  title: string;
  url: string;
  published_date: string;
  content?: string;
}

export interface LogEntry {
  id?: number;
  level: 'info' | 'error' | 'warn';
  message: string;
  details?: string;
  created_at?: string;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Environment {
  DB: D1Database;
  GEMINI_API_KEY: string;
  DISCORD_WEBHOOK_URL?: string;
  ENVIRONMENT: string;
  ADMIN_TOKEN?: string;
}

export interface ArticleFilter {
  source?: 'aws' | 'martinfowler' | 'all';
  page?: number;
  limit?: number;
}

export interface SummaryRequest {
  title: string;
  content: string;
}

export interface SummaryResponse {
  summary: string;
}
