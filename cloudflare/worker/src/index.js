/**
 * K Media Telugu Cloudflare Worker — Phase 2 public read API scaffold.
 *
 * Safe by design:
 * - GET-only public routes; no admin/auth/storage/write endpoints.
 * - Published-only article SQL filters.
 * - Prepared D1 statements and bounded pagination.
 * - Requires a D1 binding named DB; returns 503 if not configured.
 * - Health endpoint remains available without bindings.
 *
 * Do not deploy/cut over production until staging tests and D1 data parity pass.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function notFound() {
  return json({ error: "Not found" }, 404);
}

function dbUnavailable() {
  return json({ error: "Database binding is not configured" }, 503);
}

function parseLimit(value) {
  const n = Number.parseInt(value || "20", 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "k-media-telugu-api",
        phase: 2,
        mode: "public-read-api-scaffold",
        databaseConfigured: Boolean(env && env.DB),
        timestamp: new Date().toISOString()
      });
    }

    if (method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!env || !env.DB) return dbUnavailable();

    try {
      if (url.pathname === "/api/categories") {
        const result = await env.DB.prepare(
          "SELECT id, name, slug FROM categories ORDER BY id ASC"
        ).all();
        return json({ categories: result.results || [] });
      }

      if (url.pathname === "/api/articles") {
        const limit = parseLimit(url.searchParams.get("limit"));
        const cursor = url.searchParams.get("before");
        let stmt;

        if (cursor) {
          stmt = env.DB.prepare(
            "SELECT id, category_id, title, slug, summary, featured_image, published_at, view_count " +
            "FROM news_articles WHERE status = 'published' AND published_at < ? " +
            "ORDER BY published_at DESC LIMIT ?"
          ).bind(cursor, limit);
        } else {
          stmt = env.DB.prepare(
            "SELECT id, category_id, title, slug, summary, featured_image, published_at, view_count " +
            "FROM news_articles WHERE status = 'published' " +
            "ORDER BY published_at DESC LIMIT ?"
          ).bind(limit);
        }

        const result = await stmt.all();
        return json({ articles: result.results || [], limit });
      }

      const match = url.pathname.match(/^\/api\/articles\/([a-zA-Z0-9-]{1,180})$/);
      if (match) {
        const slug = match[1];
        const article = await env.DB.prepare(
          "SELECT id, category_id, title, slug, summary, content, featured_image, " +
          "source_url, published_at, seo_title, meta_description, view_count " +
          "FROM news_articles WHERE slug = ? AND status = 'published' LIMIT 1"
        ).bind(slug).first();

        if (!article) return notFound();
        return json({ article });
      }

      return notFound();
    } catch (error) {
      // Keep SQL/schema details out of public responses.
      return json({ error: "Unable to complete request" }, 500);
    }
  }
};
