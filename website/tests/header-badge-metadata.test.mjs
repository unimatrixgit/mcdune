import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('release badge metadata does not contaminate navigation tuples',()=>{
 const js=readFileSync(new URL('../web/portal-navigation.js',import.meta.url),'utf8');
 assert.match(js,/\blet items=\[/);
 const start=js.lastIndexOf('(()=>{let items=')+'(()=>{let items='.length;
 const items=JSON.parse(js.slice(start,js.indexOf(';function mark()',start)));
 assert(items.every(i=>!Array.isArray(i)&&typeof i.href==='string'));
 assert.equal(items.find(i=>i.href==='https://www.dunerealms.com/')?.introducedIn,'1.0.0.3');
 assert.equal(items.find(i=>i.href==='https://support.dunerealms.com/')?.updatedIn,'1.0.0.3');
});
