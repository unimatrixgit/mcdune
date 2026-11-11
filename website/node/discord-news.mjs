import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {newsPath} from './search-visibility.mjs';
const ORIGIN='https://www.dunerealms.com';
const categories=new Set(['world','news','maintenance','changelogs','events','community','unis_blog']);
export function newsWebhookPayload(post,{test=false}={}){
 const category=categories.has(post.category)?post.category:'news';
 const summary=String(post.body||'').replace(/<[^>]*>/g,'').replace(/\[([^\]]+)\]\(https?:[^)]+\)/g,'$1').replace(/[#*_`]/g,'').replace(/\s+/g,' ').trim().slice(0,500);
 return {username:'DuneRealms Dispatches',avatar_url:'https://cdn.discordapp.com/avatars/1567239700610285618/dc3ff7eb9f86481f52b4293affa3bbfd.png',allowed_mentions:{parse:[]},embeds:[{title:(test?'[TEST] ':'')+'['+({news:'NEWS',world:'World',maintenance:'Maintenance',changelogs:'Changelogs',events:'Events',community:'Community',unis_blog:'Uni’s Blog'}[post.category]||'NEWS')+'] '+String(post.title).slice(0,220),description:summary,url:ORIGIN+newsPath(post),color:0xc6a551,image:{url:ORIGIN+'/assets/news-'+(category==='unis_blog'?'news':category)+'.webp'},footer:{text:test?'Integration test — not a new published article':'Written by '+(post.author_name||'DuneRealms')+' • DuneRealms'},timestamp:new Date(Number(post.published_at)).toISOString()}]};
}
export function validateNewsWebhook(config){
 const url=new URL(config.url);if(url.protocol!=='https:'||url.hostname!=='discord.com'||!/^\/api(?:\/v10)?\/webhooks\/\d+\/[A-Za-z0-9_.-]+$/.test(url.pathname)||url.search||url.hash||url.username||url.password||config.channelId!=='1567237542040834250'||config.guildId!=='1567229433033531462')throw Error('Invalid news webhook configuration');
 return url.href;
}
export async function initializeDiscordNews(db,now=Date.now()){
 await db.prepare("CREATE TABLE IF NOT EXISTS discord_news_meta (marker VARCHAR(40) PRIMARY KEY,created_at BIGINT NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS discord_news_delivery (post_id CHAR(36) PRIMARY KEY,state VARCHAR(16) NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_at BIGINT NOT NULL DEFAULT 0,claimed_at BIGINT NOT NULL DEFAULT 0,claim_token CHAR(36) NOT NULL DEFAULT '',message_id VARCHAR(30) NOT NULL DEFAULT '',last_error VARCHAR(80) NOT NULL DEFAULT '')").run();
 await db.batch([
  db.prepare("INSERT INTO discord_news_delivery(post_id,state) SELECT id,'baseline' FROM website_posts WHERE status='published' AND published_at<=? AND NOT EXISTS(SELECT 1 FROM discord_news_meta WHERE marker='initialized') ON CONFLICT(post_id) DO UPDATE SET post_id=excluded.post_id").bind(now),
  db.prepare("INSERT INTO discord_news_meta(marker,created_at) VALUES('initialized',?) ON CONFLICT(marker) DO UPDATE SET marker=excluded.marker").bind(now)
 ]);
}
export async function drainDiscordNews(db,config,{fetcher=fetch,now=Date.now}={}){
 const webhook=validateNewsWebhook(config),time=now();
 // A timeout/crash after sending may already have posted. Never blindly duplicate it.
 await db.prepare("UPDATE discord_news_delivery SET state='uncertain',last_error='Interrupted delivery requires review' WHERE state='sending' AND claimed_at<?").bind(time-120000).run();
 await db.prepare("INSERT INTO discord_news_delivery(post_id,state) SELECT id,'queued' FROM website_posts WHERE status='published' AND published_at<=? ON CONFLICT(post_id) DO UPDATE SET state=CASE WHEN discord_news_delivery.state='withdrawn' THEN 'queued' ELSE discord_news_delivery.state END").bind(time).run();
 const {results}=await db.prepare("SELECT post_id FROM discord_news_delivery WHERE state IN ('queued','retry') AND next_at<=? ORDER BY post_id LIMIT 5").bind(time).all();
 const states=[];
 for(const job of results){
  const token=randomUUID();const claimed=await db.prepare("UPDATE discord_news_delivery SET state='sending',claim_token=?,claimed_at=?,attempts=attempts+1 WHERE post_id=? AND state IN ('queued','retry') AND next_at<=?").bind(token,time,job.post_id,time).run();if(!claimed.meta.changes)continue;
  const post=await db.prepare("SELECT p.id,p.title,p.body,p.category,p.published_at,COALESCE(a.display_name,a.username,'DuneRealms') author_name FROM website_posts p LEFT JOIN site_accounts a ON a.id=p.author_id WHERE p.id=? AND p.status='published' AND p.published_at<=?").bind(job.post_id,time).first();
  const finish=async(state,message='',next=0,error='')=>{await db.prepare('UPDATE discord_news_delivery SET state=?,message_id=?,next_at=?,last_error=? WHERE post_id=? AND claim_token=?').bind(state,message,next,error,job.post_id,token).run();states.push(state);};
  if(!post){await finish('withdrawn');continue;}
  try{
   const response=await fetcher(webhook+'?wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newsWebhookPayload(post)),signal:AbortSignal.timeout(15000),redirect:'error'});
   if(response.status===429){let seconds=60;try{seconds=Math.max(1,Math.min(3600,Number((await response.json()).retry_after)||60));}catch{}await finish('retry','',time+seconds*1000,'Rate limited');continue;}
   if(!response.ok){await finish(response.status>=500?'uncertain':'failed','','0','Discord HTTP '+response.status);continue;}
   let result;try{result=await response.json();}catch{}
   if(!/^\d+$/.test(String(result?.id||''))){await finish('uncertain','','0','No confirmed message ID');continue;}
   await finish('sent',String(result.id));
  }catch{await finish('uncertain','','0','Delivery outcome unknown; review before retry');}
 }
 return states;
}
export async function startDiscordNewsWorker(db,settings=process.env,{logger=console}={}){
 const file=settings.DISCORD_NEWS_CONFIG_FILE;if(!file)return()=>{};
 let config;try{config=JSON.parse(await readFile(file,'utf8'));validateNewsWebhook(config);await initializeDiscordNews(db);}catch{logger.warn('Discord news worker unavailable; check private configuration');return()=>{};}
 let stopped=false,busy=false;const tick=async()=>{if(stopped||busy)return;busy=true;try{await drainDiscordNews(db,config);}catch{logger.warn('Discord news queue check failed');}finally{busy=false;}};
 const timer=setInterval(tick,10000);timer.unref?.();void tick();return()=>{stopped=true;clearInterval(timer);};
}
