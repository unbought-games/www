import { load, JSON_SCHEMA } from 'js-yaml';
import { markdownLabel } from './content.mjs';

const seasonPattern = /^prod\/(S\d{3})$/;
const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const notePrefix = 'docs/news/changes/';

export function validateDeploymentTarget(record) {
  if (record.universe === undefined && record.universe_name === undefined && record.source_branch === undefined) return;
  if (!uuidPattern.test(record.universe) || typeof record.universe_name !== 'string' || !record.universe_name.trim() ||
      !(record.source_branch === 'main' || seasonPattern.test(record.source_branch))) {
    throw new Error('Invalid universe or deployment source branch');
  }
}

function publishedNotes(git, revision, files) {
  const notes = new Map();
  for (const file of files) {
    const source = git('show', revision + ':' + file);
    const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!front) throw new Error('Missing change note frontmatter in ' + file);
    const note = load(front[1], {schema: JSON_SCHEMA});
    if (!note || typeof note.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.id) || typeof note.title !== 'string' || !note.title.trim() ||
        (note.audience !== undefined && note.audience !== 'game' && !/^S\d{3}$/.test(note.audience))) {
      throw new Error('Invalid change note in ' + file);
    }
    if (note.draft !== undefined && typeof note.draft !== 'boolean') throw new Error('Invalid draft flag in ' + file);
    if (!note.draft) {
      if (notes.has(note.id)) throw new Error('Duplicate change note ' + note.id);
      notes.set(note.id, {...note, file});
    }
  }
  return notes;
}

function addedNotes(git, previous, commit) {
  // Compare deployed trees, including second parents of main-to-season merges.
  // A published note keeps its identity through amendments and file renames.
  const changed = git('diff', '--no-renames', '--name-status', '-z', previous, commit, '--', notePrefix + '*.md');
  const fields = changed.split('\0');
  const oldFiles = [], newFiles = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const status = fields[index], file = fields[index + 1];
    if (status !== 'A') oldFiles.push(file);
    if (status !== 'D') newFiles.push(file);
  }
  const old = publishedNotes(git, previous, oldFiles);
  const current = publishedNotes(git, commit, newFiles);
  return [...current.values()].filter(note => !old.has(note.id));
}

export function seasonPosts(git, subject, game, record) {
  const [, season] = record.source_branch.match(seasonPattern);
  const notes = addedNotes(git, record.previous, record.commit);
  const date = new Date(record.published).toISOString().slice(0,16).replace('T',' ') + ' UTC';
  const posts = [];
  for (const audience of ['game', season]) {
    const selected = notes.filter(note => (note.audience ?? 'game') === audience);
    if (!selected.length) continue;
    const label = audience === 'game' ? game.name : record.universe_name + ' · Season ' + Number(season.slice(1));
    const lines = selected.map(note => {
      const path = note.file.split('/').map(encodeURIComponent).join('/');
      return '- [' + markdownLabel(note.title) + '](https://github.com/' + game.repository + '/blob/' + record.commit + '/' + path + ')';
    });
    posts.push({
      id: subject + '-update-' + record.id + '-' + audience.toLowerCase(),
      title: label + ' update · ' + date,
      summary: selected.length === 1 ? selected[0].title : selected.length + ' changes are live in ' + record.universe_name + '.',
      body: 'These changes are live in ' + markdownLabel(record.universe_name) + '.\n\n' + lines.join('\n') + '\n',
      date: record.published, subject, kind: 'patch', template: 'release',
      source: 'https://github.com/' + game.repository + '/commit/' + record.commit,
    });
  }
  return posts;
}
