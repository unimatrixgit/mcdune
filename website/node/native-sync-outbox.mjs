import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {syncNativeAgents} from './native-agents.mjs';

// One coalesced change event. Retrying this table never polls accounts or ranks.
export const NATIVE_SYNC_SCHEMA=`CREATE TABLE IF NOT EXISTS native_sync_outbox (
 job_key VARCHAR(32) PRIMARY KEY, revision CHAR(36) NOT NULL, attempts INTEGER NOT NULL,
 next_attempt_at BIGINT NOT NULL, lease_token CHAR(36) NOT NULL, lease_until BIGINT NOT NULL,
 created_at BIGINT NOT NULL, last_error VARCHAR(80) NOT NULL
)`;
export async function initializeNativeSyncOutbox(db){await db.prepare(NATIVE_SYNC_SCHEMA).run();}
export function nativeSyncChange(db,now=Date.now()){
 return db.prepare("INSERT INTO native_sync_outbox(job_key,revision,attempts,next_attempt_at,lease_token,lease_until,created_at,last_error) VALUES('memberships',?,0,0,'',0,?,'') ON CONFLICT(job_key) DO UPDATE SET revision=excluded.revision,attempts=0,next_attempt_at=0,created_at=excluded.created_at,last_error='' ").bind(randomUUID(),now);
}
async function synchronize(db){
 if(!['/home/dunerealms/apps/integrations/osticket/sync-agents.php','/home/dunerealms/apps/integrations/sync-staff-seals.php','/home/dunerealms/apps/integrations/seal-manifest.json'].every(existsSync))throw Error('Native adapters unavailable');
 await syncNativeAgents(db);
}
export async function drainNativeSyncOutbox(db,{sync=synchronize,now=Date.now,logger=console}={}){
 const timestamp=now(),job=await db.prepare("SELECT * FROM native_sync_outbox WHERE job_key='memberships'").first();
 if(!job)return {pending:false};
 if(Number(job.next_attempt_at)>timestamp||Number(job.lease_until)>timestamp)return {pending:true};
 const token=randomUUID(),claimed=await db.prepare("UPDATE native_sync_outbox SET lease_token=?,lease_until=? WHERE job_key='memberships' AND lease_until<=?").bind(token,timestamp+120000,timestamp).run();
 if(!claimed.meta.changes)return {pending:true};
 // Read after claiming: a change committed before this point belongs to this pass.
 const current=await db.prepare("SELECT * FROM native_sync_outbox WHERE job_key='memberships' AND lease_token=?").bind(token).first();
 if(!current)return {pending:true};
 try{
  await sync(db);
  const done=await db.prepare("DELETE FROM native_sync_outbox WHERE job_key='memberships' AND revision=? AND lease_token=?").bind(current.revision,token).run();
  if(!done.meta.changes)await db.prepare("UPDATE native_sync_outbox SET lease_token='',lease_until=0 WHERE job_key='memberships' AND lease_token=?").bind(token).run();
  return {pending:!done.meta.changes};
 }catch{
  const attempts=Number(current.attempts)+1,delay=Math.min(300000,5000*2**Math.min(attempts-1,6));
  await db.prepare("UPDATE native_sync_outbox SET attempts=?,next_attempt_at=?,last_error='Native synchronization failed' WHERE job_key='memberships' AND revision=? AND lease_token=?").bind(attempts,now()+delay,current.revision,token).run();
  await db.prepare("UPDATE native_sync_outbox SET lease_token='',lease_until=0 WHERE job_key='memberships' AND lease_token=?").bind(token).run();
  logger.warn?.('Native synchronization queued for retry');return {pending:true};
 }
}
// Start in the main process only. Both processes may attempt immediate delivery;
// the database lease serializes them, including recovery after a process crash.
export function startNativeSyncRetryWorker(db,{intervalMs=5000,...options}={}){
 let stopped=false,running=false;
 const tick=async()=>{if(stopped||running)return;running=true;try{await drainNativeSyncOutbox(db,options);}catch{options.logger?.warn?.('Native synchronization retry unavailable');}finally{running=false;}};
 const timer=setInterval(tick,intervalMs);timer.unref?.();void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
