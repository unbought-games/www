import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escape } from './content.mjs';

process.env.FONTCONFIG_FILE = fileURLToPath(new URL('../artwork/fonts.conf', import.meta.url));

export async function socialImage(post, subject, output, root) {
  const dark = post.template !== 'company';
  const ink = dark ? '#f6f4ee' : '#201e1d', paper = dark ? '#201e1d' : '#f6f4ee';
  const width = post.template === 'game' ? 740 : 1060;
  // Pango measures and wraps the bundled font, so wide letters and long words
  // cannot silently escape the card. No web font is sent to readers.
  const title = await sharp({text:{
    text:`<span foreground="${ink}">${escape(post.title)}</span>`,
    font:'Space Grotesk Bold 62',fontfile:join(root,'artwork/brand/source/SpaceGrotesk.ttf'),
    width,wrap:'word-char',rgba:true,dpi:72,
  }}).png().toBuffer({resolveWithObject:true});
  if (title.info.height > 280) throw new Error(`${post.id}: shorten title for the sharing image`);
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="${paper}"/><path d="M64 156H1136" stroke="${ink}" stroke-opacity=".3"/><text x="64" y="218" fill="${ink}" font-family="sans-serif" font-size="22">${escape(subject.toUpperCase())} / ${post.kind === 'release' ? 'OPEN-SOURCE RELEASE' : post.kind === 'patch' ? 'SERVER UPDATE' : 'NEWS'}</text><text x="64" y="580" fill="${ink}" font-family="sans-serif" font-size="21">unbought.games${post.version ? ' / v' + escape(post.version) : ''}</text></svg>`;
  const logo = await sharp(await readFile(join(root, 'artwork/brand/exports', dark ? 'unbought-games-light.svg' : 'unbought-games.svg'))).resize(340).png().toBuffer();
  const layers = [{ input: logo, left:64, top:64 },{input:title.data,left:60,top:255}];
  if (post.template === 'game') layers.push({input:await sharp(join(root,'public/art/planet-03-640.webp')).resize(330).png().toBuffer(),left:825,top:235});
  await mkdir(join(output,'images'),{recursive:true});
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(join(output,'images',post.id+'.png'));
}
