import { XMLParser } from 'fast-xml-parser';
import type { RSSFeedItem } from '../types';

export class RSSFetcher {
  private xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    trimValues: true
  });

  async fetchAWSFeed(): Promise<RSSFeedItem[]> {
    try {
      const response = await fetch('https://aws.amazon.com/about-aws/whats-new/recent/feed/');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      return this.parseRSSFeed(xmlText, 'aws');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch AWS RSS feed: ${errorMessage}`);
    }
  }

  async fetchMartinFowlerFeed(): Promise<RSSFeedItem[]> {
    try {
      const response = await fetch('https://martinfowler.com/feed.atom');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      return this.parseAtomFeed(xmlText, 'martinfowler');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch Martin Fowler Atom feed: ${errorMessage}`);
    }
  }

  async fetchGitHubChangelogFeed(): Promise<RSSFeedItem[]> {
    try {
      const response = await fetch('https://github.blog/changelog/feed/');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      // GitHub ChangelogはRSS 2.0想定
      return this.parseRSSFeed(xmlText, 'github_changelog');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch GitHub Changelog RSS feed: ${errorMessage}`);
    }
  }

  async fetchAllFeeds(): Promise<{ aws: RSSFeedItem[]; martinfowler: RSSFeedItem[]; github_changelog: RSSFeedItem[] }> {
    const [awsResult, martinFowlerResult, githubResult] = await Promise.allSettled([
      this.fetchAWSFeed(),
      this.fetchMartinFowlerFeed(),
      this.fetchGitHubChangelogFeed()
    ]);

    return {
      aws: awsResult.status === 'fulfilled' ? awsResult.value : [],
      martinfowler: martinFowlerResult.status === 'fulfilled' ? martinFowlerResult.value : [],
      github_changelog: githubResult.status === 'fulfilled' ? githubResult.value : []
    };
  }

  private parseRSSFeed(xmlText: string, source: string): RSSFeedItem[] {
    try {
      if (!xmlText.includes('<rss') && !xmlText.includes('<?xml')) {
        throw new Error('Invalid XML format');
      }

      const parsed = this.xmlParser.parse(xmlText);
      
      if (!parsed.rss || !parsed.rss.channel) {
        return [];
      }

      const items = parsed.rss.channel.item || [];
      const itemArray = Array.isArray(items) ? items : [items];

      return itemArray.map((item: any) => ({
        title: item.title || '',
        url: item.link || '',
        published_date: this.parseRSSDate(item.pubDate),
        content: item.description || ''
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // sourceはログ用に使うだけなので固定文言は避ける
      throw new Error(`Failed to parse RSS feed: ${errorMessage}`);
    }
  }

  private parseAtomFeed(xmlText: string, source: string): RSSFeedItem[] {
    try {
      if (!xmlText.includes('<feed') && !xmlText.includes('<?xml')) {
        throw new Error('Invalid XML format');
      }

      const parsed = this.xmlParser.parse(xmlText);
      
      if (!parsed.feed) {
        return [];
      }

      const entries = parsed.feed.entry || [];
      const entryArray = Array.isArray(entries) ? entries : [entries];

      return entryArray.map((entry: any) => {
        let content = '';
        if (entry.content) {
          if (typeof entry.content === 'string') {
            content = entry.content;
          } else if (entry.content['#text']) {
            content = entry.content['#text'];
          }
        } else if (entry.summary) {
          content = entry.summary;
        }

        return {
          title: entry.title || '',
          url: entry.link?.['@_href'] || entry.link || '',
          published_date: this.parseRSSDate(entry.updated || entry.published),
          content
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Atom feed: ${errorMessage}`);
    }
  }

  parseRSSDate(dateString: string): string {
    if (!dateString) {
      return new Date().toISOString();
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
