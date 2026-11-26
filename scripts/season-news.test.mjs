import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { importNews } from './import-news.mjs';

const game = {name: 'Orbit Imperium', repository: 'unbought-games/orbit-imperium'};
const subject = 'orbit-imperium';
const andromeda = '11111111-1111-4111-8111-111111111111';
const next = '22222222-2222-4222-8222-222222222222';
const publishTime = '2026-11-26T12:00:00Z';

test('publishing a mixed seasonal release includes main merge notes and newly enabled campaign notes in separate posts', async t => {
  const root = mkdtempSync(join(tmpdir(), 'season-publication-'));
  t.after(() => rmSync(root, {recursive:true,force:true}));
  const repo = join(root,'game'), dir = join(repo,'docs/news/changes');
  mkdirSync(dir,{recursive:true});
  const git = (...args) => execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  git('init','-q','-b','main');
  git('config','user.name','Fixture');
  git('config','user.email','fixture@example.test');
  const write = (id, title, metadata = '', filename = id) => {
    writeFileSync(join(dir,filename + '.md'), '---\nid: '+id+'\ntitle: '+title+'\n'+metadata+'\n---\n\nBody\n');
  };
  const commit = message => {
    git('add','.');
    git('commit','-qm',message);
    return git('rev-parse','HEAD');
  };

  write('already-live','Old news');
  write('finale','Andromeda enters its final week','audience: S001\ndraft: true');
  const before = commit('feat: create baseline');
  git('switch','-qc','prod/S001');
  write('finale','Andromeda enters its final week','audience: S001');
  write('spoiler','Hidden reveal','audience: S001\ndraft: true');
  write('future','Future season','audience: S002');
  git('mv','docs/news/changes/already-live.md','docs/news/changes/renamed.md');
  commit('feat: launch campaign');
  git('switch','-q','main');
  write('fleet','Returning fleets keep their cargo');
  const shared = commit('fix: return fleets');
  git('switch','-q','prod/S001');
  git('merge','--no-ff','-qm','Merge main into season',shared);
  const deployed = git('rev-parse','HEAD');
  mkdirSync(join(root,'.cache'),{recursive:true});
  execFileSync('git',['clone','--quiet','--bare',repo,join(root,'.cache',subject)]);
  mkdirSync(join(root,'content/sources'),{recursive:true});
  const makeRecord = (id, commit, previous) => ({
    id, commit, previous, published:publishTime, universe:andromeda, universe_name:'Andromeda', source_branch:'prod/S001'
  });
  const source = {repository:game.repository,releases:[],deployments:[
    makeRecord('first',deployed,before),
    makeRecord('rollback',before,deployed),
    {...makeRecord('new',shared), universe:next, universe_name:'New universe', source_branch:'main'},
  ]};
  writeFileSync(join(root,'content/sources',subject+'.json'),JSON.stringify(source));
  const posts = await importNews(root,{[subject]:game});
  assert.equal(posts.length,2);
  const [general, seasonal] = posts;
  assert.match(general.title,/^Orbit Imperium update/);
  assert.match(general.body,/Returning fleets keep their cargo/);
  assert.doesNotMatch(general.body,/final week/);
  assert.match(seasonal.title,/Andromeda · Season 1/);
  assert.match(seasonal.body,/Andromeda enters its final week/);
  assert.doesNotMatch(seasonal.body,/Returning fleets/);
  for (const post of posts) {
    assert.doesNotMatch(post.body,/Old news|Hidden reveal|Future season/);
    assert.ok(post.body.includes('/blob/'+deployed+'/'));
  }
});

test('publication identity includes retained universe and source branch and does not reuse another universe baseline', t => {
  const root = mkdtempSync(join(tmpdir(),'record-deployment-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'scripts'));
  cpSync(resolve('scripts/record-publication.py'),join(root,'scripts/record-publication.py'));
  mkdirSync(join(root,'content'));
  writeFileSync(join(root,'content/games.json'),JSON.stringify({[subject]:game}));
  const sha = 'a'.repeat(40), previous = 'b'.repeat(40);
  const record = (...flags) => execFileSync('python3',[join(root,'scripts/record-publication.py'),
    '--write-only','--game',subject,'--kind','deployment','--commit',sha,'--published',publishTime,...flags],{encoding:'utf8'});
  const target = (universe,name,branch) => ['--universe',universe,'--universe-name',name,'--source-branch',branch];
  record(); // A pre-cutover publication.
  assert.match(record(...target(andromeda,'Andromeda','main'),'--previous',sha), /no new publication/);
  // The actual release job can still publish its delta after an Accounts-only repeat.
  record(...target(andromeda,'Andromeda','main'),'--previous',previous);
  const cutover = [...target(andromeda,'Andromeda','prod/S001'),'--previous',previous];
  record(...cutover);
  assert.match(record(...cutover),/already recorded/);
  record(...target(next,'Next universe','main'));
  const publications = join(root,'content/publications',subject);
  const files = readdirSync(publications);
  assert.equal(files.length,4);
  const read = (id) => JSON.parse(readFileSync(join(publications,'deployment-'+id+'.json'),'utf8'));
  assert.equal(read(andromeda+'-S001-'+sha).previous, previous);
  assert.equal(read(andromeda+'-main-'+sha).previous,previous);
  assert.equal(read(next+'-main-'+sha).previous,undefined);
  assert.throws(()=>record('--universe',andromeda),/require universe/);
});
