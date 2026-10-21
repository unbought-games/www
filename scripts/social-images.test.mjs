import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { socialImage } from './social-images.mjs';

test('game cards use the registered artwork and reject overflowing titles',async()=>{
  const root=await mkdtemp(join(tmpdir(),'news-card-'));
  try{
    await cp(resolve('artwork'),join(root,'artwork'),{recursive:true});
    await mkdir(join(root,'public/art'),{recursive:true});
    await sharp({create:{width:10,height:10,channels:3,background:'#ff0000'}}).png().toFile(join(root,'public/art/custom.png'));
    const post={id:'custom-game',title:'A new game',template:'game',kind:'news'};
    await socialImage(post,'Another game',join(root,'dist'),root,'/art/custom.png');
    const pixel=await sharp(join(root,'dist/images/custom-game.png')).extract({left:1000,top:400,width:1,height:1}).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel],[255,0,0]);
    await assert.rejects(socialImage({...post,title:'W'.repeat(500)},'Another game',join(root,'dist'),root,'/art/custom.png'),/shorten title/);
    await assert.rejects(socialImage(post,'Another game',join(root,'dist'),root,'/art/../../secret'),/local/);
  }finally{await rm(root,{recursive:true,force:true});}
});
