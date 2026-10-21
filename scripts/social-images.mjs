import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { escape } from './content.mjs';

export async function socialImage(post, subject, output, root) {
  const dark = post.template !== 'company';
  const ink = dark ? '#f6f4ee' : '#201e1d', paper = dark ? '#201e1d' : '#f6f4ee';
  const width = post.template === 'game' ? 25 : 34;
  const lines = [];
  for (const word of post.title.split(/\s+/)) {
    if (word.length > width) throw new Error(`${post.id}: title word too long for social card`);
    if (!lines.length || `${lines.at(-1)} ${word}`.length > width) lines.push(word);
    else lines[lines.length-1] += ' ' + word;
  }
  if (lines.length > 4) throw new Error(`${post.id}: shorten title for the sharing image`);
  const font = lines.length > 3 ? 54 : 62;
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="${paper}"/><path d="M64 156H1136" stroke="${ink}" stroke-opacity=".3"/><text x="64" y="218" fill="${ink}" font-family="Space Grotesk" font-size="22">${escape(subject.toUpperCase())} / ${post.kind === 'release' ? 'OPEN-SOURCE RELEASE' : post.kind === 'patch' ? 'SERVER UPDATE' : 'NEWS'}</text>${lines.map((line,i)=>`<text x="60" y="${302+i*font*1.15}" font-family="Space Grotesk" font-weight="700" font-size="${font}" fill="${ink}">${escape(line)}</text>`).join('')}<text x="64" y="580" fill="${ink}" font-family="Space Grotesk" font-size="21">unbought.games${post.version ? ' / v' + escape(post.version) : ''}</text></svg>`;
  const logo = await sharp(await readFile(join(root, 'artwork/brand/exports', dark ? 'unbought-games-light.svg' : 'unbought-games.svg'))).resize(340).png().toBuffer();
  const layers = [{ input: logo, left:64, top:64 }];
  if (post.template === 'game') layers.push({input:await sharp(join(root,'public/art/planet-03-640.webp')).resize(330).png().toBuffer(),left:825,top:235});
  await mkdir(join(output,'images'),{recursive:true});
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(join(output,'images',post.id+'.png'));
}
