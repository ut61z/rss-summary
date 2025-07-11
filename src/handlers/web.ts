import type { DatabaseService } from '../services/database';
import type { Logger } from '../services/logger';
import type { ArticleFilter } from '../types';

export class WebHandler {
  private htmlTemplate: string | null = null;

  constructor(
    private database: DatabaseService,
    private logger: Logger
  ) {}

  async handleHomeRequest(request: Request): Promise<Response> {
    try {
      const html = await this.getHTMLTemplate();
      
      await this.logger.info('Home page request', {
        url: request.url,
        userAgent: request.headers.get('User-Agent')
      });

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300' // 5分キャッシュ
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('Home page request failed', {
        error: errorMessage,
        url: request.url
      });

      return new Response(this.getErrorHTML(errorMessage), {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }
  }

  private async getHTMLTemplate(): Promise<string> {
    if (this.htmlTemplate) {
      return this.htmlTemplate;
    }

    // In a real Cloudflare Workers environment, you would import the HTML file
    // For now, we'll return a simplified template
    this.htmlTemplate = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSS要約フィード</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 0;
            margin-bottom: 2rem;
            border-radius: 10px;
        }

        h1 {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 700;
        }

        .subtitle {
            text-align: center;
            margin-top: 0.5rem;
            opacity: 0.9;
            font-size: 1.1rem;
        }

        .filters {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .filter-group {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .filter-label {
            font-weight: 600;
            color: #555;
        }

        select, button {
            padding: 0.7rem 1rem;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        select:focus, button:focus {
            outline: none;
            border-color: #667eea;
        }

        button {
            background: #667eea;
            color: white;
            border-color: #667eea;
            cursor: pointer;
            font-weight: 600;
        }

        button:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }

        .loading {
            text-align: center;
            padding: 2rem;
            font-size: 1.2rem;
            color: #666;
        }

        .articles-grid {
            display: grid;
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .article-card {
            background: white;
            border-radius: 10px;
            padding: 1.5rem;
            box-shadow: 0 2px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border-left: 4px solid #667eea;
        }

        .article-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 25px rgba(0,0,0,0.15);
        }

        .article-card.aws {
            border-left-color: #ff9500;
        }

        .article-card.martinfowler {
            border-left-color: #2ecc71;
        }

        .article-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: #333;
            margin-bottom: 0.5rem;
            line-height: 1.4;
        }

        .article-title a {
            color: inherit;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .article-title a:hover {
            color: #667eea;
        }

        .article-meta {
            display: flex;
            gap: 1rem;
            align-items: center;
            margin-bottom: 1rem;
            flex-wrap: wrap;
        }

        .source-tag {
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .source-tag.aws {
            background: #fff5e6;
            color: #ff9500;
        }

        .source-tag.martinfowler {
            background: #e8f5e8;
            color: #2ecc71;
        }

        .article-date {
            color: #666;
            font-size: 0.9rem;
        }

        .article-summary {
            font-size: 1.05rem;
            line-height: 1.7;
            color: #444;
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            border-left: 3px solid #667eea;
        }

        .pagination {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin: 2rem 0;
        }

        .pagination button {
            min-width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .pagination button.active {
            background: #333;
            border-color: #333;
        }

        .pagination button:disabled {
            background: #ccc;
            border-color: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .stats {
            text-align: center;
            margin: 1rem 0;
            color: #666;
            font-size: 0.9rem;
        }

        .error {
            background: #fee;
            color: #c33;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            border-left: 4px solid #c33;
        }

        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }

        .empty-state h3 {
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            h1 {
                font-size: 2rem;
            }

            .filter-group {
                flex-direction: column;
                align-items: stretch;
            }

            .article-meta {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📰 RSS要約フィード</h1>
            <p class="subtitle">AWSとMartin FowlerのRSSフィードを日本語要約で配信</p>
        </header>

        <div class="filters">
            <div class="filter-group">
                <label class="filter-label">フィルター:</label>
                <select id="sourceFilter">
                    <option value="all">すべて</option>
                    <option value="aws">AWS ニュース</option>
                    <option value="martinfowler">Martin Fowler</option>
                </select>
                <button onclick="loadArticles()">更新</button>
                <button onclick="triggerUpdate()">RSS更新</button>
            </div>
        </div>

        <div id="loading" class="loading" style="display: none;">
            読み込み中...
        </div>

        <div id="error" class="error" style="display: none;"></div>

        <div id="stats" class="stats"></div>

        <div id="articles" class="articles-grid"></div>

        <div id="pagination" class="pagination"></div>
    </div>

    <script>
        let currentPage = 1;
        let currentSource = 'all';
        const articlesPerPage = 20;

        document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            currentPage = parseInt(urlParams.get('page')) || 1;
            currentSource = urlParams.get('source') || 'all';
            
            document.getElementById('sourceFilter').value = currentSource;
            loadArticles();
        });

        document.getElementById('sourceFilter').addEventListener('change', function() {
            currentSource = this.value;
            currentPage = 1;
            loadArticles();
        });

        async function loadArticles() {
            try {
                showLoading(true);
                hideError();

                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: articlesPerPage.toString(),
                    source: currentSource
                });

                const response = await fetch(\`/api/articles?\${params}\`);
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                
                displayArticles(data.data);
                displayPagination(data);
                displayStats(data);
                updateURL();

            } catch (error) {
                showError(\`記事の読み込みに失敗しました: \${error.message}\`);
            } finally {
                showLoading(false);
            }
        }

        function displayArticles(articles) {
            const container = document.getElementById('articles');
            
            if (articles.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <h3>📝 記事が見つかりません</h3>
                        <p>選択したフィルターに該当する記事がありません。</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = articles.map(article => \`
                <div class="article-card \${article.feed_source}">
                    <h2 class="article-title">
                        <a href="\${article.url}" target="_blank" rel="noopener">
                            \${escapeHtml(article.title)}
                        </a>
                    </h2>
                    <div class="article-meta">
                        <span class="source-tag \${article.feed_source}">
                            \${article.feed_source === 'aws' ? 'AWS' : 'Martin Fowler'}
                        </span>
                        <span class="article-date">
                            \${formatDate(article.published_date)}
                        </span>
                    </div>
                    \${article.summary_ja ? \`
                        <div class="article-summary">
                            \${escapeHtml(article.summary_ja)}
                        </div>
                    \` : ''}
                </div>
            \`).join('');
        }

        function displayPagination(data) {
            const container = document.getElementById('pagination');
            const totalPages = data.totalPages;
            
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }

            let pagination = '';
            
            pagination += \`<button onclick="changePage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>‹</button>\`;
            
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);
            
            if (startPage > 1) {
                pagination += \`<button onclick="changePage(1)">1</button>\`;
                if (startPage > 2) pagination += \`<span>...</span>\`;
            }
            
            for (let i = startPage; i <= endPage; i++) {
                pagination += \`<button onclick="changePage(\${i})" \${i === currentPage ? 'class="active"' : ''}>\${i}</button>\`;
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) pagination += \`<span>...</span>\`;
                pagination += \`<button onclick="changePage(\${totalPages})">\${totalPages}</button>\`;
            }
            
            pagination += \`<button onclick="changePage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''}>›</button>\`;
            
            container.innerHTML = pagination;
        }

        function displayStats(data) {
            const container = document.getElementById('stats');
            const start = (data.page - 1) * data.limit + 1;
            const end = Math.min(data.page * data.limit, data.total);
            container.textContent = \`\${start}-\${end} / \${data.total}件の記事\`;
        }

        function changePage(page) {
            if (page < 1) return;
            currentPage = page;
            loadArticles();
        }

        function updateURL() {
            const params = new URLSearchParams();
            if (currentPage > 1) params.set('page', currentPage.toString());
            if (currentSource !== 'all') params.set('source', currentSource);
            
            const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.replaceState({}, '', newURL);
        }

        async function triggerUpdate() {
            try {
                const button = event.target;
                button.disabled = true;
                button.textContent = '更新中...';

                const response = await fetch('/api/cron/update-feeds', {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}\`);
                }

                const result = await response.json();
                alert('RSS更新が開始されました。しばらくしてから画面を更新してください。');
                
            } catch (error) {
                alert(\`RSS更新に失敗しました: \${error.message}\`);
            } finally {
                const button = event.target;
                button.disabled = false;
                button.textContent = 'RSS更新';
            }
        }

        function showLoading(show) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }

        function showError(message) {
            const errorElement = document.getElementById('error');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    </script>
</body>
</html>`;

    return this.htmlTemplate;
  }

  private getErrorHTML(error: string): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エラー - RSS要約フィード</title>
    <style>
        body {
            font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 2rem;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .error-container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 {
            color: #c33;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
        .error-code {
            background: #fee;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            font-family: monospace;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>⚠️ エラーが発生しました</h1>
        <p>申し訳ございませんが、ページの読み込み中にエラーが発生しました。</p>
        <div class="error-code">${this.escapeHtml(error)}</div>
        <p>しばらく時間をおいてから再度お試しください。</p>
    </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}