import type { Article, ArticleFilter, PaginationResult } from '../types';

export class DatabaseService {
  constructor(private db: D1Database) {}

  async saveArticle(article: Omit<Article, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO articles (title, url, published_date, feed_source, original_content, summary_ja)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(
      article.title,
      article.url,
      article.published_date,
      article.feed_source,
      article.original_content || null,
      article.summary_ja || null
    ).run();

    return result.meta.last_row_id as number;
  }

  async getArticles(filter: ArticleFilter = {}): Promise<PaginationResult<Article>> {
    const { source, page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM articles';
    let countQuery = 'SELECT COUNT(*) as count FROM articles';
    const params: any[] = [];

    if (source && source !== 'all') {
      query += ' WHERE feed_source = ?';
      countQuery += ' WHERE feed_source = ?';
      params.push(source);
    }

    query += ' ORDER BY published_date DESC LIMIT ? OFFSET ?';
    const queryParams = [...params, limit, offset];

    const [articlesResult, countResult] = await Promise.all([
      this.db.prepare(query).bind(...queryParams).all(),
      this.db.prepare(countQuery).bind(...params).first()
    ]);

    const total = (countResult as any)?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: articlesResult.results as unknown as Article[],
      total,
      page,
      limit,
      totalPages
    };
  }

  async getArticleByUrl(url: string): Promise<Article | null> {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE url = ?');
    const result = await stmt.bind(url).first();
    return result as Article | null;
  }

  async updateArticleSummary(articleId: number, summary: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE articles SET summary_ja = ?, updated_at = ? WHERE id = ?
    `);
    const now = new Date().toISOString();
    await stmt.bind(summary, now, articleId).run();
  }

  async getArticleCount(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM articles');
    const result = await stmt.first();
    return (result as any)?.count || 0;
  }

  async deleteOldArticles(daysToKeep: number = 365): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const stmt = this.db.prepare(`
      DELETE FROM articles WHERE created_at < ?
    `);
    await stmt.bind(cutoffDate.toISOString()).run();
  }
}