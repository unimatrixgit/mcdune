import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalD1} from './d1-adapter.mjs';
import {createAuth} from '../node/auth.mjs';
import {TERMS_VERSION} from '../node/first-login.mjs';
import {contactSchema} from '../node/contact-email.mjs';
test('registration requires an explicit age band and cannot grant privileges',async()=>{
 // Registration grants badges and resolves effective ranks in the current schema.
 const db=new LocalD1(`CREATE TABLE cp_account_ranks(user_id TEXT,rank_key TEXT,PRIMARY KEY(user_id,rank_key));CREATE TABLE website_badges(user_id TEXT,badge_key TEXT,earned_at INTEGER,PRIMARY KEY(user_id,badge_key));CREATE TABLE website_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT,updated_at INTEGER);CREATE TABLE site_accounts(id TEXT,username TEXT,display_name TEXT,password_salt TEXT,password_hash TEXT,role TEXT,created_at INTEGER);CREATE TABLE player_profiles(user_id TEXT,display_name TEXT,minecraft_name TEXT,discord_name TEXT,created_at INTEGER,updated_at INTEGER);CREATE TABLE site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);CREATE TABLE site_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE cp_ranks(rank_key TEXT,label TEXT,rank_level INTEGER,kind TEXT,permissions_json TEXT,version INTEGER);CREATE TABLE site_terms_acceptances(user_id TEXT,version TEXT,accepted_at INTEGER);CREATE TABLE site_first_login(user_id TEXT PRIMARY KEY,password_changed INTEGER,created_at INTEGER);`+';'+contactSchema);
 try{
 const auth=createAuth(db,'https://cp.dunerealms.com');
 const register=ageBand=>auth(new Request('https://cp.dunerealms.com/api/auth/register',{method:'POST',headers:{Origin:'https://cp.dunerealms.com','Content-Type':'application/json'},body:JSON.stringify({username:'youngtraveller',password:'Long test password 123',ageBand,role:'owners',email:'youngtraveller@example.com',termsAccepted:'yes',termsVersion:TERMS_VERSION})}));
 assert.equal((await register()).status,400);assert.equal((await register('adult')).status,400);
 assert.equal((await register('under15')).status,200);
 assert.equal((await db.prepare('SELECT age_band FROM site_age_declarations').first()).age_band,'under15');
 assert.equal((await db.prepare('SELECT role FROM site_accounts').first()).role,'user');
 }finally{db.close();}
});
