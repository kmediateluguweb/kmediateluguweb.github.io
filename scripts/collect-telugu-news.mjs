import crypto from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://mewyojxgsuceppsauesh.supabase.co").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error("Missing GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY");

const makeFeed = (query, categoryKey) => ({
  url: "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=te&gl=IN&ceid=IN:te",
  categoryKey
});
const feeds = [
  makeFeed("తెలుగు సినిమా OR టాలీవుడ్ వార్తలు", "cinema"),
  makeFeed("తెలుగు కొత్త సినిమాలు అప్‌డేట్స్", "cinema"),
  makeFeed("Andhra Pradesh politics OR AP government OR ఆంధ్రప్రదేశ్ రాజకీయాలు OR ఏపీ ప్రభుత్వం", "ap"),
  makeFeed("Telangana politics OR Telangana government OR తెలంగాణ రాజకీయాలు OR తెలంగాణ ప్రభుత్వం", "ts"),
  makeFeed("Andhra Pradesh public issues OR AP assembly OR ఆంధ్రప్రదేశ్ ప్రజా సమస్యలు", "ap"),
  makeFeed("Telangana public issues OR Telangana assembly OR తెలంగాణ ప్రజా సమస్యలు", "ts")
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
function cleanPlainText(value) {
  let text = String(value || "");
  for (let i = 0; i < 3; i++) {
    text = text
      .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  }
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:BBC|Google News)\s*$/i, "")
    .replace(/\s+/g, " ").trim();
}
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
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
    for (const meta of metas) {
      const key = meta.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
      const value = meta.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&').trim();
      if (value && /^(og:image|og:image:url|twitter:image|twitter:image:src|image)$/i.test(key || '')) {
        const absolute = new URL(value, response.url || publisherUrl).href;
        if (/^https?:\/\//i.test(absolute) && !isGoogleImage(absolute)) return absolute;
      }
    }
    const jsonLd = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of jsonLd) {
      try {
        const data = JSON.parse(match[1]);
        const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])];
        for (const node of nodes) {
          const raw = node?.image?.url || node?.image?.[0]?.url || node?.image?.[0] || node?.image;
          const candidate = typeof raw === 'string' ? raw : raw?.url;
          if (candidate) { const absolute = new URL(candidate, response.url || publisherUrl).href; if (/^https?:\/\//i.test(absolute) && !isGoogleImage(absolute)) return absolute; }
        }
      } catch {}
    }
  } catch (error) { console.warn('Could not fetch publisher image:', publisherUrl, error.message); }
  return null;
}


