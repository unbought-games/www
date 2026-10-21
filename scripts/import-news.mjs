import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePost } from './content.mjs';

const shaPattern = /^[a-f0-9]{40}$/;
export function validateRecord(record, kind) {
  if (!shaPattern.test(record.commit) || !Number.isFinite(Date.parse(record.published))) throw new Error('Invalid publication revision/date');
  if (kind === 'release' && !/^v\d+\.\d+\.\d+$/.test(record.tag)) throw new Error('Invalid release tag');
  if (kind === 'deployment' && !/^[a-zA-Z0-9-]{1,100}$/.test(record.id)) throw new Error('Invalid deployment identity');
  if (record.previous && !shaPattern.test(record.previous)) throw new Error('Invalid previous revision');
}
export function playerChanges(log) {
  return log.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^([a-f0-9]{40})\t(?:feat|fix|perf)(?:\(([^)]+)\))?!?: (.+)$/);
    return match && !['ci','build','deps','release','tooling','tests'].includes(match[2]) ? {commit:match[1],text:match[3]} : null;
  }).filter(Boolean);
}
export async function importNews(root, games) {
  const result = [];
  for (const file of (await readdir(join(root,'content/sources'))).filter(f=>f.endsWith('.json'))) {
    const subject = file.slice(0,-5), game = games[subject];
    const source = JSON.parse(await readFile(join(root,'content/sources',file),'utf8'));
    if (!game || source.repository !== game.repository || !/^unbought-games\/[a-z0-9-]+$/.test(source.repository)) throw new Error(`Unexpected source ${file}`);
    let publications = [];
    try { publications = await readdir(join(root,'content/publications',subject)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const publication of publications.filter(f=>f.endsWith('.json'))) {
      const record = JSON.parse(await readFile(join(root,'content/publications',subject,publication),'utf8'));
      if (!['release','deployment'].includes(record.kind)) throw new Error('Unknown publication kind');
      source[record.kind === 'release' ? 'releases' : 'deployments'].push(record);
    }
    if (!source.deployments.length && !source.releases.length) continue;
    const cache = join(root,'.cache',subject);
    await mkdir(cache,{recursive:true});
    const git = (...args) => execFileSync('git',['-C',cache,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','--bare','--quiet');
    git('config','remote.origin.url',`https://github.com/${source.repository}.git`);
    git('config','remote.origin.promisor','true');
    git('config','remote.origin.partialclonefilter','blob:none');
    const fetch = commit => {
      if (!shaPattern.test(commit)) throw new Error('Invalid revision');
      try { git('cat-file','-e',commit+'^{commit}'); }
      catch { git('fetch','--quiet','--filter=blob:none','origin',commit); }
    };
    for (const record of source.deployments) {
      validateRecord(record,'deployment');
      if (!record.previous) continue; // Establishing a baseline must not announce the entire repository history.
      fetch(record.commit);
      fetch(record.previous);
      try { git('merge-base','--is-ancestor',record.previous,record.commit); }
      catch { continue; } // A rollback is not a new feature announcement.
      const changes = playerChanges(git('log','--first-parent','--format=%H%x09%s',`${record.previous}..${record.commit}`));
      if (!changes.length) continue;
      const id = `${subject}-update-${record.id}`;
      const post = {
        id,title:`${game.name} update · ${new Date(record.published).toISOString().slice(0,16).replace('T',' ') + ' UTC'}`,
        summary:changes.length === 1 ? changes[0].text : `${changes.length} changes are live on the official server.`,
        date:record.published,subject,kind:'patch',template:'release',
        body:`These changes are live on the official ${game.name} server. Official-server updates are published independently of numbered open-source releases.\n\n## Changes\n\n${changes.map(c=>`- ${c.text.replace(/[\\[\]<>*_`]/g,'\\$&')} ([commit](https://github.com/${source.repository}/commit/${c.commit}))`).join('\n')}\n`,
      };
      result.push({...post,id,subject,kind:'patch',date:record.published,source:`https://github.com/${source.repository}/commit/${record.commit}`});
    }
    for (const record of source.releases) {
      validateRecord(record,'release'); fetch(record.commit);
      if (git('rev-parse',record.commit+'^{commit}') !== record.commit) throw new Error('Source revision mismatch');
      const post = parsePost(git('show',`${record.commit}:docs/news/releases/${record.tag}.md`),record.tag);
      if (post.draft || post.kind !== 'release' || post.subject !== subject || post.version !== record.tag.slice(1)) throw new Error(`Release metadata mismatch: ${record.tag}`);
      result.push({...post,date:record.published,source:`https://github.com/${source.repository}/releases/tag/${record.tag}`});
    }
  }
  return result;
}
