**PR タイトル案**
- feat: GitHub Changelog の RSS を追加して要約・Discord 通知に対応

**概要**
- GitHub Changelog の RSS フィードを新規購読して、既存の AWS / Martin Fowler と同様に要約＆Discord 通知まで流すようにした。
  これにより、GitHub の変更情報（Changelog）も自動でキャッチできる。

**背景**
- 要望: https://github.blog/changelog/feed/ を購読対象に追加したい（“購入”ではなく“購読”）。
- 既存は AWS と Martin Fowler の2本。運用フローは維持しつつ3本目のソースを追加。

**変更点**
- 取得: `src/services/rss-fetcher.ts`
  - `fetchGitHubChangelogFeed()` を追加（RSS 2.0）。
  - `fetchAllFeeds()` を AWS / Martin Fowler / GitHub Changelog の3本並列に拡張。
  - パース失敗時のエラーメッセージを一般化（RSS/Atom で共通化）。
- 処理: `src/handlers/cron.ts`
  - `github_changelog` の記事も保存・Discord 通知対象に追加。
  - 完了ログに `githubChangelogArticles` を追加。
- 型: `src/types/index.ts`
  - `Article.feed_source` と `ArticleFilter.source` に `'github_changelog'` を追加。
- 通知: `src/services/discord-notifier.ts`
  - `github_changelog` のカラー（GitHub Purple: `0x6e5494`）と表示名「GitHub Changelog」を追加。
- デバッグ: `scripts/debug-summary.ts`
  - GitHub Changelog 記事も要約テスト対象に追加。
- ユーティリティ: `scripts/discord-test.ts` を追加（Webhook 通知の単体テスト用）。
  - `package.json` に `discord:test` スクリプトを追加。
- テスト: 既存テストの文言調整＋GitHub Changelog 追加分を網羅し、全テストをパス。

**実装詳細**
- 追加 Feed URL: https://github.blog/changelog/feed/
- `feed_source` 値: `github_changelog`
- パース:
  - RSS 2.0: `title`, `link`, `pubDate`, `description` を取り出し。
  - Atom: 既存（Martin Fowler 用）実装を流用。
- 保存ポリシー: URL 重複チェック → 未保存なら D1 `articles` に Insert → Discord 通知。
- Discord 埋め込み:
  - フッター: 「GitHub Changelog」。
  - カラー: `0x6e5494`。
  - タイムスタンプ: 記事の公開日時（不正な場合は現在時刻）。

**動作確認**
- ローカル起動: `npm run dev`。
- 手動実行（要トークン）:
  - `.dev.vars` に `ADMIN_TOKEN` を設定。
  - `curl -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8787/api/cron/update-feeds`。
  - 期待: 新規記事があれば D1 に保存され、Discord に順次通知される。
- Discord Webhook 単体テスト:
  - `.dev.vars` に `DISCORD_WEBHOOK_URL` を設定。
  - `bun run scripts/discord-test.ts`（または `npm run discord:test`）。
  - 期待: 「テスト通知 - Discord連携確認」が Discord に届く。
- デバッグ要約テスト:
  - `GEMINI_API_KEY` を設定。
  - `bun run scripts/debug-summary.ts`。
  - 期待: 3ソース（AWS / Martin / GitHub）から1件ずつ拾って要約・通知。

**テスト結果**
- 実行: `bun test`。
- 結果: 69 pass / 0 fail。
- カバレッジ（参考）:
  - `src/services/rss-fetcher.ts`: Lines 100%。
  - `src/handlers/cron.ts`: Lines ~85%。
  - 主要ファイルは既存水準を維持。

**影響範囲**
- DB: マイグレーション不要（`feed_source` は TEXT）。
- 型: `feed_source` のユニオン拡張あり。外部参照があれば `'github_changelog'` を追加扱いに調整が必要。
- ログ: 完了ログに GitHub 件数を追加（運用可視化に有用）。

**リスクと対策**
- 新規 RSS のXML差異: 失敗時は当該ソースのみ空配列にフォールバック（他ソースは継続）。
- Discord Rate Limit: 既存の 100ms ウェイトを維持。
- 要約失敗: 保存・通知は継続（`summary_ja` は未設定で保存）。

**デプロイ手順**
- 機密はWranglerの`secret/vars`に設定：
  - `wrangler secret put DISCORD_WEBHOOK_URL`
  - `wrangler secret put GEMINI_API_KEY`
  - `wrangler secret put ADMIN_TOKEN`
- デプロイ: `npm run deploy`。

**ロールバック**
- 早期停止: `fetchAllFeeds()` から `fetchGitHubChangelogFeed()` 呼び出しを一時除外。
- 完全撤回: `feed_source = 'github_changelog'` の記事を手動削除。

**関連**
- Issue: 必要なら追記（例: `Closes #<issue-number>`）。

**スクリーンショット／ログ**
- Discord テスト通知: 「テスト通知 - Discord連携確認」を実送信して成功を確認済み。
- Cron 完了ログ: `processedCount`, `newArticlesCount`, `errorCount`, `awsArticles`, `martinfowlerArticles`, `githubChangelogArticles` を出力。

**チェックリスト**
- [x] コード: TypeScript `strict` 準拠
- [x] テスト: `bun test` パス
- [x] Lint: `npm run lint`
- [x] 型検査: `npm run type-check`
- [x] 機密情報のコミットなし（`.dev.vars` のみローカル）
- [x] PR 説明に検証手順とエンドポイントを記載
