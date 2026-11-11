import test from 'node:test';
import assert from 'node:assert/strict';
import {createLuckPerms,validEditorUrl} from '../control-panel/luckperms.mjs';
const origin='https://cp.dunerealms.com',owner={id:'1',username:'owner',role:'owners'};
function rig(user=owner,result={groups:[{name:'default',nodes:'1'},{name:'dr_access_owners',nodes:30}],checkedAt:10}){
 const calls=[],audit=[];
 const db={prepare(sql){return{bind(...args){return{async first(){if(sql.includes('FROM cp_ranks'))return null;return user;},async run(){audit.push(args);}};}};}};
 const handler=createLuckPerms(db,{SERVER_CONTROL_TOKEN:'s'.repeat(64)},{fetcher:async(url,options)=>{calls.push({url,options});return Response.json(result);}});
 const request=(path='groups',body,requestOrigin=origin)=>handler(new Request(origin+'/api/luckperms/'+path,{headers:{Cookie:'__Host-dune_session='+'a'.repeat(43),Origin:requestOrigin,'Content-Type':'application/json'},method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{})}));
 return{calls,audit,request,db};
}
test('LuckPerms live groups require a session and the page permission',async()=>{
 for(const [user,status] of [[null,401],[{...owner,role:'user'},403],[{...owner,role:'staff'},403]]){const r=rig(user);assert.equal((await r.request()).status,status);assert.equal(r.calls.length,0);}
 const r=rig();const response=await r.request();assert.equal(response.status,200);assert.deepEqual((await response.json()).groups,[{name:'default',nodes:1},{name:'dr_access_owners',nodes:30}]);assert.equal(r.calls[0].url,'http://127.0.0.1:15433/luckperms/groups');assert.equal(response.headers.get('cache-control'),'no-store');
});
test('full editor is owner-only even when a custom rank has every editor node',async()=>{
 const r=rig({...owner,role:'custom'});r.db.prepare=sql=>({bind(){return{async first(){return sql.includes('FROM cp_ranks')?{rank_key:'custom',label:'Custom',rank_level:80,kind:'access',permissions_json:JSON.stringify(['web.menu.luckperms','web.luckperms.edit','web.luckperms.view']),version:1}:{...owner,role:'custom'};}};}});
 assert.equal((await r.request('editor',{})).status,403);assert.equal(r.calls.length,0);
});
test('editor creation enforces Origin and returns only an official session URL',async()=>{
 const r=rig(owner,{url:'https://luckperms.net/editor/private-session'});
 assert.equal((await r.request('editor',{},'https://attacker.test')).status,403);
 const response=await r.request('editor',{actor:'spoof'});assert.equal(response.status,200);assert.equal(JSON.parse(r.calls[0].options.body).actor,'owner');assert.equal(r.audit.length,1);assert.ok(!JSON.stringify(r.audit).includes('private-session'));
 for(const url of ['https://attacker.test/editor/token','https://luckperms.net.attacker.test/editor/token','https://luckperms.net/editor/token?redirect=x','javascript:alert(1)']){assert.equal(validEditorUrl(url),false);assert.equal((await rig(owner,{url}).request('editor',{})).status,502);}
});
test('only exact editor apply/trust commands reach the private game agent',async()=>{
 const r=rig(owner,{message:'Response from LuckPerms'});
 for(const command of ['op intruder','lp applyedits abc\nstop','lp editor groups','lp applyedits abc;op hacker','lp trusteditor a b'])assert.equal((await r.request('apply',{command})).status,400);
 for(const command of ['/lp applyedits abcDEF123','lp trusteditor xyz123'])assert.equal((await r.request('apply',{command})).status,200);
 assert.equal(r.calls.length,2);assert.equal(JSON.parse(r.calls[0].options.body).command,'lp applyedits abcDEF123');assert.ok(!JSON.stringify(r.audit).includes('abcDEF123'));
});
test('LuckPerms rejects malformed groups and unsupported routes',async()=>{
 for(const group of [{name:'<script>',nodes:1},{name:'default',nodes:-1},{name:'default',nodes:'NaN'}])assert.equal((await rig(owner,{groups:[group]}).request()).status,502);
 const r=rig();assert.equal((await r.request('groups?server=elsewhere')).status,400);assert.equal((await r.request('groups',{})).status,400);
});
