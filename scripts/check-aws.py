"""Test CloudFront before DNS cutover, preserving production Host/SNI and TLS validation."""
import argparse
from email.parser import BytesParser
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import parse_qs, urlsplit

PUBLIC = Path(__file__).resolve().parents[1] / 'dist'
DOMAINS = ('unbought.games', 'www.unbought.games', 'unboughtgames.com', 'www.unboughtgames.com')


def fetch(url, edge):
    parsed = urlsplit(url)
    port = 443 if parsed.scheme == 'https' else 80
    with tempfile.TemporaryDirectory() as directory:
        headers = Path(directory) / 'headers'
        body = Path(directory) / 'body'
        command = ['curl', '--silent', '--show-error', '--noproxy', '*', '--max-time', '30',
                   '--dump-header', str(headers), '--output', str(body), '--write-out', '%{http_code}']
        if parsed.hostname in DOMAINS:
            command += ['--connect-to', f'{parsed.hostname}:{port}:{edge}:{port}']
        status = int(subprocess.check_output(command + [url]))
        raw = headers.read_bytes().split(b'\r\n', 1)[1]
        return status, BytesParser().parsebytes(raw), body.read_bytes()


def verify(edge):
    assert edge.endswith('.cloudfront.net') and '/' not in edge, 'Use the CloudFront domain name'
    # Test both the preview and canonical domain against AWS, without changing DNS.
    paths = ['/' + p.relative_to(PUBLIC).as_posix() for p in PUBLIC.rglob('*')
             if p.is_file() and p.name != '_headers']
    paths += ['/', '/terms/', '/privacy/', '/conduct/']
    for host in (edge, 'unbought.games'):
        for path in paths:
            status, headers, body = fetch('https://' + host + path, edge)
            expected = PUBLIC / path.lstrip('/')
            if expected.is_dir():
                expected /= 'index.html'
            assert status == 200, (host, path, status)
            assert body == expected.read_bytes(), ('Artifact differs', host, path)
            assert headers.get('X-Content-Type-Options') == 'nosniff', path
            assert headers.get('X-Frame-Options') == 'DENY', path
            assert headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin', path
            assert 'max-age=31536000' in headers.get('Strict-Transport-Security', ''), path
            assert "default-src 'none'" in headers.get('Content-Security-Policy', ''), path
            assert 'no-transform' in headers.get('Cache-Control', ''), path
            assert 'camera=()' in headers.get('Permissions-Policy', ''), path
            if host == edge or path == '/404.html':
                assert 'noindex' in headers.get('X-Robots-Tag', ''), (host, path)
            else:
                assert 'noindex' not in headers.get('X-Robots-Tag', ''), (host, path)
            if path == '/social.png':
                assert headers.get_content_type() == 'image/png'
        for path in ('/release-check-missing-page', '/missing/', '/_headers'):
            status, headers, body = fetch('https://' + host + path, edge)
            assert status == 404, (host, path, status)
            assert body == (PUBLIC / '404.html').read_bytes(), ('Wrong error page', host, path)
        for path in ('/terms', '/privacy', '/conduct'):
            status, headers, _ = fetch('https://' + host + path + '?source=a%2Fb', edge)
            assert status == 301 and headers.get('Location') == path + '/?source=a%2Fb'
    for host in DOMAINS:
        scheme = 'http' if host == 'unbought.games' else 'https'
        path = '/example/path?source=release-check&tag=one&tag=two&encoded=a%2Fb'
        status, headers, _ = fetch(scheme + '://' + host + path, edge)
        assert status == 301, (host, status)
        location = headers.get('Location', '')
        parsed = urlsplit(location)
        assert (parsed.scheme, parsed.netloc, parsed.path) == ('https', 'unbought.games', '/example/path'), (host, location)
        # CloudFront parses/reorders query keys; preserve values and repeated-value order.
        assert parse_qs(parsed.query, keep_blank_values=True) == parse_qs(urlsplit(path).query, keep_blank_values=True), (host, location)
        assert 'encoded=a%2Fb' in parsed.query, ('Double-encoded query value', location)
    print(json.dumps({'edge': edge, 'result': 'passed', 'checks': [
        'all published files match', 'custom-domain TLS before DNS cutover',
        'security headers', 'preview noindex', 'canonical indexing',
        'real 404 and hidden deployment metadata', 'directory redirects',
        'alias and HTTPS redirects preserve paths and repeated/encoded queries'
    ]}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edge', required=True)
    verify(parser.parse_args().edge)
