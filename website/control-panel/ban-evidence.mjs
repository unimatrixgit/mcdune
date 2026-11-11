import {evidenceMime,evidenceFileResponse,ticketEvidence,ticketEvidenceFile} from './evidence-media.mjs';
import {identity} from '../node/auth.mjs';
import {can} from '../node/permissions.mjs';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const BAN_EVIDENCE_SCHEMA=`CREATE TABLE IF NOT EXISTS moderation_evidence (
 id CHAR(36) PRIMARY KEY, ban_id CHAR(36) NOT NULL, kind VARCHAR(16) NOT NULL,
 label VARCHAR(120) NOT NULL, file_name VARCHAR(120), mime VARCHAR(64), file_key VARCHAR(80),
 link_url TEXT, sha256 CHAR(64), actor_id CHAR(36) NOT NULL, created_at BIGINT NOT NULL,
 actor_name VARCHAR(64) NOT NULL DEFAULT '', notes TEXT, file_bytes MEDIUMBLOB,
 file_size INT NOT NULL DEFAULT 0, ban_snapshot TEXT,
 INDEX ban_evidence_history (ban_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
export async function initializeBanEvidence(db){
 await db.query(BAN_EVIDENCE_SCHEMA);
 const columns=new Set((await db.query('SHOW COLUMNS FROM moderation_evidence')).map(c=>c.Field));
 for(const [name,definition]of Object.entries({actor_name:"VARCHAR(64) NOT NULL DEFAULT ''",notes:'TEXT',file_bytes:'MEDIUMBLOB',file_size:'INT NOT NULL DEFAULT 0',ban_snapshot:'TEXT'}))if(!columns.has(name))await db.query('ALTER TABLE moderation_evidence ADD COLUMN '+name+' '+definition);
}
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const limit=5*1024*1024, bodyLimit=7*1024*1024;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function boundedJson(request){
 if(Number(request.headers.get('content-length'))>bodyLimit)throw Error('size');
 const reader=request.body?.getReader();if(!reader)throw Error('json');let size=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>bodyLimit){await reader.cancel();throw Error('size');}parts.push(value);}}
 finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export function evidenceInput(b){
 if(!b||!uuid.test(b.id||'')||!uuid.test(b.banId||'')||typeof b.title!=='string'||b.title.trim().length<3||b.title.length>120||typeof b.notes!=='string'||b.notes.length>10000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(b.title+b.notes)||typeof b.sourceUrl!=='string'||b.sourceUrl.length>2000)throw Error('fields');
 let url='';if(b.sourceUrl.trim()){const u=new URL(b.sourceUrl.trim());if(u.protocol!=='https:'||u.username||u.password)throw Error('url');url=u.href;}
 let bytes=null,mime=null,name=null;
 if(b.file!=null){
  if(typeof b.file.base64!=='string'||!b.file.base64.length||b.file.base64.length>Math.ceil(limit/3)*4||typeof b.file.name!=='string')throw Error('file');
  bytes=Buffer.from(b.file.base64,'base64');if(!bytes.length||bytes.length>limit||bytes.toString('base64')!==b.file.base64)throw Error('file');
  mime=evidenceMime(bytes);if(!mime)throw Error('file');
  name=b.file.name.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'').slice(0,120)||'evidence';
 }
 if(!b.notes.trim()&&!url&&!bytes)throw Error('empty');
 return {id:b.id.toLowerCase(),banId:b.banId.toLowerCase(),title:b.title.trim(),notes:b.notes.trim(),sourceUrl:url,bytes,mime,name,hash:bytes?createHash('sha256').update(bytes).digest('hex'):null};
}
export function createBanEvidence(db,settings={},deps={}){
 const authenticate=deps.authenticate||(r=>identity(r,db)),allowed=deps.can||((u,n)=>can(db,u,n));
 return async request=>{
  const user=await authenticate(request);if(!user)return reply({message:'Sign in first.'},401);
  if(!await allowed(user,'web.menu.bans')||!await allowed(user,'web.bans.view'))return reply({message:'Ban record access required.'},403);
  const url=new URL(request.url);
  if(url.pathname==='/api/ban-evidence/file'){
   const keys=[...url.searchParams.keys()],nativeId=url.searchParams.get('nativeId'),inline=url.searchParams.get('inline')==='1';
   if(request.method!=='GET'||new Set(keys).size!==keys.length||keys.some(k=>!['id','nativeId','banId','inline'].includes(k))||(url.searchParams.has('inline')&&!inline))return reply({message:'Invalid evidence request.'},400);
   if(nativeId){if(url.searchParams.has('id')||!/^\d{1,10}$/.test(nativeId)||!uuid.test(url.searchParams.get('banId')||''))return reply({message:'Invalid evidence request.'},400);const file=await ticketEvidenceFile(db,url.searchParams.get('banId'),nativeId);if(!file)return reply({message:'Attachment not found.'},404);if(file.unavailable)return reply({message:'Open the original ticket to download this attachment.'},503);return evidenceFileResponse(request,file.bytes,file.name,inline);}
   if(url.searchParams.has('banId')||!uuid.test(url.searchParams.get('id')||''))return reply({message:'Invalid evidence request.'},400);
   const row=await db.prepare('SELECT e.file_bytes,e.mime AS file_mime,e.file_name,e.sha256 AS file_sha256,e.file_key FROM moderation_evidence e JOIN moderation_bans b ON b.id=e.ban_id WHERE e.id=?').bind(url.searchParams.get('id')).first();
   if(!row)return reply({message:'Attachment not found.'},404);
   let bytes=row.file_bytes;if(!bytes&&settings.EVIDENCE_DIR&&/^[a-f0-9-]{36}\.bin$/i.test(row.file_key||'')){try{const path=join(resolve(settings.EVIDENCE_DIR),row.file_key);if((await stat(path)).size>limit)throw Error();bytes=await readFile(path);}catch{return reply({message:'Retained attachment unavailable.'},503);}}
   if(!bytes)return reply({message:'Attachment not found.'},404);
   return evidenceFileResponse(request,bytes,row.file_name,inline);
  }
  if(request.method==='GET'){
   const id=url.searchParams.get('banId'),keys=[...url.searchParams.keys()],pageText=url.searchParams.get('page')||'0',page=Number(pageText);if(keys.length!==new Set(keys).size||keys.some(k=>!['banId','page'].includes(k))||!/^\d{1,5}$/.test(pageText)||page>10000||!uuid.test(id||''))return reply({message:'Choose a ban record.'},400);
   const ban=await db.prepare('SELECT id,player_name,minecraft_uuid,reason,banned_by,scope,active FROM moderation_bans WHERE id=?').bind(id).first();if(!ban)return reply({message:'Ban not found.'},404);
   const {results}=await db.prepare('SELECT id,actor_name,label AS title,notes,link_url AS source_url,file_name,mime AS file_mime,file_size,sha256 AS file_sha256,created_at FROM moderation_evidence WHERE ban_id=? ORDER BY created_at DESC,id DESC LIMIT 201 OFFSET '+(page*200)).bind(id).all();
   return reply({ban,canAdd:await allowed(user,'web.bans.evidence'),evidence:results.slice(0,200),hasMore:results.length>200,page,ticketEvidence:page===0?await ticketEvidence(db,id):[]});
  }
  if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
  if(!await allowed(user,'web.bans.evidence'))return reply({message:'Ban evidence permission required to add evidence.'},403);
  if(request.headers.get('origin')!==new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin)return reply({message:'Origin rejected.'},403);
  if(url.search)return reply({message:'Invalid evidence request.'},400);
  let data;try{data=evidenceInput(await boundedJson(request));}catch(error){const messages={fields:'Enter a title of 3–120 characters. Notes may contain up to 10,000 characters.',url:'Use an HTTPS source link without a username or password.',file:'Choose a valid PNG, JPEG, WebP, GIF, PDF, MP4 or WebM attachment up to 5 MB.',empty:'Add notes, a source link or an attachment.',size:'The attachment exceeds the permitted upload size.',json:'The upload request could not be read. Please try again.'};return reply({message:messages[error.message]||'The upload request could not be read. Please try again.'},error.message==='size'?413:400);}
  const ban=await db.prepare('SELECT id,player_name,minecraft_uuid,reason,banned_by,scope,active FROM moderation_bans WHERE id=?').bind(data.banId).first();if(!ban)return reply({message:'Ban not found.'},404);
  const existing=await db.prepare("SELECT ban_id,actor_id,label AS title,notes,COALESCE(link_url,'') AS source_url,sha256 AS file_sha256 FROM moderation_evidence WHERE id=?").bind(data.id).first();
  if(existing){if(existing.ban_id!==data.banId||existing.actor_id!==user.id||existing.title!==data.title||existing.notes!==data.notes||existing.source_url!==data.sourceUrl||existing.file_sha256!==data.hash)return reply({message:'This submission ID is already in use. Refresh before adding different evidence.'},409);return reply({ok:true,id:data.id,replayed:true});}
  const now=Date.now();
  try{await db.batch([
   db.prepare('INSERT INTO moderation_evidence(id,ban_id,actor_id,actor_name,kind,label,notes,link_url,file_name,mime,file_bytes,file_size,sha256,ban_snapshot,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(data.id,data.banId,user.id,user.username,'record',data.title,data.notes,data.sourceUrl,data.name,data.mime,data.bytes,data.bytes?.length||0,data.hash,JSON.stringify(ban),now),
   db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(data.id,data.banId,user.id,'evidence-added',data.title,JSON.stringify({evidenceId:data.id,fileSha256:data.hash,fileSize:data.bytes?.length||0}),now)
  ]);}catch(error){if(error.code==='ER_DUP_ENTRY')return reply({message:'Submission already saved or in progress. Refresh the evidence list.'},409);throw error;}
  return reply({ok:true,id:data.id},201);
 };
}
