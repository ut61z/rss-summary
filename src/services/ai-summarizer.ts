import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SummaryRequest, SummaryResponse } from '../types';

export interface GenerativeModel {
  generateContent(request: any): Promise<any>;
}

export class AISummarizer {
  private model: GenerativeModel;

  constructor(apiKey: string, model?: GenerativeModel) {
    if (model) {
      this.model = model;
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  async summarizeArticle(request: SummaryRequest, maxRetries: number = 3): Promise<SummaryResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildPrompt(request);
        
        const result = await this.model.generateContent(prompt);

        const summary = result.response.text().trim();
        
        if (!summary) {
          throw new Error('Empty response from AI service');
        }

        const truncatedSummary = this.validateAndTruncate(summary);

        return { summary: truncatedSummary };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          if (attempt > 1) {
            throw new Error(`Failed to generate summary after ${maxRetries} attempts: ${lastError.message}`);
          }
          throw new Error(`Failed to generate summary: ${lastError.message}`);
        }

        // Wait before retry (exponential backoff)
        const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
        const delay = isTest ? 1 : Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  buildPrompt(request: SummaryRequest): string {
    const content = request.content || '(内容なし)';
    
    return `
    以下の記事について新聞のテレビ欄のように日本語で概要と注目すべき点を無駄なく簡潔に記述してください。
    絶対に250字を超えないようにしてください。
    強調表現(**)なども不要、句読点は , . を使ってください。
    「詳細は〇〇」という文言も不要です。

タイトル: ${request.title}
内容: ${content}

概要と注目すべき点:`;
  }

  validateAndTruncate(summary: string): string {
    if (!summary) {
      return '';
    }

    // Remove leading/trailing whitespace and newlines
    const cleaned = summary.trim().replace(/\n+/g, ' ');
    
    if (cleaned.length <= 400) {
      return cleaned;
    }

    // Truncate to 399 characters and add ellipsis
    return cleaned.substring(0, 399) + '…';
  }

  async testConnection(): Promise<boolean> {
    try {
      const testRequest: SummaryRequest = {
        title: 'Test',
        content: 'This is a test.'
      };
      
      await this.summarizeArticle(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }

  getRateLimitInfo(): { requestsPerMinute: number; requestsPerDay: number } {
    return {
      requestsPerMinute: 15,
      requestsPerDay: 1500
    };
  }
}