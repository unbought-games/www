import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape as e, parsePost, renderMarkdown, selectPosts, archivePath, feedPath } from './content.mjs';
import { socialImage } from './social-images.mjs';
import { importNews } from './import-news.mjs';

const BASE = 'https://unbought.games';
const PAGE_SIZE = 10;
const dateLabel = date => new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'America/New_York'}).format(new Date(date));
const subjectLabel = (subject,games) => subject === 'all' ? 'Everything' : subject === 'company' ? 'Company' : games[subject].name;
const kindLabel = kind => ({news:'News',patch:'Server update',release:'Open-source release'}[kind]);
const postPath = p => `/news/${p.id}/`;
const header = `<a class="skip-link" href="#main">Skip to content</a><header><a class="wordmark" href="/" aria-label="unbought games home"><picture><source media="(max-width:479px)" srcset="/logo-stacked.svg"><img src="/logo.svg" width="400" height="57" alt="unbought games"></picture></a><nav aria-label="Main"><a href="/#orbit-title">Our games</a><a href="/news/" aria-current="page">News</a></nav></header>`;
const footer = `<footer><p>We can fix everything. Starting with games.</p><nav aria-label="Footer"><a href="/feeds/all/all.xml">RSS</a><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a><a href="/conduct/">Conduct</a></nav></footer>`;
function layout({title,summary,path,body,image='/social.png',feed='/feeds/all/all.xml',post,prev,next}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · unbought games</title><meta name="description" content="${e(summary)}"><meta name="theme-color" content="#f6f4ee"><link rel="canonical" href="${BASE+path}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/news.css"><link rel="alternate" type="application/rss+xml" title="${e(title)} RSS" href="${feed}">${prev?`<link rel="prev" href="${prev}">`:''}${next?`<link rel="next" href="${next}">`:''}<meta property="og:type" content="${post?'article':'website'}"><meta property="og:locale" content="en_US"><meta property="og:site_name" content="unbought games"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(summary)}"><meta property="og:url" content="${BASE+path}"><meta property="og:image" content="${BASE+image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(summary)}"><meta name="twitter:image" content="${BASE+image}"><meta name="twitter:image:alt" content="${e(title)}">${post?`<meta property="article:published_time" content="${e(post.date)}"><meta property="article:modified_time" content="${e(post.updated||post.date)}"><script src="/share.js" defer></script>`:''}</head><body class="news-site">${header}<main id="main">${body}</main>${footer}</body></html>`;
}
function card(post,games) {
  return `<article class="news-card"><div class="post-meta"><span>${e(subjectLabel(post.subject,games))}</span><span>${kindLabel(post.kind)}</span><time datetime="${e(post.date)}">${dateLabel(post.date)}</time></div><h2><a href="${postPath(post)}">${e(post.title)}</a></h2><p>${e(post.summary)}</p><a class="read-link" href="${postPath(post)}">Read ${post.kind==='patch'?'update':'story'} <span aria-hidden="true">↗</span></a></article>`;
}
export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)),'..'), {now = new Date(), extraPosts=[]} = {}) {
  const output = join(root,'dist');
  await rm(output,{recursive:true,force:true}); await cp(join(root,'public'),output,{recursive:true});
  const games = JSON.parse(await readFile(join(root,'content/games.json'),'utf8'));
  const local = await Promise.all((await readdir(join(root,'content/posts'))).filter(f=>f.endsWith('.md')).map(async file=>parsePost(await readFile(join(root,'content/posts',file),'utf8'),file)));
  const posts = [...local,...await importNews(root,games),...extraPosts].filter(p=>!p.draft && new Date(p.date)<=now).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||a.id.localeCompare(b.id));
  const ids = new Set();
  for (const p of posts) {
    if (ids.has(p.id)) throw new Error(`Duplicate post id ${p.id}`); ids.add(p.id);
    if (p.subject !== 'company' && !games[p.subject]) throw new Error(`Unknown subject ${p.subject}`);
    p.template ||= ['release','patch'].includes(p.kind) ? 'release' : p.subject === 'company' ? 'company' : 'game';
    p.html = renderMarkdown(p.body);
  }
  const sitemap = [{path:'/'},...['terms','privacy','conduct'].map(p=>({path:`/${p}/`}))];
  const save = async (path,text) => {const target=join(output,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,text);};
  for (const p of posts) {
    await socialImage(p,subjectLabel(p.subject,games),output,root,games[p.subject]?.art);
    const related = selectPosts(posts,p.subject,'news').filter(x=>x.id!==p.id).slice(0,3);
    const body = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/news/">News</a> / <a href="${archivePath(p.subject,'all')}">${e(subjectLabel(p.subject,games))}</a></nav><article class="post" itemscope itemtype="https://schema.org/BlogPosting"><meta itemprop="mainEntityOfPage" content="${BASE+postPath(p)}"><meta itemprop="image" content="${BASE}/images/${p.id}.png"><div itemprop="publisher" itemscope itemtype="https://schema.org/Organization"><meta itemprop="name" content="unbought games"><meta itemprop="url" content="${BASE}"></div><div class="post-meta"><span>${kindLabel(p.kind)}</span><time itemprop="datePublished" datetime="${e(p.date)}">${dateLabel(p.date)}</time>${p.updated?`<span>Updated <time itemprop="dateModified" datetime="${e(p.updated)}">${dateLabel(p.updated)}</time></span>`:''}</div><h1 itemprop="headline">${e(p.title)}</h1><p class="post-summary" itemprop="description">${e(p.summary)}</p><img class="post-image" src="/images/${p.id}.png" width="1200" height="630" alt="${e(p.title)}">${p.template==='game'?'<p class="art-credit">Planet artwork: Orbit Imperium contributors / Unbought Games, LLC. <a href="/art/credits.txt">Credit and license</a>.</p>':''}<div class="post-body" itemprop="articleBody">${p.html}</div>${p.source?`<p class="source-note"><a href="${e(p.source)}">${p.kind==='release'?'View release and downloads on GitHub':'View deployed source on GitHub'} ↗</a></p>`:''}<div class="sharing"><button type="button" data-share hidden>Share post</button><button type="button" data-copy hidden>Copy link</button><a href="mailto:?subject=${encodeURIComponent(p.title)}&amp;body=${encodeURIComponent(BASE+postPath(p))}">Email</a><a href="${feedPath(p.subject,'all')}">Subscribe via RSS</a><span role="status" aria-live="polite" data-share-status></span></div></article>${related.length?`<section class="related"><h2>More from ${e(subjectLabel(p.subject,games))}</h2>${related.map(p=>card(p,games)).join('')}</section>`:''}`;
    await save(postPath(p)+'index.html',layout({title:p.title,summary:p.summary,path:postPath(p),body,image:`/images/${p.id}.png`,post:p,feed:feedPath(p.subject,'all')}));
    sitemap.push({path:postPath(p),updated:p.updated||p.date});
  }
  for (const subject of ['all','company',...Object.keys(games)]) for (const type of ['news','patch','all']) {
    const selected = selectPosts(posts,subject,type), total = Math.max(1,Math.ceil(selected.length/PAGE_SIZE));
    const title = `${subjectLabel(subject,games)} · ${type==='all'?'All updates':type==='patch'?'Patch notes':'News'}`;
    for (let page=1;page<=total;page++) {
      const path = archivePath(subject,type,page), prev=page>1?archivePath(subject,type,page-1):null,next=page<total?archivePath(subject,type,page+1):null;
      const filters = `<div class="filters"><nav aria-label="Filter by subject"><span class="filter-label">Follow</span>${['all','company',...Object.keys(games)].map(s=>`<a href="${archivePath(s,type)}"${s===subject?' aria-current="page"':''}>${e(subjectLabel(s,games))}</a>`).join('')}</nav><nav aria-label="Filter by content"><span class="filter-label">Show</span>${['news','patch','all'].map(t=>`<a href="${archivePath(subject,t)}"${t===type?' aria-current="page"':''}>${t==='news'?'News & releases':t==='patch'?'Patch notes':'Everything'}</a>`).join('')}</nav></div>`;
      const body = `<div class="archive-intro"><p class="eyebrow">From unbought games</p><h1>News<span class="accent">.</span></h1><p class="intro">What we're building. What's changing. What's next.</p></div>${filters}<div class="archive-toolbar"><p>${selected.length} ${selected.length===1?'post':'posts'} · ${e(subjectLabel(subject,games))}</p><a href="${feedPath(subject,type)}">RSS for this view ↗</a></div><section class="news-list" aria-label="${e(title)}">${selected.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(p=>card(p,games)).join('')||'<p class="empty-state">Nothing here yet. Choose another filter, or subscribe to hear when that changes.</p>'}</section><nav class="pagination" aria-label="Pagination">${prev?`<a rel="prev" href="${prev}">← Newer posts</a>`:'<span></span>'}<span>Page ${page} of ${total}</span>${next?`<a rel="next" href="${next}">Older posts →</a>`:'<span></span>'}</nav>`;
      await save(path+'index.html',layout({title:page===1?title:`${title} · Page ${page}`,summary:'Company news, game announcements, patch notes, and open-source releases from unbought games.',path,body,feed:feedPath(subject,type),prev,next}));
      sitemap.push({path});
    }
    const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${e(title)} · unbought games</title><link>${BASE+archivePath(subject,type)}</link><description>Updates from unbought games</description><language>en-us</language><atom:link href="${BASE+feedPath(subject,type)}" rel="self" type="application/rss+xml"/>${selected[0]?`<lastBuildDate>${new Date(selected.reduce((latest,p)=>Date.parse(p.updated||p.date)>Date.parse(latest)?p.updated||p.date:latest,selected[0].date)).toUTCString()}</lastBuildDate>`:''}${selected.map(p=>`<item><title>${e(p.title)}</title><link>${BASE+postPath(p)}</link><guid isPermaLink="true">${BASE+postPath(p)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${e(subjectLabel(p.subject,games))}</category><category>${kindLabel(p.kind)}</category><description>${e(p.summary)}</description><content:encoded>${e(p.html.replace(/(href|src)="\/(?!\/)/g,`$1="${BASE}/`).replace(/href="#/g,`href="${BASE+postPath(p)}#`))}</content:encoded></item>`).join('')}</channel></rss>`;
    await save(feedPath(subject,type),feed);
  }
  const recent = selectPosts(posts).slice(0,3);
  let home=await readFile(join(root,'templates/home.html'),'utf8');
  home=home.replace('</head>','<link rel="stylesheet" href="/news.css"><link rel="alternate" type="application/rss+xml" title="All unbought games updates" href="/feeds/all/all.xml"></head>');
  home=home.replace('</header>','<nav aria-label="Main"><a href="/#orbit-title">Our games</a><a href="/news/">News</a></nav></header>');
  home=home.replace('</main>',`<section class="home-news"><div class="section-heading"><h2>Latest news.</h2><a href="/news/">All news ↗</a></div>${recent.map(p=>card(p,games)).join('')}</section></main>`);
  await save('index.html',home);
  await save('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(p=>`<url><loc>${BASE+p.path}</loc>${p.updated?`<lastmod>${new Date(p.updated).toISOString()}</lastmod>`:''}</url>`).join('')}</urlset>`);
  console.log(`Built ${posts.length} posts, ${sitemap.length} pages, and ${(Object.keys(games).length+2)*3} RSS feeds.`);
  return {posts,output};
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await build();
