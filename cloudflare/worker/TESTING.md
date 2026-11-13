# Worker API smoke tests

These tests use Node's built-in test runner and a mocked D1 binding. They do not connect to or modify Cloudflare or Supabase.

From the repository root, with Node.js 20 or newer:

```bash
node --experimental-default-type=module --test cloudflare/worker/test/index.test.mjs
```

The tests cover:
- Health endpoint without a database binding.
- Fail-closed behavior when D1 is not configured.
- Categories query.
- Published-only article list and 50-row maximum.
- Published-only article-by-slug lookup.
- 404 for missing articles.
- Rejection of non-GET methods.

These are unit tests with a mocked D1 API, not a substitute for staging tests against a real Cloudflare D1 database. Do not deploy or cut over based only on these tests.
