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
  get("news_articles?select=id,title,slug,summary,seo_title,meta_description,content,featured_image,published_at,updated_at,category_id,view_count&status=eq.published&order=published_at.desc&limit=1000"),
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
const homeFeed = feed.slice(0, 40).map(item => ({
  id: item.id,
  title: item.title,
  slug: item.slug,
  summary: item.summary || "",
  featured_image: item.featured_image || "",
  published_at: item.published_at || "",
  category_id: item.category_id,
  category_name: item.category_name,
  category_slug: item.category_slug
}));
await fs.writeFile("home-feed.json", JSON.stringify(homeFeed));



for (const item of articles) {
  if (!item.id || !item.title) continue;
  const dir = `articles/${slugFor(item.id)}`;
  const url = `${SITE}/${dir}/`;
  const title = item.seo_title || item.title;
  const pageTitle = /K Media Telugu/i.test(title) ? title : `${title} | K Media Telugu`;
  const description = (item.meta_description || item.summary || item.title).slice(0, 300);
  const image = item.featured_image || `${SITE}/K%20Media%20Logo.jpg`;
  const category = categoryMap.get(String(item.category_id))?.name || "తాజా వార్తలు";
  const published = iso(item.published_at);
  const modified = iso(item.updated_at || item.published_at);
  const cleanContent = String(item.content || "").split(/\r?\n/).filter(line => !/మూల వార్త\s*:/u.test(line) && !/https?:\/\/news\.google\.com\/rss\//i.test(line)).join("\n").replace(/మూల వార్త\s*:[\s\S]*$/u, "").trim();
  const normalizedContent = cleanContent.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n");
  const contentLines = normalizedContent.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const formatInline = line => esc(line.replace(/^[-*]\s+/, "")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>");
  const body = contentLines.map(line => {
    const heading = line.match(/^#{1,3}\s+(.+)$/) || line.match(/^\*\*(.+)\*\*$/);
    return heading ? `<h2>${esc(heading[1])}</h2>` : `<p>${formatInline(line)}</p>`;
  }).join("");
  const relatedArticles = articles
    .filter(other => other.id && other.id !== item.id && other.title)
    .sort((a, b) => {
      const sameCategory = Number(String(b.category_id) === String(item.category_id)) - Number(String(a.category_id) === String(item.category_id));
      return sameCategory || new Date(b.published_at || 0) - new Date(a.published_at || 0);
    })
    .slice(0, 4);
  const relatedHtml = relatedArticles.length
    ? '<section aria-labelledby="related-heading" style="margin-top:28px;padding-top:18px;border-top:1px solid #eee5ed"><h2 id="related-heading" style="font-size:20px;color:#21172b">ఇవి కూడా చదవండి</h2><ul style="padding-left:20px;line-height:1.9">' +
      relatedArticles.map(other => '<li><a href="/articles/' + slugFor(other.id) + '/">' + esc(other.title) + '</a></li>').join("") +
      '</ul></section>'
    : "";
  const html = `<!doctype html>
<html lang="te"><head><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5378557048937438" crossorigin="anonymous"></script><script>window.addEventListener("load",()=>setTimeout(()=>{const s=document.createElement("script");s.src="https://www.googletagmanager.com/gtag/js?id=G-RBRNK8Q0F1";s.async=true;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag("js",new Date());gtag("config","G-RBRNK8Q0F1");},3500),{once:true});</script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}">
<meta property="og:site_name" content="K Media Telugu"><meta property="og:type" content="article"><meta property="og:locale" content="te_IN">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="/logo-mark.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/K%20Media%20Logo.jpg">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle","headline":title,"description":description,"image":[image],"datePublished":published,"dateModified":modified,"dateCreated":published,"articleSection":category,"inLanguage":"te-IN","isAccessibleForFree":true,"mainEntityOfPage":{"@type":"WebPage","@id":url},"author":{"@type":"Organization","name":"K Media Telugu"},"publisher":{"@type":"NewsMediaOrganization","name":"K Media Telugu","logo":{"@type":"ImageObject","url":`${SITE}/K%20Media%20Logo.jpg`}}})}</script>
<style>*{box-sizing:border-box}body{margin:0;background:#fff8fc;color:#292333;font-family:Arial,"Noto Sans Telugu",sans-serif}.top{background:#fff;border-bottom:1px solid #f0e4ed}.container{width:min(1200px,94%);margin:0 auto}.nav{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:14px}.logo{display:flex;align-items:center;gap:8px;color:#21172b;font-size:18px;font-weight:900;text-decoration:none}.logo img{width:38px;height:38px;object-fit:contain;background:#fff;border-radius:6px}.logo span{color:#ed174c}nav{display:flex;gap:14px;flex-wrap:wrap}nav a{color:#42374a;font-size:12px;text-decoration:none;font-weight:700}.article-wrap{width:100%;max-width:1100px;margin:22px auto 34px;background:#fff;padding:28px;border:1px solid #f0e1eb;border-radius:12px;box-shadow:0 5px 22px #4b23410a}.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.2px;color:#ed174c;margin:0 0 7px}.article-wrap h1{font-size:clamp(22px,4vw,32px);line-height:1.32;font-weight:800;color:#20172a;margin:0 0 9px}.article-meta{font-size:11px;color:#85808a;border-bottom:1px solid #eee5ed;margin:0 0 8px;padding:0 0 9px}.share-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:22px 0 8px;padding:14px 0;border-top:1px solid #eee5ed;border-bottom:1px solid #eee5ed}.share-label{width:100%;font-size:13px;font-weight:800;color:#30253a}.share-btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 12px;border:1px solid #eadde7;border-radius:7px;background:#fff;color:#33283b!important;text-decoration:none!important;font-size:12px;font-weight:700;cursor:pointer}.share-btn:hover{background:#fff2f7;border-color:#ed174c}.share-copy{font-family:inherit}.article-views{font-size:11px;margin:0 0 12px}.article-photo-wrap{display:block;position:relative;width:100%;max-width:800px;margin:0 auto 13px}.article-photo-wrap>img:first-child{display:block;width:100%;height:auto;max-height:390px;object-fit:cover;border-radius:8px}.article-photo-wrap .article-watermark{position:absolute;right:9px;bottom:9px;width:42px;height:42px;object-fit:contain;background:#ffffffdf;padding:2px;border-radius:6px}.article-content{font-size:16px;line-height:1.55;overflow-wrap:anywhere;color:#332d39}.article-content p{display:block;margin:0 0 7px;padding:0;line-height:1.55}.article-content h2{font-size:17px;line-height:1.4;font-weight:800;color:#21172b;margin:9px 0 4px;padding:0}.article-content strong{font-weight:800}footer{margin:12px 0 0;background:#21172b;color:#fff;text-align:center;padding:14px;font-size:11px}footer a{color:#fff}@media(max-width:600px){.container{width:94%}.nav{min-height:46px}.logo{font-size:16px}.logo img{width:32px;height:32px}nav{gap:9px}nav a{font-size:10px}.article-wrap{margin:10px auto 22px;padding:14px;border-radius:9px}.article-wrap h1{font-size:22px}.article-content{font-size:14px;line-height:1.55}.article-content p{margin-bottom:6px}.article-content h2{font-size:15px}.article-photo-wrap>img:first-child{max-height:none}}</style></head>
<body><header class="top"><div class="container nav"><a class="logo" href="/"><img src="/K%20Media%20Logo.jpg" alt="K Media Telugu logo" style="width:46px;height:46px;object-fit:contain;background:#fff;border-radius:8px;vertical-align:middle"> K MEDIA <span>TELUGU</span></a><nav><a href="/">హోమ్</a><a href="/#latest">తాజా వార్తలు</a><a href="/about.html">మా గురించి</a><a href="/editorial-policy.html">సంపాదకీయ విధానం</a><a href="/terms-and-conditions.html">Terms</a></nav></div></header>
<main class="container"><article class="article-wrap"><p class="eyebrow">K MEDIA TELUGU · ${esc(category)}</p><h1>${esc(item.title)}</h1><p class="article-meta">${esc(dateText(item.published_at))} · K Media Telugu</p><div class="article-views" style="display:flex;align-items:center;gap:7px;color:#64748b;font-size:14px;margin:8px 0 18px">👁 <strong id="articleViewCount">${Number(item.view_count||0).toLocaleString("en-IN")} Views</strong><span id="articleUniqueReaders" style="font-size:12px;color:#64748b"> · Readers loading…</span></div><span class="article-photo-wrap"><img src="${esc(image)}" alt="${esc(item.title)}" fetchpriority="high"><img class="article-watermark" src="/K%20Media%20Logo.jpg" alt="K Media Telugu watermark"></span><div class="article-content">${body}</div><div class="share-bar" data-share-bar><span class="share-label">ఈ వార్తను Share చేయండి</span><a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(item.title + " " + url)}" target="_blank" rel="noopener">WhatsApp</a><a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a><a class="share-btn" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(item.title)}" target="_blank" rel="noopener">Telegram</a><a class="share-btn" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(item.title)}" target="_blank" rel="noopener">X</a><button class="share-btn share-copy" type="button" id="copyArticleLink">లింక్ Copy చేయండి</button></div>${relatedHtml}<p><a href="/">← హోమ్‌కు తిరిగి వెళ్లండి</a></p></article></main>
<footer><div class="copyright">© 2026 K Media Telugu. All rights reserved. | <a href="/privacy-policy.html">Privacy Policy</a> | <a href="/contact.html">Contact</a> | <a href="/editorial-policy.html">Editorial Policy</a> | <a href="/terms-and-conditions.html">Terms</a></div></footer>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
(async()=>{
 const id=${JSON.stringify(item.id)};
 const readers=document.getElementById("articleUniqueReaders");
 const el=document.getElementById("articleViewCount");
 try{
  if(!window.supabase?.createClient) throw new Error("Supabase JS library did not load");
  const db=window.supabase.createClient("https://mewyojxgsuceppsauesh.supabase.co","sb_publishable_-ee5Pt9U0ZvZuUkipLcq-Q_KBXKsEDa");
  const makeId=()=>crypto.randomUUID();
  const visitorKey="kmt-visitor-id-v1",sessionKey="kmt-session-id-v1";
  let visitorId=localStorage.getItem(visitorKey);
  if(!visitorId){visitorId=makeId();localStorage.setItem(visitorKey,visitorId);}
  let sessionId=sessionStorage.getItem(sessionKey);
  if(!sessionId){sessionId=makeId();sessionStorage.setItem(sessionKey,sessionId);}
  const {data,error}=await db.rpc("record_article_view",{
   p_article_id:String(id),p_visitor_id:visitorId,p_session_id:sessionId
  });
  if(error) throw error;
  const stats=Array.isArray(data)?data[0]:data;
  if(!stats) throw new Error("RPC returned no data");
  if(el)el.textContent=Number(stats.total_views||0).toLocaleString("en-IN")+" Views";
  if(readers)readers.textContent=Number(stats.unique_visitors||0).toLocaleString("en-IN")+" Unique Readers";
 }catch(error){
  console.error("K Media Telugu visitor tracking:",error);
  if(readers)readers.textContent="Readers unavailable: "+(error.code?error.code+" — ":"")+(error.message||String(error));
 }
})();
</script></body></html>`;
  await import("node:fs/promises").then(fs => fs.mkdir(dir, { recursive: true }));
  await import("node:fs/promises").then(fs => fs.writeFile(`${dir}/index.html`, html));
  urls.push({ url, published, modified, title: item.title });
}

const fixed = ["", "about.html", "contact.html", "privacy-policy.html", "editorial-policy.html", "terms-and-conditions.html"];
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
