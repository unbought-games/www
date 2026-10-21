---
name: write-unbought-announcement
description: Draft or update company and game announcements for unbought games, using repository evidence and existing release notes. Merge version-specific editorial into the version's existing post.
---

Read the sibling `unbought-writing/SKILL.md`, then `docs/news-publishing.md` in
this repository. Find the intended subject, audience, and publication state from
the request and repository before asking questions. Ask only for missing context
that affects the story. Don't ask the owner to restate facts available in code,
commits, release notes, or deployment records.

Company news and standalone announcements live in `content/posts/`. For an exact
game version, locate that game's `docs/news/releases/vVERSION.md` and edit its
editorial introduction and detailed notes together. Preserve its ID and URL.
If release preparation hasn't happened, create that version's Markdown file with
`draft: true`; the release-preparation skill will incorporate and finalize it.
Don't create a second post for the same version.

Use ISO timestamps with timezone. Titles and summaries should stand alone in RSS
and social previews. Choose company, game, or release image template. Use ordinary
Markdown headings, descriptive links, and image alt text. Skip author metadata.

Ground claims in actual changes and verified publication state. Say explicitly
when an update is live on the official server or belongs to a numbered release.
Keep migration/upgrade instructions in the version's notes, with links to docs.

A writing request authorizes drafting and local edits. Follow the user's scope
for pushing or publishing; don't infer permission to send to Discord or socials.
If publishing is authorized, run `npm run check`, inspect the generated post and
sharing image, and use the normal website PR/push flow. Draft and future-dated
local posts are excluded from public builds. Future dates don't schedule a build;
use an explicitly requested scheduling workflow if automatic timed publication
is desired.
