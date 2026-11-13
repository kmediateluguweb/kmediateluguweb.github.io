# K Media Telugu — Cloudflare migration (Phase 1)

This folder is an isolated migration starter. It does **not** replace the live Supabase-backed site.

## Current production dependencies found in the repository

- Static site and article pages are generated into `index.html`, `articles/**`, `sitemap.xml` and `news-sitemap.xml`.
- The admin UI (`admin.html`) uses Supabase Auth email OTP and checks the `admin_users` table.
- News management uses the Supabase tables `news_articles` and `categories`.
- Article photos and the Top Story photo/mode are stored in the Supabase Storage bucket `news-images`.
- Article views use the RPCs `increment_article_view`, `record_article_view` and `get_article_unique_counts`, plus the tables `article_view_sessions` and `article_unique_visitors`.
- The homepage and generated article pages currently call Supabase directly.

## Target architecture

| Existing responsibility | Cloudflare target |
| --- | --- |
| Static hosting | Cloudflare Pages |
| Server-side admin/API | Cloudflare Worker |
| Relational news data | D1 |
| News and Top Story images | R2 |
| Admin sign-in | Cloudflare Access or a Worker-verified identity provider |
| Secrets | Worker secrets / environment bindings |

## Migration sequence

1. Keep the current Supabase site live while building and testing the Cloudflare version separately.
2. Export and document the exact Supabase schema, indexes, RLS policies, triggers, storage policies, Auth users and current data.
3. Create D1 tables and import a verified data export. Preserve article IDs, slugs, timestamps, statuses and view counts.
4. Create R2 buckets and migrate images while retaining a mapping from every old public image URL to its new R2 URL.
5. Implement Worker endpoints for public published-news reads, admin CRUD, image uploads, Top Story settings and atomic view tracking.
6. Configure admin authentication and enforce authorization on every write endpoint. Never trust a client-supplied admin flag.
7. Test on a staging hostname: homepage, article pages, search, categories, admin login, create/edit/delete, image uploads, Top Story, analytics, sitemap and mobile.
8. Cut over only after backups, parity checks and rollback are verified. Keep Supabase intact until the new site has passed acceptance tests.

## Important safeguards

- Do not delete or disable the existing Supabase project during migration.
- Do not put service-role keys, database passwords or Cloudflare API tokens in Git.
- The existing Supabase publishable key is public by design, but it does not make database policies safe by itself.
- Do not import user/auth data into D1 without a deliberate authentication and privacy plan.
- D1/R2/Workers have free allowances and paid limits; this is not a guarantee of lifetime-zero cost.
- The worker in this phase only exposes a health endpoint. No production data is read or changed.

## Setup prerequisites

Create a Cloudflare Worker and D1/R2 resources in the Cloudflare dashboard, then configure bindings locally or in the deployment environment. Do not add credentials to this repository. Review `wrangler.example.toml` and follow Cloudflare's current dashboard prompts before deployment.
