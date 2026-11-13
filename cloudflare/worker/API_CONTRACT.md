# K Media Telugu Worker API — implementation contract

This is a design contract, not an enabled production API. The current Worker intentionally exposes only `GET /api/health`.

## Public routes (after D1 parity is verified)

- `GET /api/categories` — list categories.
- `GET /api/articles?limit=&cursor=` — published articles only; bounded pagination.
- `GET /api/articles/:slug` — one published article by slug.
- `POST /api/articles/:id/view` — privacy-conscious, rate-limited view/session accounting.

Public handlers must never return drafts, pending articles, rejected articles, admin records, private source configuration, or raw database errors.

## Admin routes (must remain disabled until authentication exists)

- `POST /api/admin/auth/*` — only after a supported identity provider and verified session strategy are selected.
- `POST /api/admin/articles`
- `PATCH /api/admin/articles/:id`
- `DELETE /api/admin/articles/:id`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `POST /api/admin/images` — R2 upload using server-side binding only.
- `GET /api/admin/analytics`

Every admin request must verify a signed, expiring session on the Worker. Authorization must come from a server-verified identity allowlist/role mapping. Never trust `is_admin`, an email, user ID, or role supplied only in request JSON or browser storage.

## Data and security rules

- Use prepared D1 statements and validate every path, query, and body field.
- Enforce `status = 'published'` in public article queries at SQL level.
- Apply request-size limits, image MIME/type/size checks, and rate limits.
- Set safe CORS origins to the production site only after cutover planning.
- Keep secrets in Worker Secrets; never commit credentials or Supabase service-role keys.
- Keep R2 private by default; serve objects through a controlled Worker or explicitly designed public custom domain.
- Return generic client errors; log operational details server-side without personal data.
- Implement view tracking with idempotency/rate-limiting to avoid accidental inflation.

## Dependencies before implementation

1. Verified D1 schema and imported data.
2. Chosen authentication provider and admin allowlist.
3. R2 bucket and object URL strategy.
4. Tested CORS, abuse limits, backups, and rollback.
5. Staging tests for current `admin.html`, `article.html`, homepage, and generated static article pages.

Until those dependencies are satisfied, the Worker must stay health-only.
