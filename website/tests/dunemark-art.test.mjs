import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const web=new URL('../web/',import.meta.url);
test('All Vaerkring denominations have full artwork, downloadable GUI sizes and the imperial seal',()=>{
 const chapters=JSON.parse(readFileSync(new URL('manual-data.json',web),'utf8'));
 const chapter=chapters.find(c=>c.id==='solaris-spice-sales-and-guild-travel');
 assert.match(chapter.body,/VAERKRING RESERVE/);
 for(const value of [1,5,100,1000,5000]){
  for(const file of [`dunemark-${value}.webp`,`dunemark-${value}-icon-64.png`,`dunemark-${value}-icon-128.png`])assert.ok(existsSync(new URL('assets/'+file,web)),file);
  assert.match(chapter.body,new RegExp('id="dunemark-'+value+'"'));
 }
 assert.ok(existsSync(new URL('assets/imperial-seal.png',web)));
});

test('The zero Leto II tribute is explicitly a separate non-game design',()=>{
 const chapters=JSON.parse(readFileSync(new URL('manual-data.json',web),'utf8'));
 const text=chapters.find(c=>c.id==='solaris-spice-sales-and-guild-travel').body;
 assert.match(text,/id="dunemark-0"/);
 assert.match(text,/Not an in-game denomination, item, reward or redeemable note/);
 assert.ok(existsSync(new URL('assets/dunemark-0-commemorative.webp',web)));
 assert.doesNotMatch(text,/dunemark-0-icon/);
});
