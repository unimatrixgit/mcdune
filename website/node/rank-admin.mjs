import {isOwnerRank} from './permissions.mjs';
import {nativeSyncChange,drainNativeSyncOutbox} from './native-sync-outbox.mjs';
import {randomUUID} from 'node:crypto';
import {identity} from './auth.mjs';
import {honourAction} from './honours.mjs';
import {memorialRoleStatements} from './memorials.mjs';
import {setGitArchived} from './git-identity.mjs';
import {json,gameAuthorized} from './game-link.mjs';
import {WEBSITE_NODES,DEFAULT_RANKS,RANK_SECTIONS,rankSection,accessFor,rankFor,rankKey,can} from './permissions.mjs';
const validKey=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{2,39}$/.test(value);
export function createRankAdmin(db,settings,origin){return async request=>{
 const url=new URL(request.url);
 if(url.pathname==='/api/game/permissions'){
  if(request.method!=='GET'||url.search||!gameAuthorized(request,settings))return json({message:'Unauthorized'},401);
  return json({message:'Website ranks no longer export game permissions. Use LuckPerms.'},410);
 }
 const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
 const access=await accessFor(db,user);
 const editProtected=user.username?.toLowerCase()==='unimatrix999'&&access.ranks.includes('owners');
 if(url.pathname==='/api/ranks/honour')return honourAction(db,user,request,origin);
 if(!access.nodes.includes('web.ranks.manage'))return json({message:'Rank-management permission required.'},403);
 if(request.method==='GET'&&url.pathname==='/api/ranks'&&!url.search){
  const {results}=await db.prepare('SELECT rank_key,label,rank_level,kind,permissions_json,version FROM cp_ranks ORDER BY rank_level,rank_key').all();
  return json({sections:RANK_SECTIONS,catalog:Object.entries(WEBSITE_NODES).map(([node,label])=>({node,label,scope:'Website'})),ranks:results.filter(r=>r.kind==='access').map(r=>({key:r.rank_key,section:rankSection(r.rank_key),label:r.label,level:Number(r.rank_level),kind:r.kind,nodes:JSON.parse(r.permissions_json).filter(n=>Object.hasOwn(WEBSITE_NODES,n)),version:Number(r.version),editable:!isOwnerRank(r.rank_key)&&(isOwnerRank(access.rank)||Number(r.rank_level)<access.level)})),actor:{rank:access.rank,nodes:access.nodes}});
 }
 if(request.method!=='POST'||url.search)return json({message:'Invalid rank request.'},400);
 if(request.headers.get('origin')!==origin)return json({message:'Origin rejected.'},403);
 let body;try{body=await request.json();}catch{return json({message:'Invalid request.'},400);}
 const audit=(action,details)=>db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,action,details,Date.now());
 if(url.pathname==='/api/ranks/create'){
  if(!validKey(body.key)||body.key.length>16||DEFAULT_RANKS.some(r=>r.key===body.key)||typeof body.label!=='string'||!body.label.trim()||body.label.length>40||!['user','vip','staff','corestaff'].includes(body.base))return json({message:'Use a unique rank ID of 3–16 lowercase letters, digits or underscores, a label, and a base rank.'},400);
  const base=await rankFor(db,body.base);
  if(!isOwnerRank(access.rank)&&base.level>=access.level)return json({message:'You can only create ranks below your own.'},403);
  const nodes=base.nodes.filter(n=>access.nodes.includes(n));
  try{await db.batch([db.prepare('INSERT INTO cp_ranks(rank_key,label,rank_level,kind,permissions_json,version) VALUES(?,?,?,?,?,1)').bind(body.key,body.label.trim(),base.level,'access',JSON.stringify(nodes)),audit('rank-created',body.key)]);}catch(error){if(error.code==='ER_DUP_ENTRY'||String(error.message).includes('UNIQUE'))return json({message:'That rank already exists.'},409);throw error;}
  return json({ok:true},201);
 }
 if(url.pathname==='/api/ranks/permissions'){
  if(!validKey(body.rank)||!Array.isArray(body.nodes)||body.nodes.length>Object.keys(WEBSITE_NODES).length||!Number.isInteger(body.version))return json({message:'Invalid permission matrix.'},400);
  const rank=await rankFor(db,body.rank),nodes=[...new Set(body.nodes)];
  if(rank.kind!=='access'||isOwnerRank(rank.key)||rank.level===0||!isOwnerRank(access.rank)&&rank.level>=access.level)return json({message:'This rank is protected.'},403);
  if(nodes.some(n=>!Object.hasOwn(WEBSITE_NODES,n)||!isOwnerRank(access.rank)&&!access.nodes.includes(n)||rank.kind!=='access'&&n.startsWith('cp.')))return json({message:'You cannot grant these permissions.'},403);
  const result=await db.batch([db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify(nodes),rank.key,body.version),audit('rank-permissions',rank.key+': matrix update attempted'),nativeSyncChange(db)]);
  const nativeSync=result[0].meta.changes?await drainNativeSyncOutbox(db):null;
  return result[0].meta.changes?json({ok:true,nativeSyncPending:nativeSync.pending}):json({message:'This matrix changed in another session. Refresh before saving.'},409);
 }
 if(url.pathname==='/api/ranks/assign'){
  if(!await can(db,user,'web.accounts.assign'))return json({message:'Account rank assignment permission required.'},403);
  const keys=body.ranks??[body.rank];
  if(typeof body.userId!=='string'||body.userId.length!==36||!Array.isArray(keys)||!keys.length||keys.length>20||keys.some(k=>!validKey(k))||new Set(keys).size!==keys.length)return json({message:'Select 1–20 distinct ranks.'},400);
  const target=await db.prepare('SELECT id,role FROM site_accounts WHERE id=?').bind(body.userId).first();if(!target)return json({message:'Account not found.'},404);
  const ranks=await Promise.all(keys.map(key=>rankFor(db,key))),previous=await accessFor(db,target);
  if(keys.includes('crysknife')&&!previous.ranks.includes('crysknife'))return json({message:'Award the Crysknife from User Panel → DuneRealms → Order of the Crysknife, with a citation and confirmation.'},403);
  if(ranks.some(r=>r.kind!=='access'||r.level===0)||(previous.ranks.some(isOwnerRank)&&!editProtected)||!isOwnerRank(access.rank)&&(ranks.some(r=>r.level>=access.level)||previous.level>=access.level||target.id===user.id))return json({message:'That assignment is protected. Owner accounts cannot be changed here.'},403);
  if(keys.includes('memorial')&&(!isOwnerRank(access.rank)||target.id===user.id||keys.some(k=>!['memorial','user','crysknife'].includes(k))))return json({message:'Only Owners can create memorial accounts. Memorials cannot hold staff, supporter or gameplay ranks.'},403);
  if(editProtected&&target.id===user.id&&!keys.includes('owners'))return json({message:'Your Owner role must be retained.'},403);
  const primary=keys.includes('memorial')?ranks.find(r=>r.key==='memorial'):ranks.find(r=>r.key===target.role)||[...ranks].sort((a,b)=>b.level-a.level)[0];
  await db.batch([db.prepare('UPDATE site_accounts SET role=? WHERE id=?').bind(primary.key,target.id),db.prepare('DELETE FROM cp_account_ranks WHERE user_id=?').bind(target.id),...ranks.filter(r=>r.key!==primary.key).map(r=>db.prepare('INSERT INTO cp_account_ranks(user_id,rank_key) VALUES(?,?)').bind(target.id,r.key)),...await memorialRoleStatements(db,target,keys),db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(target.id),audit('account-ranks',target.id+' -> '+keys.join(',')),nativeSyncChange(db)]);
  let memorialSyncPending=false;if(keys.includes('memorial'))try{await setGitArchived(db,target.id,true,settings);}catch{memorialSyncPending=true;}
  const nativeSync=await drainNativeSyncOutbox(db);
  return json({ok:true,nativeSyncPending:nativeSync.pending||memorialSyncPending});
 }
 return json({message:'Not found.'},404);
};}
