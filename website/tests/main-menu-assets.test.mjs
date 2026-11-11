import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MAIN_MENU} from '../scripts/main-menu.mjs';

const web=fileURLToPath(new URL('../web/',import.meta.url));
const localPath=url=>{
 const parsed=new URL(url);
 if(parsed.hostname!=='www.dunerealms.com')return null;
 return parsed.pathname==='/'?'index.html':decodeURIComponent(parsed.pathname.slice(1));
};

test('every main-menu destination on the public website exists in the build source',()=>{
 for(const [label,url] of MAIN_MENU){
  const file=localPath(url);
  if(!file)continue;
  assert.ok(existsSync(new URL(file,new URL('../web/',import.meta.url))),`${label} links to missing ${file}`);
 }
});

test('every main-menu icon exists in the public website assets',()=>{
 for(const [label,,icon] of MAIN_MENU){
  assert.ok(existsSync(new URL('assets/'+icon,new URL('../web/',import.meta.url))),`${label} uses missing icon ${icon}`);
 }
});

test('Shop and Kit Exchange pages include their required client dependencies',()=>{
 for(const [page,assets] of [['shop.html',['shop-landing.css','shop-embed.js']],['kits.html',['kits.css','kits.js']]]){
  for(const asset of assets)assert.ok(existsSync(new URL(asset,new URL('../web/',import.meta.url))),`${page} requires ${asset}`);
 }
});
