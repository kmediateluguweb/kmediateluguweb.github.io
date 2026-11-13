/**
 * K Media Telugu Cloudflare Worker — public read API + idempotent view tracking.
 *
 * Still no admin/write/content-management routes. View tracking only updates
 * counters for already-published articles and uses opaque client identifiers.
 */
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function notFound() { return json({ error: "Not found" }, 404); }
function dbUnavailable() { return json({ error: "Database binding is not configured" }, 503); }
function parseLimit(value) {
  const n = Number.parseInt(value || "20", 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}
function validOpaqueId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}
async function recordArticleView(request, env, articleId) {
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return json({ error: "Request body too large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { sessionId, visitorId } = body || {};
  if (!validOpaqueId(sessionId) || !validOpaqueId(visitorId)) {
    return json({ error: "Valid sessionId and visitorId are required" }, 400);
  }

  const article = await env.DB.prepare(
    "SELECT id FROM news_articles WHERE id = ? AND status = 'published' LIMIT 1"
  ).bind(articleId).first();
  if (!article) return notFound();

  // Composite primary key makes repeated requests from the same tab/session idempotent.
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO article_view_sessions (article_id, session_id) VALUES (?, ?)"
  ).bind(articleId, sessionId).run();
  const isNewView = Number(inserted?.meta?.changes || 0) > 0;
  if (isNewView) {
    await env.DB.prepare(
      "UPDATE news_articles SET view_count = view_count + 1 WHERE id = ? AND status = 'published'"
    ).bind(articleId).run();
  }
  await env.DB.prepare(
    "INSERT INTO article_unique_visitors (article_id, visitor_id) VALUES (?, ?) " +
    "ON CONFLICT(article_id, visitor_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP"
  ).bind(articleId, visitorId).run();

  const count = await env.DB.prepare(
    "SELECT view_count FROM news_articles WHERE id = ? AND status = 'published' LIMIT 1"
  ).bind(articleId).first();
  return json({ recorded: isNewView, view_count: Number(count?.view_count || 0) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true, service: "k-media-telugu-api", phase: 2,
        mode: "public-read-and-view-tracking",
        databaseConfigured: Boolean(env && env.DB),
        timestamp: new Date().toISOString()
      });
    }
    if (!env || !env.DB) return dbUnavailable();

    try {
      const viewMatch = url.pathname.match(/^\/api\/articles\/([A-Za-z0-9-]{1,180})\/view$/);
      if (viewMatch && method === "POST") {
        return await recordArticleView(request, env, viewMatch[1]);
      }
      if (method !== "GET") return json({ error: "Method not allowed" }, 405);

      if (url.pathname === "/api/categories") {
        const result = await env.DB.prepare(
          "SELECT id, name, slug FROM categories ORDER BY id ASC"
        ).all();
        return json({ categories: result.results || [] });
      }
      if (url.pathname === "/api/articles") {
        const limit = parseLimit(url.searchParams.get("limit"));
        const cursor = url.searchParams.get("before");
        const stmt = cursor
          ? env.DB.prepare(
              "SELECT id, category_id, title, slug, summary, featured_image, published_at, view_count " +
              "FROM news_articles WHERE status = 'published' AND published_at < ? " +
              "ORDER BY published_at DESC LIMIT ?"
            ).bind(cursor, limit)
          : env.DB.prepare(
              "SELECT id, category_id, title, slug, summary, featured_image, published_at, view_count " +
              "FROM news_articles WHERE status = 'published' " +
              "ORDER BY published_at DESC LIMIT ?"
            ).bind(limit);
        const result = await stmt.all();
        return json({ articles: result.results || [], limit });
      }
      const match = url.pathname.match(/^\/api\/articles\/([a-zA-Z0-9-]{1,180})$/);
      if (match) {
        const article = await env.DB.prepare(
          "SELECT id, category_id, title, slug, summary, content, featured_image, " +
          "source_url, published_at, seo_title, meta_description, view_count " +
          "FROM news_articles WHERE slug = ? AND status = 'published' LIMIT 1"
        ).bind(match[1]).first();
        if (!article) return notFound();
        return json({ article });
      }
      return notFound();
    } catch {
      return json({ error: "Unable to complete request" }, 500);
    }
  }
};
