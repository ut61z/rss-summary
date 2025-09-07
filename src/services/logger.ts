import type { LogEntry } from '../types';

export class Logger {
  constructor(private db: D1Database) {}

  async info(message: string, details?: unknown): Promise<void> {
    await this.log('info', message, details);
  }

  async error(message: string, details?: unknown): Promise<void> {
    await this.log('error', message, details);
  }

  async warn(message: string, details?: unknown): Promise<void> {
    await this.log('warn', message, details);
  }

  private serializeDetails(details?: unknown): string | null {
    if (details === undefined || details === null) return null;
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  }

  private async log(level: 'info' | 'error' | 'warn', message: string, details?: unknown): Promise<void> {
    const stmt = this.db.prepare('INSERT INTO logs (level, message, details) VALUES (?, ?, ?)');
    const detailsJson = this.serializeDetails(details);
    await stmt.bind(level, message, detailsJson).run();
  }

  async getLogs(page: number = 1, limit: number = 10, level?: 'info' | 'error' | 'warn'): Promise<LogEntry[]> {
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM logs';
    const params: Array<string> = [];
    
    if (level) {
      query += ' WHERE level = ?';
      params.push(level);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    return (result as { results: LogEntry[] }).results;
  }
}
