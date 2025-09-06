#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscordNotifier } from '../src/services/discord-notifier';

class SimpleLogger {
  async info(message: string, details?: any): Promise<void> {
    console.log(`[INFO] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }
  async error(message: string, details?: any): Promise<void> {
    console.error(`[ERROR] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }
  async warn(message: string, details?: any): Promise<void> {
    console.warn(`[WARN] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }
}

function loadDevVars() {
  try {
    const devVarsPath = join(process.cwd(), '.dev.vars');
    const content = readFileSync(devVarsPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  } catch (error) {
    console.warn('⚠️ .dev.varsが読み込めませんでした:', error);
  }
}

async function main() {
  console.log('📨 Discord Webhook 通知テストを実行します');
  loadDevVars();

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.error('❌ DISCORD_WEBHOOK_URL が未設定です。.dev.vars を確認してください。');
    process.exit(1);
  }

  const logger = new SimpleLogger();
  const notifier = new DiscordNotifier({
    DISCORD_WEBHOOK_URL: webhook,
    ENVIRONMENT: process.env.ENVIRONMENT || 'development'
  }, logger as any);

  const ok = await notifier.testNotification();
  if (ok) {
    console.log('✅ Discordにテスト通知を送信しました。サーバー側で届いているか確認してください。');
  } else {
    console.log('⚠️ 通知をスキップまたは失敗しました。ログを確認してください。');
  }
}

main().catch(err => {
  console.error('❌ 実行エラー:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

