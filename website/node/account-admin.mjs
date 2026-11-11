import{avatarForAccount}from'./avatar.mjs';
import {communityBadgeVisible} from './community-badges.mjs';
import {badgesFor} from './community-badges.mjs';
import {can,rankFor,accessFor} from './permissions.mjs';
import {randomUUID} from 'node:crypto';
import {identity} from './auth.mjs';
import {json} from './game-link.mjs';
import {archiveAccount,restoreAccount} from './account-archive.mjs';
import {setGitArchived} from './git-identity.mjs';
export function createAccountAdmin(db,origin){return async request=>{
 const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);if(!await can(db,user,request.method==='GET'?'web.accounts.view':'web.accounts.revoke'))return json({message:'Account administration permission required.'},403);
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path==='/api/admin/accounts'){
  const {results}=await db.prepare("SELECT a.id,a.username,a.role,a.created_at,CASE WHEN a.password_hash IN ('!deleted','!banned') THEN 1 ELSE 0 END AS archived,CASE WHEN a.password_hash='!banned' THEN 1 ELSE 0 END AS banned,l.minecraft_uuid,l.minecraft_name FROM site_accounts a LEFT JOIN site_game_links l ON l.user_id=a.id ORDER BY a.created_at DESC LIMIT 200").all();const accounts=[];for(const row of results){const access=await accessFor(db,row);accounts.push({...row,avatar:await avatarForAccount(db,row.id),ranks:access.ranks,communityBadges:(await badgesFor(db,row.id)).filter(k=>communityBadgeVisible(k,access.ranks)),rankLevel:access.level});}return json({accounts});
 }
 if(request.method!=='POST'||!['/api/admin/revoke-sessions','/api/admin/archive-account','/api/admin/restore-account'].includes(path))return json({message:'Not found'},404);
 if(request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
 let data;try{data=await request.json();}catch{return json({message:'Invalid request'},400);}
 if(typeof data.userId!=='string'||data.userId.length!==36)return json({message:'Invalid account'},400);
 if(path!=='/api/admin/revoke-sessions'){
  const handler=path.endsWith('restore-account')?restoreAccount:archiveAccount;
  const result=await handler(db,user,data,{native:(id,archived)=>setGitArchived(db,id,archived)});
  return json(result,result.status);
 }
 const target=await db.prepare('SELECT id,role FROM site_accounts WHERE id=?').bind(data.userId).first();
 if(!target)return json({message:'Account not found'},404);
 if((await accessFor(db,target)).level>=(await accessFor(db,user)).level&&target.id!==user.id)return json({message:'Other staff sessions require operator review.'},403);
 await db.batch([db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(target.id),db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'sessions-revoked',target.id,Date.now())]);return json({ok:true});
};}
