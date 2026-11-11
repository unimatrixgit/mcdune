import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import path from'node:path';import{pagesForChanges,menuBadgeScript,recordPageUpdates}from'../scripts/menu-updates.mjs';
test('Release badge mapping follows deployed page scopes and ignores tests and unrelated game changes',()=>{assert.deepEqual(pagesForChanges(['website/node/staff-roster.mjs','website/node/staff-roster.mjs']),['https://www.dunerealms.com/staff.html']);assert.deepEqual(pagesForChanges(['website/tests/staff-roster.test.mjs','DuneCore/src/Main.java']),[]);assert.deepEqual(pagesForChanges(['website/node/memorials.mjs','website/control-panel/public/panel.js']),['https://cp.dunerealms.com/','https://www.dunerealms.com/']);assert(pagesForChanges(['website/integrations/azuriom/DuneShopRanks.php']).includes('https://www.dunerealms.com/shop.html'));});
test('Shared badge script reads the one central manifest and changes labels only when needed',()=>{const s=menuBadgeScript();assert(s.includes('/menu-new-items.json'));assert(s.includes("cache:'no-store'"));assert(s.includes("if(tag.textContent!==label)"));assert(s.includes('updatedIn===release'));assert(s.includes('https://www.dunerealms.com/staff.html'));new Function(s);});

test('Immutable CI artifact without .git builds release badge manifest without crashing',()=>{
 const repo=mkdtempSync(path.join(tmpdir(),'dune-gitless-build-'));
 try{
  const root=path.join(repo,'website');mkdirSync(path.join(root,'web'),{recursive:true});
  const initial={items:[{href:'https://cp.dunerealms.com/',introducedIn:'1.0.0.3',badge:'NEW'}]};
  const manifest=path.join(root,'web/menu-new-items.json');writeFileSync(manifest,JSON.stringify(initial));
  assert.deepEqual(recordPageUpdates({root,version:'1.0.0.4'}),[]);
  assert.deepEqual(JSON.parse(readFileSync(manifest,'utf8')),initial);
 }finally{rmSync(repo,{recursive:true,force:true});}
});
test('Explicit changed paths still update menu badges without Git metadata',()=>{
 const repo=mkdtempSync(path.join(tmpdir(),'dune-manifest-'));
 try{
  const root=path.join(repo,'website');mkdirSync(path.join(root,'web'),{recursive:true});
  const manifest=path.join(root,'web/menu-new-items.json');writeFileSync(manifest,JSON.stringify({items:[]}));
  assert.deepEqual(recordPageUpdates({root,version:'1.0.0.4',paths:['website/control-panel/banking.mjs']}),['https://cp.dunerealms.com/']);
  const data=JSON.parse(readFileSync(manifest,'utf8'));assert.equal(data.items[0].updatedIn,'1.0.0.4');
 }finally{rmSync(repo,{recursive:true,force:true});}
});
