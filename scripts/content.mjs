import MarkdownIt from 'markdown-it';
import { load, JSON_SCHEMA } from 'js-yaml';

export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function parsePost(source, label = 'post') {
  const match = source.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${label}: expected YAML frontmatter`);
  const post = load(match[1], { schema: JSON_SCHEMA });
  const keys = ['id','title','summary','date','updated','subject','kind','template','version','draft'];
  if (!post || typeof post !== 'object' || Array.isArray(post)) throw new Error(`${label}: invalid metadata`);
  for (const key of Object.keys(post)) if (!keys.includes(key)) throw new Error(`${label}: unknown field ${key}`);
  for (const key of ['id','title','summary','date','subject','kind']) if (typeof post[key] !== 'string' || !post[key].trim()) throw new Error(`${label}: missing ${key}`);
  if (!slugPattern.test(post.id) || !slugPattern.test(post.subject)) throw new Error(`${label}: invalid id or subject`);
  for (const key of ['date','updated']) if (post[key] && (!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(post[key]) || !Number.isFinite(Date.parse(post[key])))) throw new Error(`${label}: ${key} needs an ISO timestamp with timezone`);
  if (post.updated && Date.parse(post.updated) < Date.parse(post.date)) throw new Error(`${label}: update precedes publication`);
  if (!['news','patch','release'].includes(post.kind)) throw new Error(`${label}: invalid kind`);
  if (post.template && !['company','game','release'].includes(post.template)) throw new Error(`${label}: invalid template`);
  if (post.kind === 'release' && !/^\d+\.\d+\.\d+$/.test(post.version || '')) throw new Error(`${label}: release needs version`);
  if (post.draft !== undefined && typeof post.draft !== 'boolean') throw new Error(`${label}: draft must be boolean`);
  return { ...post, body: match[2] };
}
export function renderMarkdown(body) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const used = new Set();
  md.renderer.rules.heading_open = (tokens, index) => {
    // Post titles are supplied by the page; body headings start at h2.
    const level = Math.max(2, Number(tokens[index].tag.slice(1)));
    tokens[index].tag = tokens[index + 2].tag = `h${level}`;
    const base = tokens[index+1].content.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return `<h${level} id="${id}"><a class="heading-link" href="#${id}" aria-label="Link to this section">#</a> `;
  };
  const image = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, ...args) => {
    if (!tokens[index].content.trim()) throw new Error('Images need alt text');
    tokens[index].attrSet('loading','lazy');
    tokens[index].attrSet('decoding','async');
    return image(tokens,index,...args);
  };
  return md.render(body);
}
export function selectPosts(posts, subject = 'all', type = 'news') {
  return posts.filter(p => (subject === 'all' || p.subject === subject) && (type === 'all' || (type === 'patch' ? p.kind === 'patch' : p.kind !== 'patch')));
}
export const archivePath = (subject = 'all', type = 'news', page = 1) => `/news/${subject === 'all' && type === 'news' ? '' : `browse/${subject}/${type}/`}${page === 1 ? '' : `page/${page}/`}`;
export const feedPath = (subject = 'all', type = 'all') => `/feeds/${subject}/${type}.xml`;
