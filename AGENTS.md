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
- PR には説明、関連 Issue、動作確認手順（スクリーンショットや `curl` 結果）を含める。CI 相当として以下を手元で実施: `npm test`、`npm run lint`、`npm run type-check`。

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
