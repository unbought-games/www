import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePost, renderMarkdown, selectPosts, archivePath, feedPath } from './content.mjs';
import { playerChanges, validateRecord } from './import-news.mjs';

const source = `---\nid: example\ntitle: Hello\nsummary: A summary\ndate: '2026-10-21T12:00:00Z'\nsubject: company\nkind: news\n---\n## Hello\nText`;
test('metadata fails closed on unsafe paths, invalid timestamps, and unknown fields',()=>{
  assert.equal(parsePost(source).id,'example');
  for (const invalid of [source.replace('id: example','id: ../escape'), source.replace('2026-10-21T12:00:00Z','yesterday'),source.replace('kind: news','kind: release'),source.replace('kind: news','kind: news\nunknown: value')]) assert.throws(()=>parsePost(invalid));
});
test('Markdown escapes raw HTML, blocks executable links, and generates unique heading anchors',()=>{
  const html=renderMarkdown('# A\n\n## A\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))');
  assert.match(html,/id="a"/);assert.match(html,/id="a-2"/);
  assert.doesNotMatch(html,/<script|href="javascript:|<h1/);
  assert.throws(()=>renderMarkdown('![](/image.png)'),/alt/);
});
test('subject and content filters are independent and keep releases in news',()=>{
  const posts=[{subject:'company',kind:'news'},{subject:'orbit-imperium',kind:'release'},{subject:'orbit-imperium',kind:'patch'}];
  assert.equal(selectPosts(posts).length,2);
  assert.equal(selectPosts(posts,'orbit-imperium','all').length,2);
  assert.deepEqual(selectPosts(posts,'orbit-imperium','patch'),[posts[2]]);
  assert.equal(archivePath('all','news',2),'/news/page/2/');
  assert.equal(feedPath('orbit-imperium','all'),'/feeds/orbit-imperium/all.xml');
});
test('deployment fallback selects player-facing conventional changes',()=>{
  const sha='a'.repeat(40);
  assert.deepEqual(playerChanges(`${sha}\tfix: Repair fleet returns\n${sha}\tchore: CI\n${sha}\tfix(ci): Cache\n${sha}\tfeat(fleets)!: New routing`).map(c=>c.text),['Repair fleet returns','New routing']);
  assert.throws(()=>validateRecord({commit:'main',published:'2026-10-21'},'deployment'));
});
