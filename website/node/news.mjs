import {nativeForumFeed} from './native-forum-feed.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {json} from './game-link.mjs';
export const NEWS_CATEGORIES={world:'World',news:'NEWS',maintenance:'Maintenance',changelogs:'Changelogs',events:'Events',community:'Community',unis_blog:"Uni’s Blog"};
export async function initializeNews(db){
 for(const [key,label] of Object.entries(NEWS_CATEGORIES))await db.prepare('INSERT INTO website_post_categories(category_key,label,artwork) VALUES(?,?,?) ON CONFLICT(category_key) DO UPDATE SET label=excluded.label').bind(key,label,'assets/news-'+(key==='unis_blog'?'news':key)+'.png').run();
 // Only published release records become posts. Pending work never becomes a release announcement.
 let releases=[];try{const file=JSON.parse(await readFile(new URL('../scripts/changelog.json',import.meta.url),'utf8'));releases=Array.isArray(file)?file:file.releases||[];}catch{}
 for(const release of releases){
  const key='release:'+String(release.version).slice(0,100),existing=await db.prepare('SELECT id FROM website_posts WHERE source_key=?').bind(key).first();if(existing)continue;
  const date=Date.parse(release.date);if(!Number.isFinite(date)||date>Date.now())continue;
  const body=[release.synopsis,...(release.tasks||[]).flatMap(t=>[t.title,...(t.changes||[]).map(x=>'• '+x)])].filter(Boolean).join('\n\n').slice(0,12000);
  await db.prepare('INSERT INTO website_posts(id,source_key,category,title,body,status,author_id,created_at,updated_at,published_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(source_key) DO UPDATE SET source_key=excluded.source_key').bind(randomUUID(),key,'changelogs',String(release.title||release.version).slice(0,120),body,'published','release-register',date,date,date).run();
 }
}
export async function forumLinks(db,posts){try{if(!posts.length)return posts;const{results}=await db.prepare('SELECT post_id,thread_id FROM forum_news_delivery WHERE post_id IN ('+posts.map(()=>'?').join(',')+") AND thread_id>0 AND state='sent'").bind(...posts.map(p=>p.id)).all();const links=new Map(results.filter(r=>Number.isSafeInteger(Number(r.thread_id))&&Number(r.thread_id)>0).map(r=>[r.post_id,'https://forums.dunerealms.com/showthread.php?tid='+Number(r.thread_id)]));return posts.map(p=>({...p,forum_url:links.get(p.id)||null}));}catch{return posts.map(p=>({...p,forum_url:null}));}}
export function createPublicNews(db){return async request=>{
 const url=new URL(request.url);if(request.method!=='GET')return json({message:'Method not allowed'},405);
 if(url.pathname==='/api/home/forum'){
  const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>3)return json({message:'Invalid page'},400);
  try{return json(await nativeForumFeed(page));}catch{return json({message:'Forum updates are temporarily unavailable.'},503);}
 }
 const match=url.pathname.match(/^\/api\/news\/([0-9a-f-]{36})$/i);
 if(match){const post=await db.prepare("SELECT p.id,p.title,p.body,p.category,p.published_at,c.label,c.artwork,COALESCE(a.display_name,a.username,'DuneRealms') AS author_name FROM website_posts p JOIN website_post_categories c ON c.category_key=p.category LEFT JOIN site_accounts a ON a.id=p.author_id WHERE p.id=? AND p.status='published' AND p.published_at<=?").bind(match[1],Date.now()).first();return post?json({post:(await forumLinks(db,[post]))[0]}):json({message:'Post not found'},404);}
 if(url.pathname!=='/api/news')return json({message:'Not found'},404);
 const page=Number(url.searchParams.get('page')||1),archive=url.searchParams.get('surface')==='archive',size=archive?25:5;
 if(!Number.isSafeInteger(page)||page<1||page>1000000)return json({message:'Invalid page'},400);
 const count=await db.prepare("SELECT COUNT(*) AS count FROM website_posts WHERE status='published' AND published_at<=?").bind(Date.now()).first();
 const {results}=await db.prepare("SELECT p.id,p.title,p.body,p.category,p.published_at,c.label,c.artwork,COALESCE(a.display_name,a.username,'DuneRealms') AS author_name FROM website_posts p JOIN website_post_categories c ON c.category_key=p.category LEFT JOIN site_accounts a ON a.id=p.author_id WHERE p.status='published' AND p.published_at<=? ORDER BY p.published_at DESC,p.id DESC LIMIT ? OFFSET ?").bind(Date.now(),size,(page-1)*size).all();
 return json({posts:await forumLinks(db,results.map(p=>({...p,body:p.body.slice(0,220)}))),page,pages:Math.ceil(Number(count.count)/size),total:Number(count.count)});
};}
