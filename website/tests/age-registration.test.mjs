import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalD1} from './d1-adapter.mjs';
import {createAuth} from '../node/auth.mjs';
test('registration requires an explicit age band and cannot grant privileges',async()=>{
 const db=new LocalD1(`CREATE TABLE site_accounts(id TEXT,username TEXT,display_name TEXT,password_salt TEXT,password_hash TEXT,role TEXT,created_at INTEGER);CREATE TABLE player_profiles(user_id TEXT,display_name TEXT,minecraft_name TEXT,discord_name TEXT,created_at INTEGER,updated_at INTEGER);CREATE TABLE site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);CREATE TABLE site_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE cp_ranks(rank_key TEXT,label TEXT,rank_level INTEGER,kind TEXT,permissions_json TEXT,version INTEGER);`);
 try{
 const auth=createAuth(db,'https://cp.dunerealms.com');
 const register=ageBand=>auth(new Request('https://cp.dunerealms.com/api/auth/register',{method:'POST',headers:{Origin:'https://cp.dunerealms.com','Content-Type':'application/json'},body:JSON.stringify({username:'youngtraveller',password:'Long test password 123',ageBand,role:'owners'})}));
 assert.equal((await register()).status,400);assert.equal((await register('adult')).status,400);
 assert.equal((await register('under15')).status,200);
 assert.equal((await db.prepare('SELECT age_band FROM site_age_declarations').first()).age_band,'under15');
 assert.equal((await db.prepare('SELECT role FROM site_accounts').first()).role,'user');
 }finally{db.close();}
});
