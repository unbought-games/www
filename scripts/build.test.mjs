import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from './build.mjs';

test('build paginates filtered archives, omits drafts/future posts and uses stable full-content RSS identities', async()=>{
  const root=await mkdtemp(join(tmpdir(),'unbought-news-'));
  try {
    for (const dir of ['public','templates','content','artwork']) await cp(resolve(dir),join(root,dir),{recursive:true});
    // Fixtures must stay offline and independent of real publication history.
    await rm(join(root,'content'),{recursive:true});
    await mkdir(join(root,'content/posts'),{recursive:true});
    await mkdir(join(root,'content/sources'),{recursive:true});
    await writeFile(join(root,'content/games.json'),JSON.stringify({'orbit-imperium':{name:'Orbit Imperium',repository:'unbought-games/orbit-imperium'}}));
    for (const subject of ['company','orbit-imperium']) await writeFile(join(root,'content/posts',subject+'.md'),`---\nid: ${subject}-news\ntitle: Fixture news\nsummary: News summary\ndate: '2026-10-21T12:00:00Z'\nsubject: ${subject}\nkind: news\ntemplate: company\n---\nNews body`);
    const post={title:'Fixture update',summary:'Fixture summary',date:'2026-10-20T12:00:00Z',subject:'orbit-imperium',kind:'patch',template:'release',body:'## Details\n\n[Read](/news/)'};
    const extraPosts=Array.from({length:12},(_,i)=>({...post,id:`fixture-${i}`}));
    extraPosts.push({...post,id:'draft',draft:true},{...post,id:'future',date:'2099-01-01T12:00:00Z'});
    const result=await build(root,{extraPosts,now:new Date('2026-10-22T12:00:00Z')});
    assert.equal(result.posts.length,14);
    const page=await readFile(join(root,'dist/news/browse/orbit-imperium/patch/page/2/index.html'),'utf8');
    assert.match(page,/Page 2 of 2/);assert.match(page,/rel="prev"/);
    const feed=await readFile(join(root,'dist/feeds/orbit-imperium/patch.xml'),'utf8');
    assert.equal((feed.match(/<item>/g)||[]).length,12);
    assert.match(feed,/https:\/\/unbought.games\/news\/fixture-0\//);
    assert.match(feed,/content:encoded/);assert.doesNotMatch(feed,/\/draft\/|\/future\//);
    const news=await readFile(join(root,'dist/news/index.html'),'utf8');
    assert.doesNotMatch(news,/Fixture update/);
    const article=await readFile(join(root,'dist/news/fixture-0/index.html'),'utf8');
    assert.match(article,/schema.org\/BlogPosting/);assert.match(article,/article:published_time/);assert.match(article,/twitter:card/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
