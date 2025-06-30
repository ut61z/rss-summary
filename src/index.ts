import { Logger } from './services/logger';
import { DatabaseService } from './services/database';
import { RSSFetcher } from './services/rss-fetcher';
import { AISummarizer } from './services/ai-summarizer';
import { DiscordNotifier } from './services/discord-notifier';
import { CronHandler } from './handlers/cron';
import { ApiHandler } from './handlers/api';
import { WebHandler } from './handlers/web';
import type { Environment } from './types';

export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    // Initialize services
    const logger = new Logger(env.DB);
    const database = new DatabaseService(env.DB);
    const rssFetcher = new RSSFetcher();
    const aiSummarizer = new AISummarizer(env.GEMINI_API_KEY);
    const discordNotifier = new DiscordNotifier(env, logger);
    
    // Initialize handlers
    const apiHandler = new ApiHandler(database, logger);
    const webHandler = new WebHandler(database, logger);

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // Handle CORS preflight requests
      if (method === 'OPTIONS') {
        return apiHandler.handleOptionsRequest();
      }

      // API Routes
      if (pathname.startsWith('/api/')) {
        if (pathname === '/api/articles' && method === 'GET') {
          return apiHandler.handleArticlesRequest(request);
        }
        
        if (pathname === '/api/cron/update-feeds' && method === 'POST') {
          const cronHandler = new CronHandler(logger, database, rssFetcher, aiSummarizer, discordNotifier);
          return cronHandler.handleManualTrigger();
        }

        if (pathname === '/api/health' && method === 'GET') {
          return apiHandler.handleHealthCheck();
        }

        if (pathname === '/api/discord/test' && method === 'POST') {
          const result = await discordNotifier.testNotification();
          return new Response(JSON.stringify({
            success: result,
            message: result ? 'Discord test notification sent successfully' : 'Discord test notification failed'
          }), {
            status: result ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // API route not found
        return new Response(JSON.stringify({
          error: 'API endpoint not found',
          path: pathname
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Web Routes
      if (pathname === '/' || pathname === '/index.html') {
        return webHandler.handleHomeRequest(request);
      }

      // Static files or other routes - return 404
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      await logger.error('Unhandled error in worker', {
        error: errorMessage,
        stack: errorStack,
        url: request.url,
        method: request.method
      });

      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    // Initialize services for scheduled event
    const logger = new Logger(env.DB);
    const database = new DatabaseService(env.DB);
    const rssFetcher = new RSSFetcher();
    const aiSummarizer = new AISummarizer(env.GEMINI_API_KEY);
    const discordNotifier = new DiscordNotifier(env, logger);
    
    // Initialize cron handler
    const cronHandler = new CronHandler(logger, database, rssFetcher, aiSummarizer, discordNotifier);

    try {
      await logger.info('Scheduled RSS update started', {
        cron: event.cron,
        scheduledTime: event.scheduledTime
      });

      await cronHandler.handleScheduledEvent();

      await logger.info('Scheduled RSS update completed successfully', {
        cron: event.cron
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      await logger.error('Scheduled RSS update failed', {
        error: errorMessage,
        stack: errorStack,
        cron: event.cron,
        scheduledTime: event.scheduledTime
      });

      // Re-throw to mark the cron job as failed
      throw error;
    }
  }
};