import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importNews } from './import-news.mjs';

test('imports pinned released notes and deployed deltas, never unpublished notes on main',async()=>{
  const root=mkdtempSync(join(tmpdir(),'news-import-')),repo=join(root,'game');mkdirSync(repo);
  const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  const subject='orbit-imperium',games={[subject]:{name:'Orbit Imperium',repository:'unbought-games/orbit-imperium'}};
  try{
    git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
    mkdirSync(join(repo,'docs/news/releases'),{recursive:true});
    const release="---\nid: orbit-imperium-v0-1-0\ntitle: Original release\nsummary: Ready to play\ndate: '2026-10-21T12:00:00Z'\nsubject: orbit-imperium\nkind: release\nversion: 0.1.0\n---\nOriginal notes";
    writeFileSync(join(repo,'docs/news/releases/v0.1.0.md'),release);git('add','.');git('commit','-qm','feat: initial game');const before=git('rev-parse','HEAD');
    writeFileSync(join(repo,'fix.txt'),'fixed');git('add','.');git('commit','-qm','fix: return fleets');const deployed=git('rev-parse','HEAD');
    writeFileSync(join(repo,'docs/news/releases/v0.1.0.md'),release.replace('Original notes','Unpublished rewrite'));git('add','.');git('commit','-qm','docs: rewrite draft');
    mkdirSync(join(root,'.cache'),{recursive:true});execFileSync('git',['clone','--bare','--quiet',repo,join(root,'.cache',subject)]);
    mkdirSync(join(root,'content/sources'),{recursive:true});
    const source={repository:games[subject].repository,deployments:[{id:'deploy',commit:deployed,previous:before,published:'2026-10-21T13:00:00Z'}],releases:[]};
    writeFileSync(join(root,'content/sources',subject+'.json'),JSON.stringify(source));
    assert.equal((await importNews(root,games)).length,1);
    source.releases=[{commit:before,tag:'v0.1.0',published:'2026-10-21T14:00:00Z'}];
    writeFileSync(join(root,'content/sources',subject+'.json'),JSON.stringify(source));
    const posts=await importNews(root,games);assert.equal(posts.length,2);assert.match(posts[0].body,/return fleets/);assert.equal(posts[1].body,'Original notes');assert.equal(posts[1].date,'2026-10-21T14:00:00Z');
    // Exact revision matches share the release post; an older release above did not.
    source.releases=[{commit:deployed,tag:'v0.1.0',published:'2026-10-21T14:00:00Z'}];
    writeFileSync(join(root,'content/sources',subject+'.json'),JSON.stringify(source));
    const coordinated=await importNews(root,games);
    assert.equal(coordinated.length,1);
    assert.equal(coordinated[0].kind,'release');
    assert.equal(coordinated[0].id,'orbit-imperium-v0-1-0');
    assert.equal(coordinated[0].body,'Original notes');
  }finally{rmSync(root,{recursive:true,force:true});}
});