function htmlText(value) {
  return decode(String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|h[1-6]|li|article|section)>/gi, "\n"));
}
function collectArticleBody(html) {
  const bodies = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const visit = value => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) return value.forEach(visit);
        if (typeof value.articleBody === "string") bodies.push(htmlText(value.articleBody));
        if (value["@graph"]) visit(value["@graph"]);
        if (value.mainEntity) visit(value.mainEntity);
      };
      visit(parsed);
    } catch {}
  }
  for (const match of html.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)) {
    const paragraphs = [...match[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => htmlText(m[1])).filter(p => p.length > 35);
    if (paragraphs.length) bodies.push(paragraphs.join("\n\n"));
  }
  return [...new Set(bodies)].sort((x,y) => y.length-x.length)[0] || "";
}
async function fetchPublisherContent(url) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow", signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return "";
    return collectArticleBody((await response.text()).slice(0, 1800000)).slice(0, 12000);
  } catch (error) {
    console.warn("Could not extract publisher article:", url, error.message);
    return "";
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
async function writeOriginalTeluguSummary(title, description, categoryName, sourceUrl) {
  if (!OPENAI_API_KEY) return "";
  const prompt = `మీరు K Media Telugu కోసం తెలుగు న్యూస్ ఎడిటర్. క్రింది శీర్షిక, చిన్న RSS వివరణలో ఉన్న ధృవీకరించగల వాస్తవాలనే ఉపయోగించి 120-180 పదాల్లో పూర్తిగా కొత్త తెలుగు భాషలో సంక్షిప్త వార్త రాయండి. వాక్య నిర్మాణం, పదజాలం మూల కథనం నుంచి కాపీ చేయకండి. కొత్త వివరాలు, ఊహాగానాలు, ఆరోపణలు కల్పించకండి. వివరాలు సరిపోకపోతే 60-90 పదాలకు పరిమితం చేయండి. వ్యక్తులపై ఆరోపణలను నిజాలుగా రాయకండి; మూలం చెప్పినట్లుగా ఆపాదించండి. శీర్షికను మళ్లీ యథాతథంగా పునరావృతం చేయకండి. 2-4 చిన్న పేరాలు మాత్రమే ఇవ్వండి; Markdown, HTML, source URL వద్దు. వర్గం: ${categoryName}. శీర్షిక: ${title}. RSSలోని సంక్షిప్త సమాచారం: ${description}. మూల లింక్: ${sourceUrl}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("OpenAI summary failed: " + response.status + " " + (await response.text()).slice(0, 300));
  const data = await response.json();
  return cleanPlainText(data.choices?.[0]?.message?.content || "").slice(0, 3000);
}

async function main() {
  const cats = await api("categories?select=id,name,slug&order=id");
  if (!cats?.length) throw new Error("No categories found in Supabase.");
  const findCategory = key => {
    const patterns = {
      cinema: /సినిమా|మూవీ|ఎంటర్|entertain|movie|cinema/i,
      ap: /ఆంధ్ర|ఏపీ|ap[- ]?politic|andhra|రాజకీయ|politic/i,
      ts: /తెలంగాణ|టీఎస్|telangana|రాజకీయ|politic/i
    };
    return cats.find(c => patterns[key]?.test(c.name + " " + (c.slug || "")));
  };
  const seen = new Set();
  const addedByCategory = { cinema: 0, ap: 0, ts: 0 };
  let added = 0, skipped = 0;
  for (const feed of feeds) {
    const category = findCategory(feed.categoryKey);
    if (!category) { console.warn("Missing category for feed:", feed.categoryKey); continue; }
    if (addedByCategory[feed.categoryKey] >= 6) continue;
    const response = await fetch(feed.url, { headers: { "User-Agent": "KMediaTeluguNewsBot/1.0" } });
    if (!response.ok) { console.warn("RSS unavailable:", response.status, feed.url); continue; }
    const xml = await response.text();
    const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    for (const item of items) {
      if (addedByCategory[feed.categoryKey] >= 6) break;
      const title = tag(item, "title");
      const link = tag(item, "link");
      const description = cleanPlainText(tag(item, "description")).slice(0, 700);
      const publisherUrl = await resolvePublisherUrl(link);
      const featuredImage = await resolveFeaturedImage(item, link);
      const pubDate = tag(item, "pubDate");
      if (!title || !link || !/^https?:\/\//i.test(link) || seen.has(link)) { skipped++; continue; }
      seen.add(link);
      const published = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Date.parse(published) < cutoff) { skipped++; continue; }
      const existing = await api("news_articles?select=id,featured_image,content,summary,meta_description,status&source_url=eq." + encodeURIComponent(link) + "&limit=1");
      if (existing.length) {
        const patch = { updated_at: new Date().toISOString() };
        if (featuredImage && (!existing[0].featured_image || isGoogleImage(existing[0].featured_image))) patch.featured_image = featuredImage;
        if (existing[0].status === "draft") {
          if (description && /<a\b|<font\b|news\.google\.com\/rss\//i.test(existing[0].summary || "")) patch.summary = cleanPlainText(description).slice(0, 500);
          if (description && /<a\b|<font\b|news\.google\.com\/rss\//i.test(existing[0].meta_description || "")) patch.meta_description = cleanPlainText(description).slice(0, 160);
          if (fullContent.length >= 250 && (!existing[0].content || existing[0].content.length < 250 || /news\.google\.com\/rss\/|<a\b|<font\b/i.test(existing[0].content))) patch.content = cleanPlainText(fullContent);
        }
        if (Object.keys(patch).length > 1) {
          await api("news_articles?id=eq." + encodeURIComponent(existing[0].id), { method: "PATCH", body: JSON.stringify(patch) });
          console.log("Repaired existing article:", title);
        }
        skipped++;
        continue;
      }
      if (fullContent.length < 250 || !featuredImage || !/^https?:\/\//i.test(featuredImage)) {
        console.log("Skipped: article is missing full text or a valid featured image:", title);
        skipped++;
        continue;
      }
      const shortHash = crypto.createHash("sha1").update(link).digest("hex").slice(0, 8);
      const safeSlug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 75) || "telugu-cinema-news";
      const payload = {
        title: title.slice(0, 250),
        slug: safeSlug + "-" + shortHash,
        summary: originalSummary.slice(0, 500),
        seo_title: title.slice(0, 70),
        meta_description: originalSummary.slice(0, 160),
        content: originalSummary,
        source_url: link,
        featured_image: featuredImage,
        category_id: category.id,
        status: "draft",
        updated_at: new Date().toISOString(),
        published_at: null
      };
      await api("news_articles", { method: "POST", body: JSON.stringify(payload) });
      added++;
      addedByCategory[feed.categoryKey]++;
    }
  }
  console.log(`Collector complete: ${added} draft(s) added, ${skipped} item(s) skipped. By category: ${JSON.stringify(addedByCategory)}`);
}
main().catch(error => { console.error(error); process.exit(1); });
