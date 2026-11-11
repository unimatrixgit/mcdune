import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {can} from '../node/permissions.mjs';
import {json} from '../node/game-link.mjs';
const pendingBanSync=new WeakMap();
const BAN_SCOPES=new Set(['arrakis','lobby','kaitain','giedi_prime','caladan','sigma_draconis_iv','network']);
export function validateBanFeed(live){
 if(!live||!Array.isArray(live.bans)||live.bans.length>5000||!Array.isArray(live.sources)||!live.sources.length||live.sources.length>7||new Set(live.sources).size!==live.sources.length||!live.sources.every(scope=>BAN_SCOPES.has(scope)))throw Error('Invalid ban sources');
 const seen=new Set();const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 for(const ban of live.bans){
  if(!ban||typeof ban!=='object'||!BAN_SCOPES.has(ban.scope)||!live.sources.includes(ban.scope)||typeof ban.uuid!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(ban.uuid)||ban.key!==ban.scope+':'+ban.uuid)throw Error('Invalid ban identity');
  for(const [field,limit]of Object.entries({name:40,operator:120,reason:2000,created:100,expires:100}))if(typeof ban[field]!=='string'||ban[field].length>limit||/[\x00-\x1f\x7f]/.test(ban[field])||(field==='created'&&!ban[field]))throw Error('Invalid ban metadata');
  if(ban.scope==='network'&&(typeof ban.recordId!=='string'||!uuidPattern.test(ban.recordId)))throw Error('Invalid network ban record reference');
  if(seen.has(ban.key))throw Error('Duplicate ban identity');seen.add(ban.key);
 }
 return live;
}
export function createModeration(db,settings,{fetcher=fetch}={}){
 async function bridge(path,body){const response=await fetcher('http://127.0.0.1:15433'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(path==='/bans'?10000:23000)});if(!response.ok)throw Error('The game host did not confirm this action.');return response.json();}
 async function performSync(){const live=validateBanFeed(await bridge('/bans'));const seen=[],now=Date.now();for(const ban of live.bans){const key=ban.key+':'+ban.created;seen.push(key);await db.prepare('INSERT INTO moderation_bans(id,source_key,native_key,minecraft_uuid,player_name,banned_by,reason,scope,created_text,expires_text,active,first_seen,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(source_key) DO UPDATE SET reason=excluded.reason,expires_text=excluded.expires_text,active=1,updated_at=excluded.updated_at').bind(ban.scope==='network'?ban.recordId:randomUUID(),key,ban.key,ban.uuid,ban.name,ban.operator,ban.reason,ban.scope,ban.created,ban.expires,now,now).run();}
  const {results:known}=await db.prepare('SELECT id,source_key,scope FROM moderation_bans WHERE active=1').all();for(const row of known)if(live.sources.includes(row.scope)&&!seen.includes(row.source_key))await db.prepare('UPDATE moderation_bans SET active=0,updated_at=? WHERE id=?').bind(now,row.id).run();return live;
 }
 async function sync(){if(pendingBanSync.has(db))return pendingBanSync.get(db);const work=performSync();pendingBanSync.set(db,work);try{return await work;}finally{pendingBanSync.delete(db);}}
 async function attach(banId,ticketId,user){const ban=await db.prepare('SELECT * FROM moderation_bans WHERE id=?').bind(banId).first();if(!ban)return json({message:'Ban ID not found'},404);const ticket=await db.prepare('SELECT id,user_id,category FROM support_tickets WHERE id=?').bind(ticketId).first();if(!ticket||ticket.category!=='ban-appeal')return json({message:'Choose an existing ban-appeal support ticket'},400);if(ticket.user_id!==user.id&&!await can(db,user,'web.tickets.staff'))return json({message:'Ticket access denied'},403);const existing=await db.prepare('SELECT id FROM moderation_appeals WHERE ticket_id=?').bind(ticketId).first();if(existing)return json({message:'This ticket already has an appeal'},409);await db.batch([db.prepare('INSERT INTO moderation_appeals(id,ban_id,ticket_id,status,ban_snapshot,opened_at) VALUES(?,?,?,?,?,?)').bind(randomUUID(),ban.id,ticketId,'pending',JSON.stringify(ban),Date.now()),db.prepare('UPDATE support_tickets SET status=?,updated_at=? WHERE id=?').bind('in_progress',Date.now(),ticketId),db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,'appeal-opened','Support ticket '+ticketId,JSON.stringify(ban),Date.now())]);return json({ok:true});}
 async function ticketBan(ticketId){const appeal=await db.prepare('SELECT * FROM moderation_appeals WHERE ticket_id=?').bind(ticketId).first();if(!appeal)return null;return{appeal,ban:await db.prepare('SELECT * FROM moderation_bans WHERE id=?').bind(appeal.ban_id).first()};}
 async function handle(request){const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);if(!await can(db,user,'web.menu.bans')||!await can(db,user,'web.bans.view'))return json({message:'Permission required: web.bans.view'},403);const url=new URL(request.url),origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
  if(request.method==='GET'){try{const live=await sync(),{results:bans}=await db.prepare('SELECT * FROM moderation_bans ORDER BY first_seen DESC,id DESC').all(),{results:appeals}=await db.prepare('SELECT * FROM moderation_appeals ORDER BY opened_at DESC,id DESC').all();return json({bans:bans.map(b=>({...b,appeals:appeals.filter(a=>a.ban_id===b.id)})),globalConnected:live.globalConnected,sources:live.sources});}catch{return json({message:'Live bans could not be refreshed. No stored ban history was removed.'},503);}}
  if(request.method!=='POST'||request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
  if(url.pathname==='/api/cp/bans/attach'){if(!await can(db,user,'web.bans.tickets'))return json({message:'Permission required: web.bans.tickets'},403);return attach(body.banId,body.ticketId,user);}
  if(url.pathname!=='/api/cp/bans/action'||!await can(db,user,'web.bans.manage'))return json({message:'Permission required: web.bans.manage'},403);
  if(!['edit','remove','approve','deny'].includes(body.action)||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500||/[\r\n\x00-\x1f]/.test(body.reason))return json({message:'Enter a single-line reason of 5–500 characters.'},400);
  const ban=await db.prepare('SELECT * FROM moderation_bans WHERE id=?').bind(body.banId).first();if(!ban)return json({message:'Ban not found'},404);const reason=body.reason.trim();
  let appeal=null;if(['approve','deny'].includes(body.action)){appeal=await db.prepare("SELECT * FROM moderation_appeals WHERE ban_id=? AND status='pending' ORDER BY opened_at DESC LIMIT 1").bind(ban.id).first();if(!appeal)return json({message:'No pending appeal exists for this ban'},409);}
  await db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,body.action+'-requested',reason,JSON.stringify(ban),Date.now()).run();
  if(body.action!=='deny'){try{await bridge('/bans/action',{key:ban.native_key,action:body.action==='edit'?'edit':'remove',reason,actor:user.username});}catch(error){return json({message:error.message+' The request remains in the audit history; no success was recorded.'},503);}}
  const now=Date.now(),statements=[db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,body.action+'-confirmed',reason,JSON.stringify(ban),now)];
  if(body.action==='edit')statements.push(db.prepare('UPDATE moderation_bans SET reason=?,updated_at=? WHERE id=?').bind(reason,now,ban.id));
  if(['remove','approve'].includes(body.action))statements.push(db.prepare('UPDATE moderation_bans SET active=0,updated_at=? WHERE id=?').bind(now,ban.id));
  if(appeal){statements.push(db.prepare('UPDATE moderation_appeals SET status=?,decision_reason=?,decided_by=?,decided_at=? WHERE id=? AND status=?').bind(body.action==='approve'?'approved':'denied',reason,user.username,now,appeal.id,'pending'),db.prepare('UPDATE support_tickets SET status=?,updated_at=? WHERE id=?').bind('resolved',now,appeal.ticket_id),db.prepare('INSERT INTO support_messages(id,ticket_id,author_id,author_name,author_role,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),appeal.ticket_id,user.id,user.username,'system','Appeal '+(body.action==='approve'?'approved (successful)':'denied (unsuccessful)')+'. '+reason,now));}
  await db.batch(statements);return json({ok:true});
 }
 return{handle,sync,attach,ticketBan};
}



export function startModerationSync(db,settings,{intervalMs=30000,setTimer=setInterval,clearTimer=clearInterval,log=console.error,...dependencies}={}){const moderation=createModeration(db,settings,dependencies);let stopped=false;const run=async()=>{if(stopped)return;try{await moderation.sync();}catch{log('Ban synchronization temporarily unavailable; retained history preserved.');}};void run();const timer=setTimer(run,intervalMs);timer.unref?.();return()=>{stopped=true;clearTimer(timer);};}
