#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';
import { RSSFetcher } from '../src/services/rss-fetcher';
import { AISummarizer } from '../src/services/ai-summarizer';
import { DiscordNotifier } from '../src/services/discord-notifier';
import type { RSSFeedItem, Article } from '../src/types';
import type { FeedSource } from '../src/config/feeds';

// スクリプト用のシンプルなロガー
class SimpleLogger {
  async info(message: string, details?: unknown): Promise<void> {
    console.log(`[INFO] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }

  async error(message: string, details?: unknown): Promise<void> {
    console.error(`[ERROR] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }

  async warn(message: string, details?: unknown): Promise<void> {
    console.warn(`[WARN] ${message}`, details ? JSON.stringify(details, null, 2) : '');
  }
}

// .dev.varsファイルから環境変数を読み込む
function loadDevVars() {
  try {
    const devVarsPath = join(process.cwd(), '.dev.vars');
    const content = readFileSync(devVarsPath, 'utf-8');
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  } catch (error) {
    console.warn('⚠️ .dev.varsファイルが読み込めませんでした:', error);
  }
}

async function debugSummary() {
  console.log('🔍 デバッグ: 要約機能のテスト');
  console.log('=' .repeat(50));

  // .dev.varsファイルから環境変数を読み込む
  loadDevVars();

  // 環境変数からAPIキーを取得
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY環境変数が設定されていません');
    return;
  }

  const fetcher = new RSSFetcher();
  const summarizer = new AISummarizer(apiKey);
  const logger = new SimpleLogger();
  const discordNotifier = new DiscordNotifier({
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    ENVIRONMENT: process.env.ENVIRONMENT || 'development'
  }, logger);

  try {
    // Discordテスト通知を先に実行
    console.log('📨 Discord通知のテストを実行中...');
    const testResult = await discordNotifier.testNotification();
    if (testResult) {
      console.log('✅ Discord通知テスト成功\n');
    } else {
      console.log('⚠️ Discord通知テスト失敗または未設定\n');
    }

    // 対象フィード（今後はここに追加するだけ）
    const TARGET_SOURCES: FeedSource[] = [
      'aws',
      'martinfowler',
      'github_changelog',
      'kaminashi_developer',
      'tidyfirst',
    ];

    console.log('📡 RSSフィードから記事を取得中...');
    const results = await fetcher.fetchMany(TARGET_SOURCES);

    // 最新の記事を1つずつピックアップ（sourceとセットで保持）
    const testEntries: Array<{ source: FeedSource; article: RSSFeedItem }> = [];
    for (const source of TARGET_SOURCES) {
      const list = results[source] || [];
      if (list.length > 0) testEntries.push({ source, article: list[0] });
    }

    if (testEntries.length === 0) {
      console.log('❌ テスト用記事が見つかりませんでした');
      return;
    }

    console.log(`\n📄 ${testEntries.length}記事をテスト対象として選択\n`);

    // 各記事の要約を生成してテスト
    for (let i = 0; i < testEntries.length; i++) {
      const { source, article } = testEntries[i];
      
      console.log(`--- 記事 ${i + 1} ---`);
      console.log(`🟦 ソース: ${source}`);
      console.log(`📰 タイトル: ${article.title}`);
      console.log(`🔗 URL: ${article.url}`);
      console.log(`📅 公開日: ${article.published_date}`);
      console.log(`📝 元コンテンツ長: ${article.content?.length || 0}文字`);
      
      let summary = '';
      
      if (article.content) {
        console.log('\n🤖 AI要約を生成中...');
        try {
          const result = await summarizer.summarizeArticle({
            title: article.title,
            content: article.content
          });
          summary = result.summary;
          
          console.log(`✅ 要約完了 (${summary.length}文字):`);
          console.log(`📋 要約: ${summary}`);
          
        } catch (error) {
          console.log(`❌ 要約生成エラー: ${error instanceof Error ? error.message : String(error)}`);
          summary = '要約生成に失敗しました';
        }
      } else {
        console.log('⚠️ 元コンテンツが空のため要約をスキップ');
        summary = '元コンテンツが空のため要約なし';
      }

      // Discord通知のテスト（要約が生成された記事のみ）
      if (summary && summary !== '要約生成に失敗しました' && summary !== '元コンテンツが空のため要約なし') {
        console.log('\n📨 Discord通知を送信中...');
        try {
          // Articleオブジェクトを作成
          const testArticle: Article = {
            id: 1000000 + i, // テスト用ID
            title: article.title,
            url: article.url,
            published_date: article.published_date,
            feed_source: source,
            original_content: article.content || '',
            summary_ja: summary,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await discordNotifier.notifyNewArticle(testArticle);
          console.log('✅ Discord通知送信完了');
          
        } catch (error) {
          console.log(`❌ Discord通知エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error instanceof Error ? error.message : String(error));
  }
}

// スクリプト実行
debugSummary().catch(console.error);
