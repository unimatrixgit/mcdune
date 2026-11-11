import {randomUUID} from 'node:crypto';
import {accessFor,isOwnerRank} from './permissions.mjs';
import {nativeSyncChange} from './native-sync-outbox.mjs';
export async function initializeAccountArchive(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS site_account_archive(user_id CHAR(36) PRIMARY KEY,role VARCHAR(40) NOT NULL,ranks_json TEXT NOT NULL,password_salt VARCHAR(64) NOT NULL,password_hash VARCHAR(256) NOT NULL,deleted_by CHAR(36) NOT NULL,deleted_at BIGINT NOT NULL)`).run();
}
export async function archiveAccount(db,actor,{userId,confirmation}, {native=async()=>{}}={}){
 if(!(await accessFor(db,actor)).ranks.some(isOwnerRank))return {status:403,message:'Only protected Owners may remove accounts.'};
 const target=await db.prepare('SELECT id,username,role,password_salt,password_hash FROM site_accounts WHERE id=?').bind(userId).first();
 if(!target)return {status:404,message:'Account not found.'};
 if(target.id===actor.id||(await accessFor(db,target)).ranks.some(isOwnerRank))return {status:403,message:'Your own account and protected leadership accounts cannot be removed here.'};
 if(confirmation!==target.username)return {status:400,message:'Type the exact username to confirm account removal.'};
 if(target.password_hash.startsWith('!'))return {status:409,message:'This account is already disabled.'};
 const {results:extra}=await db.prepare('SELECT rank_key FROM cp_account_ranks WHERE user_id=?').bind(target.id).all();
 try{
 const result=await db.batch([
  db.prepare('INSERT INTO site_account_archive(user_id,role,ranks_json,password_salt,password_hash,deleted_by,deleted_at) SELECT id,role,?,password_salt,password_hash,?,? FROM site_accounts WHERE id=? AND role=? AND password_hash=?').bind(JSON.stringify(extra.map(r=>r.rank_key)),actor.id,Date.now(),target.id,target.role,target.password_hash),
  db.prepare("UPDATE site_accounts SET role='user',password_hash='!deleted' WHERE id=? AND role=? AND password_hash=?").bind(target.id,target.role,target.password_hash),
  db.prepare("DELETE FROM cp_account_ranks WHERE user_id=? AND EXISTS(SELECT 1 FROM site_accounts WHERE id=? AND password_hash='!deleted')").bind(target.id,target.id),
  db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(target.id),
  db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),actor.id,'account-archived',target.id,Date.now()),nativeSyncChange(db),
 ]);
 if(!result[1].meta.changes)return {status:409,message:'Account changed; refresh before removing it.'};
 }catch(e){if(e.code==='ER_DUP_ENTRY'||String(e.message).includes('UNIQUE'))return {status:409,message:'Account removal was already recorded.'};throw e;}
 let nativePending=false;try{await native(target.id,true);}catch{nativePending=true;}
 return {status:nativePending?202:200,ok:true,nativePending,message:nativePending?'Account disabled; connected Git access requires reconciliation.':'Account archived. Receipts and audit history retained.'};
}
export async function restoreAccount(db,actor,{userId,confirmation},{native=async()=>{}}={}){
 if(!(await accessFor(db,actor)).ranks.some(isOwnerRank))return {status:403,message:'Only protected Owners may restore accounts.'};
 const permanent=await db.prepare("SELECT 1 FROM site_accounts WHERE id=? AND password_hash='!banned'").bind(userId).first();if(permanent)return {status:409,message:'This account is permanently banned and cannot be restored through account recovery.'};
 const target=await db.prepare('SELECT a.id,a.username,h.role,h.ranks_json,h.password_salt,h.password_hash FROM site_account_archive h JOIN site_accounts a ON a.id=h.user_id WHERE h.user_id=?').bind(userId).first();
 if(!target)return {status:404,message:'Archived account not found.'};
 if(confirmation!==target.username)return {status:400,message:'Type the exact username to restore.'};
 try{await native(target.id,false);}catch{return {status:503,message:'Connected Git account could not be restored; central account remains disabled.'};}
 const ranks=JSON.parse(target.ranks_json);
 await db.batch([
  db.prepare("UPDATE site_accounts SET role=?,password_salt=?,password_hash=? WHERE id=? AND password_hash='!deleted'").bind(target.role,target.password_salt,target.password_hash,target.id),
  ...ranks.map(key=>db.prepare('INSERT INTO cp_account_ranks(user_id,rank_key) VALUES(?,?)').bind(target.id,key)),
  db.prepare('DELETE FROM site_account_archive WHERE user_id=?').bind(target.id),
  db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),actor.id,'account-restored',target.id,Date.now()),nativeSyncChange(db),
 ]);
 return {status:200,ok:true,message:'Account restored; old sessions remain signed out.'};
}
