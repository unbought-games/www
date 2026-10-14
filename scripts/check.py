"""Check the deployable artifact, using only Python's standard library."""
from html.parser import HTMLParser
from pathlib import Path
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / "public"


class Page(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.tags = []
        self.feed(content)

    def handle_starttag(self, tag, attributes):
        self.tags.append((tag, dict(attributes)))


for path in ROOT.glob("*.html"):
    page = Page(path.read_text())
    assert any(t == "html" and a.get("lang") == "en" for t, a in page.tags), path
    assert sum(t == "h1" for t, _ in page.tags) == 1, path
    assert not any(t == "script" for t, _ in page.tags), "Keep this site JavaScript-free"
    for tag, attrs in page.tags:
        for key in ("href", "src"):
            value = attrs.get(key, "")
            if value.startswith("/"):
                target = ROOT / (value.lstrip("/") or "index.html")
                assert target.is_file(), f"Missing asset: {value}"

home = Page((ROOT / "index.html").read_text())
metadata = {a.get("property", a.get("name")): a.get("content")
            for t, a in home.tags if t == "meta"}
assert metadata["og:url"] == "https://unbought.games/"
assert metadata["og:image"] == "https://unbought.games/social.png"
assert metadata["twitter:card"] == "summary_large_image"
assert metadata["description"]
assert metadata["og:image:alt"]
assert any(t == "link" and a.get("rel") == "canonical" and
           a.get("href") == metadata["og:url"] for t, a in home.tags)
png = (ROOT / "social.png").read_bytes()
assert png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", png[16:24]) == (1200, 630)
sitemap = ET.parse(ROOT / "sitemap.xml")
assert sitemap.find("{*}url/{*}loc").text == metadata["og:url"]

# Transfer budgets catch accidental frameworks, fonts, and oversized artwork.
render_bytes = sum((ROOT / p).stat().st_size for p in ("index.html", "style.css", "favicon.svg"))
assert render_bytes < 12_000, f"Initial page exceeds 12 KB: {render_bytes}"
assert len(png) < 150_000, "Social card exceeds 150 KB"
assert not list(ROOT.rglob("*.js")), "No JavaScript runtime is needed"
print(f"Static checks passed. Initial page: {render_bytes:,} bytes; social card: {len(png):,} bytes.")
