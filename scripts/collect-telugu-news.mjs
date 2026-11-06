import crypto from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://mewyojxgsuceppsauesh.supabase.co").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error("Missing GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY");

const feeds = [
  "https://news.google.com/rss/search?q=%E0%B0%A4%E0%B1%86%E0%B0%B2%E0%B1%81%E0%B0%97%E0%B1%81+%E0%B0%B8%E0%B0%BF%E0%B0%A8%E0%B0%BF%E0%B0%AE%E0%B0%BE+OR+%E0%B0%9F%E0%B0%BE%E0%B0%B2%E0%B1%80%E0%B0%B5%E0%B1%81%E0%B0%A1%E0%B1%8D&hl=te&gl=IN&ceid=IN:te",
  "https://news.google.com/rss/search?q=%E0%B0%A4%E0%B1%86%E0%B0%B2%E0%B1%81%E0%B0%97%E0%B1%81+%E0%B0%95%E0%B1%8A%E0%B0%A4%E0%B1%8D%E0%B0%A4+%E0%B0%B8%E0%B0%BF%E0%B0%A8%E0%B0%BF%E0%B0%AE%E0%B0%BE%E0%B0%B2%E0%B1%81+%E0%B0%85%E0%B0%AA%E0%B1%8D%E0%B0%A1%E0%B1%87%E0%B0%9F%E0%B1%8D%E0%B0%B8%E0%B1%8D&hl=te&gl=IN&ceid=IN:te",
  "https://news.google.com/rss/search?q=%E0%B0%9F%E0%B0%BE%E0%B0%B2%E0%B1%80%E0%B0%B5%E0%B1%81%E0%B0%A1%E0%B1%8D+%E0%B0%A8%E0%B1%8D%E0%B0%AF%E0%B1%82%E0%B0%B8%E0%B1%8D&hl=te&gl=IN&ceid=IN:te"
];
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal"
};
const decode = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&nbsp;/gi, " ").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ").trim();
const tag = (xml, name) => {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i");
  return decode(xml.match(re)?.[1] || "");
};
async function api(path, options = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + (await res.text()).slice(0, 500));
  if (res.status === 204) return null;
  const responseText = await res.text();
  if (!responseText.trim()) return null;
  try { return JSON.parse(responseText); }
  catch { throw new Error("Supabase returned a non-JSON response: " + responseText.slice(0, 300)); }
}
function imageFromItem(item) {
  const candidates = [
    item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    item.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = candidate.replace(/&amp;/g, "&").trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return null;
}
function isGoogleImage(value) {
  try { const host = new URL(value).hostname.toLowerCase(); return host === 'google.com' || host.endsWith('.google.com') || host === 'gstatic.com' || host.endsWith('.gstatic.com') || host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com'); } catch { return true; }
}
async function resolvePublisherUrl(articleUrl) {
  if (!/^https?:\/\/news\.google\.com\//i.test(articleUrl || '')) return articleUrl;
  const id = articleUrl.match(/\/(?:rss\/)?articles\/([\w-]+)/i)?.[1];
  if (!id) return null;
  try {
    const page = await fetch(`https://news.google.com/rss/articles/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' }, signal: AbortSignal.timeout(10000) });
    if (!page.ok) return null;
    const html = await page.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = Number(html.match(/data-n-a-ts="([^"]+)"/)?.[1]);
    if (!sg || !ts) return null;
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'IN:te', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, ts, sg]);
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
    const decoded = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, signal: AbortSignal.timeout(10000) });
    if (!decoded.ok) return null;
    const text = await decoded.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('[[')) continue;
      try { const rows = JSON.parse(line); for (const row of rows) { if (row[1] === 'Fbv4je' && typeof row[2] === 'string') { const url = JSON.parse(row[2])?.[1]; if (typeof url === 'string' && /^https?:\/\//i.test(url) && !/news\.google\.com/i.test(url)) return url; } } } catch {}
    }
  } catch (error) { console.warn('Could not decode Google News article URL:', error.message); }
  return null;
}
async function resolveFeaturedImage(item, articleUrl) {
  const fromFeed = imageFromItem(item);
  if (fromFeed && !isGoogleImage(fromFeed)) return fromFeed;
  const publisherUrl = await resolvePublisherUrl(articleUrl);
  if (!publisherUrl || isGoogleImage(publisherUrl)) return null;
  try {
    const response = await fetch(publisherUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 1200000);
    const metas = [...html.matchAll(/<meta\\b[^>]*>/gi)].map(m => m[0]);
    for (const meta of metas) {
      const key = meta.match(/(?:property|name)=[\"']([^\"']+)[\"']/i)?.[1]?.toLowerCase();
      const value = meta.match(/content=[\"']([^\"']+)[\"']/i)?.[1]?.replace(/&amp;/g, '&').trim();
      if (value && /^(og:image|og:image:url|twitter:image|twitter:image:src|image)$/i.test(key || '')) {
        const absolute = new URL(value, response.url || publisherUrl).href;
        if (/^https?:\\/\\//i.test(absolute) && !isGoogleImage(absolute)) return absolute;
      }
    }
    const jsonLd = [...html.matchAll(/<script\\b[^>]*type=[\"']application\\/ld\\+json[\"'][^>]*>([\\s\\S]*?)<\\/script>/gi)];
    for (const match of jsonLd) {
      try {
        const data = JSON.parse(match[1]);
        const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])];
        for (const node of nodes) {
          const raw = node?.image?.url || node?.image?.[0]?.url || node?.image?.[0] || node?.image;
          const candidate = typeof raw === 'string' ? raw : raw?.url;
          if (candidate) { const absolute = new URL(candidate, response.url || publisherUrl).href; if (/^https?:\\/\\//i.test(absolute) && !isGoogleImage(absolute)) return absolute; }
        }
      } catch {}
    }
  } catch (error) { console.warn('Could not fetch publisher image:', publisherUrl, error.message); }
  return null;
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
    const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    for (const item of items) {
      if (added >= 15) break;
      const title = tag(item, "title");
      const link = tag(item, "link");
      const description = tag(item, "description").replace(/https?:\/\/\S+/g, "").slice(0, 700);
      const featuredImage = await resolveFeaturedImage(item, link);
      const pubDate = tag(item, "pubDate");
      if (!title || !link || !/^https?:\/\//i.test(link) || seen.has(link)) { skipped++; continue; }
      seen.add(link);
      const published = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Date.parse(published) < cutoff) { skipped++; continue; }
      const existing = await api("news_articles?select=id,featured_image&source_url=eq." + encodeURIComponent(link) + "&limit=1");
      if (existing.length) {
        if (featuredImage && (!existing[0].featured_image || isGoogleImage(existing[0].featured_image))) {
          await api("news_articles?id=eq." + encodeURIComponent(existing[0].id), {
            method: "PATCH",
            body: JSON.stringify({ featured_image: featuredImage, updated_at: new Date().toISOString() })
          });
          console.log("Added missing featured image to existing draft:", title);
        }
        skipped++;
        continue;
      }
      const shortHash = crypto.createHash("sha1").update(link).digest("hex").slice(0, 8);
      const safeSlug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 75) || "telugu-cinema-news";
      const payload = {
        title: title.slice(0, 250),
        slug: safeSlug + "-" + shortHash,
        summary: (description || title).slice(0, 500),
        seo_title: title.slice(0, 70),
        meta_description: (description || title).slice(0, 160),
        content: (description || title) + "\n\nమూల వార్త: " + link + "\n\nగమనిక: ఇది RSS ద్వారా వచ్చిన వార్తా సారాంశం మాత్రమే. పూర్తి కథనాన్ని ప్రచురించే ముందు మూలాన్ని పరిశీలించి, స్వంతంగా ధృవీకరించిన వివరాలతో రాయాలి.",
        source_url: link,
        featured_image: featuredImage,
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
