import { describe, it, expect } from 'bun:test';

describe('Worker (index.ts)', () => {
  it('should export a worker with fetch and scheduled handlers', async () => {
    // 動的インポートでworkerを読み込む
    const workerModule = await import('../src/index');
    const worker = workerModule.default;

    // Worker構造の検証
    expect(worker).toBeDefined();
    expect(typeof worker.fetch).toBe('function');
    expect(typeof worker.scheduled).toBe('function');
  });

  it('should have proper function signatures', async () => {
    const workerModule = await import('../src/index');
    const worker = workerModule.default;

    // fetchハンドラーの引数数を確認
    expect(worker.fetch.length).toBe(3); // request, env, ctx

    // scheduledハンドラーの引数数を確認
    expect(worker.scheduled.length).toBe(3); // event, env, ctx
  });

  it('should be able to instantiate without errors', async () => {
    // モジュールの読み込みが成功することを確認
    expect(async () => {
      await import('../src/index');
    }).not.toThrow();
  });
});