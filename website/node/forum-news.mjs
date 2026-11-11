import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
export async function initializeForumNews(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS forum_news_delivery(post_id CHAR(36) PRIMARY KEY,state VARCHAR(16) NOT NULL,thread_id BIGINT NOT NULL DEFAULT 0,claim_token CHAR(36) NOT NULL DEFAULT '',claimed_at BIGINT NOT NULL DEFAULT 0,last_error VARCHAR(120) NOT NULL DEFAULT '')").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS forum_news_revision(post_id CHAR(36) PRIMARY KEY,delivered_hash VARCHAR(64) NOT NULL DEFAULT '')").run();
}
const nativeSend=post=>new Promise((resolve,reject)=>{const child=execFile('/usr/bin/php',['/home/dunerealms/apps/integrations/forum-news.php'],{timeout:30000,maxBuffer:262144},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(e){reject(e);}});child.stdin.end(JSON.stringify(post));});
export function forumNewsRevision(row,time){
 // Withdrawal payloads deliberately contain no current draft/private/future content.
 const post=row.status==='published'&&row.published_at!=null&&Number.isFinite(Number(row.published_at))&&Number(row.published_at)<=time
  ?{id:row.id,status:'published',title:row.title,body:row.body,category:row.category,published_at:Number(row.published_at),author_name:row.author_name||'DuneRealms',format_version:2}
  :{id:row.id,status:'archived'};
 return {...post,revision:createHash('sha256').update(JSON.stringify(post)).digest('hex')};
}
const sourceSQL="SELECT d.post_id AS id,d.thread_id,d.state,p.title,p.body,p.category,p.published_at,p.status,COALESCE(a.display_name,a.username,'DuneRealms') author_name,r.delivered_hash FROM forum_news_delivery d LEFT JOIN website_posts p ON p.id=d.post_id LEFT JOIN site_accounts a ON a.id=p.author_id LEFT JOIN forum_news_revision r ON r.post_id=d.post_id";
export async function drainForumNews(db,{send=nativeSend,now=Date.now}={}){
 const time=now();
 // Native source-marker reconciliation makes an interrupted claim safe to inspect again.
 await db.prepare("UPDATE forum_news_delivery SET state='queued',claim_token='' WHERE state='sending' AND claimed_at<?").bind(time-120000).run();
 await db.prepare("INSERT INTO forum_news_delivery(post_id,state) SELECT id,'queued' FROM website_posts WHERE status='published' AND published_at<=? ON CONFLICT(post_id) DO UPDATE SET post_id=excluded.post_id").bind(time).run();
 const {results:known}=await db.prepare(sourceSQL).all();
 for(const row of known){
  const post=forumNewsRevision(row,time);
  if(post.status==='archived'&&!Number(row.thread_id))continue;
  if(row.delivered_hash===post.revision)continue;
  // The revision guard prevents a stale concurrent scan from requeueing an already delivered update.
  await db.prepare("UPDATE forum_news_delivery SET state='queued' WHERE post_id=? AND state IN ('sent','archived','withdrawn') AND NOT EXISTS(SELECT 1 FROM forum_news_revision WHERE post_id=? AND delivered_hash=?)").bind(row.id,row.id,post.revision).run();
 }
 const{results}=await db.prepare("SELECT post_id FROM forum_news_delivery WHERE state='queued' ORDER BY post_id LIMIT 5").all();const states=[];
 for(const job of results){
  const token=randomUUID();const claim=await db.prepare("UPDATE forum_news_delivery SET state='sending',claim_token=?,claimed_at=? WHERE post_id=? AND state='queued'").bind(token,time,job.post_id).run();if(!claim.meta.changes)continue;
  const row=await db.prepare(sourceSQL+' WHERE d.post_id=?').bind(job.post_id).first();const post=forumNewsRevision(row,time);
  if(post.status==='archived'&&!Number(row.thread_id)){await db.prepare("UPDATE forum_news_delivery SET state='withdrawn',claim_token='' WHERE post_id=? AND claim_token=?").bind(job.post_id,token).run();continue;}
  try{
   const result=await send(post),state=post.status==='archived'?'archived':'sent';
   if(result.state!==state||result.revision!==post.revision||!Number.isSafeInteger(result.thread_id)||result.thread_id<1)throw Error('Native reconciliation required');
   await db.batch([
    db.prepare("INSERT INTO forum_news_revision(post_id,delivered_hash) SELECT ?,? WHERE EXISTS(SELECT 1 FROM forum_news_delivery WHERE post_id=? AND claim_token=? AND state='sending') ON CONFLICT(post_id) DO UPDATE SET delivered_hash=excluded.delivered_hash").bind(job.post_id,post.revision,job.post_id,token),
    db.prepare("UPDATE forum_news_delivery SET state=?,thread_id=?,claim_token='',last_error='' WHERE post_id=? AND claim_token=?").bind(state,result.thread_id,job.post_id,token)
   ]);states.push(state);
  }catch{
   await db.prepare("UPDATE forum_news_delivery SET state='uncertain',last_error='Native delivery requires reconciliation' WHERE post_id=? AND claim_token=?").bind(job.post_id,token).run();states.push('uncertain');
  }
 }return states;
}
export async function startForumNewsWorker(db,{logger=console}={}){if(!existsSync('/home/dunerealms/apps/integrations/forum-news.php'))return()=>{};await initializeForumNews(db);let stopped=false,busy=false;const tick=async()=>{if(stopped||busy)return;busy=true;try{await drainForumNews(db);}catch{logger.warn('Forum news delivery check failed');}finally{busy=false;}};const timer=setInterval(tick,10000);timer.unref?.();void tick();return()=>{stopped=true;clearInterval(timer);};}
