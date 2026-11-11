import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,key=/^[a-z][a-z0-9-]{2,63}$/;
const statuses=new Set(['preparing','assigned','completed','failed','skipped','discovered']);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function validateQuestDefinition(body){
 if(!body||!key.test(body.key||'')||!text(body.title,120)||body.title.trim().length<3||!text(body.description,2000)||body.description.trim().length<10||typeof body.enabled!=='boolean'||typeof body.hidden!=='boolean'||!Number.isSafeInteger(body.intervalSeconds)||body.intervalSeconds<3600||body.intervalSeconds>604800||!Number.isSafeInteger(body.surviveSeconds)||body.surviveSeconds<60||body.surviveSeconds>1800||body.rewardDunemarks!==0||!Number.isSafeInteger(body.version)||body.version<0||body.version>2147483646)return null;
 return {key:body.key,title:body.title.trim(),description:body.description,enabled:body.enabled,hidden:body.hidden,intervalSeconds:body.intervalSeconds,surviveSeconds:body.surviveSeconds,rewardDunemarks:0,version:body.version};
}
function event(row,admin=false){
 if(!row||!uuid.test(row.id||'')||!key.test(row.questKey||'')||!statuses.has(row.status)||!text(row.title,120)||!text(row.description,2000))throw Error('Invalid quest event');
 const result={id:row.id,questKey:row.questKey,title:row.title,description:row.description,status:row.status,assignedAt:row.assignedAt,deadlineAt:row.deadlineAt,completedAt:row.completedAt};
 if(admin)Object.assign(result,{playerUuid:row.playerUuid,serverId:row.serverId,definitionVersion:row.definitionVersion,reason:typeof row.reason==='string'?row.reason.slice(0,500):''});
 return result;
}
/** Capability-only relay: the native quest engine owns assignments, spawns and
 * completion. No website route writes a wallet or accepts a caller-selected UUID. */
export function createQuests(db,settings={},dependencies={}){
 const authenticate=dependencies.authenticate||(request=>identity(request,db)),access=dependencies.access||(user=>accessFor(db,user));
 const linked=dependencies.linked||(async user=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first())?.minecraft_uuid);
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin,attempts=new Map();
 async function bridge(path,body){if((settings.SERVER_CONTROL_TOKEN||'').length<64)throw Error('Unavailable');const result=await(dependencies.fetcher||fetch)('http://127.0.0.1:15433'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});return{ok:result.ok,status:result.status,data:await result.json()};}
 return async request=>{
  const url=new URL(request.url),user=await authenticate(request);if(!user)return response({message:'Sign in first.'},401);
  const nodes=(await access(user)).nodes||[],admin=url.pathname.startsWith('/api/quests/admin');
  if(!nodes.includes(admin?'web.quests.manage':'web.quests.view'))return response({message:'Quest access is not available for this account.'},403);
  if(url.search)return response({message:'This endpoint does not accept player overrides or query filters.'},400);
  try{
   if(request.method==='GET'&&url.pathname==='/api/quests'){
    const player=await linked(user);if(!player)return response({linked:false,quests:[]});if(!uuid.test(player))throw Error('Invalid verified identity');
    const result=await bridge('/quests/player?uuid='+encodeURIComponent(player));if(!result.ok)throw Error('Unavailable');
    if(!Array.isArray(result.data.events)||result.data.events.length>200||result.data.events.some(row=>row.playerUuid&&row.playerUuid.toLowerCase()!==player.toLowerCase()))throw Error('Invalid private events');
    return response({linked:true,quests:result.data.events.filter(row=>['assigned','completed','failed','discovered'].includes(row.status)).map(row=>event(row)),rewardDunemarks:0});
   }
   if(request.method==='GET'&&url.pathname==='/api/quests/admin'){
    const [definitions,history]=await Promise.all([bridge('/quests/definitions'),bridge('/quests/events')]);if(!definitions.ok||!history.ok)throw Error('Unavailable');
    if(definitions.data.cap!==2||definitions.data.rewardDunemarks!==0||!Array.isArray(definitions.data.definitions)||definitions.data.definitions.length>100||!Array.isArray(history.data.events)||history.data.events.length>500)throw Error('Invalid engine state');
    const rows=definitions.data.definitions.map(row=>{if(!validateQuestDefinition(row))throw Error('Invalid definition');return{...validateQuestDefinition(row),engine:row.engine,nextRunAt:row.nextRunAt,updatedAt:row.updatedAt,updatedBy:row.updatedBy};});
    return response({definitions:rows,events:history.data.events.map(row=>event(row,true)),cap:2,rewardDunemarks:0,manualTestAvailable:false});
   }
   if(request.method==='POST'&&url.pathname==='/api/quests/admin/definitions'){
    if(request.headers.get('origin')!==origin)return response({message:'Origin rejected.'},403);
    const now=Date.now();for(const[id,row]of attempts)if(row.until<now)attempts.delete(id);const row=attempts.get(user.id)||{count:0,until:now+60000};if(++row.count>10)return response({message:'Wait a minute before saving more changes.'},429);attempts.set(user.id,row);
    let input;try{const raw=await request.text();if(Buffer.byteLength(raw)>16384)throw Error();input=JSON.parse(raw);}catch{return response({message:'Invalid quest definition.'},400);}
    const definition=validateQuestDefinition(input);if(!definition)return response({message:'Check the title, schedule and survival duration. Monetary rewards are not enabled.'},400);
    await db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'quest-config-requested',JSON.stringify({key:definition.key,version:definition.version,enabled:definition.enabled,hidden:definition.hidden}),now).run();
    const result=await bridge('/quests/definitions',{...definition,actor:user.username});if(result.status===409)return response({message:'Another staff member changed this quest. Refresh before saving again.'},409);
    if(!result.ok||result.data.ok!==true||result.data.key!==definition.key||result.data.version!==definition.version+1||result.data.cap!==2||result.data.rewardDunemarks!==0)throw Error('Unconfirmed change');
    await db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'quest-config-confirmed',JSON.stringify({key:definition.key,version:result.data.version}),Date.now()).run();
    return response({ok:true,key:definition.key,version:result.data.version,message:'The quest engine confirmed your settings.'});
   }
   return response({message:'Method or quest route not available.'},405);
  }catch{return response({message:'The quest engine is temporarily unavailable. Refresh to check the current state; no success is assumed.'},503);}
 };
}
