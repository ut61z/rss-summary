import type { Logger } from '../services/logger';
import type { DatabaseService } from '../services/database';
import type { RSSFetcher } from '../services/rss-fetcher';
import type { AISummarizer } from '../services/ai-summarizer';
import type { DiscordNotifier } from '../services/discord-notifier';
import type { RSSFeedItem, Article } from '../types';
import type { FeedSource } from '../config/feeds';

export class CronHandler {
  constructor(
    private logger: Logger,
    private database: DatabaseService,
    private rssFetcher: RSSFetcher,
    private aiSummarizer: AISummarizer,
    private discordNotifier: DiscordNotifier
  ) {}

  async handleScheduledEvent(): Promise<void> {
    try {
      await this.logger.info('Starting RSS feed update');

      const feeds = await this.rssFetcher.fetchAllFeeds();

      let processedCount = 0;
      let newArticlesCount = 0;
      let errorCount = 0;
      const newArticles: Article[] = [];

      const entries = Object.entries(feeds) as Array<[FeedSource, RSSFeedItem[]]>;
      const perSourceCounts: Record<string, number> = {};

      for (const [source, items] of entries) {
        perSourceCounts[source] = items.length;
        for (const article of items) {
          try {
            const result = await this.processArticle(article, source);
            if (result.isNew && result.savedArticle) {
              newArticlesCount++;
              newArticles.push(result.savedArticle);
            }
            processedCount++;
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.logger.error('Failed to process article', {
              url: article.url,
              error: errorMessage,
              source,
            });
          }
        }
      }

      // Send Discord notifications for new articles
      if (newArticles.length > 0) {
        try {
          await this.discordNotifier.notifyMultipleArticles(newArticles);
          await this.logger.info('Discord notifications sent', {
            notificationCount: newArticles.length
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.logger.error('Failed to send Discord notifications', {
            error: errorMessage,
            articleCount: newArticles.length
          });
        }
      }

      await this.logger.info('RSS feed update completed successfully', {
        processedCount,
        newArticlesCount,
        errorCount,
        perSourceCounts,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('Failed to update RSS feeds', {
        error: errorMessage
      });
      throw error;
    }
  }

  async processArticle(article: RSSFeedItem, source: FeedSource): Promise<{ isNew: boolean; savedArticle?: Article }> {
    // Check if article already exists
    const existingArticle = await this.database.getArticleByUrl(article.url);
    if (existingArticle) {
      return { isNew: false }; // Article already exists, skip
    }

    let summary: string | undefined;

    // Try to generate AI summary
    try {
      if (article.title && (article.content || article.title)) {
        const summaryResponse = await this.aiSummarizer.summarizeArticle({
          title: article.title,
          content: article.content || ''
        });
        summary = summaryResponse.summary;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.warn('Failed to generate summary for article', {
        url: article.url,
        error: errorMessage
      });
      // Continue without summary
    }

    // Save article to database
    const articleData = {
      title: article.title,
      url: article.url,
      published_date: article.published_date,
      feed_source: source,
      original_content: article.content,
      summary_ja: summary
    };

    await this.database.saveArticle(articleData);

    // 保存された記事の完全なオブジェクトを取得してDiscord通知に使用
    const savedArticle = await this.database.getArticleByUrl(article.url);
    return { isNew: true, savedArticle: savedArticle ?? undefined };
  }

  async handleManualTrigger(): Promise<Response> {
    try {
      await this.handleScheduledEvent();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'RSS feeds updated successfully' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
