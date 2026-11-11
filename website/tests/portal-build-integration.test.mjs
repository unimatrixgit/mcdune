import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updatePortalNavigation,PORTAL_LINKS} from '../scripts/portal-navigation.mjs';

const web=new URL('../web/',import.meta.url);
for(const page of ['index.html','staff.html','shop.html','kits.html']){
 test(`${page} gets canonical shared navigation once during packaging`,()=>{
  const original=readFileSync(new URL(page,web),'utf8');
  const rendered=updatePortalNavigation(original);
  assert.equal(updatePortalNavigation(rendered),rendered);
  const nav=rendered.match(/<nav aria-label="Main navigation">([\s\S]*?)<\/nav>/);
  assert.ok(nav,`${page} missing navigation`);
  for(const [name,href] of PORTAL_LINKS)assert.ok(nav[1].includes(`href="${href}"`),`${page} missing ${name}`);
  assert.equal((rendered.match(/<link rel="stylesheet" href="\/portal-navigation\.css">/g)||[]).length,1);
  assert.equal((rendered.match(/<script src="\/portal-navigation\.js" defer><\/script>/g)||[]).length,1);
 });
}
test('production build uses canonical portal injection when packaging HTML',()=>{
 const source=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(source,/updatePortalNavigation\(bytes\.toString\('utf8'\)\)/);
});
