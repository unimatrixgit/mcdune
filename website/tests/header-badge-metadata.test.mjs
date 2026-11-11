import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('release badge metadata does not contaminate navigation tuples',()=>{
 const js=readFileSync(new URL('../web/portal-navigation.js',import.meta.url),'utf8');
 assert(js.includes('const items=[{"href":'));
 const start=js.lastIndexOf('(()=>{const items=')+'(()=>{const items='.length;
 const items=JSON.parse(js.slice(start,js.indexOf(';function mark()',start)));
 assert(items.every(i=>!Array.isArray(i)&&typeof i.href==='string'));
 for(const href of ['https://www.dunerealms.com/','https://support.dunerealms.com/'])assert.equal(items.find(i=>i.href===href)?.updatedIn,'1.0.0.3');
});
