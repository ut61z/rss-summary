// ESLint v9 flat config
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // 無視パターン
  { ignores: ['node_modules/**', 'dist/**', '.wrangler/**', '.tmp/**', 'eslint.config.*'] },

  // JavaScript の基本推奨ルール
  js.configs.recommended,

  // TypeScript 向け設定
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // 型情報を使うルールは tsc に任せる。必要なら project を指定する。
        project: false,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // 推奨ルールを適用（flat config なので rules だけ展開）
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // TypeScript では no-undef は誤検知しやすいため無効化
      'no-undef': 'off',
      // any の使用を禁止（テストは別設定で許容）
      '@typescript-eslint/no-explicit-any': 'error',
      // ---- Style rules ----
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'only-multiline'],
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'sort-imports': ['error', {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: true,
        allowSeparatedGroups: true,
      }],
    },
  },

  // Cloudflare Workers / scripts で使うグローバル
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
      },
    },
  },

  // Bun のテスト用グローバル（bun:test）
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        mock: 'readonly',
      },
    },
    rules: {
      // テストでは any を許容
      '@typescript-eslint/no-explicit-any': 'off',
      // テストでは未使用変数の警告を抑制（モックや型importで出がち）
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
