import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Logger } from '../../src/services/logger';
import type { LogEntry } from '../../src/types';

describe('Logger', () => {
  let mockDB: any;
  let logger: Logger;
  let mockRun: any;
  let mockBind: any;
  let mockPrepare: any;
  let mockAll: any;

  beforeEach(() => {
    mockRun = mock(() => Promise.resolve({ success: true }));
    mockAll = mock(() => Promise.resolve([]));
    mockBind = mock(() => ({ run: mockRun, all: mockAll }));
    mockPrepare = mock(() => ({ bind: mockBind }));
    
    mockDB = {
      prepare: mockPrepare
    };
    logger = new Logger(mockDB);
  });

  describe('info', () => {
    it('should log info message to database', async () => {
      const message = 'Test info message';
      const details = { key: 'value' };

      await logger.info(message, details);

      expect(mockPrepare).toHaveBeenCalledWith(
        'INSERT INTO logs (level, message, details) VALUES (?, ?, ?)'
      );
      expect(mockBind).toHaveBeenCalledWith(
        'info',
        message,
        JSON.stringify(details)
      );
    });

    it('should log info message without details', async () => {
      const message = 'Test info message';

      await logger.info(message);

      expect(mockBind).toHaveBeenCalledWith(
        'info',
        message,
        null
      );
    });
  });

  describe('error', () => {
    it('should log error message to database', async () => {
      const message = 'Test error message';
      const details = { error: 'Something went wrong' };

      await logger.error(message, details);

      expect(mockPrepare).toHaveBeenCalledWith(
        'INSERT INTO logs (level, message, details) VALUES (?, ?, ?)'
      );
      expect(mockBind).toHaveBeenCalledWith(
        'error',
        message,
        JSON.stringify(details)
      );
    });
  });

  describe('warn', () => {
    it('should log warning message to database', async () => {
      const message = 'Test warning message';
      const details = { warning: 'This is a warning' };

      await logger.warn(message, details);

      expect(mockBind).toHaveBeenCalledWith(
        'warn',
        message,
        JSON.stringify(details)
      );
    });
  });

  describe('getLogs', () => {
    it('should retrieve logs with pagination', async () => {
      const mockLogs = [
        { id: 1, level: 'info' as const, message: 'Test 1', details: undefined, created_at: '2024-01-01' },
        { id: 2, level: 'error' as const, message: 'Test 2', details: '{"error": "test"}', created_at: '2024-01-02' }
      ];

      mockAll.mockReturnValue(Promise.resolve({ results: mockLogs }));

      const result = await logger.getLogs(1, 10);

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
      );
      expect(mockBind).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual(mockLogs);
    });

    it('should retrieve logs with level filter', async () => {
      const mockLogs = [
        { id: 1, level: 'error' as const, message: 'Test error', details: undefined, created_at: '2024-01-01' }
      ];

      mockAll.mockReturnValue(Promise.resolve({ results: mockLogs }));

      const result = await logger.getLogs(1, 10, 'error');

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM logs WHERE level = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      );
      expect(mockBind).toHaveBeenCalledWith('error', 10, 0);
      expect(result).toEqual(mockLogs);
    });
  });

  describe('database operation failures', () => {
    it('should handle database errors gracefully', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(logger.info('test message')).rejects.toThrow('Database connection failed');
    });
  });
});