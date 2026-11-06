import crypto from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://mewyojxgsuceppsauesh.supabase.co").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error("Missing GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY");

const feeds = [
  "https://news.google.com/rss/search?q=Telugu+cinema+OR+Tollywood&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=Telugu+movies+upcoming+film+updates&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=Telugu+film+industry+actors+movie+news&hl=en-IN&gl=IN&ceid=IN:en"
];
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal"
};
const decode = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, " ").trim();
const tag = (xml, name) => {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i");
  return decode(xml.match(re)?.[1] || "");
};
async function api(path, options = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + (await res.text()).slice(0, 500));
  if (res.status === 204) return null;
  return res.json();
}
async function main() {
  const cats = await api("categories?select=id,name,slug&order=id");
  if (!cats?.length) throw new Error("No categories found in Supabase.");
  const category = cats.find(c => /సినిమా|మూవీ|ఎంటర్|entertain|movie|cinema/i.test(c.name + " " + (c.slug || ""))) || cats[0];
  const seen = new Set();
  let added = 0, skipped = 0;
  for (const feedUrl of feeds) {
    const response = await fetch(feedUrl, { headers: { "User-Agent": "KMediaTeluguNewsBot/1.0" } });
    if (!response.ok) { console.warn("RSS unavailable:", response.status, feedUrl); continue; }
    const xml = await response.text();
    const items = [...xml.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)].map(m => m[1]);
    for (const item of items) {
      if (added >= 15) break;
      const title = tag(item, "title");
      const link = tag(item, "link");
      const description = tag(item, "description").slice(0, 700);
      const pubDate = tag(item, "pubDate");
      if (!title || !link || !/^https?:\/\//i.test(link) || seen.has(link)) { skipped++; continue; }
      seen.add(link);
      const published = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Date.parse(published) < cutoff) { skipped++; continue; }
      const existing = await api("news_articles?select=id&source_url=eq." + encodeURIComponent(link) + "&limit=1");
      if (existing.length) { skipped++; continue; }
      const shortHash = crypto.createHash("sha1").update(link).digest("hex").slice(0, 8);
      const safeSlug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 75) || "telugu-cinema-news";
      const payload = {
        title: title.slice(0, 250),
        slug: safeSlug + "-" + shortHash,
        summary: (description || title).slice(0, 500),
        seo_title: title.slice(0, 70),
        meta_description: (description || title).slice(0, 160),
        content: (description || title) + "\n\nమూల వార్త చదవండి: " + link + "\n\nగమనిక: ఇది వార్తా మూలం ఆధారంగా సేకరించిన Draft. ప్రచురించే ముందు K Media Telugu బృందం ధృవీకరించాలి.",
        source_url: link,
        category_id: category.id,
        status: "draft",
        updated_at: new Date().toISOString(),
        published_at: null
      };
      await api("news_articles", { method: "POST", body: JSON.stringify(payload) });
      added++;
    }
  }
  console.log(`Collector complete: ${added} draft(s) added, ${skipped} item(s) skipped. Category: ${category.name}`);
}
main().catch(error => { console.error(error); process.exit(1); });
