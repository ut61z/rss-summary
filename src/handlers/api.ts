import type { DatabaseService } from '../services/database';
import type { Logger } from '../services/logger';
import type { ArticleFilter } from '../types';

export class ApiHandler {
  constructor(
    private database: DatabaseService,
    private logger: Logger
  ) {}

  async handleArticlesRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      const filter: ArticleFilter = {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        source: (searchParams.get('source') as 'aws' | 'martinfowler' | 'all') || 'all'
      };

      // Validate parameters
      if ((filter.page || 0) < 1) filter.page = 1;
      if ((filter.limit || 0) < 1 || (filter.limit || 0) > 100) filter.limit = 20;

      const result = await this.database.getArticles(filter);

      await this.logger.info('API articles request', {
        page: filter.page,
        limit: filter.limit,
        source: filter.source,
        total: result.total
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('API articles request failed', {
        error: errorMessage,
        url: request.url
      });

      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: errorMessage
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  async handleCronTriggerRequest(request: Request): Promise<Response> {
    try {
      // Only allow POST requests
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          error: 'Method not allowed'
        }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': 'POST'
          }
        });
      }

      await this.logger.info('Manual cron trigger requested', {
        url: request.url,
        userAgent: request.headers.get('User-Agent')
      });

      // This will be handled by the CronHandler in the main worker
      return new Response(JSON.stringify({
        success: true,
        message: 'Cron job triggered successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('Manual cron trigger failed', {
        error: errorMessage,
        url: request.url
      });

      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: errorMessage
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async handleOptionsRequest(): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  async handleHealthCheck(): Promise<Response> {
    try {
      // Simple health check - could be extended to check database connectivity
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      return new Response(JSON.stringify(health), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
}
