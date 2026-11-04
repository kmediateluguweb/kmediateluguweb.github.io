import html
import json
import os
import re
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, register_namespace

BASE = "https://kmediatelugu.rweb.site/"
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

with open("/tmp/news.json", encoding="utf-8") as f:
    articles = json.load(f)

out_dir = Path("articles")
if out_dir.exists():
    shutil.rmtree(out_dir)
out_dir.mkdir(parents=True)

used = set()
for article in articles:
    article_id = str(article.get("id", ""))
    slug = slugify(article.get("slug") or article.get("title"), "news")
    if slug in used:
        slug = f"{slug}-{article_id[:8]}"
    used.add(slug)
    article["public_slug"] = slug
    article["public_url"] = BASE + "articles/" + slug + "/"

    title = article.get("seo_title") or article.get("title") or "K Media Telugu"
    description = article.get("meta_description") or article.get("summary") or article.get("title") or "K Media Telugu తాజా తెలుగు వార్తలు"
    image = article.get("featured_image") or BASE + "K%20Media%20Logo.jpg"
    published = article.get("published_at") or ""
    body = esc(article.get("content") or "").replace("\\r\\n", "\\n").replace("\\n", "<br>")

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
<link rel="stylesheet" href="../../style.css">
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
.article-wrap{{max-width:850px;margin:40px auto;background:#fff;padding:28px;border-radius:14px}}
.article-wrap img{{width:100%;max-height:480px;object-fit:cover;border-radius:10px}}
.article-content{{font-size:18px;line-height:1.9;white-space:normal;overflow-wrap:anywhere}}
.article-meta{{color:#777;font-size:14px}}
@media(max-width:700px){{.article-wrap{{margin:18px auto;padding:18px}}}}
</style>
</head>
<body>
<header class="top"><div class="container nav"><a class="logo" href="../../">K MEDIA <span>TELUGU</span></a><nav><a href="../../">హోమ్</a><a href="../../#latest">తాజా వార్తలు</a></nav></div></header>
<main class="container"><article class="article-wrap">
<p class="eyebrow">K MEDIA TELUGU</p>
<h1>{esc(article.get('title'))}</h1>
<p class="article-meta">{esc(published)}</p>
{('<img src="' + esc(image) + '" alt="' + esc(article.get('title')) + '" fetchpriority="high">') if article.get('featured_image') else ''}
{('<p><strong>' + esc(article.get('summary')) + '</strong></p>') if article.get('summary') else ''}
<div class="article-content">{body}</div>
<p><a href="../../">← హోమ్‌కు తిరిగి వెళ్లండి</a></p>
</article></main>
<footer><div class="copyright">© 2026 K Media Telugu. All rights reserved.</div></footer>
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
