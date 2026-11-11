import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const web=new URL('../web/',import.meta.url);
const read=name=>readFileSync(new URL(name,web),'utf8');

test('homepage, staff, Shop and Kit Exchange use bundled navigation assets',()=>{
 for(const page of ['index.html','staff.html','shop.html','kits.html']){
  const html=read(page);
  assert.match(html,/portal-navigation\.css/,`${page} missing portal CSS`);
  assert.match(html,/portal-navigation\.js/,`${page} missing portal JS`);
  assert.doesNotMatch(html,/hosting-9(?:-release-1002)?/,`${page} uses stale navigation version`);
  assert.doesNotMatch(html,/nav-shop-v1\.webp/,`${page} uses missing Shop icon`);
 }
});

test('shipped portal script does not request the missing Shop icon',()=>{
 assert.doesNotMatch(read('portal-navigation.js'),/nav-shop-v1\.webp/);
});
