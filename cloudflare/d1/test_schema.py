"""Validate the staging bootstrap SQL against SQLite's D1-compatible core."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
SQL_FILE = ROOT / "cloudflare" / "d1" / "0003_staging_bootstrap.sql"

def main() -> None:
    sql = SQL_FILE.read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(sql)

    expected = {
        "admin_users",
        "article_unique_visitors",
        "article_view_sessions",
        "categories",
        "news",
        "news_articles",
        "news_sources",
        "youtube_videos",
    }
    actual = {
        row[0]
        for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    assert actual == expected, f"Unexpected application tables: {actual ^ expected}"

    # Verify required uniqueness and status constraint.
    indexes = {
        row[1]
        for row in db.execute("PRAGMA index_list(news_articles)")
    }
    assert indexes, "news_articles should have its unique slug index"

    db.execute(
        "INSERT INTO categories (name, slug) VALUES (?, ?)",
        ("Politics", "politics"),
    )
    db.execute(
        """INSERT INTO news_articles (id, category_id, title, slug, status)
           VALUES (?, ?, ?, ?, ?)""",
        ("article-1", 1, "Test", "test-article", "draft"),
    )

    try:
        db.execute(
            """INSERT INTO news_articles (id, category_id, title, slug, status)
               VALUES (?, ?, ?, ?, ?)""",
            ("article-2", 1, "Test duplicate", "test-article", "published"),
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Duplicate article slug was accepted")

    try:
        db.execute(
            """INSERT INTO news_articles (id, category_id, title, slug, status)
               VALUES (?, ?, ?, ?, ?)""",
            ("article-3", 1, "Invalid", "invalid-status", "private"),
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Invalid article status was accepted")

    fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
    assert not fk_errors, f"Foreign key violations: {fk_errors}"
    print("PASS: staging schema creates 8 application tables; uniqueness, status CHECK, and foreign keys validated.")

if __name__ == "__main__":
    main()
