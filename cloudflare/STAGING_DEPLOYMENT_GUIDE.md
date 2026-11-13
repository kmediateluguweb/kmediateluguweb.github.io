# Staging-only deployment and verification

This guide is intentionally limited to the new `kmt-news-staging` database.
Never substitute `kmt-news-db` in any step.

## Current state

- [x] New empty D1 database `kmt-news-staging` created by the site owner.
- [x] Empty-table check returned no application tables.
- [x] Staging bootstrap SQL committed at `cloudflare/d1/0003_staging_bootstrap.sql`.
- [x] Worker unit tests run in GitHub Actions successfully (mocked D1; not a live Cloudflare test).
- [ ] Bootstrap SQL applied to staging D1.
- [ ] Worker deployed to a staging-only Worker name.
- [ ] D1 binding named `DB` points to `kmt-news-staging`.
- [ ] Live staging smoke tests completed.

## Apply schema to staging

1. Open Cloudflare Dashboard → Storage & databases → D1 → `kmt-news-staging` → Console.
2. Open the raw SQL file from this branch:
   `cloudflare/d1/0003_staging_bootstrap.sql`.
3. Copy the entire SQL into the Console and execute it.
4. Run this verification query:

```sql
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE '_cf_%'
ORDER BY name;
```

Expected application tables:
- admin_users
- article_unique_visitors
- article_view_sessions
- categories
- news
- news_articles
- news_sources
- youtube_videos

Then verify foreign keys:

```sql
PRAGMA foreign_key_list(news_articles);
PRAGMA foreign_key_list(article_unique_visitors);
PRAGMA foreign_key_list(article_view_sessions);
```

## Worker deployment guardrails

- Create a separate staging Worker, e.g. `k-media-telugu-api-staging`.
- Bind only the D1 database `kmt-news-staging` using binding name `DB`.
- Do not add production domains/routes.
- Do not add admin write routes, authentication bypasses, or production secrets.
- Do not change DNS, Pages production settings, or the live site.
- Keep the Worker endpoint on its temporary `workers.dev` URL for testing.

## Smoke tests

- `GET /api/health` → 200, `databaseConfigured: true`.
- `GET /api/categories` → 200 and an empty categories array before seed data.
- `GET /api/articles` → 200 and an empty articles array before seed data.
- `POST /api/articles` → 405.
- Unknown route → 404.

The current Worker has public read endpoints only. It does not yet implement admin login, article CRUD, view tracking, R2 uploads, Supabase Auth replacement, or frontend integration.

## Stop conditions

Stop and do not continue if:
- The selected database is not exactly `kmt-news-staging`.
- Any query would alter `kmt-news-db` or Supabase production.
- A schema error occurs; capture the error and review the SQL rather than improvising edits.
- Any staging test requires exposing a secret in chat or committing a secret to Git.


## Newly observed Supabase quota incident (13 Nov 2026)

A GitHub Actions run of `.github/workflows/seo-publish.yml` failed while requesting published article data from Supabase. The API returned HTTP 402 with `exceed_cached_egress_quota`, stating the project is restricted until the owner upgrades the plan or removes spend caps.

This is a Supabase project billing/usage restriction, not a Worker or D1 schema failure. Do not try to bypass the restriction or change production billing without the owner's decision.

The SEO publishing workflow previously ran on every branch push, which caused migration-branch commits to invoke the production Supabase-dependent script. Its push trigger is now limited to `main`; scheduled/manual production behavior is otherwise unchanged. This change is only on the migration branch until the PR is merged.

Before production cutover:
- Confirm Supabase service has been restored or the SEO generator has been migrated to the staging/production Worker data source.
- Run the SEO generator successfully and verify generated article pages and sitemaps.
- Avoid merging this migration PR while production Supabase-dependent publishing remains broken unless the owner explicitly accepts the impact.
