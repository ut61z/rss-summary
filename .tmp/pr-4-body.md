**概要**
- 目的: Web UI を廃止し、Cloudflare Workers のバックエンド（API/Cron/Discord 通知）へ機能を集約し、攻撃面積とメンテナンスコストを削減します。
- 範囲: ブランチ `slim-to-batch` → `main`。
- 変更規模: 11 ファイル変更（+122/−1,673）、1 コミット（aaddec29867c6f74307cf70a5bd6c2d72d0df23a）。

**主な変更**
- Web UI の廃止:
  - `src/templates/index.html` を削除（−531）。
  - `src/handlers/web.ts` を削除（−619）。
  - `tests/handlers/web.test.ts` を削除（−238）。
- API/テストの整理:
  - `src/handlers/api.ts` を整理（+1/−54）。
  - `tests/handlers/api.test.ts` を整理（+2/−161）。
  - `src/index.ts` を更新（+22/−12）、`src/types/index.ts` を更新（+2/−1）。
- ドキュメント更新:
  - `AGENTS.md` を追加（+48）。
  - `CLAUDE.md` と `doc/rss-feed-system-specs.md` を「フロントエンドなし（管理 API のみ）」構成に合わせて更新（+19/−22、+23/−34）。
- 環境変数の整備:
  - `.dev.vars.example` に `ADMIN_TOKEN` を追加（+5/−1）。

**API/運用の変更点**
- 管理系エンドポイントは `Authorization: Bearer ${ADMIN_TOKEN}` を必須化。
- 提供エンドポイント（例）:
  - `POST /api/cron/update-feeds`（手動フィード更新）
  - `POST /api/discord/test`（Discord Webhook 疎通）
  - `GET /api/health`（ヘルスチェック）
- ルート `/` での HTML 提供は廃止。ブラウザ表示は対象外となります。

**動作確認手順**
- 事前準備（ローカル・本番の双方で必要に応じて設定）:
  - `.dev.vars` に以下を設定: `GEMINI_API_KEY=...`、`DISCORD_WEBHOOK_URL=...`（通知利用時）、`ADMIN_TOKEN=...`。
  - 本番は Wrangler の `secret`/`vars` を使用（例: `wrangler secret put ADMIN_TOKEN`）。
- ローカル起動: `npm run dev`。
- 正常系確認（例）:
  - ヘルス: `curl -i http://127.0.0.1:8787/api/health`
  - 手動更新: `curl -i -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8787/api/cron/update-feeds`
  - Discord 疎通: `curl -i -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8787/api/discord/test`
- テスト/静的検査:
  - `npm test` または `bun test`
  - `npm run lint`
  - `npm run type-check`

**互換性/移行**
- 破壊的変更: Web UI は提供終了。手動操作は管理 API へ移行（Bearer 認可が必須）。
- 移行のポイント:
  - ブラウザ経由の参照/操作は API に置き換え。
  - バッチ処理/通知は既存の Cron と Discord 通知に集約。
  - `ADMIN_TOKEN` を本番環境に登録（Wrangler の `secret`/`vars`）。

**セキュリティ**
- UI 廃止により公開面を縮小。手動系は Bearer 認可で統一。
- 機密情報は `.dev.vars` をコミットせず、本番は Wrangler `secret` を利用。

**パフォーマンス/保守性**
- 不要資産（テンプレート/ハンドラ/テスト）削除により差分が大幅減少（+122/−1,673）。読みやすさと変更容易性が向上。

**リスク/ロールバック**
- リスク: UI 依存の運用手順が残存している場合、移行直後に運用断が生じる可能性。公開前に手順書更新と API 疎通確認を実施。
- ロールバック: 問題がある場合、この PR を Revert するか、コミット `aaddec29867c6f74307cf70a5bd6c2d72d0df23a` を Revert して一時復旧可能。

**チェックリスト**
- [ ] `npm test` / `bun test` が成功
- [ ] `npm run lint` と `npm run type-check` が成功
- [ ] 本番環境に `ADMIN_TOKEN` を登録済み（`wrangler secret put ADMIN_TOKEN`）
- [ ] 運用手順書を API ベースに更新済み
- [ ] 監視/通知（Discord）の稼働確認済み
