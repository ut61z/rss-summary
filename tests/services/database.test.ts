import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DatabaseService } from '../../src/services/database';
import type { Article, ArticleFilter, PaginationResult } from '../../src/types';

describe('DatabaseService', () => {
  let mockDB: any;
  let databaseService: DatabaseService;
  let mockRun: any;
  let mockBind: any;
  let mockPrepare: any;
  let mockAll: any;
  let mockFirst: any;

  beforeEach(() => {
    mockRun = mock(() => Promise.resolve({ success: true, meta: { last_row_id: 1 } }));
    mockAll = mock(() => Promise.resolve([]));
    mockFirst = mock(() => Promise.resolve(null));
    mockBind = mock(() => ({ run: mockRun, all: mockAll, first: mockFirst }));
    mockPrepare = mock(() => ({ bind: mockBind }));
    
    mockDB = {
      prepare: mockPrepare
    };
    databaseService = new DatabaseService(mockDB);
  });

  describe('saveArticle', () => {
    it('should save new article to database', async () => {
      const article = {
        title: 'Test Article',
        url: 'https://example.com/test',
        published_date: '2024-01-01',
        feed_source: 'aws' as const,
        original_content: 'Test content',
        summary_ja: 'テスト要約'
      };

      const result = await databaseService.saveArticle(article);

      expect(mockPrepare).toHaveBeenCalledWith(`
      INSERT INTO articles (title, url, published_date, feed_source, original_content, summary_ja)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
      expect(mockBind).toHaveBeenCalledWith(
        article.title,
        article.url,
        article.published_date,
        article.feed_source,
        article.original_content,
        article.summary_ja
      );
      expect(result).toBe(1);
    });

    it('should handle duplicate URLs gracefully', async () => {
      mockRun.mockRejectedValue(new Error('UNIQUE constraint failed: articles.url'));

      const article = {
        title: 'Test Article',
        url: 'https://example.com/test',
        published_date: '2024-01-01',
        feed_source: 'aws' as const
      };

      await expect(databaseService.saveArticle(article)).rejects.toThrow('UNIQUE constraint failed');
    });
  });

  describe('getArticles', () => {
    it('should retrieve articles with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article 1',
          url: 'https://example.com/1',
          published_date: '2024-01-01',
          feed_source: 'aws' as const,
          original_content: 'Content 1',
          summary_ja: '要約1',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      mockAll.mockReturnValue(Promise.resolve({ results: mockArticles }));
      mockFirst.mockReturnValue(Promise.resolve({ count: 1 }));

      const filter: ArticleFilter = { page: 1, limit: 10 };
      const result = await databaseService.getArticles(filter);

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM articles ORDER BY published_date DESC LIMIT ? OFFSET ?'
      );
      expect(mockBind).toHaveBeenCalledWith(10, 0);
      expect(result.data).toEqual(mockArticles);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter articles by source', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'AWS Article',
          url: 'https://aws.amazon.com/1',
          published_date: '2024-01-01',
          feed_source: 'aws' as const,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      mockAll.mockReturnValue(Promise.resolve({ results: mockArticles }));
      mockFirst.mockReturnValue(Promise.resolve({ count: 1 }));

      const filter: ArticleFilter = { source: 'aws', page: 1, limit: 10 };
      const result = await databaseService.getArticles(filter);

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM articles WHERE feed_source = ? ORDER BY published_date DESC LIMIT ? OFFSET ?'
      );
      expect(mockBind).toHaveBeenCalledWith('aws', 10, 0);
    });
  });

  describe('getArticleByUrl', () => {
    it('should retrieve article by URL', async () => {
      const mockArticle = {
        id: 1,
        title: 'Test Article',
        url: 'https://example.com/test',
        published_date: '2024-01-01',
        feed_source: 'aws' as const,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z'
      };

      mockFirst.mockReturnValue(Promise.resolve(mockArticle));

      const result = await databaseService.getArticleByUrl('https://example.com/test');

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM articles WHERE url = ?'
      );
      expect(mockBind).toHaveBeenCalledWith('https://example.com/test');
      expect(result).toEqual(mockArticle);
    });

    it('should return null for non-existent URL', async () => {
      mockFirst.mockReturnValue(Promise.resolve(null));

      const result = await databaseService.getArticleByUrl('https://example.com/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateArticleSummary', () => {
    it('should update article summary', async () => {
      const articleId = 1;
      const summary = 'Updated summary';

      await databaseService.updateArticleSummary(articleId, summary);

      expect(mockPrepare).toHaveBeenCalledWith(`
      UPDATE articles SET summary_ja = ?, updated_at = ? WHERE id = ?
    `);
      expect(mockBind).toHaveBeenCalledWith(
        summary,
        expect.any(String),
        articleId
      );
    });
  });

  describe('database operation failures', () => {
    it('should handle database errors', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const article = {
        title: 'Test',
        url: 'https://test.com',
        published_date: '2024-01-01',
        feed_source: 'aws' as const
      };

      await expect(databaseService.saveArticle(article)).rejects.toThrow('Database connection failed');
    });
  });
});