import {isOwnerRank} from '../node/permissions.mjs';
import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {can,accessFor} from '../node/permissions.mjs';
import {json} from '../node/game-link.mjs';
export const validEditorUrl=value=>typeof value==='string'&&/^https:\/\/luckperms\.net\/editor\/[A-Za-z0-9_-]{3,200}$/.test(value);
export function createLuckPerms(db,settings,{fetcher=fetch}={}){return async request=>{
 const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
 if(!await can(db,user,'web.menu.luckperms'))return json({message:'Permission required: web.menu.luckperms'},403);
 const url=new URL(request.url),origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 let target,body;
 if(request.method==='GET'&&url.pathname==='/api/luckperms/groups'&&!url.search){
  if(!await can(db,user,'web.luckperms.view'))return json({message:'Permission required: web.luckperms.view'},403);
  target='/luckperms/groups';
 }else if(request.method==='POST'&&['/api/luckperms/editor','/api/luckperms/apply'].includes(url.pathname)&&!url.search){
  if(!isOwnerRank((await accessFor(db,user)).rank)||!await can(db,user,'web.luckperms.edit'))return json({message:'Only Owners may use the full LuckPerms editor.'},403);
  if(request.headers.get('origin')!==origin)return json({message:'Origin rejected.'},403);
  let data;try{data=await request.json();}catch{return json({message:'Invalid request.'},400);}
  const editor=url.pathname.endsWith('/editor');
  if(!editor&&(typeof data.command!=='string'||!/^\/?lp (applyedits|trusteditor) [A-Za-z0-9_-]{3,200}$/.test(data.command)))return json({message:'Paste only the lp applyedits or lp trusteditor command supplied by the official editor.'},400);
  target=editor?'/luckperms/editor':'/luckperms/apply';body={actor:user.username,...(!editor?{command:data.command.replace(/^\//,'')}:{})};
  await db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,editor?'luckperms-editor':'luckperms-apply','Official groups editor',Date.now()).run();
 }else return json({message:'Invalid LuckPerms request.'},400);
 if((settings.SERVER_CONTROL_TOKEN||'').length<64)return json({message:'LuckPerms bridge is not configured.'},503);
 try{
  const response=await fetcher('http://127.0.0.1:15433'+target,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(23000)});
  const data=await response.json();
  if(!response.ok)return json({message:'LuckPerms could not complete the request. Check the Arrakis server and try again.'},response.status>=400&&response.status<=599?response.status:503);
  if(target.endsWith('/editor'))return validEditorUrl(data.url)?json({url:data.url}):json({message:'LuckPerms returned an invalid editor address.'},502);
  if(target.endsWith('/groups')){
   if(!Array.isArray(data.groups)||data.groups.some(g=>typeof g.name!=='string'||!/^[a-z0-9_.-]{1,100}$/.test(g.name)||!Number.isSafeInteger(Number(g.nodes))||Number(g.nodes)<0))return json({message:'Invalid LuckPerms group data.'},502);
   return json({groups:data.groups.map(g=>({name:g.name,nodes:Number(g.nodes)})),checkedAt:data.checkedAt});
  }
  return json({message:typeof data.message==='string'?data.message.slice(0,4000):'Command sent. Check the editor for confirmation.'});
 }catch{return json({message:'LuckPerms is temporarily unavailable.'},503);}
};}

