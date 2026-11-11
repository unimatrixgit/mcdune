import {FIRST_LOGIN_SCHEMA} from '../node/first-login.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalD1} from './d1-adapter.mjs';
import {createPanel} from '../control-panel/server.mjs';
const origin='https://cp.dunerealms.com';
const schema=FIRST_LOGIN_SCHEMA+';'+'CREATE TABLE IF NOT EXISTS site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);'+`CREATE TABLE site_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,password_salt TEXT,password_hash TEXT,role TEXT,created_at INTEGER);CREATE TABLE site_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);CREATE TABLE player_profiles(user_id TEXT PRIMARY KEY,display_name TEXT,minecraft_name TEXT,discord_name TEXT,created_at INTEGER,updated_at INTEGER);`+readFileSync(new URL('../node/schema.sql',import.meta.url),'utf8').split('CREATE TABLE IF NOT EXISTS site_game_links')[1].replace(/^/,'CREATE TABLE IF NOT EXISTS site_game_links').replace(/ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g,'');
const aliceUuid='12345678-1234-4234-9234-123456789012',bobUuid='22345678-1234-4234-9234-123456789012';
test('Real panel session and verified-link schema isolate inventory/sales; unlink and logout revoke reads',async()=>{
 const db=new LocalD1(schema),queries=[];
 const app=createPanel(db,{}, {inventoryPool:{async query(q){queries.push(q);return{rows:q.text.includes('dune_players')?[{inventory_view:{version:1,playerName:q.values[0]===aliceUuid?'Alice':'Bob'},session_open:false}]:[]};}},logger:{error(){}}});
 const req=(path,cookie,body)=>app(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 try{
  assert.equal((await req('/api/inventory')).status,401);
  const cookies=[];
  for(const [username,uuid]of [['alice',aliceUuid],['bobby',bobUuid]]){
   const r=await req('/api/auth/register',null,{username,password:'long test password 123',ageBand:'18plus'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];cookies.push(cookie);
   const account=await db.prepare('SELECT id FROM site_accounts WHERE username=?').bind(username).first();
   await db.prepare('INSERT INTO site_game_links(user_id,minecraft_uuid,minecraft_name,linked_at) VALUES(?,?,?,?)').bind(account.id,uuid,username,1).run();
  }
  assert.equal((await (await req('/api/inventory',cookies[0])).json()).snapshot.playerName,'Alice');
  assert.equal((await (await req('/api/inventory',cookies[1])).json()).snapshot.playerName,'Bob');
  assert.equal((await req('/api/inventory?uuid='+bobUuid,cookies[0])).status,400);
  const sales=await req('/api/exchange/sales-history',cookies[0]);assert.match(sales.headers.get('Cache-Control'),/private, no-store/);assert.deepEqual(queries.at(-1).values,[aliceUuid,null]);
  await req('/api/game-link/unlink',cookies[0],{});const count=queries.length;
  assert.equal((await (await req('/api/inventory',cookies[0])).json()).status,'unlinked');assert.equal(queries.length,count);
  await req('/api/auth/logout',cookies[1],{});assert.equal((await req('/api/inventory',cookies[1])).status,401);assert.equal((await req('/api/exchange/sales-history',cookies[1])).status,401);
 }finally{db.close();}
});
test('Inventory module assets are served with safe MIME; private runtime adapters stay inaccessible',async()=>{
 const db=new LocalD1(schema),app=createPanel(db);try{
  const r=await app(new Request(origin+'/inventory/inventory-mount.mjs'));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);
  assert.equal((await app(new Request(origin+'/inventory/inventory.css'))).status,200);
  assert.equal((await app(new Request(origin+'/inventory/inventory-api.mjs'))).status,404);
  assert.equal((await app(new Request(origin+'/inventory/market-bridge.mjs'))).status,404);
 }finally{db.close();}
});
