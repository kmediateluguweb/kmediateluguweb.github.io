import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function mockDb({ allRows = [], firstRow = null } = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async all() { return { results: allRows }; },
        async first() { return firstRow; }
      };
    }
  };
  return { DB, calls };
}

test("health works without D1 binding", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/health"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.databaseConfigured, false);
});

test("data routes fail closed when D1 binding is missing", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/categories"), {});
  assert.equal(response.status, 503);
});

test("categories uses a bounded read query", async () => {
  const { DB, calls } = mockDb({ allRows: [{ id: 1, name: "Politics", slug: "politics" }] });
  const response = await worker.fetch(new Request("https://example.test/api/categories"), { DB });
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /FROM categories/);
  assert.deepEqual((await response.json()).categories.length, 1);
});

test("article list enforces published status and clamps limit to 50", async () => {
  const { DB, calls } = mockDb({ allRows: [] });
  const response = await worker.fetch(new Request("https://example.test/api/articles?limit=500"), { DB });
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /status = 'published'/);
  assert.equal(calls[0].values.at(-1), 50);
});

test("single article lookup is by slug and published status", async () => {
  const article = { id: "a1", slug: "sample-news", status: "published" };
  const { DB, calls } = mockDb({ firstRow: article });
  const response = await worker.fetch(new Request("https://example.test/api/articles/sample-news"), { DB });
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /slug = \?/);
  assert.match(calls[0].sql, /status = 'published'/);
  assert.deepEqual((await response.json()).article, article);
  assert.deepEqual(calls[0].values, ["sample-news"]);
});

test("unknown article is 404", async () => {
  const { DB } = mockDb({ firstRow: null });
  const response = await worker.fetch(new Request("https://example.test/api/articles/missing"), { DB });
  assert.equal(response.status, 404);
});

test("non-GET methods are rejected", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/articles", { method: "POST" }), { DB: {} });
  assert.equal(response.status, 405);
});


function mockViewDb({ published = true } = {}) {
  const calls = [];
  let sessions = new Set();
  let visitors = new Set();
  let views = 7;
  const DB = {
    prepare(sql) {
      const call = { sql, values: [] }; calls.push(call);
      return {
        bind(...values) { call.values = values; return this; },
        async first() {
          if (/SELECT id FROM news_articles/.test(sql)) return published ? { id: call.values[0] } : null;
          if (/SELECT view_count FROM news_articles/.test(sql)) return { view_count: views };
          return null;
        },
        async run() {
          if (/INSERT OR IGNORE INTO article_view_sessions/.test(sql)) {
            const key = call.values.join(":");
            const before = sessions.size; sessions.add(key);
            return { meta: { changes: sessions.size - before } };
          }
          if (/UPDATE news_articles SET view_count/.test(sql)) { views += 1; return { meta: { changes: 1 } }; }
          if (/INSERT INTO article_unique_visitors/.test(sql)) { visitors.add(call.values.join(":")); return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
      };
    }
  };
  return { DB, calls, get views() { return views; }, sessions, visitors };
}
const validViewBody = { sessionId: "session_identifier_123", visitorId: "visitor_identifier_123" };

test("view endpoint increments published article once per session", async () => {
  const mock = mockViewDb();
  const makeRequest = () => new Request("https://example.test/api/articles/article-1/view", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validViewBody)
  });
  const first = await worker.fetch(makeRequest(), { DB: mock.DB });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { recorded: true, view_count: 8 });
  const second = await worker.fetch(makeRequest(), { DB: mock.DB });
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { recorded: false, view_count: 8 });
  assert.equal(mock.views, 8);
});

test("view endpoint rejects invalid identifiers", async () => {
  const { DB } = mockViewDb();
  const response = await worker.fetch(new Request("https://example.test/api/articles/article-1/view", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "x", visitorId: "y" })
  }), { DB });
  assert.equal(response.status, 400);
});

test("view endpoint does not count unpublished articles", async () => {
  const { DB } = mockViewDb({ published: false });
  const response = await worker.fetch(new Request("https://example.test/api/articles/article-1/view", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validViewBody)
  }), { DB });
  assert.equal(response.status, 404);
});
