import {FIRST_LOGIN_SCHEMA} from '../node/first-login.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalD1} from './d1-adapter.mjs';
import {createPanel} from '../control-panel/server.mjs';
const origin='https://cp.dunerealms.com',secret='test-bridge-secret-with-more-than-32-characters';
const schema=FIRST_LOGIN_SCHEMA+';'+'CREATE TABLE IF NOT EXISTS site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);'+`CREATE TABLE site_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,password_salt TEXT,password_hash TEXT,role TEXT,created_at INTEGER);
CREATE TABLE site_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
CREATE TABLE player_profiles(user_id TEXT PRIMARY KEY,display_name TEXT,minecraft_name TEXT,discord_name TEXT,created_at INTEGER,updated_at INTEGER);`+readFileSync(new URL('../node/schema.sql',import.meta.url),'utf8').split('CREATE TABLE IF NOT EXISTS site_game_links')[1].replace(/^/,'CREATE TABLE IF NOT EXISTS site_game_links').replace(/ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g,'');
function setup(){const db=new LocalD1(schema),app=createPanel(db,{GAME_LINK_SECRET:secret});const req=async(path,body,headers={})=>app(new Request(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));return {db,req};}
async function register(req,name){const response=await req('auth/register',{username:name,password:'long testing password 123',ageBand:'18plus'});assert.equal(response.status,200);return {Cookie:response.headers.get('set-cookie').split(';')[0]};}
const uuid='12345678-1234-4234-9234-123456789012',otherUuid='22345678-1234-4234-9234-123456789012';
test('Panel serves shared theme assets without exposing private source paths',async()=>{
 const db=new LocalD1(schema),app=createPanel(db,{GAME_LINK_SECRET:secret});try{
  const response=await app(new Request(origin+'/assets/ornament.webp'));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
  assert.equal((await app(new Request(origin+'/assets/.env'))).status,404);
  assert.equal((await app(new Request(origin+'/node/schema.sql'))).status,404);
 }finally{db.close();}
});
test('Panel verifies UUID ownership, consumes private links once and preserves eligibility on relink',async()=>{
 const {db,req}=setup();try{
 const alice=await register(req,'alice'),bob=await register(req,'bobby');
 assert.equal((await req('game-link',{}, {...alice,Origin:'https://evil.test'})).status,403);
 const challenge=await (await req('game-link',{},alice)).json();assert.match(challenge.code,/^[a-f0-9]{32}$/);
 assert.equal((await req('game-link/consume',{uuid,name:'Alice',code:challenge.code})).status,401);
 const bridge={Authorization:'Bearer '+secret};
 assert.equal((await req('game-link/consume',{uuid,name:'Alice',code:challenge.code},bridge)).status,200);
 assert.equal((await req('game-link/consume',{uuid:otherUuid,name:'Bob',code:challenge.code},bridge)).status,409);
 const original=await db.prepare('SELECT * FROM site_game_identities WHERE minecraft_uuid=?').bind(uuid).first();
 await req('game-link/unlink',{},alice);
 const second=await (await req('game-link',{},bob)).json();
 assert.equal((await req('game-link/consume',{uuid,name:'Renamed',code:second.code},bridge)).status,200);
 const retained=await db.prepare('SELECT * FROM site_game_identities WHERE minecraft_uuid=?').bind(uuid).first();
 assert.equal(retained.first_linked_at,original.first_linked_at);assert.equal(retained.last_name,'Renamed');
 assert.equal((await (await req('game-link',undefined,alice)).json()).linked,false);
 }finally{db.close();}
});
test('Personal rewards start after UUID link, are private, and move to history only after delivery',async()=>{
 const {db,req}=setup();try{
 const alice=await register(req,'alice'),bob=await register(req,'bobby');const account=await db.prepare('SELECT id FROM site_accounts WHERE username=?').bind('alice').first();
 await db.prepare('INSERT INTO site_game_links(user_id,minecraft_uuid,minecraft_name,linked_at) VALUES(?,?,?,?)').bind(account.id,uuid,'Alice',200).run();
 await db.prepare('INSERT INTO site_game_identities VALUES(?,?,?)').bind(uuid,200,'Alice').run();
 for(const [month,reached]of [['2026-09',100],['2026-10',300]])await db.prepare('INSERT INTO community_campaigns VALUES(?,?,?,?,?,?,?)').bind(month,100,100,50,'PUBLIC-'+month,reached,1).run();
 const earned=await (await req('community/rewards',undefined,alice)).json();assert.deepEqual(earned.available.map(r=>r.month),['2026-10']);
 assert.equal((await (await req('community/rewards',undefined,bob)).json()).available.length,0);
 const bridge={Authorization:'Bearer '+secret},personal=earned.available[0].personal_code;
 assert.equal((await req('community/game/prepare',{uuid:otherUuid,code:personal},bridge)).status,404);
 const prepared=await (await req('community/game/prepare',{uuid,code:personal},bridge)).json();assert.equal(prepared.amount,50);
 const again=await (await req('community/game/prepare',{uuid,code:'PUBLIC-2026-10'},bridge)).json();assert.equal(again.receipt,prepared.receipt);
 assert.equal((await (await req('community/rewards',undefined,alice)).json()).available.length,1);
 assert.equal((await req('community/game/ack',{uuid:otherUuid,receipt:prepared.receipt},bridge)).status,404);
 assert.equal((await req('community/game/ack',{uuid,receipt:prepared.receipt},bridge)).status,200);
 assert.equal((await req('community/game/ack',{uuid,receipt:prepared.receipt},bridge)).status,200);
 const used=await (await req('community/rewards',undefined,alice)).json();assert.equal(used.available.length,0);assert.equal(used.history.length,1);assert.equal(used.history[0].personal_code,undefined);
 assert.equal((await req('community/game/prepare',{uuid:otherUuid,code:'PUBLIC-2026-09'},bridge)).status,200);
 }finally{db.close();}
});
test('Password changes require current password and revoke other sessions; staff actions reject player injection',async()=>{
 const {db,req}=setup();try{
 const alice=await register(req,'alice');const second=await req('auth/login',{username:'alice',password:'long testing password 123',ageBand:'18plus'});const oldCookie={Cookie:second.headers.get('set-cookie').split(';')[0]};
 assert.equal((await req('community/campaigns',{month:'2026-12',targetCents:100,rewardAmount:50,role:'staff'},alice)).status,403);
 assert.equal((await req('auth/password',{currentPassword:'wrong',newPassword:'new long password 123'},alice)).status,403);
 const change=await req('auth/password',{currentPassword:'long testing password 123',newPassword:'new long password 123'},alice);assert.equal(change.status,200);
 assert.equal((await (await req('auth/session',undefined,oldCookie)).json()).authenticated,false);
 assert.equal((await req('auth/login',{username:'alice',password:'new long password 123',ageBand:'18plus'})).status,200);
 }finally{db.close();}
});
test('Staff goals are fixed, audited, month-bound and unreached codes remain private',async()=>{
 const {db,req}=setup();try{
 const staff=await register(req,'operator');await db.prepare("UPDATE site_accounts SET role='staff' WHERE username='operator'").run();
 const month=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'}).slice(0,7);
 assert.equal((await req('community/campaigns',{month,targetCents:500,rewardAmount:100},staff)).status,201);
 assert.equal((await req('community/campaigns',{month,targetCents:100,rewardAmount:999},staff)).status,409);
 assert.equal((await (await req('community/campaigns')).json()).campaigns[0].public_code,null);
 assert.equal((await req('community/verify-total',{month,receivedCents:500,reference:'test verified record'},staff)).status,200);
 const active=(await (await req('community/campaigns')).json()).campaigns[0];assert.ok(active.reached_at);assert.ok(active.public_code);
 assert.equal((await req('community/verify-total',{month,receivedCents:400,reference:'lower total attempt'},staff)).status,409);
 const audit=await db.prepare('SELECT COUNT(*) AS n FROM account_audit').first();assert.ok(audit.n>=2);
 }finally{db.close();}
});
