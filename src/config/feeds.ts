export type FeedFormat = 'rss' | 'atom' | 'auto';

export interface FeedDefinition {
  id: string;
  url: string;
  format: FeedFormat;
  displayName: string;
  color: number;
  enabled?: boolean;
}

// 追加したいブログはこの配列にエントリを1つ足すだけ
export const FEEDS = [
  {
    id: 'aws',
    url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/',
    format: 'rss',
    displayName: 'AWS ニュース',
    color: 0x3498db,
    enabled: true,
  },
  {
    id: 'martinfowler',
    url: 'https://martinfowler.com/feed.atom',
    format: 'atom',
    displayName: 'Martin Fowler',
    color: 0x2ecc71,
    enabled: true,
  },
  {
    id: 'github_changelog',
    url: 'https://github.blog/changelog/feed/',
    format: 'rss',
    displayName: 'GitHub Changelog',
    color: 0x6e5494,
    enabled: true,
  },
] as const satisfies ReadonlyArray<FeedDefinition>;

export type FeedSource = typeof FEEDS[number]['id'];

export function getFeedById(id: string): FeedDefinition | undefined {
  return (FEEDS as ReadonlyArray<FeedDefinition>).find((f) => f.id === id);
}

