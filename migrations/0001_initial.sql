-- Initial database schema for RSS Summary application

-- Articles table: stores RSS articles with Japanese summaries
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_date TEXT NOT NULL,
  feed_source TEXT NOT NULL, -- 'aws' or 'martinfowler'
  original_content TEXT,
  summary_ja TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_published_date ON articles(published_date DESC);
CREATE INDEX idx_feed_source ON articles(feed_source);
CREATE INDEX idx_created_at ON articles(created_at DESC);

-- Logs table: structured error and info logging
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL, -- 'info', 'error', 'warn'
  message TEXT NOT NULL,
  details TEXT, -- JSON string for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for logs
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_level ON logs(level);