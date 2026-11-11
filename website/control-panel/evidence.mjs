import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {identity} from '../node/auth.mjs';
import {can} from '../node/permissions.mjs';
import {json} from '../node/game-link.mjs';
export function evidenceMime(bytes,name){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return'image/webp';
 if(/\.(txt|log)$/i.test(name)&&!bytes.includes(0))return'text/plain';return null;
}
export function createEvidence(db,settings){
 const columns='id,ban_id,kind,label,file_name,mime,link_url,sha256,created_at';
 async function list(banId){const {results}=await db.prepare('SELECT '+columns+' FROM moderation_evidence WHERE ban_id=? ORDER BY created_at,id').bind(banId).all();return results;}
 return{list,handle:async request=>{
  const user=await identity(request,db);if(!user)return json({message:'Sign in first'},401);const url=new URL(request.url),origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
  const match=url.pathname.match(/^\/api\/cp\/evidence\/([0-9a-f-]{36})$/i);
  if(match&&request.method==='GET'){
   const evidence=await db.prepare('SELECT * FROM moderation_evidence WHERE id=?').bind(match[1]).first();if(!evidence||evidence.kind!=='file')return json({message:'Evidence not found'},404);
   const staff=await can(db,user,'web.bans.view');const ownAppeal=await db.prepare('SELECT a.id FROM moderation_appeals a JOIN support_tickets t ON t.id=a.ticket_id WHERE a.ban_id=? AND t.user_id=? LIMIT 1').bind(evidence.ban_id,user.id).first();
   if(!staff&&!ownAppeal)return json({message:'Evidence access denied'},403);if(!settings.EVIDENCE_DIR)return json({message:'Evidence storage unavailable'},503);
   if(!/^[a-f0-9-]{36}\.bin$/.test(evidence.file_key||''))return json({message:'Invalid evidence record'},503);
   try{return new Response(await readFile(join(resolve(settings.EVIDENCE_DIR),evidence.file_key)),{headers:{'Content-Type':evidence.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="'+evidence.file_name.replace(/[^a-zA-Z0-9_.-]/g,'_')+'"'}});}catch{return json({message:'Evidence file unavailable'},503);}
  }
  if(request.method!=='POST'||!await can(db,user,'web.bans.evidence'))return json({message:'Permission required: web.bans.evidence'},403);
  if(request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
  let banId,label,id=randomUUID(),values;
  if(url.pathname==='/api/cp/bans/evidence/link'){
   let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}banId=body.banId;label=body.label;let link;try{link=new URL(body.url);if(link.protocol!=='https:'||link.username||link.password||link.href.length>2000)throw Error();}catch{return json({message:'Use an HTTPS evidence link without embedded login details'},400);}
   values={kind:'link',fileName:null,mime:null,fileKey:null,url:link.href,hash:null};
  }else if(url.pathname==='/api/cp/bans/evidence/upload'){
   if(!settings.EVIDENCE_DIR)return json({message:'Private evidence storage is not configured'},503);let form;try{form=await request.formData();}catch{return json({message:'Invalid file upload'},400);}banId=form.get('banId');label=form.get('label');const file=form.get('file');
   if(!file||typeof file.arrayBuffer!=='function'||file.size<1||file.size>5*1024*1024)return json({message:'Upload an image or text log of up to 5 MB'},400);const bytes=Buffer.from(await file.arrayBuffer()),mime=evidenceMime(bytes,file.name);if(!mime)return json({message:'Only PNG, JPEG, WebP, .txt and .log evidence is accepted'},400);
   values={kind:'file',fileName:file.name.slice(0,120),mime,fileKey:id+'.bin',url:null,hash:createHash('sha256').update(bytes).digest('hex'),bytes};
  }else return json({message:'Not found'},404);
  if(typeof label!=='string'||label.trim().length<3||label.length>120)return json({message:'Give the evidence a label of 3–120 characters'},400);
  const ban=await db.prepare('SELECT id FROM moderation_bans WHERE id=?').bind(banId||'').first();if(!ban)return json({message:'Ban ID not found'},404);
  if(values.bytes){await mkdir(resolve(settings.EVIDENCE_DIR),{recursive:true,mode:0o700});await writeFile(join(resolve(settings.EVIDENCE_DIR),values.fileKey),values.bytes,{flag:'wx',mode:0o600});}
  await db.batch([db.prepare('INSERT INTO moderation_evidence(id,ban_id,kind,label,file_name,mime,file_key,link_url,sha256,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,ban.id,values.kind,label.trim(),values.fileName,values.mime,values.fileKey,values.url,values.hash,user.id,Date.now()),db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,'evidence-added',label.trim(),JSON.stringify({evidenceId:id,sha256:values.hash}),Date.now())]);return json({id,ok:true},201);
 }};
}
