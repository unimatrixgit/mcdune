import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LocalD1} from './d1-adapter.mjs';
import {createIntegrationSSO} from '../node/integration-sso.mjs';
const secret='integration-test-secret-over-32-characters',token='x'.repeat(43),ref=createHash('sha256').update(token).digest('hex');
test('SSO binds fixed callbacks to a live account session and consumes codes once',async()=>{
 const db=new LocalD1(`CREATE TABLE site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);CREATE TABLE site_accounts(id TEXT,username TEXT,display_name TEXT,role TEXT);CREATE TABLE site_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE site_game_links(user_id TEXT,minecraft_uuid TEXT);CREATE TABLE cp_ranks(rank_key TEXT,label TEXT,rank_level INTEGER,kind TEXT,permissions_json TEXT,version INTEGER);CREATE TABLE integration_sso_codes(code_hash TEXT PRIMARY KEY,user_id TEXT,session_ref TEXT,client_id TEXT,expires_at INTEGER);`);
 try{
 await db.prepare('INSERT INTO site_accounts VALUES(?,?,?,?)').bind('user-1','traveller','Traveller','user').run();await db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').bind(ref,'user-1',Date.now()+100000).run();
 const sso=createIntegrationSSO(db,{INTEGRATION_SSO_SECRET:secret}),url='https://cp.dunerealms.com/sso/authorize?client=mybb&state='+'a'.repeat(32);
 assert.equal((await sso(new Request(url))).status,302);
 assert.equal((await sso(new Request(url.replace('mybb','evil')))).status,400);
 const response=await sso(new Request(url,{headers:{Cookie:'__Host-dune_session='+token}})),callback=new URL(response.headers.get('Location'));
 assert.equal(callback.origin,'https://www.dunerealms.com');assert.equal(callback.pathname,'/forums/dune-sso.php');
 const req=(path,body,key=secret)=>new Request('https://cp.dunerealms.com'+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const payload={code:callback.searchParams.get('code'),client:'mybb'};
 assert.equal((await sso(req('/internal/integrations/redeem',payload,'wrong'))).status,401);
 assert.equal((await sso(req('/internal/integrations/redeem',{...payload,client:'osticket'}))).status,401);
 const redeemed=await sso(req('/internal/integrations/redeem',payload));assert.equal(redeemed.status,200);assert.equal((await redeemed.json()).id,'user-1');
 assert.equal((await sso(req('/internal/integrations/redeem',payload))).status,401);
 assert.equal((await sso(req('/internal/integrations/identity',{sessionRef:ref}))).status,200);
 await db.prepare('DELETE FROM site_sessions').run();assert.equal((await sso(req('/internal/integrations/identity',{sessionRef:ref}))).status,401);
 }finally{db.close();}
});
