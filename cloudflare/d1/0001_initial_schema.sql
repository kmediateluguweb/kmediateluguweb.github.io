-- K Media Telugu D1 schema draft, derived from the supplied Supabase metadata exports.
-- Review before applying. This creates structure only; it does not copy production data.
-- SQLite/D1 types: UUIDs and timestamps are stored as TEXT; booleans as INTEGER (0/1).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT
);

-- Legacy table present in Supabase metadata; preserve it until usage is verified.
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  title TEXT,
  slug TEXT,
  content TEXT,
  category TEXT,
  image_url TEXT,
  is_published INTEGER
);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY NOT NULL,
  category_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT,
  featured_image TEXT,
  source_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  published_at TEXT,
  seo_title TEXT,
  meta_description TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id)
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

CREATE TABLE IF NOT EXISTS article_view_sessions (
  article_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (article_id, session_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_unique_visitors (
  article_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (article_id, visitor_id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_view_sessions_viewed_at
  ON article_view_sessions(viewed_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_status_published_at
  ON news_articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category_id
  ON news_articles(category_id);
