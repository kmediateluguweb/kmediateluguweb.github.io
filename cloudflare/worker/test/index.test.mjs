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
