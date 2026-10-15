"""Build the approved F3 brand assets. See artwork/brand/README.md."""
from functools import lru_cache
from html import escape
from io import BytesIO
from pathlib import Path
import hashlib
import json
import zipfile

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import resvg_py
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "artwork/brand"
OUT = BRAND / "exports"
FONT = BRAND / "source/SpaceGrotesk.ttf"
INK, PAPER = "#201e1d", "#f6f4ee"
# Approved F3: preserve these two identical, 180-degree-rotated pieces exactly.
SYMBOL = "M0 0h28l-10 10H10v8L0 28zM32 32H4l10-10h8v-8L32 4z"


def number(value):
    return f"{value:.3f}".rstrip("0").rstrip(".") or "0"


@lru_cache
def font_at(weight):
    font = instantiateVariableFont(TTFont(FONT), {"wght": weight}, inplace=True)
    stream = BytesIO()
    font.save(stream)
    face = hb.Face(stream.getvalue())
    shaping_font = hb.Font(face)
    shaping_font.scale = (face.upem, face.upem)
    return font, shaping_font, face.upem


def lettering(value, x, baseline, size, weight=700, tracking=0):
    font, shaping_font, upem = font_at(weight)
    buffer = hb.Buffer()
    buffer.add_str(value)
    buffer.guess_segment_properties()
    hb.shape(shaping_font, buffer)
    glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
    pen = SVGPathPen(glyphs, ntos=number)
    scale, cursor = size / upem, x
    for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions):
        transform = (scale, 0, 0, -scale,
                     cursor + pos.x_offset * scale, baseline - pos.y_offset * scale)
        glyphs[order[info.codepoint]].draw(TransformPen(pen, transform))
        cursor += pos.x_advance * scale + tracking
    width = cursor - x - (tracking if value else 0)
    return f'<path d="{pen.getCommands()}"/>', width


def symbol(x=0, y=0, size=32):
    return f'<path transform="translate({number(x)} {number(y)}) scale({number(size / 32)})" d="{SYMBOL}"/>'


def wordmark():
    # Same size, spacing, weight, and symbol proportions as the selected F3.
    left, advance = lettering("unb", 0, 40, 47)
    right, right_width = lettering("ught", advance + 32, 40, 47)
    return left + symbol(advance + 1.5, 11, 29) + right, advance + 32 + right_width


def document(body, width, height, title, fill=INK, viewbox=None):
    box = viewbox or f"0 0 {number(width)} {number(height)}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{number(width)}" '
            f'height="{number(height)}" viewBox="{box}" role="img" aria-label="{escape(title)}">'
            f'<title>{escape(title)}</title><g fill="{fill}">{body}</g></svg>\n')


def export(name, svg, png_width):
    (OUT / f"{name}.svg").write_text(svg)
    (OUT / f"{name}.png").write_bytes(resvg_py.svg_to_bytes(
        svg_string=svg, width=png_width, skip_system_fonts=True))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    word, advance = wordmark()
    width, word_height, stacked_height = advance + 8, 57, 108
    # Games is full-size typography, not a small uppercase descriptor.
    games_x = advance + 4 + 14
    games, games_width = lettering("games", games_x, 40, 47, weight=700)
    inline_width = games_x + games_width + 4
    stacked_games, _ = lettering("Games", 4, 92, 47, weight=700)
    word = f'<g transform="translate(4 0)">{word}</g>'
    for suffix, color in (("", INK), ("-light", PAPER)):
        export("unbought-symbol" + suffix, document(
            symbol(), 1024, 1024, "Unbought symbol", color,
            "-5.333333 -5.333333 42.666666 42.666666"), 1024)
        export("unbought-wordmark" + suffix, document(
            word, width, word_height, "Unbought", color), 2400)
        export("unbought-games" + suffix, document(
            word + games, inline_width, word_height, "Unbought Games", color), 2400)
        export("unbought-games-stacked" + suffix, document(
            word + stacked_games, width, stacked_height, "Unbought Games", color), 2400)

    (ROOT / "public/logo.svg").write_bytes((OUT / "unbought-games.svg").read_bytes())
    (ROOT / "public/logo-stacked.svg").write_bytes((OUT / "unbought-games-stacked.svg").read_bytes())
    (ROOT / "public/favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        f'<style>path{{fill:{INK}}}@media(prefers-color-scheme:dark){{path{{fill:{PAPER}}}}}</style>'
        f'<path d="{SYMBOL}"/></svg>\n')

    # Outline the entire social card too: identical output on every renderer.
    logo_scale = 290 / width
    social = f'<rect width="1200" height="630" fill="{PAPER}"/>'
    social += f'<g transform="translate(72 38) scale({number(logo_scale)})">{word}</g>'
    for value, x, baseline, size, weight in (
        ("Victory isn’t", 68, 287, 104, 700), ("for sale.", 68, 395, 104, 700),
        ("Games worth playing. Victory worth earning.", 72, 569, 21, 500),
    ):
        paths, _ = lettering(value, x, baseline, size, weight)
        social += paths
    url, url_width = lettering("unbought.games", 0, 569, 21, 500)
    social += f'<g transform="translate({number(1128 - url_width)} 0)">{url}</g>'
    social += '<path d="M72 522h1056" fill="none" stroke="#d5d1cb"/>'
    social_svg = document(social, 1200, 630, "Unbought. Victory isn’t for sale.")
    (ROOT / "artwork/social.svg").write_text(social_svg)
    (ROOT / "public/social.png").write_bytes(resvg_py.svg_to_bytes(
        svg_string=social_svg, skip_system_fonts=True))

    manifest = {
        "design": "F3 — Two pieces, one O (original approved diagonal design)",
        "font": "Space Grotesk 2.000; unbought and games/Games 700; same 47-unit type size; all lettering outlined",
        "font_sha256": hashlib.sha256(FONT.read_bytes()).hexdigest(),
        "ink": INK, "paper": PAPER,
        "wordmark_svg_size": [round(width, 3), word_height],
        "lockup_svg_size": [round(inline_width, 3), word_height],
        "stacked_lockup_svg_size": [round(width, 3), stacked_height],
        "symbol_png_size": [1024, 1024],
        "wordmark_png_width": 2400,
    }
    (BRAND / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    # Deterministic archive, including an offline guide and font attribution.
    files = [*sorted(OUT.iterdir()), BRAND / "guide.html", BRAND / "guide.css",
             BRAND / "README.md", BRAND / "manifest.json", BRAND / "source/OFL.txt"]
    with zipfile.ZipFile(BRAND / "unbought-brand-kit.zip", "w", zipfile.ZIP_DEFLATED) as kit:
        for path in files:
            info = zipfile.ZipInfo(str(path.relative_to(BRAND)), (2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            kit.writestr(info, path.read_bytes())
    print(f"Built 16 logo files, brand kit, favicon, website logos, and social card. Horizontal lockup width: {inline_width:.3f}.")


if __name__ == "__main__":
    main()
