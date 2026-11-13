-- K Media Telugu staging bootstrap for Cloudflare D1
-- Apply ONLY to the newly created, empty kmt-news-staging database.
-- Do not run against kmt-news-db or any production database.
-- Structure only: no production rows, Supabase Auth users, or Storage objects are copied.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY NOT NULL,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT,
  featured_image TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  seo_title TEXT,
  meta_description TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_unique_visitors (
  article_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, visitor_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_view_sessions (
  article_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, session_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

-- Legacy table retained from the Supabase schema inventory; verify its exact
-- application usage and column semantics before importing any legacy rows.
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
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id TEXT PRIMARY KEY NOT NULL,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_status ON news_articles(status);
CREATE INDEX IF NOT EXISTS idx_article_view_sessions_viewed_at ON article_view_sessions(viewed_at);
CREATE INDEX IF NOT EXISTS idx_article_unique_visitors_article_id ON article_unique_visitors(article_id);

-- Supabase Auth is NOT migrated by this schema. admin_users.id is only a
-- placeholder identity key until a replacement authentication flow is built.
-- RLS policies, RPC functions, triggers, and R2 image migration are separate phases.
