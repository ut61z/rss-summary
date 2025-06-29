import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AISummarizer } from '../../src/services/ai-summarizer';
import type { SummaryRequest, SummaryResponse } from '../../src/types';

describe('AISummarizer', () => {
  let aiSummarizer: AISummarizer;
  let mockGemini: any;
  let mockGenerateContent: any;

  beforeEach(() => {
    mockGenerateContent = mock();
    mockGemini = {
      generateContent: mockGenerateContent
    };
    
    aiSummarizer = new AISummarizer('test-api-key', mockGemini);
  });

  describe('summarizeArticle', () => {
    it('should generate Japanese summary from article content', async () => {
      const request: SummaryRequest = {
        title: 'AWS Lambda introduces new feature',
        content: 'AWS Lambda has introduced a new feature that allows developers to run serverless functions with improved performance and reduced cold start times.'
      };

      const mockResponse = {
        response: {
          text: () => 'AWSがLambdaの新機能を発表。サーバーレス関数のパフォーマンス向上とコールドスタート時間短縮を実現。'
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiSummarizer.summarizeArticle(request);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('以下の記事について新聞のテレビ欄のように日本語で概要と注目すべき点を無駄なく簡潔に記述してください')
      );

      expect(result.summary).toBe('AWSがLambdaの新機能を発表。サーバーレス関数のパフォーマンス向上とコールドスタート時間短縮を実現。');
    });

    it('should handle empty content gracefully', async () => {
      const request: SummaryRequest = {
        title: 'Test Article',
        content: ''
      };

      const mockResponse = {
        response: {
          text: () => 'テスト記事のタイトルのみの要約です。'
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiSummarizer.summarizeArticle(request);

      expect(result.summary).toBe('テスト記事のタイトルのみの要約です。');
    });

    it('should truncate long summaries to 400 characters', async () => {
      const request: SummaryRequest = {
        title: 'Long Article',
        content: 'This is a very long article with lots of content.'
      };

      const longSummary = 'あ'.repeat(450); // 450文字の要約
      const mockResponse = {
        response: {
          text: () => longSummary
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiSummarizer.summarizeArticle(request);

      expect(result.summary.length).toBe(400);
      expect(result.summary).toMatch(/…$/); // Should end with ellipsis
    });

    it('should handle API errors gracefully', async () => {
      const request: SummaryRequest = {
        title: 'Test Article',
        content: 'Test content'
      };

      mockGenerateContent.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(aiSummarizer.summarizeArticle(request, 1)).rejects.toThrow('Failed to generate summary: API rate limit exceeded');
    });

    it('should handle empty API response', async () => {
      const request: SummaryRequest = {
        title: 'Test Article',
        content: 'Test content'
      };

      const mockResponse = {
        response: {
          text: () => ''
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await expect(aiSummarizer.summarizeArticle(request, 1)).rejects.toThrow('Failed to generate summary: Empty response from AI service');
    });

    it('should retry on temporary failures', async () => {
      const request: SummaryRequest = {
        title: 'Test Article',
        content: 'Test content'
      };

      const mockResponse = {
        response: {
          text: () => '要約が生成されました。'
        }
      };

      // First call fails, second succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockResponse);

      const result = await aiSummarizer.summarizeArticle(request);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.summary).toBe('要約が生成されました。');
    });

    it('should fail after max retries', async () => {
      const request: SummaryRequest = {
        title: 'Test Article',
        content: 'Test content'
      };

      mockGenerateContent.mockRejectedValue(new Error('Persistent failure'));

      await expect(aiSummarizer.summarizeArticle(request, 2)).rejects.toThrow('Failed to generate summary after 2 attempts');
    });
  });

  describe('buildPrompt', () => {
    it('should build proper prompt with title and content', () => {
      const request: SummaryRequest = {
        title: 'Test Title',
        content: 'Test content here'
      };

      const prompt = aiSummarizer.buildPrompt(request);

      expect(prompt).toContain('以下の記事について新聞のテレビ欄のように日本語で概要と注目すべき点を無駄なく簡潔に記述してください');
      expect(prompt).toContain('タイトル: Test Title');
      expect(prompt).toContain('内容: Test content here');
      expect(prompt).toContain('概要と注目すべき点:');
    });

    it('should handle missing content', () => {
      const request: SummaryRequest = {
        title: 'Test Title',
        content: ''
      };

      const prompt = aiSummarizer.buildPrompt(request);

      expect(prompt).toContain('タイトル: Test Title');
      expect(prompt).toContain('内容: (内容なし)');
    });
  });

  describe('validateAndTruncate', () => {
    it('should return summary as-is if under 400 characters', () => {
      const shortSummary = '短い要約です。';
      const result = aiSummarizer.validateAndTruncate(shortSummary);
      expect(result).toBe(shortSummary);
    });

    it('should truncate and add ellipsis if over 400 characters', () => {
      const longSummary = 'あ'.repeat(450);
      const result = aiSummarizer.validateAndTruncate(longSummary);
      expect(result.length).toBe(400);
      expect(result).toMatch(/…$/);
    });

    it('should handle empty input', () => {
      const result = aiSummarizer.validateAndTruncate('');
      expect(result).toBe('');
    });
  });
});