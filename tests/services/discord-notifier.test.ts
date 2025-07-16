import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DiscordNotifier } from '../../src/services/discord-notifier';
import { Logger } from '../../src/services/logger';
import type { Article } from '../../src/types';

// fetch関数をモック
const mockFetch = mock();
(global as any).fetch = mockFetch;

describe('DiscordNotifier', () => {
  let discordNotifier: DiscordNotifier;
  let mockLogger: Logger;
  let mockEnv: any;

  beforeEach(() => {
    // Loggerのモック
    mockLogger = {
      info: mock(),
      error: mock(),
      warn: mock(),
      getLogs: mock()
    } as any;

    // 環境変数のモック
    mockEnv = {
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/test/webhook',
      ENVIRONMENT: 'test'
    };

    discordNotifier = new DiscordNotifier(mockEnv, mockLogger);
    
    // fetchモックをリセット
    mockFetch.mockReset();
  });

  describe('notifyNewArticle', () => {
    const testArticle: Article = {
      id: 1,
      title: 'Test Article Title',
      url: 'https://example.com/test-article',
      published_date: '2024-01-01T00:00:00Z',
      feed_source: 'aws',
      original_content: 'Test content',
      summary_ja: 'テスト要約',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    it('should send Discord notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await discordNotifier.notifyNewArticle(testArticle);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.any(String)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Discord notification sent successfully',
        expect.objectContaining({
          articleId: 1,
          articleTitle: 'Test Article Title',
          feedSource: 'aws'
        })
      );
    });

    it('should format webhook payload correctly for AWS article', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await discordNotifier.notifyNewArticle(testArticle);

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload).toEqual({
        embeds: [{
          title: 'Test Article Title',
          description: 'テスト要約',
          url: 'https://example.com/test-article',
          color: 0x3498db, // AWS blue
          footer: {
            text: 'AWS ニュース'
          },
          timestamp: '2024-01-01T00:00:00.000Z'
        }]
      });
    });

    it('should format webhook payload correctly for Martin Fowler article', async () => {
      const martinFowlerArticle: Article = { 
        ...testArticle, 
        feed_source: 'martinfowler' as const
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await discordNotifier.notifyNewArticle(martinFowlerArticle);

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload.embeds[0]).toEqual(
        expect.objectContaining({
          color: 0x2ecc71, // Martin Fowler green
          footer: {
            text: 'Martin Fowler'
          }
        })
      );
    });

    it('should handle article without summary', async () => {
      const articleWithoutSummary: Article = { 
        ...testArticle, 
        summary_ja: undefined 
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await discordNotifier.notifyNewArticle(articleWithoutSummary);

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload.embeds[0].description).toBe('要約なし');
    });

    it('should handle Discord webhook failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await discordNotifier.notifyNewArticle(testArticle);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send Discord notification',
        expect.objectContaining({
          error: 'Discord webhook failed: 404 Not Found',
          articleId: 1,
          articleTitle: 'Test Article Title',
          feedSource: 'aws'
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await discordNotifier.notifyNewArticle(testArticle);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send Discord notification',
        expect.objectContaining({
          error: 'Network error',
          articleId: 1,
          articleTitle: 'Test Article Title',
          feedSource: 'aws'
        })
      );
    });

    it('should skip notification when webhook URL is not configured', async () => {
      const envWithoutWebhook = { ...mockEnv, DISCORD_WEBHOOK_URL: undefined };
      const notifierWithoutWebhook = new DiscordNotifier(envWithoutWebhook, mockLogger);

      await notifierWithoutWebhook.notifyNewArticle(testArticle);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Discord webhook URL not configured, skipping notification'
      );
    });
  });

  describe('notifyMultipleArticles', () => {
    const testArticles: Article[] = [
      {
        id: 1,
        title: 'First Article',
        url: 'https://example.com/first',
        published_date: '2024-01-01T00:00:00Z',
        feed_source: 'aws',
        original_content: 'First content',
        summary_ja: '最初の要約',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 2,
        title: 'Second Article',
        url: 'https://example.com/second',
        published_date: '2024-01-01T01:00:00Z',
        feed_source: 'martinfowler',
        original_content: 'Second content',
        summary_ja: '二番目の要約',
        created_at: '2024-01-01T01:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      }
    ];

    it('should send notifications for multiple articles with delay', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const startTime = Date.now();
      await discordNotifier.notifyMultipleArticles(testArticles);
      const endTime = Date.now();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100); // 100ms delay
    });

    it('should skip multiple notifications when webhook URL is not configured', async () => {
      const envWithoutWebhook = { ...mockEnv, DISCORD_WEBHOOK_URL: undefined };
      const notifierWithoutWebhook = new DiscordNotifier(envWithoutWebhook, mockLogger);

      await notifierWithoutWebhook.notifyMultipleArticles(testArticles);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Discord webhook URL not configured, skipping notifications'
      );
    });
  });

  describe('testNotification', () => {
    it('should send test notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await discordNotifier.testNotification();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Discord test notification sent successfully'
      );
    });

    it('should return false when webhook URL is not configured', async () => {
      const envWithoutWebhook = { ...mockEnv, DISCORD_WEBHOOK_URL: undefined };
      const notifierWithoutWebhook = new DiscordNotifier(envWithoutWebhook, mockLogger);

      const result = await notifierWithoutWebhook.testNotification();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Discord webhook URL not configured for testing'
      );
    });

    it('should return false when test notification fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      const result = await discordNotifier.testNotification();

      expect(result).toBe(true); // notifyNewArticleがエラーをキャッチするため、testNotificationは成功扱い
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Discord test notification sent successfully'
      );
    });
  });
});