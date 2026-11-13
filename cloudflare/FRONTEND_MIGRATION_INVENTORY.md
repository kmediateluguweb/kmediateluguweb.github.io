# Frontend migration inventory — Supabase to Cloudflare

Source inspected: `main/admin.html`, `main/article.html`, and `main/index.html`.
This is a read-only inventory and migration plan. No production files were edited.

## Admin page dependencies

| Current Supabase behavior | Required Cloudflare replacement |
|---|---|
| Supabase OTP email sign-in and OTP verification | Keep Supabase Auth temporarily, or implement a separate verified identity provider + Worker session. Do not replace with a browser-only password check. |
| `admin_users` lookup by authenticated user UUID | Worker must validate signed session and resolve an allowlisted admin identity server-side. |
| Read `categories` | `GET /api/categories` |
| Read article list and analytics from `news_articles` | Admin-only authenticated Worker endpoints; current public Worker must not expose drafts or admin data. |
| `get_article_unique_counts()` RPC | Authenticated analytics endpoint backed by visitor aggregation. |
| Insert/update/delete `news_articles` | Authenticated, role-checked Worker CRUD endpoints with schema validation and audit logging. |
| Upload images to `news-images` and call `getPublicUrl` | Authenticated Worker upload endpoint writing to R2; preserve stable public URL mapping. |
| Top Story object keys `top-story/current`, `top-story/mode.txt`, `top-story/custom-video.txt` | Migrate all three objects and preserve current photo/video mode behavior. |

## Article page dependencies

- Fetch one published article by slug; the Worker public read route can serve this once D1 is bound and populated.
- Replace `increment_article_view(p_article_id)` with a privacy-conscious, rate-limited Worker endpoint.
- Keep existing SEO metadata, canonical URL, JSON-LD, share controls, and HTML escaping behavior.
- Article image URLs must continue to resolve after R2 migration; do not rewrite live URLs until every object has been copied and verified.

## Homepage dependencies

- `index.html` contains existing static article cards and Supabase Storage image URLs. A safe migration must inventory all generated article paths and image URLs before changing them.
- Do not change static pages or SEO routes as part of a database-only test.
- Use a staging hostname/preview for integration tests; keep production domain, DNS, Pages settings, and canonical URLs unchanged.

## Required implementation order

1. Confirm staging D1 schema and seed a small synthetic dataset.
2. Deploy a separate staging Worker with only the `kmt-news-staging` D1 binding.
3. Test public read routes with synthetic published and draft rows.
4. Choose and implement server-verified admin identity/session strategy.
5. Implement authenticated admin CRUD, category management, analytics, and safe view counting.
6. Create staging R2 bucket; copy and verify article images and all Top Story objects.
7. Build a staging frontend adapter and test login, draft, publish, edit, delete, image upload, article display, and analytics.
8. Compare production Supabase row/object counts against staging exports.
9. Prepare rollback and only schedule production cutover after explicit owner approval.

## Security stop conditions

- Never expose a Supabase service-role key, Cloudflare API token, R2 secret, or session signing secret in browser code, Git, or chat.
- Never trust a user ID, email, or admin flag supplied by browser JSON without a server-verified session.
- Do not enable public writes or return draft/pending/rejected content from public routes.
- Do not delete or disable Supabase until post-cutover verification and rollback window are complete.
