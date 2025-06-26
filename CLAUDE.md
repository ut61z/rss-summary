# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 注意点
- t_wadaがいうTDDで開発を進めてください


## プロジェクト概要

RSSフィードを取得して日本語要約し、時系列でカード表示するWebアプリケーション：
- AWS新機能情報とMartin FowlerブログのRSSフィードを取得
- Google Gemini APIで日本語要約を生成
- 時系列カード形式でのWeb表示
- Cloudflare WorkersとD1データベースで動作

## 技術スタック

- **ランタイム**: Bun + TypeScript
- **データベース**: Cloudflare D1 (SQLite)
- **AI サービス**: Google Gemini API (Free Tier)
- **フロントエンド**: Simple HTML/CSS/JavaScript
- **デプロイ**: Cloudflare Workers
- **スケジューリング**: Cloudflare Cron Triggers

## アーキテクチャ

レイヤード アーキテクチャで以下のコンポーネントから構成：

### サービス層 (`src/services/`)
- `rss-fetcher.ts`: RSSフィード取得・パース処理
- `ai-summarizer.ts`: Gemini API連携による日本語要約生成
- `database.ts`: D1データベース操作（articles、logsテーブル）
- `logger.ts`: 構造化ログ出力ユーティリティ

### ハンドラー層 (`src/handlers/`)
- `web.ts`: HTMLページレンダリング・Web インターフェース
- `api.ts`: 記事取得用REST API エンドポイント
- `cron.ts`: 定期RSS更新ジョブ（毎日6:30 JST）

### データ層
- articlesテーブル: RSS記事と日本語要約を保存
- logsテーブル: 構造化エラー・情報ログを保存

## 開発コマンド

Cloudflare Workersプロジェクトのため、一般的なコマンド：
- `bun install` - 依存関係インストール
- `bun run dev` または `wrangler dev` - ローカル開発
- `bun run deploy` または `wrangler deploy` - Cloudflareへデプロイ
- `wrangler d1 migrations apply` - データベースマイグレーション実行

## 環境設定

必要な環境変数：
- `GEMINI_API_KEY`: Google Gemini API キー（要約生成用）
- `DB`: D1データベースバインディング
- `ENVIRONMENT`: production または development

## 主要ビジネスロジック

### RSS処理フロー
1. Cronトリガーが毎日6:30 JSTに実行
2. 2つのソースから取得：AWS新機能フィード、Martin Fowler Atomフィード
3. 記事をパースし、URL一意性で重複チェック
4. Gemini APIで140文字以内の日本語要約生成
5. 要約付き記事をD1データベースに保存

### APIエンドポイント
- `GET /`: メインHTMLページ（ページネーション・ソースフィルタリング付き）
- `GET /api/articles`: 記事一覧JSON API（ページネーション付き）
- `POST /api/cron/update-feeds`: 手動RSS更新トリガー

### エラーハンドリング戦略
- RSS取得失敗: ログ記録し次回スケジュール実行で再試行
- AI要約失敗: エラーログ記録するが要約なしで記事保存
- データベース失敗: エラーログ記録しアプリケーション継続
- 全エラーをデータベースに構造化ログとして保存

## データベーススキーマ

articlesテーブル: id, title, url（一意）, published_date, feed_source（'aws'|'martinfowler'）, original_content, summary_ja, タイムスタンプ

logsテーブル: id, level, message, details（JSON）, created_at

## レート制限とパフォーマンス

- Gemini API: 15リクエスト/分、1500リクエスト/日
- RSS取得: 複数フィードの並列処理
- AI要約: レート制限を考慮した順次処理
- データベース: パフォーマンス向上のためのバッチ操作