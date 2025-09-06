# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 注意点
- t_wadaがいうTDDで開発を進めてください


## プロジェクト概要

RSSフィードを取得して日本語要約し、Discordに通知するバックエンドサービス：
- AWS新機能情報とMartin FowlerブログのRSSフィードを取得
- Google Gemini 2.0-flash で日本語要約を生成（実装で最大400文字にバリデーション）
- Cloudflare Workers と D1 データベースで動作（Web UI なし）
- 手動RSS更新は管理APIから実行
- Discord Webhook に新記事を通知

## 技術スタック

- **ランタイム**: Bun 1.2.17 (mise管理) + TypeScript 5.6.3
- **データベース**: Cloudflare D1 (SQLite) - パフォーマンスインデックス付き
- **AI サービス**: Google Gemini 2.0-flash model (15req/min, 1500req/day制限)
- **XMLパーサー**: fast-xml-parser (RSS/Atom対応)
- **フロントエンド**: なし（管理APIのみ）
- **テストフレームワーク**: Bun built-in test runner + comprehensive test suite
- **開発ツール**: ESLint, mise runtime manager, デバッグ用スクリプト
- **デプロイ**: Cloudflare Workers (production/staging/development環境分離)
- **スケジューリング**: Cloudflare Cron Triggers (毎日6:30 AM)

## アーキテクチャ

レイヤード アーキテクチャで以下のコンポーネントから構成：

### サービス層 (`src/services/`)
- `rss-fetcher.ts`: RSSフィード取得・パース処理
- `ai-summarizer.ts`: Gemini API連携による日本語要約生成
- `database.ts`: D1データベース操作（articles、logsテーブル）
- `logger.ts`: 構造化ログ出力ユーティリティ
- `discord-notifier.ts`: Discord Webhookによる新記事・エラー通知処理

### ハンドラー層 (`src/handlers/`)
- `api.ts`: 管理API（手動トリガー、ヘルスチェック、Discord疎通）
- `cron.ts`: 定期RSS更新ジョブ（毎日6:30 JST）

### データ層
- articlesテーブル: RSS記事と日本語要約を保存
- logsテーブル: 構造化エラー・情報ログを保存

## 開発コマンド

### 基本開発コマンド
- `bun install` - 依存関係インストール
- `bun run dev` - ローカル開発サーバー起動
- `bun test` - テストスイート実行（TDD開発用）
- `bun run deploy` - 本番環境へデプロイ
- `wrangler deploy --env staging` - ステージング環境へデプロイ
- `bun run debug:summary` - 特定記事の要約をデバッグ実行
- `bun run lint` - ESLintによるコードチェック

### データベース管理
- `wrangler d1 migrations apply RSS_SUMMARY_DB --local` - ローカルDBマイグレーション
- `wrangler d1 migrations apply RSS_SUMMARY_DB --remote` - 本番DBマイグレーション

### 開発環境セットアップ
- `mise install` - Bun 1.2.17のインストール（mise.toml設定）

## 環境設定

必要な環境変数：
- `GEMINI_API_KEY`: Google Gemini API キー（要約生成用）
- `DISCORD_WEBHOOK_URL`: Discord Webhook URL（通知用、オプション）
- `ADMIN_TOKEN`: 管理API用のベアラートークン
- `DB`: D1データベースバインディング
- `ENVIRONMENT`: production、staging、または development

## 主要ビジネスロジック

### RSS処理フロー
1. Cronトリガー（毎日 6:30 JST）
2. 2ソース取得：AWS新機能フィード、Martin Fowler Atomフィード
3. パース → URL一意性で重複チェック
4. Gemini 2.0-flash で要約生成（実装で最大400文字）
5. 記事を D1 データベースに保存
6. 新記事を Discord Webhook で通知

### APIエンドポイント
- `POST /api/cron/update-feeds`: 手動RSS更新トリガー（要 `Authorization: Bearer ${ADMIN_TOKEN}`）
- `POST /api/discord/test`: Discord疎通テスト（要 `Authorization: Bearer ${ADMIN_TOKEN}`）
- `GET /api/health`: ヘルスチェック
- `OPTIONS /*`: CORS プリフライト対応

### エラーハンドリング戦略
- **RSS取得失敗**: ログ記録し次回スケジュール実行で再試行
- **AI要約失敗**: 指数バックオフによる3回リトライ、失敗時は要約なしで記事保存
- **データベース失敗**: エラーログ記録しアプリケーション継続
- **重複記事**: URL一意性チェックでスキップ（既存データは更新しない）
- **レート制限**: Gemini APIは15req/min制限を考慮した順次処理
- **Discord通知失敗**: ログ記録しアプリケーション継続（通知失敗は致命的エラーではない）
- **全エラー**: 構造化ログとしてD1データベースに保存

## データベーススキーマ

### articlesテーブル
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_date TEXT NOT NULL,
  feed_source TEXT NOT NULL, -- 'aws' または 'martinfowler'
  original_content TEXT,
  summary_ja TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- パフォーマンスインデックス
CREATE INDEX idx_published_date ON articles(published_date DESC);
CREATE INDEX idx_feed_source ON articles(feed_source);
CREATE INDEX idx_created_at ON articles(created_at DESC);
```

### logsテーブル
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL, -- 'info', 'error', 'warn'
  message TEXT NOT NULL,
  details TEXT, -- JSON文字列
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## レート制限とパフォーマンス

- **Gemini 2.0-flash API**: 15リクエスト/分、1500リクエスト/日（指数バックオフリトライ）
- **RSS取得**: AWS・Martin Fowlerフィードの並列処理
- **AI要約**: APIレート制限考慮の順次処理（実装で最大400文字）
- **データベース**: インデックス最適化、バッチ操作によるパフォーマンス向上

## フィード取得対象

- **AWS新機能**: `https://aws.amazon.com/about-aws/whats-new/recent/feed/` (RSS形式)
- **Martin Fowler**: `https://martinfowler.com/feed.atom` (Atom形式)

## テスト戦略（TDD）

- **テストフレームワーク**: Bun built-in test runner
- **カバレッジ**: 全サービス・ハンドラーの包括的テスト
- **モック**: AI API・データベース・RSS取得のモック対応
- **テストコマンド**: `bun test` で全テスト実行
