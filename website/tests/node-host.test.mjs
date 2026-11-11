import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalD1} from './d1-adapter.mjs';
import {TERMS_VERSION} from '../node/first-login.mjs';
import {contactSchema} from '../node/contact-email.mjs';
import {createApplication} from '../node/server.mjs';
import {mysqlSql} from '../node/mysql.mjs';
// Include current account-rank and badge tables used by session responses.
const accountSchema=`CREATE TABLE site_first_login(user_id TEXT PRIMARY KEY,password_changed INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);CREATE TABLE site_terms_acceptances(user_id TEXT,version TEXT,accepted_at INTEGER);CREATE TABLE cp_account_ranks(user_id TEXT,rank_key TEXT,PRIMARY KEY(user_id,rank_key));CREATE TABLE website_badges(user_id TEXT,badge_key TEXT,earned_at INTEGER,PRIMARY KEY(user_id,badge_key));CREATE TABLE website_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT,updated_at INTEGER);`;
const schema=['0000_forums','0001_profiles_tickets'].map(n=>readFileSync(new URL('../drizzle/'+n+'.sql',import.meta.url),'utf8')).join('\n')+accountSchema+`
CREATE TABLE site_age_declarations(user_id TEXT PRIMARY KEY,age_band TEXT,declared_at INTEGER);CREATE TABLE site_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,password_salt TEXT,password_hash TEXT,role TEXT,created_at INTEGER);
CREATE TABLE site_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`;
const oldSchema=schema;
const origin='https://dunerealms.com';
function request(path,method='GET',body,headers={}){return new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});}
test('External hosting rejects forged identity, protects sessions and keeps private data private',async()=>{
 const db=new LocalD1(schema+';'+contactSchema+';'+`CREATE TABLE cp_ranks(rank_key TEXT PRIMARY KEY,label TEXT,rank_level INTEGER,kind TEXT,permissions_json TEXT,version INTEGER);`),app=createApplication(db);
 try{
  assert.equal((await app(request('/api/profile','GET',null,{'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'verified-staff@dunerealms.internal'}))).status,401);
  const account={username:'desert_test',password:'A long test password 123',ageBand:'15plus',role:'staff',email:'desert_test@example.com',termsAccepted:'yes',termsVersion:TERMS_VERSION};
  assert.equal((await app(request('/api/auth/register','POST',account,{Origin:'https://evil.test'}))).status,403);
  const created=await app(request('/api/auth/register','POST',account));assert.equal(created.status,200);
  const cookie=created.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  const row=await db.prepare('SELECT * FROM site_accounts').first();assert.equal(row.role,'user');assert.notEqual(row.password_hash,account.password);
  const session=await db.prepare('SELECT * FROM site_sessions').first();assert.ok(!cookie.includes(session.token_hash));
  const authenticated={Cookie:cookie.split(';')[0]};
  assert.equal((await app(request('/api/profile','GET',null,authenticated))).status,200);
  assert.equal((await app(request('/api/tickets?view=staff','GET',null,{...authenticated,'oai-authenticated-user-email':'verified-staff@dunerealms.internal'}))).status,410);
  assert.equal((await app(request('/api/auth/login','POST',{...account,password:'The wrong password here'}))).status,401);
  assert.equal((await app(request('/api/auth/login','POST',account))).status,200);
  assert.equal((await app(request('/api/auth/register','POST',account))).status,409);
  await app(request('/api/auth/logout','POST',{},authenticated));
  assert.equal((await app(request('/api/profile','GET',null,authenticated))).status,401);
  const redirect=await app(request('/signin-with-chatgpt?return_to=https://evil.test'));assert.equal(new URL(redirect.headers.get('location')).origin,origin);
 }finally{db.close();}
});
test('MySQL profile upserts retain bound values',()=>{
 assert.equal(mysqlSql('INSERT INTO player_profiles(user_id) VALUES(?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name'),'INSERT INTO player_profiles(user_id) VALUES(?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)');
});
