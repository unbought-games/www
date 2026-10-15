# Unbought Games · mini design guide

The approved identity is **F3: Two pieces, one O**. Two identical pieces, rotated
180 degrees, make the diagonal symbolic O. Equal pieces represent fair
competition; the space between them is shared. Use this original design, not
the later rounded, faceted, or face-off studies.

Open **guide.html** for the visual guide. It works offline alongside `exports/`.

## Choose the right asset

| Asset | Use | PNG export |
| --- | --- | --- |
| `exports/unbought-symbol.svg` | Avatars, app icons, favicon, small brand marks | 1024 × 1024, transparent, 128 px clear space on each side |
| `exports/unbought-wordmark.svg` | Headers and layouts where the name is sufficient | 2400 px wide, transparent |
| `exports/unbought-games.svg` | Primary one-line “unbought games” lockup; headers and press | 2400 px wide, transparent |
| `exports/unbought-games-stacked.svg` | Compact two-line lockup: unbought above Games | 2400 px wide, transparent |

Each has a matching PNG. The `-light` files use paper-colored artwork for dark
backgrounds. Prefer SVG for web and print; PNG is for services that require it.
The source SVGs contain paths, not live text, so no font installation is needed.

## Color

- Ink: **#201E1D**. Primary mark on a light background.
- Paper: **#F6F4EE**. Background, or reversed mark on an ink background.
- Keep both pieces of the O the same color and visual weight.
- The approved identity is monochrome. Green and the earlier color studies are
  not part of this release.

## Size, spacing, and typography

- Keep the complete name **unbought** on one line, with the symbolic O in its
  original position. The lowercase logo is intentional; prose can use Unbought.
- Around either wordmark, leave at least **half an O-width** of clear space on
  every side. For square symbol avatars, use the supplied 1024 PNG with its
  built-in 128 px safety margin; allow more space when the layout permits.
- Minimum display sizes: standalone symbol **16 px of visible artwork**;
  wordmark **160 px wide**; one-line lockup **260 px wide**; stacked lockup
  **160 px wide**. When horizontal space is tight, use the stacked lockup.
- Wordmark: **Space Grotesk 700**, with the approved custom O and spacing.
  Both lockups use **Space Grotesk 700** for games/Games, at the same weight and type size
  as unbought. The one-line version uses lowercase **games** on the same baseline;
  the stacked version uses title-case **Games**, left-aligned on the next line.
  Use normal spacing, not the former small, widely tracked uppercase descriptor.
  The SVG assets freeze these decisions; do not recreate the logo by typing its name.
- Body copy may use the platform's system sans-serif. The site does not load a
  web font. The bundled Space Grotesk font is licensed under the SIL Open Font
  License; see `source/OFL.txt`.

## Keep the identity intact

Do not stretch, rotate, separate, recolor one half, close the diagonal gap, add
effects, substitute a normal O, or split Unbought over lines. Keep games/Games in
the position and casing supplied in the selected lockup. Use a plain,
contrasting background. The complete logo is not the
symbol followed by another symbolic O: use one of the supplied configurations.

## Rebuild in the source repository

The repository additionally contains `source/SpaceGrotesk.ttf`,
`requirements.txt`, and `../../scripts/build-brand.py`. Those are not required
to use the exported kit. From the repository root:

```sh
python3 -m venv .local/brand-venv
.local/brand-venv/bin/python -m pip install -r artwork/brand/requirements.txt
.local/brand-venv/bin/python scripts/build-brand.py
npm run check
```

This rebuilds the outlined SVGs, transparent PNGs, zip, favicon, website logo,
and social card. It does not change the guide. The font source is preserved
locally; its SHA-256 is recorded in `manifest.json`. Original upstream files:

- https://github.com/google/fonts/tree/main/ofl/spacegrotesk
- https://github.com/floriankarsten/space-grotesk
