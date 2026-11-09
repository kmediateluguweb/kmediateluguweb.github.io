import html
import json
import os
import re
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, register_namespace

BASE = "https://kmediatelugu.com/"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
NEWS_NS = "http://www.google.com/schemas/sitemap-news/0.9"
register_namespace("", SITEMAP_NS)
register_namespace("news", NEWS_NS)

def esc(value):
    return html.escape(str(value or ""), quote=True)

def slugify(value, fallback):
    raw = str(value or "").strip().lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", raw)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:90].strip("-") or fallback

def render_content(value):
    """Render safe, simple Markdown paragraphs and headings for Telugu articles."""
    lines = str(value or "").replace("\\r\\n", "\\n").replace("\\r", "\\n").split("\\n")
    out = []
    paragraph = []
    def flush():
        if paragraph:
            joined = " ".join(part.strip() for part in paragraph if part.strip())
            if joined:
                joined = re.sub(r"\\*\\*(.+?)\\*\\*", r"<strong>\\1</strong>", joined)
                out.append("<p>" + joined + "</p>")
            paragraph.clear()
    for raw in lines:
        line = raw.strip()
        if not line:
            flush()
        elif line.startswith("### "):
            flush()
            out.append("<h3>" + esc(line[4:]) + "</h3>")
        elif line.startswith("## "):
            flush()
            out.append("<h2>" + esc(line[3:]) + "</h2>")
        elif line.startswith("# "):
            flush()
            out.append("<h2>" + esc(line[2:]) + "</h2>")
        elif line.startswith("- ") or line.startswith("* "):
            flush()
            out.append("<p class=\"article-list-item\">• " + esc(line[2:]) + "</p>")
        else:
            paragraph.append(esc(line))
    flush()
    return "\\n".join(out)

with open("/tmp/news.json", encoding="utf-8") as f:
    articles = json.load(f)

out_dir = Path("articles")
if out_dir.exists():
    shutil.rmtree(out_dir)
out_dir.mkdir(parents=True)

