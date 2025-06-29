import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { RSSFetcher } from '../../src/services/rss-fetcher';
import type { RSSFeedItem } from '../../src/types';

describe('RSSFetcher', () => {
  let rssFetcher: RSSFetcher;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = mock();
    global.fetch = mockFetch;
    rssFetcher = new RSSFetcher();
  });

  describe('fetchAWSFeed', () => {
    it('should fetch and parse AWS RSS feed', async () => {
      const mockRSSXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>AWS What's New</title>
<item>
<title>AWS announces new feature</title>
<link>https://aws.amazon.com/about-aws/whats-new/2024/01/aws-new-feature/</link>
<pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
<description>AWS has announced a new feature that improves performance.</description>
</item>
</channel>
</rss>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSSXML)
      });

      const result = await rssFetcher.fetchAWSFeed();

      expect(mockFetch).toHaveBeenCalledWith('https://aws.amazon.com/about-aws/whats-new/recent/feed/');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'AWS announces new feature',
        url: 'https://aws.amazon.com/about-aws/whats-new/2024/01/aws-new-feature/',
        published_date: '2024-01-01T10:00:00.000Z',
        content: 'AWS has announced a new feature that improves performance.'
      });
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(rssFetcher.fetchAWSFeed()).rejects.toThrow('Failed to fetch AWS RSS feed: Network error');
    });

    it('should handle invalid RSS XML', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Invalid XML')
      });

      await expect(rssFetcher.fetchAWSFeed()).rejects.toThrow('Failed to parse AWS RSS feed');
    });

    it('should handle empty RSS feed', async () => {
      const emptyRSSXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>AWS What's New</title>
</channel>
</rss>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(emptyRSSXML)
      });

      const result = await rssFetcher.fetchAWSFeed();
      expect(result).toEqual([]);
    });
  });

  describe('fetchMartinFowlerFeed', () => {
    it('should fetch and parse Martin Fowler Atom feed', async () => {
      const mockAtomXML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Martin Fowler</title>
<entry>
<title>Test Article</title>
<link href="https://martinfowler.com/articles/test-article.html"/>
<published>2024-01-01T10:00:00Z</published>
<content type="html">This is a test article about software architecture.</content>
</entry>
</feed>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockAtomXML)
      });

      const result = await rssFetcher.fetchMartinFowlerFeed();

      expect(mockFetch).toHaveBeenCalledWith('https://martinfowler.com/feed.atom');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'Test Article',
        url: 'https://martinfowler.com/articles/test-article.html',
        published_date: '2024-01-01T10:00:00.000Z',
        content: 'This is a test article about software architecture.'
      });
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(rssFetcher.fetchMartinFowlerFeed()).rejects.toThrow('Failed to fetch Martin Fowler Atom feed: Network error');
    });

    it('should handle invalid Atom XML', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Invalid XML')
      });

      await expect(rssFetcher.fetchMartinFowlerFeed()).rejects.toThrow('Failed to parse Martin Fowler Atom feed');
    });

    it('should parse Martin Fowler Atom feed with updated field', async () => {
      const mockAtomXML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Martin Fowler</title>
<entry>
<title>LLMs bring new nature of abstraction</title>
<link href="https://martinfowler.com/articles/2025-nature-abstraction.html"/>
<updated>2025-06-24T10:02:00-04:00</updated>
<id>tag:martinfowler.com,2025-06-24:LLMs-bring-new-nature-of-abstraction</id>
<content type="html">
&lt;p&gt;Like most loudmouths in this field, I&amp;#x2019;ve been paying a lot of attention
      to the role that generative AI systems may play in software development.&lt;/p&gt;

&lt;p&gt;&lt;a class = 'more' href = 'https://martinfowler.com/articles/2025-nature-abstraction.html'&gt;more窶ｦ&lt;/a&gt;&lt;/p&gt;
</content>
</entry>
</feed>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockAtomXML)
      });

      const result = await rssFetcher.fetchMartinFowlerFeed();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'LLMs bring new nature of abstraction',
        url: 'https://martinfowler.com/articles/2025-nature-abstraction.html',
        published_date: '2025-06-24T14:02:00.000Z',
        content: expect.stringContaining('Like most loudmouths in this field')
      });
    });
  });

  describe('fetchAllFeeds', () => {
    it('should fetch both feeds and return combined results', async () => {
      const mockRSSXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<item>
<title>AWS Article</title>
<link>https://aws.amazon.com/test</link>
<pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
<description>AWS content</description>
</item>
</channel>
</rss>`;

      const mockAtomXML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
<title>Martin Fowler Article</title>
<link href="https://martinfowler.com/test"/>
<published>2024-01-01T11:00:00Z</published>
<content type="html">Martin Fowler content</content>
</entry>
</feed>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockRSSXML)
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockAtomXML)
        });

      const result = await rssFetcher.fetchAllFeeds();

      expect(result.aws).toHaveLength(1);
      expect(result.martinfowler).toHaveLength(1);
      expect(result.aws[0].title).toBe('AWS Article');
      expect(result.martinfowler[0].title).toBe('Martin Fowler Article');
    });

    it('should handle partial failures gracefully', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('AWS feed failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
<title>Martin Fowler Article</title>
<link href="https://martinfowler.com/test"/>
<published>2024-01-01T11:00:00Z</published>
<content type="html">Content</content>
</entry>
</feed>`)
        });

      const result = await rssFetcher.fetchAllFeeds();

      expect(result.aws).toEqual([]);
      expect(result.martinfowler).toHaveLength(1);
    });
  });

  describe('parseRSSDate', () => {
    it('should parse various date formats', async () => {
      // Test RFC 2822 format
      expect(rssFetcher.parseRSSDate('Mon, 01 Jan 2024 10:00:00 GMT')).toBe('2024-01-01T10:00:00.000Z');
      
      // Test ISO 8601 format
      expect(rssFetcher.parseRSSDate('2024-01-01T10:00:00Z')).toBe('2024-01-01T10:00:00.000Z');
      
      // Test invalid date
      expect(rssFetcher.parseRSSDate('invalid date')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});