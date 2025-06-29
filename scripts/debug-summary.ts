#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';
import { RSSFetcher } from '../src/services/rss-fetcher';
import { AISummarizer } from '../src/services/ai-summarizer';
import type { RSSFeedItem } from '../src/types';

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

  try {
    // AWS と Martin Fowler から記事を取得
    console.log('📡 RSSフィードから記事を取得中...');
    const awsArticles = await fetcher.fetchAWSFeed();
    const fowlerArticles = await fetcher.fetchMartinFowlerFeed();
    
    // 最新の記事を1つずつピックアップ
    const testArticles: RSSFeedItem[] = [];
    
    if (awsArticles.length > 0) {
      testArticles.push(awsArticles[0]);
    }
    
    if (fowlerArticles.length > 0) {
      testArticles.push(fowlerArticles[0]);
    }

    if (testArticles.length === 0) {
      console.log('❌ テスト用記事が見つかりませんでした');
      return;
    }

    console.log(`\n📄 ${testArticles.length}記事をテスト対象として選択\n`);

    // 各記事の要約を生成してテスト
    for (let i = 0; i < testArticles.length; i++) {
      const article = testArticles[i];
      
      console.log(`--- 記事 ${i + 1} ---`);
      console.log(`📰 タイトル: ${article.title}`);
      console.log(`🔗 URL: ${article.url}`);
      console.log(`📅 公開日: ${article.published_date}`);
      console.log(`📝 元コンテンツ長: ${article.content?.length || 0}文字`);
      
      if (article.content) {
        console.log('\n🤖 AI要約を生成中...');
        try {
          const result = await summarizer.summarizeArticle({
            title: article.title,
            content: article.content
          });
          const summary = result.summary;
          
          console.log(`✅ 要約完了 (${summary.length}文字):`);
          console.log(`📋 要約: ${summary}`);
          
        } catch (error) {
          console.log(`❌ 要約生成エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('⚠️ 元コンテンツが空のため要約をスキップ');
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error instanceof Error ? error.message : String(error));
  }
}

// スクリプト実行
debugSummary().catch(console.error);