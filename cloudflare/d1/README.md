# D1 schema notes — K Media Telugu

This is a **draft schema only**, created from the four metadata CSV exports supplied from the existing Supabase project. It has not been applied to a Cloudflare database and contains no production rows.

## Tables captured

- `admin_users` (3 columns)
- `article_unique_visitors` (4)
- `article_view_sessions` (3)
- `categories` (4)
- `news` (8; retained as a legacy table until repository usage is confirmed)
- `news_articles` (15)
- `news_sources` (5)
- `youtube_videos` (8)

## Constraints captured

- `categories.name` and `categories.slug` are unique.
- `news_articles.slug` is unique; `category_id` references `categories.id`.
- `news_sources.feed_url` is unique.
- `youtube_videos.video_id` is unique.
- `article_view_sessions` has composite primary key `(article_id, session_id)`.
- `article_unique_visitors` has composite primary key `(article_id, visitor_id)`.
- Both view-tracking tables reference `news_articles.id` with delete cascade.
- Supabase `admin_users.id` references Supabase Auth. D1 does not have that Auth system; the draft keeps the UUID as text and intentionally does not pretend to migrate the Auth foreign key.

## Authorization policies observed

The exported RLS policy list contains 9 policies:
- Public read of categories.
- Public read of published articles (two overlapping SELECT policies were present).
- Admin-only management of categories, articles, news sources and YouTube videos via `is_admin()`.
- Admin can read their own `admin_users` profile.
- Public read of published YouTube videos.

These rules must be reimplemented in Worker routes. D1 does not automatically inherit Supabase RLS. Never expose unrestricted D1 access or trust an `is_admin` value supplied by the browser.

## Functions observed

- `is_admin()`
- `increment_article_view(text)`
- `record_article_view(uuid, uuid, uuid)`
- `get_article_unique_counts()`
- `rls_auto_enable` (Postgres event trigger; not applicable to D1)

The article view functions need Worker-side equivalents with atomic SQL operations. Admin analytics must require an authenticated server-verified admin identity.

## Deliberate limitations / next verification

The CSV exports did not include column defaults, exact CHECK expressions, all indexes, triggers, storage policies, Auth users, or production table rows. Therefore:
1. This SQL is a structural starting point, not a verified lossless schema conversion.
2. The exact allowed values for `news_articles.status` must be confirmed before adding a D1 CHECK constraint.
3. Existing timestamp/default behavior and IDs must be preserved during data export/import.
4. The `news` legacy table should not be dropped until code references and data are checked.
5. Supabase Storage objects and Top Story configuration still need a complete inventory and URL mapping.
6. Authentication must be designed and tested before any admin endpoint is enabled.

Do not apply this file to production or switch the live site to Cloudflare yet. Keep Supabase unchanged until D1/R2 data parity, Worker authorization, admin workflow, and rollback have been tested.
