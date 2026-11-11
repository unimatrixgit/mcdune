import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('authored homepage retains its news, moderation and appeal modules',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 for(const id of ['news','news-grid','news-prev','news-next','moderation','latest-bans','latest-appeals','server-bans','ban-list'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 const main=html.indexOf('<main'),news=html.indexOf('id="news"'),moderation=html.indexOf('id="moderation"'),bans=html.indexOf('id="server-bans"');
 assert(main>=0&&main<news&&news<moderation&&moderation<bans&&bans<html.indexOf('</main>'));
 assert.match(html,/Latest bans/);
 assert.match(html,/Latest appeal decisions/);
 assert.match(html,/Server ban list/);
 const script=readFileSync(new URL('../web/portal-design.js',import.meta.url),'utf8');
 assert.match(script,/latest-bans/);
 assert.match(script,/latest-appeals/);
 assert.match(script,/ban-list/);
});
