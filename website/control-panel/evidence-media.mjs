const limit=5*1024*1024;
export function evidenceMime(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
 if(bytes.toString('ascii',0,5)==='%PDF-')return 'application/pdf';
 if(bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp')return 'video/mp4';
 if(bytes.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'))&&bytes.subarray(0,256).includes(Buffer.from('webm')))return 'video/webm';
 return null;
}
export function evidenceFileResponse(request,bytes,name,inline=false){
 bytes=Buffer.from(bytes);const mime=evidenceMime(bytes)||'application/octet-stream';const safeInline=inline&&/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(mime);
 const headers={'Content-Type':mime,'Content-Disposition':(safeInline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Accept-Ranges':'bytes'};
 const range=request.headers.get('range');let start=0,end=bytes.length-1;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length}});if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end);}else start=Math.max(0,bytes.length-Number(m[2]));if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=bytes.length||end<start)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length}});headers['Content-Range']='bytes '+start+'-'+end+'/'+bytes.length;}
 headers['Content-Length']=String(end-start+1);return new Response(bytes.subarray(start,end+1),{status:range?206:200,headers});
}
const nativeJoins=" FROM native_ban_appeals n JOIN drsupport_thread t ON t.object_id=n.ticket_id AND t.object_type='T' JOIN drsupport_thread_entry e ON e.thread_id=t.id JOIN drsupport_attachment a ON a.object_id=e.id AND a.type='H' JOIN drsupport_file f ON f.id=a.file_id ";
export async function ticketEvidence(db,banId){const {results}=await db.prepare("SELECT a.id AS attachment_id,n.ticket_id,f.name AS file_name,f.type AS file_mime,f.size AS file_size,e.poster AS actor_name,e.staff_id,UNIX_TIMESTAMP(e.created)*1000 AS created_at"+nativeJoins+"WHERE n.ban_id=? ORDER BY e.created DESC,a.id DESC LIMIT 200").bind(banId).all();return results.map(r=>({...r,id:'ticket-'+r.attachment_id,title:r.file_name,notes:'Appeal attachment · '+(Number(r.staff_id)>0?'Staff':'Player')+' · Ticket #'+r.ticket_id,file_url:'/api/ban-evidence/file?nativeId='+encodeURIComponent(r.attachment_id)+'&banId='+encodeURIComponent(banId)}));}
export async function ticketEvidenceFile(db,banId,attachmentId){
 const row=await db.prepare('SELECT f.id AS file_id,f.name AS file_name,f.size AS file_size,f.bk'+nativeJoins+'WHERE n.ban_id=? AND a.id=? LIMIT 1').bind(banId,attachmentId).first();if(!row)return null;if(row.bk!=='D'||Number(row.file_size)>limit)return {unavailable:true};
 const {results}=await db.prepare('SELECT filedata FROM drsupport_file_chunk WHERE file_id=? ORDER BY chunk_id LIMIT 128').bind(row.file_id).all();let total=0;const parts=[];for(const r of results){const bytes=Buffer.from(r.filedata);total+=bytes.length;if(total>limit)return {unavailable:true};parts.push(bytes);}if(!total||total!==Number(row.file_size))return {unavailable:true};return {name:row.file_name,bytes:Buffer.concat(parts)};
}