used = set()
for article in articles:
    article_id = str(article.get("id", ""))
    slug = "news-" + re.sub(r"[^a-zA-Z0-9]", "", article_id)[:8]
    if slug in used:
        slug = f"{slug}-{len(used)}"
    used.add(slug)
    article["public_slug"] = slug
    article["public_url"] = BASE + "articles/" + slug + "/"

    title = article.get("seo_title") or article.get("title") or "K Media Telugu"
    description = article.get("meta_description") or article.get("summary") or article.get("title") or "K Media Telugu తాజా తెలుగు వార్తలు"
    image = article.get("featured_image") or BASE + "K%20Media%20Logo.jpg"
    published = article.get("published_at") or ""
    body = render_content(article.get("content") or "")

    schema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "description": description,
        "mainEntityOfPage": article["public_url"],
        "image": [image],
        "datePublished": published,
        "dateModified": article.get("updated_at") or published,
        "author": {"@type": "Organization", "name": "K Media Telugu"},
        "publisher": {
            "@type": "NewsMediaOrganization",
            "name": "K Media Telugu",
            "logo": {"@type": "ImageObject", "url": BASE + "K%20Media%20Logo.jpg"}
        }
    }
    schema_json = json.dumps(schema, ensure_ascii=False).replace("</", "<\\/")
    page = f"""<!DOCTYPE html>
<html lang="te">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} | K Media Telugu</title>
<meta name="description" content="{esc(description[:160])}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{esc(article['public_url'])}">
<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="/style.css?v=telugu-font-20261108">
<meta property="og:site_name" content="K Media Telugu">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description[:200])}">
<meta property="og:url" content="{esc(article['public_url'])}">
<meta property="og:image" content="{esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(description[:200])}">
<meta name="twitter:image" content="{esc(image)}">
<script type="application/ld+json">{schema_json}</script>
<style>
:root{{color-scheme:light}}
body{{background:#f5f6f8!important;color:#242833;font-family:"Noto Sans Telugu",Arial,sans-serif}}
.article-wrap{{box-sizing:border-box;max-width:900px;margin:28px auto;background:#fff;padding:30px 34px;border:1px solid #e5e8ee;border-radius:8px;box-shadow:0 2px 12px rgba(20,35,60,.05)}}
.article-wrap h1{{font-family:"Noto Sans Telugu",Arial,sans-serif;color:#172f56;font-size:clamp(25px,3vw,32px);font-weight:700;line-height:1.45;margin:10px 0 14px}}
.article-wrap img{{display:block;width:100%;height:auto;max-height:480px;object-fit:contain;border-radius:6px;margin:16px 0 20px}}
.article-content{{font-family:"Noto Sans Telugu",Arial,sans-serif;color:#252a33;font-size:16px;font-weight:400;line-height:1.72;letter-spacing:0;white-space:normal;overflow-wrap:anywhere}}
.article-content p{{margin:0 0 15px}}
.article-content h2{{font-size:23px;line-height:1.45;font-weight:700;color:#1d3c68;margin:25px 0 10px}}
.article-content h3{{font-size:19px;line-height:1.5;font-weight:700;color:#284d78;margin:20px 0 8px}}
.article-content strong{{font-weight:700;color:#202a3a}}
.article-content .article-list-item{{margin:0 0 7px 18px}}
.article-meta{{color:#737b88;font-size:12px;margin:8px 0 14px}}
.share-bar{{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:22px 0 8px;padding:14px 0;border-top:1px solid #eee5ed;border-bottom:1px solid #eee5ed}}.share-label{{width:100%;font-size:13px;font-weight:800;color:#30253a}}.share-btn{{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 12px;border:1px solid #eadde7;border-radius:7px;background:#fff;color:#33283b!important;text-decoration:none!important;font-size:12px;font-weight:700;cursor:pointer}}.share-btn:hover{{background:#fff2f7;border-color:#ed174c}}.share-copy{{font-family:inherit}}
@media(max-width:700px){{.article-wrap{{margin:12px auto;padding:18px 16px;border-radius:6px}}.article-wrap h1{{font-size:24px;line-height:1.5}}.article-content{{font-size:15px;line-height:1.75}}.article-content h2{{font-size:20px;margin-top:22px}}}}
</style>
</head>
<body>
<header class="top"><div class="container nav"><a class="logo" href="../../">K MEDIA <span>TELUGU</span></a><nav><a href="../../">హోమ్</a><a href="../../#latest">తాజా వార్తలు</a></nav></div></header>
<main class="container"><article class="article-wrap">
<p class="eyebrow">K MEDIA TELUGU</p>
<h1>{esc(article.get('title'))}</h1>
<p class="article-meta">{esc(published)}</p>
{("<p class=\"article-meta\" id=\"articleViews\">👁 Views లెక్కిస్తోంది… · <span id=\"articleUniqueReaders\">Readers లెక్కిస్తోంది…</span></p>")}
{('<img src="' + esc(image) + '" alt="' + esc(article.get('title')) + '" fetchpriority="high">') if article.get('featured_image') else ''}
{('<p><strong>' + esc(article.get('summary')) + '</strong></p>') if article.get('summary') else ''}
<div class="article-content">{body}</div>
<div class="share-bar" data-share-bar><span class="share-label">ఈ వార్తను Share చేయండి</span><a class="share-btn" data-share="whatsapp" target="_blank" rel="noopener">WhatsApp</a><a class="share-btn" data-share="facebook" target="_blank" rel="noopener">Facebook</a><a class="share-btn" data-share="telegram" target="_blank" rel="noopener">Telegram</a><a class="share-btn" data-share="x" target="_blank" rel="noopener">X</a><button class="share-btn share-copy" type="button" data-share="copy">లింక్ Copy చేయండి</button></div>
<p><a href="../../">← హోమ్‌కు తిరిగి వెళ్లండి</a></p>
</article></main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
function setupArticleShare(container,title,url){const q=encodeURIComponent(title);const u=encodeURIComponent(url);const targets={whatsapp:'https://wa.me/?text='+q+'%20'+u,facebook:'https://www.facebook.com/sharer/sharer.php?u='+u,telegram:'https://t.me/share/url?url='+u+'&text='+q,x:'https://twitter.com/intent/tweet?url='+u+'&text='+q};container.querySelectorAll('a[data-share]').forEach(link=>{link.href=targets[link.dataset.share]||'#';});const copy=container.querySelector('[data-share="copy"]');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='Copied ✓';}catch(e){const field=document.createElement('textarea');field.value=url;document.body.appendChild(field);field.select();document.execCommand('copy');field.remove();copy.textContent='Copied ✓';}setTimeout(()=>copy.textContent='లింక్ Copy చేయండి',2000);});}
const shareArticle=document.querySelector('[data-share-bar]');
setupArticleShare(shareArticle, {json.dumps(title, ensure_ascii=False)}, {json.dumps(article["public_url"])});
(async()=>{{
 try{{
  const db=window.supabase.createClient("https://mewyojxgsuceppsauesh.supabase.co","sb_publishable_-ee5Pt9U0ZvZuUkipLcq-Q_KBXKsEDa");
  const visitorKey="kmt-visitor-id-v1",sessionKey="kmt-session-id-v1";
  const makeId=()=>crypto.randomUUID();
  let visitorId=localStorage.getItem(visitorKey);if(!visitorId){{visitorId=makeId();localStorage.setItem(visitorKey,visitorId);}}
  let sessionId=sessionStorage.getItem(sessionKey);if(!sessionId){{sessionId=makeId();sessionStorage.setItem(sessionKey,sessionId);}}
  const result=await db.rpc("record_article_view",{{p_article_id:{json.dumps(article_id)},p_visitor_id:visitorId,p_session_id:sessionId}});
  if(!result.error&&result.data){{
   const views=document.getElementById("articleViews"),readers=document.getElementById("articleUniqueReaders");
   if(views)views.firstChild.textContent="👁 "+Number(result.data.total_views||0).toLocaleString("en-IN")+" Views · ";
   if(readers)readers.textContent=Number(result.data.unique_visitors||0).toLocaleString("en-IN")+" Unique Readers";
  }}else if(result.error)console.warn("Article view tracking setup required",result.error);
 }}catch(error){{console.warn("Article view tracking unavailable",error);}}
}})();
</script>
<footer><div class="copyright">© 2026 K Media Telugu. All rights reserved. | <a style="color:#fff" href="../../privacy-policy.html">Privacy Policy</a></div></footer>
</body></html>
"""
    target = out_dir / slug / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page, encoding="utf-8")

