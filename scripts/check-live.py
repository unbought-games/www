"""Verify an actual Pages release, including canonical redirects and security headers."""
from pathlib import Path
import argparse
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


client = build_opener(NoRedirect)


def fetch(url):
    try:
        return client.open(Request(url, headers={"User-Agent": "Unbought-release-check/1.0"}), timeout=20)
    except HTTPError as error:
        return error


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base', default='https://unbought.games', choices=['https://unbought.games', 'https://unbought-www.pages.dev'])
base = parser.parse_args().base
public = Path(__file__).resolve().parents[1] / "dist"
for path in ("/", "/style.css", "/logo.svg", "/logo-stacked.svg", "/favicon.svg", "/social.png", "/robots.txt", "/sitemap.xml", "/terms/", "/privacy/", "/conduct/", "/policy.css", "/art/credits.txt", "/art/planet-03-320.webp", "/art/planet-03-640.webp", "/news/", "/news.css", "/share.js", "/feeds/all/all.xml"):
    with fetch(base + path) as response:
        assert response.status == 200, (path, response.status)
        expected = public / (path.lstrip("/") or "index.html")
        if expected.is_dir():
            expected = expected / "index.html"
        assert response.read() == expected.read_bytes(), f"Stale or changed artifact: {path}"
        assert response.headers.get("X-Content-Type-Options") == "nosniff", path
        if path == "/":
            assert "default-src 'none'" in response.headers.get("Content-Security-Policy", "")
            assert "no-transform" in response.headers.get("Cache-Control", "")
            if base == 'https://unbought.games':
                assert "noindex" not in response.headers.get("X-Robots-Tag", "")
            else:
                assert "noindex" in response.headers.get("X-Robots-Tag", "")
        if path == "/social.png":
            assert response.headers.get_content_type() == "image/png"

with fetch(base + "/release-check-missing-page") as response:
    assert response.status == 404, response.status

for origin in ("http://unbought.games", "https://www.unbought.games",
               "https://unboughtgames.com", "https://www.unboughtgames.com"):
    with fetch(origin + "/example/path?source=release-check") as response:
        assert response.status == 301, (origin, response.status)
        assert response.headers.get("Location") == "https://unbought.games/example/path?source=release-check", origin

print("Live release verified: exact files, security headers, social image, 404, and domain redirects.")
