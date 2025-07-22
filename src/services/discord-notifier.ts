import type { Article } from '../types';
import { Logger } from './logger';

interface DiscordWebhookPayload {
  embeds: Array<{
    title: string;
    description: string;
    url: string;
    color: number;
    footer: {
      text: string;
    };
    timestamp: string;
  }>;
}

interface Environment {
  DISCORD_WEBHOOK_URL?: string;
  ENVIRONMENT?: string;
}

export class DiscordNotifier {
  private readonly webhookUrl: string | undefined;
  private readonly logger: Logger;

  constructor(env: Environment, logger: Logger) {
    this.webhookUrl = env.DISCORD_WEBHOOK_URL;
    this.logger = logger;
  }

  async notifyNewArticle(article: Article): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.info('Discord webhook URL not configured, skipping notification');
      return;
    }

    try {
      const payload = this.createWebhookPayload(article);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }

      this.logger.info('Discord notification sent successfully', {
        articleId: article.id,
        articleTitle: article.title,
        feedSource: article.feed_source,
      });

    } catch (error) {
      this.logger.error('Failed to send Discord notification', {
        error: error instanceof Error ? error.message : String(error),
        articleId: article.id,
        articleTitle: article.title,
        feedSource: article.feed_source,
      });
    }
  }

  async notifyMultipleArticles(articles: Article[]): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.info('Discord webhook URL not configured, skipping notifications');
      return;
    }

    for (const article of articles) {
      await this.notifyNewArticle(article);
      // Discord API rate limit対策として少し待機
      await this.delay(100);
    }
  }

  private createWebhookPayload(article: Article): DiscordWebhookPayload {
    const color = this.getFeedColor(article.feed_source);
    const feedName = this.getFeedDisplayName(article.feed_source);
    
    return {
      embeds: [{
        title: article.title,
        description: article.summary_ja && article.summary_ja !== 'null' ? article.summary_ja : '要約なし',
        url: article.url,
        color,
        footer: {
          text: feedName,
        },
        timestamp: this.getValidTimestamp(article.published_date),
      }],
    };
  }

  private getFeedColor(feedSource: string): number {
    switch (feedSource) {
      case 'aws':
        return 0x3498db; // 青
      case 'martinfowler':
        return 0x2ecc71; // 緑
      default:
        return 0x95a5a6; // グレー
    }
  }

  private getFeedDisplayName(feedSource: string): string {
    switch (feedSource) {
      case 'aws':
        return 'AWS ニュース';
      case 'martinfowler':
        return 'Martin Fowler';
      default:
        return feedSource;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getValidTimestamp(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // 無効な日付の場合は現在時刻を使用
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      // エラーが発生した場合も現在時刻を使用
      return new Date().toISOString();
    }
  }

  async testNotification(): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.warn('Discord webhook URL not configured for testing');
      return false;
    }

    const testArticle: Article = {
      id: 999999,
      title: 'テスト通知 - Discord連携確認',
      url: 'https://example.com/test',
      published_date: new Date().toISOString(),
      feed_source: 'aws',
      original_content: '',
      summary_ja: 'これはDiscord連携のテスト通知です。正常に動作していることを確認してください。',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await this.notifyNewArticle(testArticle);
      this.logger.info('Discord test notification sent successfully');
      return true;
    } catch (error) {
      this.logger.error('Discord test notification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}