urlset = Element("{" + SITEMAP_NS + "}urlset")
def add_url(root, loc, lastmod=None):
    node = SubElement(root, "{" + SITEMAP_NS + "}url")
    SubElement(node, "{" + SITEMAP_NS + "}loc").text = loc
    if lastmod:
        SubElement(node, "{" + SITEMAP_NS + "}lastmod").text = lastmod

add_url(urlset, BASE)
add_url(urlset, BASE + "about.html")
add_url(urlset, BASE + "contact.html")
for article in articles:
    add_url(urlset, article["public_url"], article.get("updated_at") or article.get("published_at"))
ElementTree(urlset).write("sitemap.xml", encoding="UTF-8", xml_declaration=True)

news_root = Element("{" + SITEMAP_NS + "}urlset")
cutoff = datetime.now(timezone.utc) - timedelta(days=2)
recent_count = 0
for article in articles:
    published = article.get("published_at")
    if not published:
        continue
    try:
        dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except ValueError:
        continue
    if dt < cutoff:
        continue
    node = SubElement(news_root, "{" + SITEMAP_NS + "}url")
    SubElement(node, "{" + SITEMAP_NS + "}loc").text = article["public_url"]
    news = SubElement(node, "{" + NEWS_NS + "}news")
    publication = SubElement(news, "{" + NEWS_NS + "}publication")
    SubElement(publication, "{" + NEWS_NS + "}name").text = "K Media Telugu"
    SubElement(publication, "{" + NEWS_NS + "}language").text = "te"
    SubElement(news, "{" + NEWS_NS + "}publication_date").text = dt.isoformat()
    SubElement(news, "{" + NEWS_NS + "}title").text = article.get("title") or "K Media Telugu"
    recent_count += 1
ElementTree(news_root).write("news-sitemap.xml", encoding="UTF-8", xml_declaration=True)
print(f"Generated {len(articles)} static article pages; {recent_count} recent Google News entries.")
