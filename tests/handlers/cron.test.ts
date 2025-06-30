import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CronHandler } from '../../src/handlers/cron';
import type { RSSFeedItem, Article } from '../../src/types';

describe('CronHandler', () => {
  let cronHandler: CronHandler;
  let mockLogger: any;
  let mockDatabase: any;
  let mockRSSFetcher: any;
  let mockAISummarizer: any;
  let mockDiscordNotifier: any;

  beforeEach(() => {
    mockLogger = {
      info: mock(),
      error: mock(),
      warn: mock()
    };

    mockDatabase = {
      getArticleByUrl: mock(),
      saveArticle: mock(),
      updateArticleSummary: mock()
    };

    mockRSSFetcher = {
      fetchAllFeeds: mock()
    };

    mockAISummarizer = {
      summarizeArticle: mock()
    };

    mockDiscordNotifier = {
      notifyMultipleArticles: mock(),
      notifyNewArticle: mock()
    };

    cronHandler = new CronHandler(
      mockLogger,
      mockDatabase,
      mockRSSFetcher,
      mockAISummarizer,
      mockDiscordNotifier
    );
  });

  describe('handleScheduledEvent', () => {
    it('should process RSS feeds and save new articles', async () => {
      const mockFeeds = {
        aws: [
          {
            title: 'AWS Article 1',
            url: 'https://aws.amazon.com/article1',
            published_date: '2024-01-01T10:00:00.000Z',
            content: 'AWS content 1'
          }
        ],
        martinfowler: [
          {
            title: 'Martin Fowler Article 1',
            url: 'https://martinfowler.com/article1',
            published_date: '2024-01-01T11:00:00.000Z',
            content: 'Martin Fowler content 1'
          }
        ]
      };

      const mockSummary = {
        summary: 'AWS新機能の要約'
      };

      mockRSSFetcher.fetchAllFeeds.mockResolvedValue(mockFeeds);
      mockDatabase.getArticleByUrl.mockResolvedValue(null); // Article doesn't exist
      mockDatabase.saveArticle.mockResolvedValue(1);
      mockAISummarizer.summarizeArticle.mockResolvedValue(mockSummary);

      await cronHandler.handleScheduledEvent();

      expect(mockRSSFetcher.fetchAllFeeds).toHaveBeenCalled();
      expect(mockDatabase.getArticleByUrl).toHaveBeenCalledTimes(2);
      expect(mockDatabase.saveArticle).toHaveBeenCalledTimes(2);
      expect(mockAISummarizer.summarizeArticle).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('RSS feed update completed successfully', expect.any(Object));
    });

    it('should skip existing articles', async () => {
      const mockFeeds = {
        aws: [
          {
            title: 'Existing AWS Article',
            url: 'https://aws.amazon.com/existing',
            published_date: '2024-01-01T10:00:00.000Z',
            content: 'Existing content'
          }
        ],
        martinfowler: []
      };

      const existingArticle = {
        id: 1,
        title: 'Existing AWS Article',
        url: 'https://aws.amazon.com/existing',
        published_date: '2024-01-01T10:00:00.000Z',
        feed_source: 'aws',
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-01T10:00:00.000Z'
      };

      mockRSSFetcher.fetchAllFeeds.mockResolvedValue(mockFeeds);
      mockDatabase.getArticleByUrl.mockResolvedValue(existingArticle);

      await cronHandler.handleScheduledEvent();

      expect(mockDatabase.getArticleByUrl).toHaveBeenCalledWith('https://aws.amazon.com/existing');
      expect(mockDatabase.saveArticle).not.toHaveBeenCalled();
      expect(mockAISummarizer.summarizeArticle).not.toHaveBeenCalled();
    });

    it('should handle RSS fetch failures gracefully', async () => {
      mockRSSFetcher.fetchAllFeeds.mockRejectedValue(new Error('RSS fetch failed'));

      await expect(cronHandler.handleScheduledEvent()).rejects.toThrow('RSS fetch failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update RSS feeds',
        { error: 'RSS fetch failed' }
      );
    });

    it('should handle individual article processing failures', async () => {
      const mockFeeds = {
        aws: [
          {
            title: 'Problematic Article',
            url: 'https://aws.amazon.com/problematic',
            published_date: '2024-01-01T10:00:00.000Z',
            content: 'Content'
          }
        ],
        martinfowler: []
      };

      mockRSSFetcher.fetchAllFeeds.mockResolvedValue(mockFeeds);
      mockDatabase.getArticleByUrl.mockResolvedValue(null);
      mockDatabase.saveArticle.mockRejectedValue(new Error('Database error'));

      await cronHandler.handleScheduledEvent();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process article',
        expect.objectContaining({
          url: 'https://aws.amazon.com/problematic',
          error: 'Database error'
        })
      );
    });

    it('should continue processing other articles after individual failures', async () => {
      const mockFeeds = {
        aws: [
          {
            title: 'Failed Article',
            url: 'https://aws.amazon.com/failed',
            published_date: '2024-01-01T10:00:00.000Z',
            content: 'Content'
          },
          {
            title: 'Success Article',
            url: 'https://aws.amazon.com/success',
            published_date: '2024-01-01T11:00:00.000Z',
            content: 'Content'
          }
        ],
        martinfowler: []
      };

      mockRSSFetcher.fetchAllFeeds.mockResolvedValue(mockFeeds);
      mockDatabase.getArticleByUrl.mockResolvedValue(null);
      mockDatabase.saveArticle
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(2);
      mockAISummarizer.summarizeArticle.mockResolvedValue({ summary: '要約' });

      await cronHandler.handleScheduledEvent();

      expect(mockDatabase.saveArticle).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('RSS feed update completed successfully', expect.any(Object));
    });

    it('should handle AI summarization failures by saving article without summary', async () => {
      const mockFeeds = {
        aws: [
          {
            title: 'AI Failed Article',
            url: 'https://aws.amazon.com/ai-failed',
            published_date: '2024-01-01T10:00:00.000Z',
            content: 'Content'
          }
        ],
        martinfowler: []
      };

      mockRSSFetcher.fetchAllFeeds.mockResolvedValue(mockFeeds);
      mockDatabase.getArticleByUrl.mockResolvedValue(null);
      mockDatabase.saveArticle.mockResolvedValue(1);
      mockAISummarizer.summarizeArticle.mockRejectedValue(new Error('AI service down'));

      await cronHandler.handleScheduledEvent();

      expect(mockDatabase.saveArticle).toHaveBeenCalledWith({
        title: 'AI Failed Article',
        url: 'https://aws.amazon.com/ai-failed',
        published_date: '2024-01-01T10:00:00.000Z',
        feed_source: 'aws',
        original_content: 'Content',
        summary_ja: undefined
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to generate summary for article',
        expect.objectContaining({
          url: 'https://aws.amazon.com/ai-failed',
          error: 'AI service down'
        })
      );
    });
  });

  describe('processArticle', () => {
    it('should process a single article correctly', async () => {
      const article: RSSFeedItem = {
        title: 'Test Article',
        url: 'https://example.com/test',
        published_date: '2024-01-01T10:00:00.000Z',
        content: 'Test content'
      };

      const mockSummary = { summary: 'テスト要約' };

      mockDatabase.getArticleByUrl.mockResolvedValue(null);
      mockDatabase.saveArticle.mockResolvedValue(1);
      mockAISummarizer.summarizeArticle.mockResolvedValue(mockSummary);

      const result = await cronHandler.processArticle(article, 'aws');

      expect(result.isNew).toBe(true);
      expect(result.savedArticle).toBe(1);
      expect(mockDatabase.saveArticle).toHaveBeenCalledWith({
        title: 'Test Article',
        url: 'https://example.com/test',
        published_date: '2024-01-01T10:00:00.000Z',
        feed_source: 'aws',
        original_content: 'Test content',
        summary_ja: 'テスト要約'
      });
    });

    it('should return false for existing articles', async () => {
      const article: RSSFeedItem = {
        title: 'Existing Article',
        url: 'https://example.com/existing',
        published_date: '2024-01-01T10:00:00.000Z',
        content: 'Content'
      };

      const existingArticle = { id: 1, url: 'https://example.com/existing' };
      mockDatabase.getArticleByUrl.mockResolvedValue(existingArticle);

      const result = await cronHandler.processArticle(article, 'aws');

      expect(result.isNew).toBe(false);
      expect(result.savedArticle).toBeUndefined();
      expect(mockDatabase.saveArticle).not.toHaveBeenCalled();
    });
  });
});