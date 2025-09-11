# Repository Guidelines

## プロジェクト構成と配置
- `src/`: アプリ本体（`handlers/` API・Web・Cron、`services/` RSS・DB・AI・Discord・Logger、`templates/` HTML、`types/` 型定義、`index.ts` エントリ）。
- `tests/`: Bun のユニットテスト（`*.test.ts`）。
- `migrations/`: D1 用 SQL マイグレーション。
- `scripts/`: 開発補助スクリプト（例: `debug-summary.ts`）。
- 主要ファイル: `wrangler.toml`（Cloudflare Workers 設定）、`tsconfig.json`、`package.json`、`.dev.vars`（ローカル環境変数）。

## ビルド・実行・開発コマンド
- `npm run dev`: Wrangler でローカル起動（Workers + D1 バインド）。
- `npm run deploy`: 本番へデプロイ。
- `npm test` / `bun test`: テスト実行。`npm run test:watch` で監視実行。
- `npm run lint`: ESLint 実行。`npm run type-check`: TypeScript 型検査。
- DB: `npm run db:create`（D1 作成）、`npm run db:migrate`（マイグレーション適用）。
- デバッグ: `bun run scripts/debug-summary.ts`（要約ロジック単体確認）。

## 開発フロー（Green 維持）
- 変更を加えるたびに以下を実行し、全て成功（green）であることを必ず確認する。
  - `bun run lint`（ESLint）
  - `bun run type-check`（TypeScript 型検査）
  - `bun test`（ユニットテスト）
- ウォッチ活用（任意）: `bun test --watch` でテストを常時実行し、素早くフィードバックを得る。
- CI 互換性: 上記コマンドは GitHub Actions（`ci.yml`）と同一。ローカルで green なら CI も原則通過する。
- 自動修正（任意）: フォーマット起因の指摘は `bun run lint -- --fix` で自動修正を適用できる。

### pre-commit（Husky）
- 目的: コミット前に `lint` / `type-check` / `test` を自動実行して、失敗コミットを防ぐ。
- セットアップ（初回のみ）:
  1) 依存追加: `bun add -D husky`（または `npm i -D husky`）
  2) フック有効化: `npm run prepare`（`package.json` に設定済み）
  3) 既存の `.husky/pre-commit` は用意済み。権限がない場合は `chmod +x .husky/pre-commit`
- 実行内容: `bun run precommit:check`（= `bun run lint && bun run type-check && bun test`）
- 注意: Bun が必要（`bun -v`）。未インストールの環境では hook がエラー終了する。

## コーディング規約・命名
- 言語: TypeScript（`strict: true`）。インデント 2 スペース、末尾セミコロン省略可。
- ファイル名: `kebab-case`（例: `ai-summarizer.ts`）。クラス: `PascalCase`。変数/関数: `camelCase`。定数: `UPPER_SNAKE_CASE`。
- Import: `@/*` パスエイリアス使用可（`tsconfig.json`）。
- ログ出力は `Logger` を使用（`console.log` は避ける）。環境値は `src/types/index.ts` の型に沿って参照。

## テスト指針
- フレームワーク: `bun:test`。モックは `mock` を使用。
- 位置と命名: `tests/**/**.test.ts`、対象モジュールと同名で配置。
- 実行例: `bun test --coverage`（カバレッジ任意、主要サービス/ハンドラは網羅）。
- 新規/修正時は成功パスと異常系の双方を追加。

## コミットと Pull Request
- スタイル: Conventional Commits（例: `feat:`, `fix:`, `docs:`, `test:`, `chore:`）。
- 例: `fix: Discord 通知の Invalid time value を修正`、`test: add RSSFetcher invalid XML cases`。
- PR には説明、関連 Issue、動作確認手順（スクリーンショットや `curl` 結果）を含める。コミット/PR 前に必ず以下をローカルで green にする: `bun run lint`、`bun run type-check`、`bun test`。

## セキュリティと設定
- 秘密情報は `.dev.vars`（ローカル）に置き、コミットしない。例:
  ```bash
  GEMINI_API_KEY=...
  DISCORD_WEBHOOK_URL=...
  ADMIN_TOKEN=...
  ```
- 本番は Wrangler の `secret`/`vars` を利用（例: `wrangler secret put GEMINI_API_KEY`）。
- D1 は `wrangler.toml` の `binding: DB` を使用。マイグレーションは `migrations/` を単一責務で追加。

### 認可（手動API）
- 保護対象: `POST /api/cron/update-feeds`、`POST /api/discord/test`。
- ヘッダー: `Authorization: Bearer ${ADMIN_TOKEN}` を必須化。
- 例: `curl -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8787/api/cron/update-feeds`。

## 設計思想（フィード拡張に強い構成）
- 設定駆動: フィード定義を `src/config/feeds.ts` に集約し、`id`/`url`/`format(rss|atom|auto)`/`displayName`/`color`/`enabled` を宣言。追加は1行で完結。
- 単一責務・疎結合: 取得（`RSSFetcher`）/処理（`CronHandler`）/通知（`DiscordNotifier`）/表示定義（`feeds.ts`）を分離。
- フォーマット抽象化: RSS/Atom を統一インターフェースでパース。`auto` 指定時はXMLから自動判定。
- 部分失敗許容: 取得は `Promise.allSettled` で並列実行し、失敗は局所化して継続。件数は `perSourceCounts` としてログ化。
- 互換性維持: デバッグ専用ラッパー（例: `fetchAWSFeed` 等）は廃止し、`fetchById`/`fetchMany` に統一。テスト・スクリプトは `FeedSource` の `id` を指定して呼び出す。
- 型一貫性: `FeedSource` を設定から導出し、`Article.feed_source` などに適用。

### 運用手順（フィード追加）
1. `src/config/feeds.ts` の `FEEDS` 配列にエントリを1つ追加。
2. `npm run type-check` と `bun test` を実行して型とテストを確認。
3. （任意）`bun run scripts/debug-summary.ts` で取得・要約・通知の流れを確認。
