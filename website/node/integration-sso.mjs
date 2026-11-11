import {communityBadgeVisible} from './community-badges.mjs';
import {publicProfileFor} from './profile.mjs';
import {badgesFor} from './community-badges.mjs';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {identity,sessionToken} from './auth.mjs';
import {accessFor} from './permissions.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createIntegrationSSO(db,settings={}){
 const clients={git:'https://www.dunerealms.com/git/sso/callback',mybb:'https://forums.dunerealms.com/dune-sso.php',osticket:'https://support.dunerealms.com/dune-sso.php',shop:'https://cp.dunerealms.com/store/dune-login'};
 return async request=>{
  const url=new URL(request.url),client=url.searchParams.get('client');
  if(url.pathname==='/sso/authorize'){
   if(request.method!=='GET')return json({message:'Method not allowed'},405);
   const state=url.searchParams.get('state');
   if(!Object.hasOwn(clients,client)||!state||!/^[a-zA-Z0-9_-]{32,128}$/.test(state))return json({message:'Invalid sign-in request'},400);
   const user=await identity(request,db);
   if(!user)return Response.redirect(new URL('/?return_to='+encodeURIComponent(url.pathname+url.search),settings.CP_ORIGIN||'https://cp.dunerealms.com'),302);
   const code=randomBytes(32).toString('base64url');
   await db.prepare('DELETE FROM integration_sso_codes WHERE expires_at<?').bind(Date.now()).run();
   await db.prepare('INSERT INTO integration_sso_codes(code_hash,user_id,session_ref,client_id,expires_at) VALUES(?,?,?,?,?)').bind(hash(code),user.id,hash(sessionToken(request)),client,Date.now()+60000).run();
   const callback=new URL(clients[client]);callback.searchParams.set('code',code);callback.searchParams.set('state',state);
   return new Response(null,{status:302,headers:{Location:callback.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(!['/internal/integrations/redeem','/internal/integrations/identity'].includes(url.pathname)||request.method!=='POST')return json({message:'Not found'},404);
  const supplied=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from('Bearer '+(settings.INTEGRATION_SSO_SECRET||''));
  if((settings.INTEGRATION_SSO_SECRET||'').length<32||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return json({message:'Unauthorized'},401);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
  if(url.pathname.endsWith('/identity')){
   if(!/^[0-9a-f]{64}$/.test(body.sessionRef||''))return json({message:'Unauthorized'},401);
   const user=await db.prepare('SELECT a.id,a.username,a.display_name,a.role FROM site_sessions s JOIN site_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(body.sessionRef,Date.now()).first();
   return user?describe(user,body.sessionRef):json({message:'Session expired'},401);
  }
  if(!Object.hasOwn(clients,body.client)||!/^[A-Za-z0-9_-]{43}$/.test(body.code||''))return json({message:'Invalid request'},400);
  const codeHash=hash(body.code),record=await db.prepare('SELECT user_id,session_ref FROM integration_sso_codes WHERE code_hash=? AND client_id=? AND expires_at>?').bind(codeHash,body.client,Date.now()).first();
  if(!record)return json({message:'Expired or already used'},401);
  const removed=await db.prepare('DELETE FROM integration_sso_codes WHERE code_hash=? AND client_id=? AND expires_at>?').bind(codeHash,body.client,Date.now()).run();
  if(!removed.meta.changes)return json({message:'Expired or already used'},401);
  const user=await db.prepare('SELECT a.id,a.username,a.display_name,a.role FROM site_sessions s JOIN site_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(record.session_ref,Date.now()).first();
  if(!user)return json({message:'Account unavailable'},401);
  return describe(user,record.session_ref);
  async function describe(user,sessionRef){
  const access=await accessFor(db,user),link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();
  const age=await db.prepare('SELECT age_band FROM site_age_declarations WHERE user_id=?').bind(user.id).first();
  const policy=await db.prepare('SELECT service_uuid,game_link_exempt FROM site_account_policies WHERE user_id=?').bind(user.id).first();
  return json({id:user.id,username:user.username,displayName:user.display_name,publicProfile:await publicProfileFor(db,user.id,settings.CP_ORIGIN||'https://cp.dunerealms.com'),role:access.rank,ranks:access.ranks,rankLabel:access.label,rankLevel:access.level,communityBadges:(await badgesFor(db,user.id)).filter(k=>communityBadgeVisible(k,access.ranks)),linked:!!link?.minecraft_uuid,gameLinkExempt:!!policy?.service_uuid&&Number(policy.game_link_exempt)===1,forumAllowed:age?.age_band!=='under15',permissions:access.nodes,sessionRef});
  }
 };
}
