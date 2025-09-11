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

  async fetchById(id: FeedSource): Promise<RSSFeedItem[]> {
    const def = (FEEDS as ReadonlyArray<FeedDefinition>).find((f) => f.id === id);
    if (!def) return [];
    try {
      return await this.fetchFeed(def);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const reason = m.includes(':') ? m.split(':').slice(1).join(':').trim() : m;
      throw new Error(`Failed to fetch ${id} feed: ${reason}`);
    }
  }

  async fetchMany(ids: ReadonlyArray<FeedSource>): Promise<Record<FeedSource, RSSFeedItem[]>> {
    const selected = (FEEDS as ReadonlyArray<FeedDefinition>).filter((f) => ids.includes(f.id as FeedSource));
    const results = await Promise.allSettled(
      selected.map(async (def) => ({ id: def.id as FeedSource, items: await this.fetchFeed(def) }))
    );

    const map = Object.create(null) as Record<FeedSource, RSSFeedItem[]>;
    for (const id of ids) {
      map[id] = [];
    }
    for (const r of results) {
      if (r.status === 'fulfilled') {
        map[r.value.id] = r.value.items;
      }
    }
    return map;
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

      type RSSItemNode = { title?: string; link?: string; pubDate?: string; description?: string };
      type RSSParsed = { rss?: { channel?: { item?: RSSItemNode | RSSItemNode[] } } };

      const parsed = this.xmlParser.parse(xmlText) as RSSParsed;
      const items = parsed.rss?.channel?.item ?? [];
      const itemArray = Array.isArray(items) ? items : [items];

      const toItem = (item: unknown): RSSFeedItem => {
        const i = (typeof item === 'object' && item !== null ? item : {}) as RSSItemNode;
        return {
          title: i.title ?? '',
          url: i.link ?? '',
          published_date: this.parseRSSDate(i.pubDate ?? ''),
          content: i.description ?? '',
        };
      };

      return itemArray.map(toItem);
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

      type AtomLink = { ['@_rel']?: string; ['@_href']?: string };
      type AtomContent = string | { ['#text']?: string };
      type AtomEntryNode = {
        title?: string;
        link?: AtomLink | AtomLink[] | string;
        updated?: string;
        published?: string;
        content?: AtomContent;
        summary?: string;
      };
      type AtomParsed = { feed?: { entry?: AtomEntryNode | AtomEntryNode[] } };

      const parsed = this.xmlParser.parse(xmlText) as AtomParsed;
      const entries = parsed.feed?.entry ?? [];
      const entryArray = Array.isArray(entries) ? entries : [entries];

      const getContent = (c?: AtomContent, summary?: string): string => {
        if (!c) return summary ?? '';
        if (typeof c === 'string') return c;
        if ('#text' in c && typeof c['#text'] === 'string') return c['#text'];
        return summary ?? '';
      };

      const isAtomLink = (v: unknown): v is AtomLink => {
        if (typeof v !== 'object' || v === null) return false;
        const r = v as Record<string, unknown>;
        return '@_href' in r || '@_rel' in r;
      };

      const resolveLink = (link: AtomEntryNode['link']): string => {
        if (!link) return '';
        if (typeof link === 'string') return link;
        if (Array.isArray(link)) {
          const objs = link.filter(isAtomLink);
          const alt = objs.find((l) => l['@_rel'] === 'alternate');
          return alt?.['@_href'] ?? objs[0]?.['@_href'] ?? '';
        }
        if (isAtomLink(link)) return link['@_href'] ?? '';
        return '';
      };

      return entryArray.map((entry) => ({
        title: entry?.title ?? '',
        url: resolveLink(entry?.link),
        published_date: this.parseRSSDate(entry?.updated ?? entry?.published ?? ''),
        content: getContent(entry?.content, entry?.summary),
      }));
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
