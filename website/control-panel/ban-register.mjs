import {identity} from '../node/auth.mjs';
import {can} from '../node/permissions.mjs';
import {createModeration} from './moderation.mjs';
import {effectiveAppealStatus} from './native-appeal-status.mjs';
import {randomUUID} from 'node:crypto';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createBanRegister(db,settings,dependencies={}){
 const moderation=dependencies.moderation||createModeration(db,settings,dependencies);let last=0,lastResult=null;
 const authenticate=dependencies.authenticate||(request=>identity(request,db)),allowed=dependencies.can||((user,node)=>can(db,user,node));
 return async request=>{
  const user=await authenticate(request);if(!user)return json({message:'Sign in first.'},401);
  if(!await allowed(user,'web.menu.bans')||!await allowed(user,'web.bans.view'))return json({message:'Permission required: web.bans.view'},403);
  if(request.method==='POST'){
   if(!await allowed(user,'web.bans.manage'))return json({message:'Permission required: web.bans.manage'},403);
   if(request.headers.get('origin')!==new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin)return json({message:'Origin rejected.'},403);
   let body;try{const raw=await request.text();if(Buffer.byteLength(raw)>4096)throw Error();body=JSON.parse(raw);}catch{return json({message:'Invalid unban request.'},400);}
   if(new URL(request.url).search||body?.action!=='remove'||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i).test(body.banId||'')||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500||/[\x00-\x1f\x7f]/.test(body.reason))return json({message:'Choose a ban and enter a single-line reason of 5–500 characters.'},400);
   const ban=await db.prepare('SELECT * FROM moderation_bans WHERE id=?').bind(body.banId).first();
   if(!ban)return json({message:'Ban not found.'},404);
   if(!ban.active||ban.source_key.startsWith('demo:'))return json({message:'This is not an active game ban.'},409);
   if((settings.SERVER_CONTROL_TOKEN||'').length<64)return json({message:'The game host is unavailable. No unban was confirmed.'},503);
   try{
    const live=await moderation.sync();
    if(!live.sources.includes(ban.scope)||!live.bans.some(row=>row.key===ban.native_key&&row.created===ban.created_text))return json({message:'The ban changed or could not be verified. Refresh before retrying.'},409);
    const reason=body.reason.trim(),snapshot=JSON.stringify(ban),now=Date.now();
    await db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,'remove-requested',reason,snapshot,now).run();
    const response=await (dependencies.fetcher||fetch)('http://127.0.0.1:15433/bans/action',{method:'POST',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({action:'remove',key:ban.native_key,created:ban.created_text,actor:user.username,reason}),signal:AbortSignal.timeout(25000)});
    const result=await response.json();
    if(!response.ok||result.ok!==true||result.confirmed!==true||result.absent!==true||result.key!==ban.native_key)return json({message:'Ban removal was not confirmed. Refresh the live ban list before retrying.'},response.status===409?409:503);
    await db.batch([db.prepare('UPDATE moderation_bans SET active=0,updated_at=? WHERE id=? AND source_key=?').bind(Date.now(),ban.id,ban.source_key),db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,'remove-confirmed',reason,snapshot,Date.now())]);last=0;
    return json({ok:true,confirmed:true,banId:ban.id,scope:ban.scope,message:'The game host confirmed that this ban was removed.'});
   }catch{return json({message:'The game host did not confirm removal. No success was recorded; refresh before retrying.'},503);}
  }
  if(request.method!=='GET')return json({message:'Method not allowed'},405);
  let connected=true;try{if(Date.now()-last>15000){lastResult=await moderation.sync();last=Date.now();}}catch{connected=false;}
  const {results:bans}=await db.prepare('SELECT * FROM moderation_bans ORDER BY first_seen DESC,id DESC LIMIT 1000').all();
  const {results:storedAppeals}=await db.prepare('SELECT a.id,a.ban_id,a.ticket_id,t.number AS ticket_number,s.state AS ticket_state,a.status,a.opened_at,a.decision_reason,a.decided_by,a.decided_at FROM native_ban_appeals a LEFT JOIN drsupport_ticket t ON t.ticket_id=a.ticket_id LEFT JOIN drsupport_ticket_status s ON s.id=t.status_id ORDER BY a.opened_at DESC LIMIT 1000').all();
  const appeals=storedAppeals.map(appeal=>({...appeal,status:effectiveAppealStatus(appeal.status,appeal.ticket_state)}));
  return json({connected,globalConnected:!!lastResult?.globalConnected,sources:lastResult?.sources||[],bans:bans.map(({source_key,...ban})=>({...ban,demo:source_key.startsWith('demo:'),appeals:appeals.filter(a=>a.ban_id===ban.id)}))});
 };
}
