import{firstLoginState,TERMS_VERSION}from './first-login.mjs';
import{normalizeContactEmail}from './contact-email.mjs';
import {provisionGitIdentity} from './git-identity.mjs';
import {alphaGrant,seasonGrant} from './community-badges.mjs';
import {publicUser} from './permissions.mjs';
import {randomBytes,randomUUID,createHash,scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt),cookieName='__Host-dune_session';
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
export function sessionToken(request){const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);return /^[A-Za-z0-9_-]{43}$/.test(value||'')?value:null;}
export function safeReturn(value){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\r\n]/.test(value)?value:'/portal.html';}
export async function identity(request,db){
  const token=sessionToken(request);if(!token)return null;
  return db.prepare("SELECT a.id,a.username,a.display_name,a.role FROM site_sessions s JOIN site_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.password_hash NOT LIKE '!%' AND a.role<>'memorial' AND NOT EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key='memorial')").bind(digest(token),Date.now()).first();
}
export function createAuth(db,origin,settings={}){
  const attempts=new Map();
  function allowed(key,max=10,window=900000){const now=Date.now();if(attempts.size>5000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);if(attempts.size>5000)return false;let row=attempts.get(key);if(!row||row.until<now){row={count:0,until:now+window};attempts.set(key,row);}return ++row.count<=max;}
  async function view(user){const result=await publicUser(db,user),firstLogin=await firstLoginState(db,user);return {...result,...(firstLogin?{permissions:[],ranks:[],rank:'user',staff:false,rankLevel:0}:{}),firstLogin};}
  async function issue(user){const token=randomBytes(32).toString('base64url');await db.prepare('INSERT INTO site_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(digest(token),user.id,Date.now()+604800000).run();return json({ok:true,user:await view(user)},200,{'Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`});}
  return async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/api/auth/session'&&request.method==='GET'){const user=await identity(request,db);return json({authenticated:!!user,user:user?await view(user):null});}
    if(request.method!=='POST')return json({message:'Method not allowed.'},405);
    if(request.headers.get('Origin')!==origin)return json({message:'Request origin rejected.'},403);
    if(path==='/api/auth/terms'){
      const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
      let b;try{b=await request.json();}catch{return json({message:'Invalid request.'},400);}
      if(b.accepted!==true||b.version!==TERMS_VERSION)return json({message:'Read and accept the current Terms of Service.'},400);
      await db.prepare('INSERT INTO site_terms_acceptances(user_id,version,accepted_at) VALUES(?,?,?) ON CONFLICT(user_id,version) DO UPDATE SET version=excluded.version').bind(user.id,TERMS_VERSION,Date.now()).run();return json({ok:true});
    }
    if(path==='/api/auth/password'){
      const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
      if(!allowed('password:'+user.id,5))return json({message:'Too many attempts. Please try later.'},429);
      let data;try{data=await request.json();}catch{return json({message:'Invalid request.'},400);}
      if(typeof data.currentPassword!=='string'||data.currentPassword.length>256||typeof data.newPassword!=='string'||data.newPassword.length<12||data.newPassword.length>256)return json({message:'Use a new password of 12–256 characters.'},400);
      if(data.newPassword===data.currentPassword)return json({message:'Choose a different new password.'},400);
      const row=await db.prepare('SELECT * FROM site_accounts WHERE id=?').bind(user.id).first();
      const actual=await scrypt(data.currentPassword,row.password_salt,64);
      if(!timingSafeEqual(actual,Buffer.from(row.password_hash,'hex')))return json({message:'Incorrect current password.'},403);
      const salt=randomBytes(16).toString('hex'),hash=(await scrypt(data.newPassword,salt,64)).toString('hex');
      const result=await db.batch([db.prepare('UPDATE site_accounts SET password_salt=?,password_hash=? WHERE id=? AND password_hash=?').bind(salt,hash,user.id,row.password_hash),db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(user.id),db.prepare('UPDATE site_first_login SET password_changed=1 WHERE user_id=?').bind(user.id)]);
      if(!result[0].meta.changes)return json({message:'Account changed. Sign in again.'},409);
      return issue(row);
    }
    if(path==='/api/auth/logout'){const token=sessionToken(request);if(token)await db.prepare('DELETE FROM site_sessions WHERE token_hash=?').bind(digest(token)).run();return json({ok:true},200,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});}
    if(!['/api/auth/login','/api/auth/register'].includes(path))return json({message:'Not found.'},404);
    let data;try{data=await request.json();}catch{return json({message:'Send valid JSON.'},400);}
    const username=typeof data?.username==='string'?data.username.trim().toLowerCase():'';
    const password=data?.password;
    if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<12||password.length>256)return json({message:'Use a username of 3–32 letters, numbers or underscores and a password of 12–256 characters.'},400);
    if(!allowed(username)||!allowed('global',120,60000))return json({message:'Too many attempts. Please try again later.'},429);
    if(path==='/api/auth/register'){
      let email;try{email=normalizeContactEmail(data.email);}catch(e){return json({message:e.message},400);}
      if(email==='no_reply@dunerealms.com')return json({message:'Enter your own email address.'},400);
      if(data.termsAccepted!=='yes'||data.termsVersion!==TERMS_VERSION)return json({message:'You must agree to the Terms of Service.'},400);
      if(!['15plus','under15'].includes(data.ageBand))return json({message:'Choose whether you are 15 or older, or under 15.'},400);
      if(!allowed('registrations',60,3600000))return json({message:'Registration is temporarily limited. Please try later.'},429);
      const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex'),id=randomUUID(),now=Date.now();
      try{await db.batch([
        db.prepare('INSERT INTO site_accounts(id,username,display_name,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,username,username,salt,hash,'user',now),
        db.prepare('INSERT INTO player_profiles(user_id,display_name,minecraft_name,discord_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,username,'','',now,now),
        db.prepare('INSERT INTO site_age_declarations(user_id,age_band,declared_at) VALUES(?,?,?)').bind(id,data.ageBand,now),db.prepare('INSERT INTO site_contact_emails(user_id,address,version) VALUES(?,?,0)').bind(id,email),db.prepare('INSERT INTO site_terms_acceptances(user_id,version,accepted_at) VALUES(?,?,?)').bind(id,TERMS_VERSION,now),alphaGrant(db,id,now),seasonGrant(db,id,now)
      ]);}catch(error){if(error.code==='ER_DUP_ENTRY'||String(error.message).includes('UNIQUE constraint'))return json({message:'That username is unavailable.'},409);throw error;}
      await provisionGitIdentity(db,{id,username,display_name:username,role:'user'},settings).catch(()=>console.error('DuneGit registration setup pending'));
      return issue({id,username,role:'user'});
    }
    const user=await db.prepare('SELECT * FROM site_accounts WHERE username=?').bind(username).first();
    const actual=await scrypt(password,user?.password_salt||'00000000000000000000000000000000',64);
    if(user?.password_hash==='!banned'){const archived=await db.prepare('SELECT password_hash FROM site_account_archive WHERE user_id=?').bind(user.id).first();if(/^[a-f0-9]{128}$/i.test(archived?.password_hash||'')&&timingSafeEqual(actual,Buffer.from(archived.password_hash,'hex')))return json({code:'ACCOUNT_PERMANENTLY_BANNED',message:'Your passage through DuneRealms has been revoked. This account is permanently banned and can no longer access DuneRealms services.'},403);}
    if(!user||user.role==='memorial'||(user&&(await db.prepare("SELECT 1 FROM cp_account_ranks WHERE user_id=? AND rank_key='memorial'").bind(user.id).first()))||user.password_hash.startsWith('!')||!/^[a-f0-9]{128}$/i.test(user.password_hash)||!timingSafeEqual(actual,Buffer.from(user.password_hash,'hex')))return json({message:'Incorrect username or password.'},401);
    return issue(user);
  };
}
