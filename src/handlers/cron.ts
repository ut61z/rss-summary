import type { Logger } from '../services/logger';
import type { DatabaseService } from '../services/database';
import type { RSSFetcher } from '../services/rss-fetcher';
import type { AISummarizer } from '../services/ai-summarizer';
import type { RSSFeedItem } from '../types';

export class CronHandler {
  constructor(
    private logger: Logger,
    private database: DatabaseService,
    private rssFetcher: RSSFetcher,
    private aiSummarizer: AISummarizer
  ) {}

  async handleScheduledEvent(): Promise<void> {
    try {
      await this.logger.info('Starting RSS feed update');

      const feeds = await this.rssFetcher.fetchAllFeeds();
      
      let processedCount = 0;
      let newArticlesCount = 0;
      let errorCount = 0;

      // Process AWS articles
      for (const article of feeds.aws) {
        try {
          const isNew = await this.processArticle(article, 'aws');
          if (isNew) newArticlesCount++;
          processedCount++;
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.logger.error('Failed to process article', {
            url: article.url,
            error: errorMessage
          });
        }
      }

      // Process Martin Fowler articles
      for (const article of feeds.martinfowler) {
        try {
          const isNew = await this.processArticle(article, 'martinfowler');
          if (isNew) newArticlesCount++;
          processedCount++;
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.logger.error('Failed to process article', {
            url: article.url,
            error: errorMessage
          });
        }
      }

      await this.logger.info('RSS feed update completed successfully', {
        processedCount,
        newArticlesCount,
        errorCount,
        awsArticles: feeds.aws.length,
        martinFowlerArticles: feeds.martinfowler.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('Failed to update RSS feeds', {
        error: errorMessage
      });
      throw error;
    }
  }

  async processArticle(article: RSSFeedItem, source: 'aws' | 'martinfowler'): Promise<boolean> {
    // Check if article already exists
    const existingArticle = await this.database.getArticleByUrl(article.url);
    if (existingArticle) {
      return false; // Article already exists, skip
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
    return true; // New article was saved
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