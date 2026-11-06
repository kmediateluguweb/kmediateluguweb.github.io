const SITE = "https://kmediatelugu.com";
const API = "https://mewyojxgsuceppsauesh.supabase.co";
const KEY = "sb_publishable_-ee5Pt9U0ZvZuUkipLcq-Q_KBXKsEDa";
const headers = { apikey: KEY };

const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const slugFor = id => `news-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
const dateText = value => value ? new Date(value).toLocaleString("te-IN", { timeZone: "Asia/Kolkata" }) : "";
const iso = value => value ? new Date(value).toISOString() : new Date().toISOString();

async function get(path) {
  const response = await fetch(`${API}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return response.json();
}
const [articles, categories] = await Promise.all([
  get("news_articles?select=id,title,slug,summary,seo_title,meta_description,content,featured_image,published_at,updated_at,category_id&status=eq.published&order=published_at.desc&limit=1000"),
  get("categories?select=id,name,slug")
]);
const categoryMap = new Map(categories.map(c => [String(c.id), c]));
const urls = [];
const fs = await import("node:fs/promises");
const feed = articles.filter(item => item.id && item.title).map(item => ({
  ...item,
  category_name: categoryMap.get(String(item.category_id))?.name || "తాజా వార్తలు",
  category_slug: categoryMap.get(String(item.category_id))?.slug || ""
}));
await fs.writeFile("news-feed.json", JSON.stringify(feed));


for (const item of articles) {
  if (!item.id || !item.title) continue;
  const dir = `articles/${slugFor(item.id)}`;
  const url = `${SITE}/${dir}/`;
  const title = item.seo_title || item.title;
  const description = (item.meta_description || item.summary || item.title).slice(0, 300);
  const image = item.featured_image || `${SITE}/K%20Media%20Logo.jpg`;
  const category = categoryMap.get(String(item.category_id))?.name || "తాజా వార్తలు";
  const published = iso(item.published_at);
  const modified = iso(item.updated_at || item.published_at);
  const body = String(item.content || "").split(/\r?\n/).filter(Boolean).map(line => `<p>${esc(line)}</p>`).join("\n");
  const html = `<!doctype html>
<html lang="te"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | K Media Telugu</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}">
<meta property="og:site_name" content="K Media Telugu"><meta property="og:type" content="article"><meta property="og:locale" content="te_IN">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="/K%20Media%20Logo.jpg"><link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle","headline":title,"description":description,"image":[image],"datePublished":published,"dateModified":modified,"dateCreated":published,"articleSection":category,"inLanguage":"te-IN","isAccessibleForFree":true,"mainEntityOfPage":{"@type":"WebPage","@id":url},"author":{"@type":"Organization","name":"K Media Telugu"},"publisher":{"@type":"NewsMediaOrganization","name":"K Media Telugu","logo":{"@type":"ImageObject","url":`${SITE}/K%20Media%20Logo.jpg`}}})}</script>
<style>.article-wrap{max-width:850px;margin:40px auto;background:#fff;padding:28px;border-radius:14px}.article-wrap img{width:100%;max-height:480px;object-fit:cover;border-radius:10px}.article-content{font-size:18px;line-height:1.9;overflow-wrap:anywhere}.article-meta{color:#777;font-size:14px}@media(max-width:700px){.article-wrap{margin:18px auto;padding:18px}}</style></head>
<body><header class="top"><div class="container nav"><a class="logo" href="/">K MEDIA <span>TELUGU</span></a><nav><a href="/">హోమ్</a><a href="/#latest">తాజా వార్తలు</a><a href="/about.html">మా గురించి</a><a href="/editorial-policy.html">సంపాదకీయ విధానం</a></nav></div></header>
<main class="container"><article class="article-wrap"><p class="eyebrow">K MEDIA TELUGU · ${esc(category)}</p><h1>${esc(item.title)}</h1><p class="article-meta">${esc(dateText(item.published_at))} · K Media Telugu</p><img src="${esc(image)}" alt="${esc(item.title)}" fetchpriority="high"><div class="article-content">${body}</div><p><a href="/">← హోమ్‌కు తిరిగి వెళ్లండి</a></p></article></main>
<footer><div class="copyright">© 2026 K Media Telugu. All rights reserved. | <a href="/privacy-policy.html">Privacy Policy</a> | <a href="/contact.html">Contact</a> | <a href="/editorial-policy.html">Editorial Policy</a></div></footer></body></html>`;
  await import("node:fs/promises").then(fs => fs.mkdir(`.${dir}`, { recursive: true }));
  await import("node:fs/promises").then(fs => fs.writeFile(`.${dir}/index.html`, html));
  urls.push({ url, published, modified, title: item.title });
}

const fixed = ["", "about.html", "contact.html", "privacy-policy.html", "editorial-policy.html"];
const sitemapEntries = [
  ...fixed.map(path => `<url><loc>${SITE}/${path}</loc></url>`),
  ...urls.map(x => `<url><loc>${x.url}</loc><lastmod>${x.modified}</lastmod></url>`)
].join("");
await fs.writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries}</urlset>\n`);

const cutoff = Date.now() - 48 * 60 * 60 * 1000;
const recent = urls.filter(x => Date.parse(x.published) >= cutoff).slice(0, 1000);
const xmlEsc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const newsEntries = recent.map(x => `<url><loc>${xmlEsc(x.url)}</loc><news:news><news:publication><news:name>K Media Telugu</news:name><news:language>te</news:language></news:publication><news:publication_date>${xmlEsc(x.published)}</news:publication_date><news:title>${xmlEsc(x.title.slice(0, 100))}</news:title></news:news></url>`).join("");
await fs.writeFile("news-sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${newsEntries}</urlset>\n`);
console.log(`Generated ${urls.length} article pages; ${recent.length} recent news sitemap entries.`);
