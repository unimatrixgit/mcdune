import {timingSafeEqual,randomUUID} from 'node:crypto';
import {createModeration} from './moderation.mjs';
import {accessFor} from '../node/permissions.mjs';
import {decideNativeAppeal} from './native-appeal-decision.mjs';
import {pendingNativeAppeal} from './native-appeal-status.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createBanBridge(db,settings,dependencies={}){
 const moderation=createModeration(db,settings,dependencies);
 let lastSync=0,lastError=null,pending=null;
 async function sync(){if(pending)return pending;if(Date.now()-lastSync<15000){if(lastError)throw lastError;return;}lastSync=Date.now();pending=moderation.sync().then(()=>{lastError=null;}).catch(error=>{lastError=error;throw error;}).finally(()=>{pending=null;});return pending;}
 async function publicBans(){try{await sync();}catch{}const{results}=await db.prepare('SELECT id,source_key,player_name,banned_by,reason,scope,created_text,expires_text FROM moderation_bans WHERE active=1 ORDER BY REPLACE(created_text,"T"," ") DESC,first_seen DESC,id DESC LIMIT 12').all();return json({bans:results.map(({source_key,...ban})=>({...ban,banned_by:/^(console|0)$/i.test(String(ban.banned_by).trim())?'Network':ban.banned_by,demo:source_key.startsWith('demo:')}))});}
 async function handle(request){
  const expected=Buffer.from('Bearer '+(settings.INTEGRATION_SSO_SECRET||'')),supplied=Buffer.from(request.headers.get('authorization')||'');
  if(request.method!=='POST'||(settings.INTEGRATION_SSO_SECRET||'').length<32||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return json({message:'Unauthorized'},401);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
  const user=await db.prepare('SELECT a.id,a.username,a.display_name,a.role FROM site_sessions s JOIN site_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(body.sessionRef||'',Date.now()).first();
  if(!user)return json({message:'Sign in first.'},401);
  if(!/^[a-f0-9-]{36}$/i.test(body.banId||''))return json({message:'Enter the complete ban ID from your ban message or the public ban list.'},400);
  let live=true;try{await sync();}catch{live=false;}
  const ban=await db.prepare('SELECT * FROM moderation_bans WHERE id=?').bind(body.banId).first();
  if(!ban)return json({message:live?'Ban ID not found. Check the ID or choose a ban from the public ban list.':'The game ban list is temporarily unavailable. Try again shortly.'},live?404:503);
  const access=await accessFor(db,user),staff=access.nodes.includes('web.bans.view')&&access.nodes.includes('web.tickets.appeals');
  const demo=ban.source_key.startsWith('demo:'),debugAllowed=access.nodes.includes('web.bans.manage')&&access.nodes.includes('web.tickets.staff');
  if(body.operation==='decision')return decideNativeAppeal(db,settings,{user,access,ban,body,fetcher:dependencies.fetcher||fetch});
  if(demo&&body.operation!=='attach'){const prior=await pendingNativeAppeal(db,ban.id,user.id);return json({ban:{...ban,demo:true},debugAllowed,evidence:[],live:false,pendingTicketId:prior?Number(prior.ticket_id):null});}
  if(demo&&!(body.debug===true&&debugAllowed))return json({message:'Only authorised staff can create a demonstration appeal.'},403);
  if(body.operation==='attach'){
   if(!live&&!demo)return json({message:'The ban list could not be verified. Please try again.'},503);
   const ticketId=Number(body.ticketId);if(!Number.isSafeInteger(ticketId)||ticketId<1)return json({message:'Invalid ticket'},400);
   const ticket=await db.prepare('SELECT t.ticket_id FROM drsupport_ticket t JOIN drsupport_user_email e ON e.user_id=t.user_id WHERE t.ticket_id=? AND e.address=?').bind(ticketId,user.id+'@accounts.dunerealms.invalid').first();
   if(!ticket)return json({message:'Ticket ownership could not be verified'},403);
   const prior=await pendingNativeAppeal(db,ban.id,user.id);if(prior)return json({message:'You already have a pending appeal for this ban.',ticketId:Number(prior.ticket_id)},409);
   const now=Date.now();await db.batch([db.prepare('INSERT INTO native_ban_appeals(id,ban_id,ticket_id,user_id,status,ban_snapshot,opened_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,ticketId,user.id,'pending',JSON.stringify(ban),now),db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,'appeal-opened','osTicket #'+ticketId,JSON.stringify(ban),now)]);
   return json({ok:true,ticketId});
  }
  const prior=await pendingNativeAppeal(db,ban.id,user.id);
  // Private evidence stays staff-only until a moderator explicitly shares it.
  const evidence=staff?(await db.prepare('SELECT id,label,kind,file_name,mime,link_url,created_at FROM moderation_evidence WHERE ban_id=? ORDER BY created_at').bind(ban.id).all()).results:[];
  return json({ban,evidence,live,pendingTicketId:prior?Number(prior.ticket_id):null});
 }
 return{handle,publicBans};
}
