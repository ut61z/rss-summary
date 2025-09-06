# RSS Feed System - Technical Specifications

## Project Overview
RSSフィードを取得して日本語要約し、Discordへ通知するバックエンドサービス（Web UIなし）。手動実行用の管理APIのみ提供する。

## Requirements

### Functional Requirements
- RSS源：
  - AWS新機能情報: https://aws.amazon.com/jp/about-aws/whats-new/recent/feed/
  - Martin Fowlerブログ: https://martinfowler.com/feed.atom
- 自動更新：毎日朝6:30（JST）
- AI要約：Gemini API（gemini-2.0-flash）で日本語要約生成（実装側で最大400文字にバリデーション）
- 表示：なし（Discord通知のみ）

### Non-Functional Requirements
- エラーハンドリング：ログ出力のみ
- 管理機能：不要
- データ保持：全記事永続保存

## Technology Stack
- Runtime: Bun + TypeScript
- Database: Cloudflare D1 (SQLite)
- AI Service: Google Gemini API (Free Tier)
- Frontend: なし（管理APIのみ）
- Deployment: Cloudflare Workers
- Scheduling: Cloudflare Cron Triggers

## Architecture

### System Components
1. **RSS Fetcher**: RSSフィード取得・パース
2. **AI Summarizer**: Gemini API経由での要約生成
3. **Database Layer**: D1データベース操作
4. **Discord Notifier**: Webhook経由での通知送信
5. **Admin API**: 手動更新トリガー/ヘルスチェック
6. **Scheduler**: Cron Job実行

### Data Flow
```
Cron Trigger (06:30 JST)
  ↓
RSS Fetcher
  ↓ 
Article Parser
  ↓
Gemini API (Summarization)
  ↓
D1 Database Storage
  ↓
Discord Notification (per article)
```

## Database Schema

### Articles Table
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_date TEXT NOT NULL,
  feed_source TEXT NOT NULL, -- 'aws' or 'martinfowler'
  original_content TEXT,
  summary_ja TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_published_date ON articles(published_date DESC);
CREATE INDEX idx_feed_source ON articles(feed_source);
```

### Logs Table
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL, -- 'info', 'error', 'warn'
  message TEXT NOT NULL,
  details TEXT, -- JSON string for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON logs(created_at DESC);
CREATE INDEX idx_level ON logs(level);
```

## File Structure
```
/
├── src/
│   ├── index.ts              # Main Cloudflare Worker entry point
│   ├── handlers/
│   │   ├── api.ts            # Admin API endpoints
│   │   └── cron.ts           # Scheduled job handler
│   ├── services/
│   │   ├── rss-fetcher.ts    # RSS feed fetching & parsing
│   │   ├── ai-summarizer.ts  # Gemini API integration
│   │   ├── discord-notifier.ts # Discord webhook notifications
│   │   ├── database.ts       # D1 database operations
│   │   └── logger.ts         # Logging utility
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
├── migrations/
│   └── 0001_initial.sql      # Database migration
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json
└── tsconfig.json
```

## API Specifications

### POST /api/cron/update-feeds
- RSS更新の手動実行（管理者向け）
- 認可: `Authorization: Bearer ${ADMIN_TOKEN}` 必須
- 戻り値: `{ success: boolean, message?: string, error?: string }`

### POST /api/discord/test
- Discord通知の疎通確認（管理者向け）
- 認可: `Authorization: Bearer ${ADMIN_TOKEN}` 必須
- 戻り値: `{ success: boolean, message: string }`

### GET /api/health
- サービスのヘルスチェック
- 戻り値: `{ status: 'healthy', timestamp: string, version: string }`

## Environment Variables
```bash
# Cloudflare Workers環境変数
GEMINI_API_KEY=your_gemini_api_key
DISCORD_WEBHOOK_URL=your_discord_webhook_url
DB=your_d1_database_binding
ENVIRONMENT=production # or development
ADMIN_TOKEN=your_admin_bearer_token
```

## Discord Integration

### Discord Webhook Format
- 記事ごとに個別送信
- シンプルテキスト形式
- フィード別色分け（AWS: 青、Martin Fowler: 緑）

### Message Format
```typescript
interface DiscordMessage {
  embeds: [{
    title: string;           // 記事タイトル
    description: string;     // 日本語要約（実装で最大400文字）
    url: string;            // 元記事URL
    color: number;          // フィード別色（AWS: 0x3498db, Martin Fowler: 0x2ecc71）
    footer: {
      text: string;         // フィード名
    };
    timestamp: string;      // 投稿日時
  }];
}
```

### Error Handling
- Discord送信失敗: ログ記録、処理継続
- Webhook URL無効: ログ記録、Discord送信スキップ
- Model: gemini-2.0-flash
- Rate Limits: 15 requests/minute, 1500 requests/day
- Prompt Template:
```
以下の英語記事を日本語で簡潔に要約してください。技術的内容を正確に読みやすく伝え、冗長な表現は避けてください。実装側で最大400文字に収めます。

タイトル: {title}
内容: {content}

要約:
```

## Error Handling Strategy
- RSS取得失敗: ログ記録、次回実行時に再試行
- AI要約失敗: ログ記録、元記事をそのまま保存
- Discord送信失敗: ログ記録、処理継続
- DB接続失敗: ログ記録、アプリケーション継続
- 全エラーは構造化ログとして記録

## Performance Considerations
- RSS解析: 並列処理で複数フィード同時取得
- AI要約: レート制限を考慮した順次処理
- DB操作: バッチ処理でパフォーマンス向上

## Development Guidelines
- TypeScript strict mode使用
- エラー処理は必須
- ログは構造化形式（JSON）
- コメントは日本語可
- 関数名・変数名は英語

## Deployment Steps
1. D1データベース作成
2. 環境変数設定
3. マイグレーション実行
4. Workers設定デプロイ
5. Cron Trigger設定

## Testing Requirements
- Unit tests for core services
- Integration tests for API endpoints
- Manual testing for cron jobs
- Error scenario testing

## Security Considerations
- API keyの適切な管理
- SQLインジェクション対策
- レート制限の実装
- CORS設定
