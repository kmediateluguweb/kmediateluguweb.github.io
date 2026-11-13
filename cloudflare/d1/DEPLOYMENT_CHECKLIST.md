# K Media Telugu — Cloudflare D1 migration runbook

## Current verified state (13 Nov 2026)

- Existing Cloudflare D1 database: `kmt-news-db`.
- Cloudflare dashboard shows two application tables: `categories` and `news_articles`, plus the Cloudflare-managed `_cf_KV` table.
- Both application tables currently contain zero rows.
- Existing `news_articles` columns observed in the D1 console:
  `id`, `category_id`, `title`, `slug`, `summary`, `content`, `featured_image`, `source_url`, `status`, `created_at`, `updated_at`, `published_at`, `seo_title`, `meta_description`, `view_count`.
- Existing status CHECK permits `draft`, `pending`, `published`, `rejected`.
- Existing `news_articles.category_id` is `INTEGER NOT NULL` and references `categories(id)`.

## Critical stop before applying migration 0002

The draft `0002_add_missing_tables.sql` is not approved for production execution yet.

Reasons:
1. The D1 `categories` and `news_articles` tables already exist and differ from the original draft in at least one important detail: `category_id` is NOT NULL in D1.
2. The source Supabase schema exports do not fully specify all column defaults, CHECK expressions, triggers, indexes, or Auth semantics.
3. The exact source definition and usage of legacy `news` must be confirmed before carrying it forward.
4. Creating `admin_users` in D1 does not migrate Supabase Auth users or prove an administrator's identity.

Do not drop, rename, or recreate existing D1 tables. Do not merge this branch or point the live site to this database yet.

## Safe next verification queries

Run these individually in the D1 Console. They are read-only:

```sql
PRAGMA table_info(categories);
```

```sql
PRAGMA table_info(news_articles);
```

```sql
PRAGMA foreign_key_list(news_articles);
```

```sql
SELECT name, sql FROM sqlite_master
WHERE type IN ('table','index','trigger')
ORDER BY type, name;
```

## Required migration gates

- [ ] Confirm the complete D1 schema and source Supabase schema, including defaults, CHECK constraints, indexes, and foreign keys.
- [ ] Decide whether the legacy `news` table is still used; preserve its data if it is.
- [ ] Export and back up Supabase rows before any import.
- [ ] Design a server-verified admin authentication flow; never trust a browser-supplied admin flag.
- [ ] Implement and test Worker routes for public published-article reads, admin CRUD, image upload, and view tracking.
- [ ] Configure R2 and test upload/read URLs without exposing bucket credentials.
- [ ] Import data into a staging database and compare row counts and sample records.
- [ ] Test the website, admin login, publish/edit/delete, images, analytics, SEO pages, and rollback.
- [ ] Only then schedule a controlled production cutover.

## Important

The existing Supabase project must remain untouched and available as the source of truth until all gates pass. A D1 schema alone is not a functioning replacement for Supabase Auth, Storage, RLS, and RPC functions.
