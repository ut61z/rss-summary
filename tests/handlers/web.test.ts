import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { WebHandler } from '../../src/handlers/web.ts';
import type { DatabaseService } from '../../src/services/database';
import type { Logger } from '../../src/services/logger';

describe('WebHandler', () => {
  let webHandler: WebHandler;
  let mockDatabase: DatabaseService;
  let mockLogger: Logger;

  beforeEach(() => {
    // DatabaseServiceのモック
    mockDatabase = {
      getArticles: mock(),
      saveArticle: mock(),
      getArticleByUrl: mock(),
      updateArticleSummary: mock()
    } as any;

    // Loggerのモック
    mockLogger = {
      info: mock(),
      error: mock(),
      warn: mock(),
      getLogs: mock()
    } as any;

    webHandler = new WebHandler(mockDatabase, mockLogger);
  });

  describe('handleHomeRequest', () => {
    it('should return HTML response successfully', async () => {
      const request = new Request('https://example.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (test browser)'
        }
      });

      const response = await webHandler.handleHomeRequest(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('RSS要約フィード');
      expect(html).toContain('<html lang="ja">');
      expect(html).toContain('AWSとMartin FowlerのRSSフィードを日本語要約で配信');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Home page request',
        expect.objectContaining({
          url: 'https://example.com/',
          userAgent: 'Mozilla/5.0 (test browser)'
        })
      );
    });

    it('should cache HTML template after first load', async () => {
      const request1 = new Request('https://example.com/');
      const request2 = new Request('https://example.com/');

      const response1 = await webHandler.handleHomeRequest(request1);
      const response2 = await webHandler.handleHomeRequest(request2);

      const html1 = await response1.text();
      const html2 = await response2.text();

      expect(html1).toBe(html2);
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // 両方のリクエストでログが記録されることを確認
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should handle User-Agent header missing', async () => {
      const request = new Request('https://example.com/');

      const response = await webHandler.handleHomeRequest(request);

      expect(response.status).toBe(200);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Home page request',
        expect.objectContaining({
          url: 'https://example.com/',
          userAgent: null
        })
      );
    });

    it('should handle logger errors gracefully', async () => {
      mockLogger.info.mockRejectedValueOnce(new Error('Logger failed'));

      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');

      const html = await response.text();
      expect(html).toContain('⚠️ エラーが発生しました');
      expect(html).toContain('Logger failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Home page request failed',
        expect.objectContaining({
          error: 'Logger failed',
          url: 'https://example.com/'
        })
      );
    });

    it('should include essential HTML structure and features', async () => {
      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);
      const html = await response.text();

      // 基本構造の確認
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<title>RSS要約フィード</title>');

      // フィルター機能の確認
      expect(html).toContain('id="sourceFilter"');
      expect(html).toContain('value="all"');
      expect(html).toContain('value="aws"');
      expect(html).toContain('value="martinfowler"');

      // JavaScript機能の確認
      expect(html).toContain('loadArticles()');
      expect(html).toContain('triggerUpdate()');
      expect(html).toContain('changePage(');

      // API呼び出しの確認
      expect(html).toContain('/api/articles');
      expect(html).toContain('/api/cron/update-feeds');

      // レスポンシブデザインの確認
      expect(html).toContain('@media (max-width: 768px)');
    });

    it('should include proper CSS styling', async () => {
      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);
      const html = await response.text();

      // CSS要素の確認
      expect(html).toContain('.container');
      expect(html).toContain('.article-card');
      expect(html).toContain('.filters');
      expect(html).toContain('.pagination');
      expect(html).toContain('.loading');

      // AWS/Martin Fowlerの色分けスタイル
      expect(html).toContain('.article-card.aws');
      expect(html).toContain('.article-card.martinfowler');
      expect(html).toContain('.source-tag.aws');
      expect(html).toContain('.source-tag.martinfowler');
    });
  });

  describe('error handling and HTML escaping', () => {
    it('should properly escape HTML in error messages', async () => {
      const dangerousError = '<script>alert("xss")</script>';
      mockLogger.info.mockRejectedValueOnce(new Error(dangerousError));

      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);

      const html = await response.text();
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;xss&quot;');
    });

    it('should handle various special characters in error messages', async () => {
      const specialCharsError = `Error with "quotes", 'apostrophes', <tags>, & ampersands`;
      mockLogger.info.mockRejectedValueOnce(new Error(specialCharsError));

      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);

      const html = await response.text();
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&#39;apostrophes&#39;');
      expect(html).toContain('&lt;tags&gt;');
      expect(html).toContain('&amp; ampersands');
    });

    it('should return error HTML with proper structure', async () => {
      mockLogger.info.mockRejectedValueOnce(new Error('Test error'));

      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);

      expect(response.status).toBe(500);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="ja">');
      expect(html).toContain('エラー - RSS要約フィード');
      expect(html).toContain('⚠️ エラーが発生しました');
      expect(html).toContain('error-container');
      expect(html).toContain('Test error');
    });

    it('should handle non-Error objects gracefully', async () => {
      mockLogger.info.mockRejectedValueOnce('String error');

      const request = new Request('https://example.com/');
      const response = await webHandler.handleHomeRequest(request);

      expect(response.status).toBe(500);

      const html = await response.text();
      expect(html).toContain('Unknown error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Home page request failed',
        expect.objectContaining({
          error: 'Unknown error'
        })
      );
    });
  });
});