/**
 * K Media Telugu Cloudflare Worker — Phase 1 scaffold.
 *
 * Safe by design: health endpoint only. No Supabase or production data writes.
 * Add authenticated API routes only after D1/R2 schema and auth are reviewed.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "k-media-telugu-api",
        phase: 1,
        mode: "scaffold-only",
        timestamp: new Date().toISOString()
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return Response.json({
      error: "Not found",
      message: "This migration scaffold does not serve production routes yet."
    }, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
