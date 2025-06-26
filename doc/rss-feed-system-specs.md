# RSS Feed System - Technical Specifications

## Project Overview
RSSフィードを取得して日本語要約し、時系列でカード表示するWebアプリケーション

## Requirements

### Functional Requirements
- RSS源：
  - AWS新機能情報: https://aws.amazon.com/about-aws/whats-new/recent/feed/
  - Martin Fowlerブログ: https://martinfowler.com/feed.atom
- 自動更新：毎日朝6:30（JST）
- AI要約：Gemini APIで140字以内の日本語要約生成
- 表示：カード形式、時系列、20件ずつページネーション

### Non-Functional Requirements
- エラーハンドリング：ログ出力のみ
- 管理機能：不要
- データ保持：全記事永続保存

## Technology Stack
- Runtime: Bun + TypeScript
- Database: Cloudflare D1 (SQLite)
- AI Service: Google Gemini API (Free Tier)
- Frontend: Simple HTML/CSS/JavaScript
- Deployment: Cloudflare Workers
- Scheduling: Cloudflare Cron Triggers

## Architecture

### System Components
1. **RSS Fetcher**: RSSフィード取得・パース
2. **AI Summarizer**: Gemini API経由での要約生成
3. **Database Layer**: D1データベース操作
4. **Web Server**: HTMLページ配信・API提供
5. **Scheduler**: Cron Job実行

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
Web Interface Display
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
│   │   ├── web.ts            # HTML page handlers
│   │   ├── api.ts            # API endpoints
│   │   └── cron.ts           # Scheduled job handler
│   ├── services/
│   │   ├── rss-fetcher.ts    # RSS feed fetching & parsing
│   │   ├── ai-summarizer.ts  # Gemini API integration
│   │   ├── database.ts       # D1 database operations
│   │   └── logger.ts         # Logging utility
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── templates/
│   │   ├── index.html        # Main page template
│   │   └── styles.css        # CSS styles
│   └── utils/
│       ├── date.ts           # Date utilities
│       └── pagination.ts     # Pagination helpers
├── migrations/
│   └── 001_initial.sql       # Database migration
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json
└── tsconfig.json
```

## API Specifications

### GET /
- メインページ（HTML）を返す
- Query Parameters:
  - `page`: ページ番号（デフォルト: 1）
  - `source`: フィルター ('aws', 'martinfowler', 'all')

### GET /api/articles
- 記事一覧をJSON形式で返す
- Query Parameters:
  - `page`: ページ番号
  - `limit`: 1ページあたりの件数（デフォルト: 20）
  - `source`: フィルター

### POST /api/cron/update-feeds
- RSS更新の手動実行（開発・テスト用）

## Environment Variables
```bash
# Cloudflare Workers環境変数
GEMINI_API_KEY=your_gemini_api_key
DB=your_d1_database_binding
ENVIRONMENT=production # or development
```

## External API Integration

### Gemini API
- Model: gemini-1.5-flash
- Rate Limits: 15 requests/minute, 1500 requests/day
- Prompt Template:
```
以下の英語記事を140字以内の日本語で要約してください。技術的な内容を正確に、読みやすく伝えてください。

タイトル: {title}
内容: {content}

要約:
```

## Error Handling Strategy
- RSS取得失敗: ログ記録、次回実行時に再試行
- AI要約失敗: ログ記録、元記事をそのまま保存
- DB接続失敗: ログ記録、アプリケーション継続
- 全エラーは構造化ログとして記録

## Performance Considerations
- RSS解析: 並列処理で複数フィード同時取得
- AI要約: レート制限を考慮した順次処理
- DB操作: バッチ処理でパフォーマンス向上
- フロントエンド: 必要最小限のJavaScript

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