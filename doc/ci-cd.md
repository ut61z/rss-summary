## GitHub Actions での CI/CD 設定

このプロジェクトは GitHub Actions を用いた CI と Cloudflare Workers への CD を用意しています。Bun を標準の実行環境として使い、型検査・Lint・テストを必ず通してからデプロイします。

### 構成
- `.github/workflows/ci.yml`: PR と `main`/`develop` への push で実行。`bun install` → `type-check` → `lint` → `bun test` を実行。
- `.github/workflows/deploy.yml`: `main` への push、`v*.*.*` タグ、または手動実行で実行。上記 CI と同じ検証後、Cloudflare D1 のマイグレーションを適用し、本番 (`--env production`) にデプロイします。

### 事前準備（GitHub Secrets）
以下を GitHub リポジトリの Secrets として登録してください（Settings → Secrets and variables → Actions）。

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare のアカウント ID。
- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token（Workers KV 不要、Workers および D1 の読み書き権限を付与）。

Secrets はデプロイ時に `wrangler secret put` で Cloudflare 側に同期されます。GitHub 側に未設定の値は同期されません（該当ステップはスキップ）。

### Cloudflare 側の前提
- `wrangler.toml` の `env.production` に本番の D1 Database が定義されています。
- D1 のマイグレーションは `migrations/` ディレクトリから適用します。
- スケジュール実行は `env.production.triggers.crons` で定義されます。

### 実行フロー
1. 依存関係を `bun install --frozen-lockfile` でインストール。
2. `bun run type-check` と `bun run lint` を実行。
3. `bun test --coverage` を実行。
4. `wrangler d1 migrations apply rss-summary-prod-db --remote --env production` を実行。
5. `wrangler deploy --env production` で本番環境にデプロイ。

### 環境保護（推奨）
GitHub の環境 `production` に Required reviewers を設定すると、`deploy.yml` は承認後にデプロイされます（Settings → Environments → New environment → `production`）。

### よくある質問
- Q: CI で Node.js も入れているのはなぜ？
  - A: `wrangler` は Node 製 CLI であり、Bun だけでも動作しますが Node も併用するとトラブルシュートが容易です。
- Q: ローカル名 `rss-summary-db` と本番名が違うけど？
  - A: ローカル開発コマンドは簡易名を使っています。本番は `wrangler.toml` の `env.production` に定義された `rss-summary-prod-db` を対象にマイグレーションします。

