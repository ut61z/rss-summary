## 目的

フィード拡張を前提に、個別実装を排し「設定駆動」でスケールする構成へリファクタリングしたよ。新しいブログを追加するときにコード改修を不要にして、保守性・可読性・テスト容易性を一気に上げたのがゴールだよ。

## 変更概要

- 設定一元化: `src/config/feeds.ts` を新規追加
  - `id`/`url`/`format(rss|atom|auto)`/`displayName`/`color`/`enabled` を定義
  - 1行追加するだけでフィードを増やせる
- Fetcherの汎用化: `RSSFetcher`
  - `fetchFeed(def)` と `fetchAllFeeds()` を追加し設定ベースで並列取得
  - `auto` 時はXMLからRSS/Atomを自動判定
  - 既存互換のため `fetchAWSFeed`/`fetchMartinFowlerFeed`/`fetchGitHubChangelogFeed` は薄いラッパーとして残存（テスト互換性維持）
- Cronの共通処理化: `CronHandler`
  - `Object.entries(feeds)` で全ソースを同一ロジック処理
  - 取得件数を `perSourceCounts` に集約してログ出力
- Discordの表示定義を設定参照化: `DiscordNotifier`
  - `displayName` と `color` を `feeds.ts` から参照
- 型の統一: `FeedSource` を導入し `Article.feed_source`/`ArticleFilter.source` に適用

## 影響範囲・互換性

- 既存のテストが依存しているメソッド名（`fetchAWSFeed` 等）はラッパーで維持しているから破壊的変更はなし
- 追加フィードは `feeds.ts` に追記すればCron〜DB保存〜Discord通知まで自動で流れる

## 動作確認

- 型チェック: `npm run type-check`（pass）
- テスト: `bun test`（69 passed / 0 failed）
- デバッグ実行: `bun run scripts/debug-summary.ts`
  - Discordテスト通知が成功
  - 既存3フィード（AWS / Martin Fowler / GitHub Changelog）で記事取得→要約→通知が正常完了

## 追加の運用TIPS

- 一時停止: 一時的に止めたいフィードは `enabled: false`
- 表示/色: Discord埋め込みは `displayName`/`color` を使用（設定のみで変更OK）

## フォローアップ候補（別PR想定）

- フィードごとのレート制限/リトライ（指数バックオフ）
- 取得件数・カテゴリフィルタの設定化
- 通知先Webhookをフィードごとに切り替え（チャンネル分割）
- 重複検出の強化（`guid`/正規化URL/ハッシュ）

## 変更ファイル（主）

- 新規: `src/config/feeds.ts`
- 変更: `src/services/rss-fetcher.ts`、`src/handlers/cron.ts`、`src/services/discord-notifier.ts`、`src/types/index.ts`

## リスク

- 解析の互換性: Atomの `link` 形式（配列/オブジェクト/文字列）を網羅しているが、特殊XMLには追加対応が必要になる可能性あり
- ネットワーク失敗時: `Promise.allSettled` により部分成功で継続、ログで検知（現状の方針を踏襲）

