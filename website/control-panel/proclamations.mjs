import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {createPoliticsPreview} from './politics-preview.mjs';
export const proclamationSchema=[`CREATE TABLE IF NOT EXISTS political_proclamations(id CHAR(36) PRIMARY KEY,request_id CHAR(36) NOT NULL,scope VARCHAR(48) NOT NULL,title VARCHAR(120) NOT NULL,body TEXT NOT NULL,author_id CHAR(36) NOT NULL,created_at BIGINT NOT NULL,version INTEGER NOT NULL DEFAULT 1,UNIQUE KEY proclamation_request(author_id,request_id),KEY scope_date(scope,created_at)) ENGINE=InnoDB`];
export async function initializeProclamations(db){for(const sql of proclamationSchema)await db.prepare(sql).run();}
export function proclamationInput(input){if(!input||input.confirmed!==true||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.requestId||''))throw Error('Confirm publication.');const title=String(input.title||'').trim(),body=String(input.body||'').trim();if(title.length<3||title.length>120||body.length<10||body.length>6000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(title+body))throw Error('Use a title of 3–120 characters and a message of 10–6,000 characters.');return{requestId:input.requestId.toLowerCase(),title,body};}
export function proclamationScope(kind,context,rights){if(kind==='imperial')return{scope:'imperium',publish:context?.emperor===true};if(kind==='guild')return{scope:'spacing_guild',publish:rights.ranks.includes('guild_envoy')};if(kind==='house'&&context?.factionStatus==='verified'&&context.faction)return{scope:'house:'+context.faction,publish:context.houseLeader===true};return null;}
export function createProclamations(db,settings={},deps={}){
 const auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u)),preview=deps.preview||createPoliticsPreview(db,settings),clock=deps.clock||Date.now,origin=settings.CP_ORIGIN||'https://cp.dunerealms.com';
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
 return async request=>{
 const url=new URL(request.url),kind=url.searchParams.get('kind'),page=Number(url.searchParams.get('page')||1);
 if(!['house','imperial','guild'].includes(kind)||!Number.isSafeInteger(page)||page<1||page>100000||[...url.searchParams.keys()].some(k=>!['kind','page'].includes(k)))return reply({message:'Invalid proclamation request.'},400);
 if(!['GET','POST'].includes(request.method))return reply({message:'Method not allowed.'},405);
 if(request.method==='POST'&&(request.headers.get('origin')!==new URL(origin).origin||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')))return reply({message:'Invalid publication origin or format.'},403);
 const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);const rights=await access(user);if(!rights.nodes.includes('web.menu.game'))return reply({message:'Realm access required.'},403);
 let input;if(request.method==='POST'){const raw=await request.text();if(raw.length>10000)return reply({message:'Message too large.'},413);try{input=proclamationInput(JSON.parse(raw));}catch(error){return reply({message:error.message},400);}}
 const response=await preview(new Request(new URL('/api/politics/preview',origin),{headers:request.headers}));if(!response.ok)return reply({message:'Political authority unavailable.'},503);const context=await response.json(),current=await auth(request);if(!current||current.id!==user.id)return reply({message:'Account changed.'},403);const freshRights=await access(current);if(!freshRights.nodes.includes('web.menu.game'))return reply({message:'Access changed.'},403);
 const target=proclamationScope(kind,context,freshRights);if(!target)return reply({message:'A verified House is required.'},403);
 if(request.method==='POST'){
 if(!target.publish)return reply({message:'Only the current office holder may publish here.'},403);
 try{const id=randomUUID();await db.prepare('INSERT INTO political_proclamations(id,request_id,scope,title,body,author_id,created_at,version) VALUES(?,?,?,?,?,?,?,1)').bind(id,input.requestId,target.scope,input.title,input.body,user.id,clock()).run();return reply({ok:true,id},201);}catch(error){const old=await db.prepare('SELECT id,scope,title,body FROM political_proclamations WHERE author_id=? AND request_id=?').bind(user.id,input.requestId).first();if(old&&old.scope===target.scope&&old.title===input.title&&old.body===input.body)return reply({ok:true,id:old.id});if(old)return reply({message:'Publication identifier already used. Refresh.'},409);throw error;}
 }
 const total=Number((await db.prepare('SELECT COUNT(*) AS total FROM political_proclamations WHERE scope=?').bind(target.scope).first()).total);
 const post=await db.prepare('SELECT p.id,p.title,p.body,p.created_at,p.version,u.username AS author FROM political_proclamations p JOIN site_accounts u ON u.id=p.author_id WHERE p.scope=? ORDER BY p.created_at DESC,p.id DESC LIMIT 1 OFFSET ?').bind(target.scope,page-1).first();
 return reply({post:post||null,page,pages:Math.max(1,total),total,canPublish:target.publish});
 };}
