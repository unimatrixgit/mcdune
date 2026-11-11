import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {createPoliticsPreview} from './politics-preview.mjs';
import {submitApplication,ownApplications} from './election-applications.mjs';
import {validateCandidature} from './public/election-rules.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
// Authenticated own-application route. Office grants and ballot writes are separate.
export function createElectionApplications(db,settings={},deps={}){
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 const auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u));
 const linked=deps.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 const excluded=deps.excluded||(async u=>!!await db.prepare("SELECT a.id FROM site_accounts a WHERE a.id=? AND (a.role IN ('official_account','memorial') OR a.password_hash LIKE '!%' OR EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key IN ('official_account','memorial')) OR EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=a.id AND p.game_link_exempt=1))").bind(u.id).first());
 const preview=deps.preview||createPoliticsPreview(db,settings);
 const save=deps.submit||submitApplication,list=deps.list||ownApplications,clock=deps.clock||Date.now;
 return async request=>{
  if(!['GET','POST'].includes(request.method))return reply({message:'Method not allowed.'},405);
  if(new URL(request.url).search)return reply({message:'Account overrides are not accepted.'},400);
  if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply({message:'Invalid request origin.'},403);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const permitted=async u=>(await access(u)).nodes.includes('web.menu.game')&&!await excluded(u);
  if(!await permitted(user))return reply({message:'A personal player account is required.'},403);
  if(request.method==='GET')return reply({applications:await list(db,user.id)});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply({message:'JSON is required.'},415);
  const raw=await request.text();if(raw.length>12000)return reply({message:'Application is too large.'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({message:'Invalid application.'},400);}
  const player=await linked(user);
  if(!player)return reply({message:'Link your Minecraft account first.'},403);
  const response=await preview(new Request(origin+'/api/politics/preview',{headers:request.headers}));
  if(!response.ok)return reply({message:'Player eligibility could not be verified.'},503);
  const verified=await response.json();
  const current=await auth(request);
  if(!current||current.id!==user.id)return reply({message:'Sign in again.'},401);
  if(!await permitted(current))return reply({message:'Access changed.'},403);
  if((await linked(current))?.toLowerCase()!==player.toLowerCase())return reply({message:'Linked account changed. Refresh.'},409);
  const context={linked:verified.linked===true,playerUuid:player,faction:verified.factionStatus==='verified'?verified.faction:null};
  try{validateCandidature(input,context,clock());}catch(error){return reply({message:error.message},400);}
  try{
   const result=await save(db,{actor:current,context,input,now:clock(),clock});
   return reply({application:result},result.created?201:200);
  }catch{return reply({message:'Application could not be saved. Refresh your register before retrying.'},409);}
 };
}
