import {can} from '../node/permissions.mjs';
import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
const SERVER_IDS=Object.freeze(['arrakis','kaitain','giedi_prime','caladan','sigma_draconis_iv','lobby','proxy']);
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export function createServerControl(db,settings,{fetcher=fetch}={}){
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 return async request=>{
  const user=await identity(request,db);
  if(!user)return json({message:'Sign in to the account panel first.'},401);
  const path=new URL(request.url).pathname;
  let node=path.endsWith('/logs')?'web.servers.logs':path.endsWith('/action')?'web.servers.power':'web.servers.view';
  if(!await can(db,user,'web.menu.servers'))return json({message:'Server operator access is required.'},403);
  if(path.endsWith('/action')){try{if((await request.clone().json()).action==='command')node='web.servers.console';}catch{}}
  if(!await can(db,user,node))return json({message:'Permission required: '+node},403);
  if(!settings.SERVER_CONTROL_TOKEN||settings.SERVER_CONTROL_TOKEN.length<64)return json({message:'Server controls are not configured.'},503);
  const url=new URL(request.url);let target,body;
  if(request.method==='GET'&&url.pathname==='/api/servers'&&!url.search)target='/servers';
  else if(request.method==='GET'&&url.pathname==='/api/servers/logs'&&[...url.searchParams.keys()].length===1&&url.searchParams.has('server')&&SERVER_IDS.includes(url.searchParams.get('server')))target='/logs?server='+url.searchParams.get('server');
  else if(request.method==='POST'&&url.pathname==='/api/servers/action'&&!url.search){
   if(request.headers.get('origin')!==origin)return json({message:'Origin rejected.'},403);
   try{body=await request.json();}catch{return json({message:'Invalid action.'},400);}
   if(!SERVER_IDS.includes(body?.server)||!['start','stop','restart','command'].includes(body?.action))return json({message:'Invalid action.'},400);
   if(body.action==='command'&&(body.server==='proxy'||typeof body.command!=='string'||!/^[A-Za-z][ -~]{0,239}$/.test(body.command)))return json({message:'Enter one console command, without a leading slash.'},400);
   body={server:body.server,action:body.action,...(body.action==='command'?{command:body.command}:{}),actor:user.username};target='/action';
   // Record accepted intent before contacting the privileged agent. Never store command text or secrets.
   await db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'server-control',JSON.stringify({server:body.server,action:body.action}),Date.now()).run();
  }else return json({message:'Invalid server request.'},400);
  try{
   const response=await fetcher('http://127.0.0.1:15433'+target,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
   const result=await response.json();return json(result,response.status);
  }catch{return json({message:'The game host is temporarily unavailable.'},503);}
 };
}

