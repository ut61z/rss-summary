import { XMLParser } from 'fast-xml-parser';
import type { RSSFeedItem } from '../types';
import { FEEDS, type FeedDefinition, type FeedSource } from '../config/feeds';

export class RSSFetcher {
  private xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  async fetchFeed(def: FeedDefinition): Promise<RSSFeedItem[]> {
    try {
      const response = await fetch(def.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const xmlText = await response.text();
      const format = def.format === 'auto' ? this.detectFormat(xmlText) : def.format;
      return format === 'atom' ? this.parseAtomFeed(xmlText) : this.parseRSSFeed(xmlText);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch feed(${def.id}): ${msg}`);
    }
  }

  async fetchAllFeeds(): Promise<Record<FeedSource, RSSFeedItem[]>> {
    const enabled = (FEEDS as ReadonlyArray<FeedDefinition>).filter((f) => f.enabled !== false);
    const results = await Promise.allSettled(
      enabled.map(async (def) => ({ id: def.id as FeedSource, items: await this.fetchFeed(def) }))
    );

    const map = Object.create(null) as Record<FeedSource, RSSFeedItem[]>;
    for (const def of enabled) {
      map[def.id as FeedSource] = [];
    }
    for (const r of results) {
      if (r.status === 'fulfilled') {
        map[r.value.id] = r.value.items;
      }
    }
    return map;
  }

  // 後方互換: 既存テストと呼び出しのためのラッパー
  async fetchAWSFeed(): Promise<RSSFeedItem[]> {
    const def = (FEEDS as ReadonlyArray<FeedDefinition>).find((f) => f.id === 'aws');
    if (!def) return [];
    try {
      return await this.fetchFeed(def);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const reason = m.includes(':') ? m.split(':').slice(1).join(':').trim() : m;
      throw new Error(`Failed to fetch AWS RSS feed: ${reason}`);
    }
  }

  async fetchMartinFowlerFeed(): Promise<RSSFeedItem[]> {
    const def = (FEEDS as ReadonlyArray<FeedDefinition>).find((f) => f.id === 'martinfowler');
    if (!def) return [];
    try {
      return await this.fetchFeed(def);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const reason = m.includes(':') ? m.split(':').slice(1).join(':').trim() : m;
      throw new Error(`Failed to fetch Martin Fowler Atom feed: ${reason}`);
    }
  }

  async fetchGitHubChangelogFeed(): Promise<RSSFeedItem[]> {
    const def = (FEEDS as ReadonlyArray<FeedDefinition>).find((f) => f.id === 'github_changelog');
    if (!def) return [];
    try {
      return await this.fetchFeed(def);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const reason = m.includes(':') ? m.split(':').slice(1).join(':').trim() : m;
      throw new Error(`Failed to fetch GitHub Changelog RSS feed: ${reason}`);
    }
  }

  private detectFormat(xmlText: string): 'rss' | 'atom' {
    const normalized = xmlText.toLowerCase();
    if (normalized.includes('<feed') && normalized.includes('<entry')) return 'atom';
    return 'rss';
  }

  private parseRSSFeed(xmlText: string): RSSFeedItem[] {
    try {
      if (!xmlText.includes('<rss') && !xmlText.includes('<?xml')) {
        throw new Error('Invalid XML format');
      }

      const parsed = this.xmlParser.parse(xmlText);
      if (!parsed.rss || !parsed.rss.channel) return [];

      const items = parsed.rss.channel.item || [];
      const itemArray = Array.isArray(items) ? items : [items];

      return itemArray.map((item: any) => ({
        title: item.title || '',
        url: item.link || '',
        published_date: this.parseRSSDate(item.pubDate),
        content: item.description || '',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse RSS feed: ${errorMessage}`);
    }
  }

  private parseAtomFeed(xmlText: string): RSSFeedItem[] {
    try {
      if (!xmlText.includes('<feed') && !xmlText.includes('<?xml')) {
        throw new Error('Invalid XML format');
      }

      const parsed = this.xmlParser.parse(xmlText);
      if (!parsed.feed) return [];

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

        // Atomのlink要素は配列/オブジェクト/文字列のいずれか
        let url = '';
        const link = entry.link;
        if (Array.isArray(link)) {
          const alt = link.find((l: any) => l['@_rel'] === 'alternate');
          url = alt?.['@_href'] || link[0]?.['@_href'] || '';
        } else if (typeof link === 'object' && link) {
          url = link['@_href'] || '';
        } else if (typeof link === 'string') {
          url = link;
        }

        return {
          title: entry.title || '',
          url,
          published_date: this.parseRSSDate(entry.updated || entry.published),
          content,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Atom feed: ${errorMessage}`);
    }
  }

  parseRSSDate(dateString: string): string {
    if (!dateString) return new Date().toISOString();
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return new Date().toISOString();
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
