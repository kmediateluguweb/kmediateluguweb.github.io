-- K Media Telugu D1 migration 0002
-- Adds only tables that are missing from the existing kmt-news-db.
-- Existing categories and news_articles tables are intentionally not recreated.
-- Draft only: review before applying to any database.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS article_view_sessions (
  article_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, session_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_unique_visitors (
  article_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, visitor_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT,
  slug TEXT,
  content TEXT,
  category TEXT,
  image_url TEXT,
  is_published INTEGER
);

CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  is_active INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id TEXT PRIMARY KEY NOT NULL,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  is_published INTEGER,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_article_view_sessions_viewed_at
  ON article_view_sessions(viewed_at);

CREATE INDEX IF NOT EXISTS idx_article_unique_visitors_article_id
  ON article_unique_visitors(article_id);
