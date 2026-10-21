# News publishing

The site is statically generated into `dist/` from `public/` assets,
`templates/home.html`, Markdown in `content/posts/`, and immutable game publication
records in `content/publications/`. Do not edit generated HTML. `npm run check`
builds and tests it; `npm run dev` previews it locally. Both AWS and the temporary
Cloudflare release path deploy the same content. A push to main rebuilds and deploys.

## Writing a post

Invoke `$write-unbought-announcement` or edit a Markdown file in `content/posts/`:

```yaml
---
id: a-permanent-url-slug
title: A concrete headline
summary: A short explanation that works without the rest of the post.
date: '2026-10-21T12:00:00-04:00'
subject: company
kind: news
template: company
---
```

Subjects are `company` and keys from `content/games.json`. Kinds are `news`, `patch`,
and `release`. Releases also require `version`. Templates are `company`, `game`,
and `release`. Optional `updated` records a substantive revision; optional
`draft: true` excludes unpublished work. Dates require timezones. Future local posts
are excluded until a later build; there is no implicit scheduling service.

IDs determine permanent URLs: `/news/ID/`. Keep them when editing titles or content.
Body headings receive stable fragment IDs. Raw HTML is escaped, and unsafe Markdown
links are rejected. Images require alt text. Sharing cards are generated at build
time, and overlong titles fail the build rather than silently clip. Use the voice
skill in `docs/skills/unbought-writing/SKILL.md` and edit it as the voice evolves.

## Browsing and feeds

`/news/` defaults to news and release announcements. Subject and content filters
are independent links, work without JavaScript, and reset pagination to page one.
`/news/browse/orbit-imperium/all/` includes patch notes; page two adds `page/2/`.
Each page contains ten entries. Empty filters remain useful subscription pages.

`/feeds/all/all.xml` is the total feed. Every subject has `news.xml`, `patch.xml`,
and `all.xml` under `/feeds/SUBJECT/`. `news` includes releases. RSS contains the
full rendered body, absolute links, publication times, and stable URL GUIDs; edits
keep their identity. All published entries remain in the feed so a long gap between
builds doesn't silently discard a deployment note. Page navigation is HTML, not
infinite scrolling. Sharing JavaScript is optional; email and RSS always work.

## Importing game publications

Each game is registered in `content/games.json` and `content/sources/GAME.json`.
`record-publication.py` commits a record to www after a successful official deployment
or published GitHub release. It accepts a full commit SHA and retries concurrent
pushes without losing another publication. Repeating an event doesn't create a second
post. Version tags and source revisions cannot be silently changed.

Builds read Markdown/data from recorded Git revisions using a local bare Git cache.
They never execute game code. A missing source revision or invalid release fails the
build. Prepared release notes on game main are not announcements: only a published
release record makes them visible on www.

Deployment summaries select player-facing feat/fix/perf Conventional Commits since
the previous recorded deployment. Routine tooling/dependency commits are omitted.
The first record establishes a baseline; rollbacks don't announce reverse changes.
Version releases import `docs/news/releases/vVERSION.md`. A human-written announcement
for a version belongs in that file, alongside its detailed notes.

The game owns its Markdown history and renders it locally for self-hosted players.
www owns the official server's publication ledger. These are separate facts: a game
build doesn't know when an operator deployed it.

## Credentials and recovery

Each publishing repository receives its own `WWW_PUBLISH_KEY`: a write deploy key
limited to www. Organizations that disable deploy keys can instead configure
`WWW_PUBLISH_TOKEN`, a fine-grained token with Contents read/write access only to www. Trusted publication jobs clone www, write the record,
and push main, triggering normal website CI. PR jobs never receive these keys.

An official deployment's news job is separate from its deployment job. Retry the
failed news job without deploying the game again. If a version was published but
notification failed, rerun the release workflow for that tag: it skips existing
public artifacts and retries recording the website event. A website build failure
can be corrected and rerun without changing the game release or moving its tag.
