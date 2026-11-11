import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlPanelRedirect} from '../node/cp-redirects.mjs';
test('account, support and exchange always use CP; forum stays public',()=>{
 for(const [page,section]of [['account.html','game'],['portal.html','game'],['profile.html','game'],['login.html','game'],['tickets.html','tickets'],['exchange.html','exchange']]){
  const response=controlPanelRedirect(new Request('https://www.dunerealms.com/'+page+'?banId=case-1'));
  assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'https://cp.dunerealms.com/?banId=case-1#'+section);
 }
 assert.equal(controlPanelRedirect(new Request('https://www.dunerealms.com/forums.html')),null);
 assert.equal(controlPanelRedirect(new Request('https://www.dunerealms.com/account.html',{method:'POST'})),null);
});
