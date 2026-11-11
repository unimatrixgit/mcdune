import {readFile} from 'node:fs/promises';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {identity} from './auth.mjs';
import {accessFor} from './permissions.mjs';

const forgePath='/home/dunerealms/apps/forgejo/data/forgejo.db';
const tokenPath='/home/dunerealms/.config/dunegit-admin-token';
const publicRoot='https://www.dunerealms.com/git/';
const inflight=new Map();
const hash=value=>createHash('sha256').update(value).digest('hex');
const cookie=(headers,name)=>(headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const safeGitReturn=value=>typeof value==='string'&&value.startsWith('/git/')&&!/[\\\r\n]/.test(value)&&!value.includes('://')?value:'/git/';
export const gitProfileUrl=login=>publicRoot+encodeURIComponent(login);
export async function initializeGitIdentities(db){
 await db.query(`CREATE TABLE IF NOT EXISTS site_git_identities (
 user_id CHAR(36) PRIMARY KEY, forgejo_id BIGINT NOT NULL UNIQUE,
 forgejo_login VARCHAR(255) NOT NULL UNIQUE, profile_url VARCHAR(512) NOT NULL,
 link_method VARCHAR(32) NOT NULL, verified_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL, owned_repo_count INT NOT NULL DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES site_accounts(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await db.query('CREATE TABLE IF NOT EXISTS site_git_sso_requests (state_hash CHAR(64) PRIMARY KEY,return_path VARCHAR(512) NOT NULL,expires_at BIGINT NOT NULL) ENGINE=InnoDB');
 await db.query('CREATE TABLE IF NOT EXISTS site_git_sessions (token_hash CHAR(64) PRIMARY KEY,user_id CHAR(36) NOT NULL,parent_session_ref CHAR(64) NOT NULL,expires_at BIGINT NOT NULL,INDEX git_session_expiry(expires_at)) ENGINE=InnoDB');
}
async function gitSessionIdentity(request,db){
 const direct=await identity(request,db);if(direct)return direct;
 const token=cookie(request.headers,'__Host-dune_git_session');if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 return db.prepare('SELECT a.id,a.username,a.display_name,a.role FROM site_git_sessions g JOIN site_sessions s ON s.token_hash=g.parent_session_ref JOIN site_accounts a ON a.id=g.user_id WHERE g.token_hash=? AND g.expires_at>? AND s.expires_at>? AND s.user_id=g.user_id').bind(hash(token),Date.now(),Date.now()).first();
}
async function gitSSO(request,db,settings){
 const url=new URL(request.url),cp=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com');
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'self' https://cp.dunerealms.com"};
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 if(url.pathname==='/git/sso/start'){
  const state=randomBytes(32).toString('base64url'),returnTo=safeGitReturn(url.searchParams.get('return_to'));
  await db.prepare('DELETE FROM site_git_sso_requests WHERE expires_at<?').bind(Date.now()).run();
  await db.prepare('INSERT INTO site_git_sso_requests(state_hash,return_path,expires_at) VALUES(?,?,?)').bind(hash(state),returnTo,Date.now()+120000).run();
  const target=new URL('/sso/authorize',cp);target.searchParams.set('client','git');target.searchParams.set('state',state);
  return new Response(null,{status:302,headers:{...headers,Location:target.href,'Set-Cookie':`__Host-dune_git_state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=120`}});
 }
 if(url.pathname!=='/git/sso/callback')return new Response('Not found',{status:404,headers});
 const state=url.searchParams.get('state')||'',stored=cookie(request.headers,'__Host-dune_git_state'),code=url.searchParams.get('code')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(state)||state.length!==stored.length||!timingSafeEqual(Buffer.from(state),Buffer.from(stored))||!/^[A-Za-z0-9_-]{43}$/.test(code))return new Response('Invalid DuneGit sign-in state',{status:403,headers});
 const pending=await db.prepare('SELECT return_path FROM site_git_sso_requests WHERE state_hash=? AND expires_at>?').bind(hash(state),Date.now()).first();
 if(!pending)return new Response('Expired DuneGit sign-in',{status:403,headers});
 const record=await db.prepare("SELECT user_id,session_ref FROM integration_sso_codes WHERE code_hash=? AND client_id='git' AND expires_at>?").bind(hash(code),Date.now()).first();
 if(!record)return new Response('Expired DuneGit code',{status:403,headers});
 const session=await db.prepare('SELECT expires_at FROM site_sessions WHERE token_hash=? AND user_id=? AND expires_at>?').bind(record.session_ref,record.user_id,Date.now()).first();
 if(!session)return new Response('Central session expired',{status:401,headers});
 const removed=await db.prepare("DELETE FROM integration_sso_codes WHERE code_hash=? AND client_id='git' AND expires_at>?").bind(hash(code),Date.now()).run();
 if(!removed.meta.changes)return new Response('DuneGit code already used',{status:403,headers});
 await db.prepare('DELETE FROM site_git_sso_requests WHERE state_hash=?').bind(hash(state)).run();
 const token=randomBytes(32).toString('base64url'),expiry=Math.min(Number(session.expires_at),Date.now()+604800000);
 await db.prepare('INSERT INTO site_git_sessions(token_hash,user_id,parent_session_ref,expires_at) VALUES(?,?,?,?)').bind(hash(token),record.user_id,record.session_ref,expiry).run();
 return new Response(null,{status:302,headers:{...headers,Location:safeGitReturn(pending.return_path),'Set-Cookie':`__Host-dune_git_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((expiry-Date.now())/1000)}`}});
}
export async function nativeGitIdentity(id,path=forgePath){
 const {DatabaseSync}=await import('node:sqlite');
 const native=new DatabaseSync(path,{readOnly:true});
 try{
  const user=native.prepare('SELECT id,name,is_active,is_admin,prohibit_login,type FROM user WHERE id=?').get(Number(id));
  if(!user||!user.is_active||user.prohibit_login||user.type!==0)return null;
  const repos=native.prepare('SELECT name,description,is_private FROM repository WHERE owner_id=? ORDER BY name').all(Number(id));
  return {id:Number(user.id),login:user.name,isAdmin:!!user.is_admin,profileUrl:gitProfileUrl(user.name),ownedRepoCount:repos.length,repositoryOwner:repos.length>0,repos:repos.map(r=>({name:r.name,fullName:user.name+'/'+r.name,htmlUrl:gitProfileUrl(user.name)+'/'+encodeURIComponent(r.name),private:!!r.is_private,description:r.description||''}))};
 }finally{native.close();}
}
async function api(settings,path,method='GET',body){
 const root=new URL(settings.FORGEJO_URL||'http://127.0.0.1:3001');
 if(root.protocol!=='http:'||!['127.0.0.1','localhost'].includes(root.hostname))throw Error('Forgejo administration must stay on loopback');
 const token=(await readFile(settings.FORGEJO_ADMIN_TOKEN_FILE||tokenPath,'utf8')).trim();
 const response=await fetch(new URL('/api/v1'+path,root),{method,headers:{Authorization:'token '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok){const e=Error('Forgejo API '+response.status);e.status=response.status;throw e;}
 return response.status===204?null:response.json();
}
async function updateOwnership(db,userId,details){
 await db.prepare('UPDATE site_git_identities SET forgejo_login=?,profile_url=?,owned_repo_count=?,updated_at=? WHERE user_id=?').bind(details.login,details.profileUrl,details.ownedRepoCount,Date.now(),userId).run();
 if(details.repositoryOwner)await db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) VALUES(?,'dunegit-owner',?) ON CONFLICT(user_id,badge_key) DO UPDATE SET user_id=excluded.user_id").bind(userId,Date.now()).run();
 else await db.prepare("DELETE FROM website_badges WHERE user_id=? AND badge_key='dunegit-owner'").bind(userId).run();
}
export async function getGitIdentity(db,userId,settings={}){
 const mapping=await db.prepare('SELECT * FROM site_git_identities WHERE user_id=?').bind(userId).first();
 if(!mapping?.verified_at)return null;
 const details=await nativeGitIdentity(mapping.forgejo_id,settings.FORGEJO_DB_PATH||forgePath);
 if(!details){await db.prepare("DELETE FROM website_badges WHERE user_id=? AND badge_key='dunegit-owner'").bind(userId).run();await db.prepare('UPDATE site_git_identities SET owned_repo_count=0,verified_at=0,updated_at=? WHERE user_id=?').bind(Date.now(),userId).run();return null;}
 await updateOwnership(db,userId,details);
 const {login,profileUrl,ownedRepoCount,repositoryOwner}=details;
 return {login,profileUrl,ownedRepoCount,repositoryOwner};
}
export async function syncGitPermissions(db,account,settings={}){
 const mapping=await db.prepare('SELECT * FROM site_git_identities WHERE user_id=?').bind(account.id).first();
 if(!mapping?.verified_at)return;
 const details=await nativeGitIdentity(mapping.forgejo_id,settings.FORGEJO_DB_PATH||forgePath);
 if(!details)return;
 const access=await accessFor(db,account),admin=access.nodes.includes('web.git.admin');
 if(details.isAdmin!==admin)await api(settings,'/admin/users/'+encodeURIComponent(details.login),'PATCH',{admin});
}
export async function setGitArchived(db,userId,archived,settings={}){
 const mapping=await db.prepare('SELECT * FROM site_git_identities WHERE user_id=?').bind(userId).first();
 if(!mapping)return;
 await api(settings,'/admin/users/'+encodeURIComponent(mapping.forgejo_login),'PATCH',{prohibit_login:archived,active:!archived,...(archived?{admin:false}:{})});
 await db.prepare('UPDATE site_git_identities SET verified_at=?,updated_at=? WHERE user_id=?').bind(archived?0:Date.now(),Date.now(),userId).run();
}
export async function provisionGitIdentity(db,account,settings={}){
 if(inflight.has(account.id))return inflight.get(account.id);
 const work=(async()=>{
  await initializeGitIdentities(db);
  let existing=await db.prepare('SELECT * FROM site_git_identities WHERE user_id=?').bind(account.id).first();
  if(existing&&!existing.verified_at)throw Error('Linked DuneGit identity disabled; no replacement created');
  if(!existing){
   // A collision never proves identity. Use a new UUID-derived login instead.
   let login=account.username;
   try{await api(settings,'/users/'+encodeURIComponent(login));login='dune_'+account.id.replaceAll('-','');}catch(e){if(e.status!==404)throw e;}
   const created=await api(settings,'/admin/users','POST',{username:login,email:account.id+'@users.dunerealms.invalid',full_name:account.display_name||account.username,password:randomBytes(48).toString('base64url'),must_change_password:false,send_notify:false,restricted:false,visibility:'public'});
   if(!Number.isSafeInteger(created.id)||created.id<1)throw Error('Invalid Forgejo account identity');
   const now=Date.now();
   await db.prepare('INSERT INTO site_git_identities(user_id,forgejo_id,forgejo_login,profile_url,link_method,verified_at,updated_at,owned_repo_count) VALUES(?,?,?,?,?,?,?,0)').bind(account.id,created.id,created.login,gitProfileUrl(created.login),'provisioned',now,now).run();
  }
  await syncGitPermissions(db,account,settings);
  return getGitIdentity(db,account.id,settings);
 })();inflight.set(account.id,work);try{return await work;}finally{inflight.delete(account.id);}
}
export function createGitIdentityRoute(db,settings={},origin='https://www.dunerealms.com'){
 return async request=>{
  if(new URL(request.url).pathname.startsWith('/git/sso/'))return gitSSO(request,db,settings);
  if(new URL(request.url).pathname!=='/api/git/me')return null;
  const headers={'Cache-Control':'no-store'};
  const cp=new URL(settings.CP_PUBLIC_ORIGIN||'https://cp.dunerealms.com').origin;
  if(request.headers.get('Origin')===cp){headers['Access-Control-Allow-Origin']=cp;headers['Access-Control-Allow-Credentials']='true';headers.Vary='Origin';}
  if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers});
  const account=await identity(request,db);
  if(!account)return Response.json({error:'sign_in_required'},{status:401,headers});
  try{
   const linked=await provisionGitIdentity(db,account,settings);
   if(!linked)return Response.json({linked:false},{headers});
   const mapping=await db.prepare('SELECT forgejo_id FROM site_git_identities WHERE user_id=?').bind(account.id).first();
   const details=await nativeGitIdentity(mapping.forgejo_id,settings.FORGEJO_DB_PATH||forgePath);
   const access=await accessFor(db,account),canAdmin=access.nodes.includes('web.git.admin');
   const entry=publicRoot+'sso/start';
   return Response.json({linked:true,...linked,repos:details.repos,dashboardUrl:entry,createUrl:entry+'?return_to='+encodeURIComponent('/git/repo/create'),embedUrl:entry,adminUrl:canAdmin?entry+'?return_to='+encodeURIComponent('/git/admin'):null,canAdmin},{headers});
  }catch{return Response.json({linked:false,error:'git_temporarily_unavailable'},{status:503,headers});}
 };
}
export function startGitIdentitySync(db,settings={}){
 let busy=false;
 const sync=async()=>{if(busy)return;busy=true;try{await initializeGitIdentities(db);const {results}=await db.prepare("SELECT id,username,display_name,role FROM site_accounts WHERE password_hash NOT LIKE '!%' AND role<>'memorial'").all();for(const account of results){try{await provisionGitIdentity(db,account,settings);}catch{console.error('DuneGit account reconciliation pending for central account',account.id);}}}catch{console.error('DuneGit reconciliation temporarily unavailable');}finally{busy=false;}};
 void sync();const timer=setInterval(sync,300000);timer.unref();return ()=>clearInterval(timer);
}
export function gitProxyIdentity(db,settings={}){
 return async req=>{
  const headers=new Headers();if(req.headers.cookie)headers.set('cookie',req.headers.cookie);
  const account=await gitSessionIdentity(new Request('https://www.dunerealms.com/git/',{headers}),db);
  if(!account)return null;
  const linked=await provisionGitIdentity(db,account,settings);
  return linked?.login||null;
 };
}
