import {readModerationResponse,evidenceDraftErrors} from './moderation-form-response.mjs';
const evidenceResponse=response=>readModerationResponse(response,{upload:true});
const dashboard=document.getElementById('dashboard');
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function mediaUrl(row){return row.file_url?.startsWith('/api/ban-evidence/file?')?row.file_url:'/api/ban-evidence/file?id='+encodeURIComponent(row.id);}
function appendEvidenceMedia(card,row){
 const type=row.file_mime||'';let media;
 if(['image/png','image/jpeg','image/webp','image/gif'].includes(type)){media=el('img');media.alt=row.title||row.file_name||'Evidence image';media.loading='lazy';}
 else if(['video/mp4','video/webm'].includes(type)){media=el('video');media.controls=true;media.preload='metadata';media.playsInline=true;media.append(el('p','Your browser cannot play this video. Use the download link.'));}
 if(media){media.className='evidence-media';media.src=mediaUrl(row)+'&inline=1';card.append(media);}
}
export async function renderEvidencePreview(host,banId,canAdd=false){
 host.className='evidence-panel';host.append(el('h3','Evidence'));const status=el('p','Loading private evidence…');status.setAttribute('role','status');host.append(status);
 const link=el('a',canAdd?'Add / manage evidence →':'Open evidence archive →');link.href='/?banId='+encodeURIComponent(banId)+'#ban-evidence';host.append(link);
 try{const response=await fetch('/api/ban-evidence?banId='+encodeURIComponent(banId)+'&page=0',{cache:'no-store'});const data=await evidenceResponse(response);if(!host.isConnected)return;if(!response.ok)throw Error(data.message||'Evidence could not be loaded.');
 data.evidence=[...data.evidence,...(data.ticketEvidence||[])].sort((a,b)=>Number(b.created_at)-Number(a.created_at));status.textContent=data.evidence.length?'Private staff evidence · '+data.evidence.length+' record'+(data.evidence.length===1?'':'s')+(data.hasMore?' on this page':''):'No evidence has been added to this ban yet.';
 for(const row of data.evidence){const card=el('article');card.className='evidence-entry';appendEvidenceMedia(card,row);card.append(el('h4',row.title),el('small',(row.actor_name||'Staff member')+' · '+new Date(Number(row.created_at)).toLocaleString()));if(row.notes){const notes=el('p',row.notes);notes.className='evidence-notes';card.append(notes);}if(row.source_url&&row.source_url.startsWith('https://')){const a=el('a','Open source ↗');a.href=row.source_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}if(row.file_name){const a=el('a','Download '+row.file_name+' · '+Math.ceil(Number(row.file_size)/1024)+' KB');a.href=mediaUrl(row);card.append(a);}host.append(card);}
 }catch(error){if(host.isConnected)status.textContent=error.message;}
}
if(dashboard){
 const css=el('link');css.rel='stylesheet';css.href='/ban-evidence.css';document.head.append(css);
 const section=el('section');section.id='ban-evidence';section.className='ban-evidence';section.hidden=true;
 const back=el('a','← Back to bans & appeals');back.href='#bans';
 const hero=el('header');hero.className='evidence-hero';const crest=el('img');crest.src='https://www.dunerealms.com/assets/nav-support-v2.webp';crest.alt='';crest.width=72;crest.height=72;
 const heading=el('div');heading.append(el('p','IMPERIAL MODERATION ARCHIVE'),el('h2','Ban evidence'),el('p','Private staff records · retained with the original ban'));hero.append(crest,heading);
 const notice=el('p');notice.setAttribute('role','status');const facts=el('div');facts.className='evidence-facts';
 const grid=el('div');grid.className='evidence-layout';const compose=el('article');compose.className='evidence-panel';compose.append(el('h3','Add evidence'),el('p','Add context, a source link or an attachment. Saved evidence is retained; it does not change or remove the ban.'));
 const form=el('form'),title=el('input'),notes=el('textarea'),source=el('input'),file=el('input');title.required=true;title.minLength=3;title.maxLength=120;title.name='title';notes.maxLength=10000;notes.rows=7;notes.name='notes';source.type='url';source.placeholder='https://';source.maxLength=2000;source.name='source';file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/webm';file.name='attachment';
 for(const [label,input]of [['Evidence title',title],['Notes / context',notes],['Source link (optional)',source],['Attachment (optional, maximum 5 MB)',file]]){const l=el('label',label);l.append(input);form.append(l);}
 form.append(el('small','PNG, JPEG, WebP, GIF, PDF, MP4 or WebM. Attachments require staff access to download. Do not include passwords or unrelated personal information.'));
 const submit=el('button','Save evidence');submit.type='submit';const result=el('p');result.setAttribute('role','status');form.append(submit,result);compose.append(form);
 const archive=el('article');archive.className='evidence-panel';archive.append(el('h3','Evidence history'));const list=el('div');list.className='evidence-history';const pages=el('div');pages.className='evidence-pages';archive.append(list,pages);grid.append(compose,archive);section.append(back,hero,notice,facts,grid);dashboard.append(section);
 let allowed=false,serial=0,requestId=crypto.randomUUID(),canAdd=false,page=0,saveAttempt=null;
 const banId=()=>new URL(location.href).searchParams.get('banId');
 const active=()=>location.hash==='#ban-evidence';
 function reset(){for(const field of [title,notes,source,file]){field.value='';field.setCustomValidity('');}requestId=crypto.randomUUID();}
 async function load(){
  if(!active()||!allowed)return;const current=++serial;notice.textContent='Loading the private evidence record…';facts.replaceChildren();list.replaceChildren();compose.hidden=true;
  try{const r=await fetch('/api/ban-evidence?banId='+encodeURIComponent(banId()||'')+'&page='+page,{cache:'no-store'}),data=await evidenceResponse(r);if(current!==serial)return;if(!r.ok)throw Error(data.message||'Evidence could not be loaded.');
   for(const [label,value]of [['Player',data.ban.player_name],['Scope',data.ban.scope],['Ban ID',data.ban.id],['Status',data.ban.active?'Active':'Retained history']]){const card=el('div');card.append(el('small',label),el('strong',value));facts.append(card);}
   const reason=el('p',data.ban.reason);reason.className='evidence-reason';facts.append(reason);canAdd=data.canAdd;compose.hidden=!canAdd;
   data.evidence=[...data.evidence,...(data.ticketEvidence||[])].sort((a,b)=>Number(b.created_at)-Number(a.created_at));   notice.textContent='Staff access only · '+data.evidence.length+' evidence record'+(data.evidence.length===1?'':'s')+' · Page '+(data.page+1);pages.replaceChildren();if(data.page>0){const prev=el('button','← Newer evidence');prev.type='button';prev.onclick=()=>{page--;load();};pages.append(prev);}if(data.hasMore){const next=el('button','Older evidence →');next.type='button';next.onclick=()=>{page++;load();};pages.append(next);}
   if(!data.evidence.length)list.append(el('p','No evidence has been added to this ban yet.'));
   for(const row of data.evidence){const entry=el('article');entry.className='evidence-entry';appendEvidenceMedia(entry,row);entry.append(el('h4',row.title),el('small',(row.actor_name||'Staff member')+' · '+new Date(Number(row.created_at)).toLocaleString()));if(row.notes){const text=el('p',row.notes);text.className='evidence-notes';entry.append(text);}if(row.source_url){const a=el('a','Open source ↗');a.href=row.source_url;a.target='_blank';a.rel='noopener noreferrer';entry.append(a);}if(row.file_name){const a=el('a','Download '+row.file_name+' · '+Math.ceil(Number(row.file_size)/1024)+' KB');a.href=mediaUrl(row);entry.append(a,el('small','SHA-256: '+row.file_sha256));}list.append(entry);}
  }catch(e){if(current===serial)notice.textContent=e.message;}
 }
 const fields={title,notes,source,file};
 function validateDraft(){for(const field of Object.values(fields))field.setCustomValidity('');const errors=evidenceDraftErrors({title:title.value,notes:notes.value,sourceUrl:source.value,file:file.files[0]});for(const[key,message]of Object.entries(errors))fields[key].setCustomValidity(message);return form.reportValidity();}
 form.onsubmit=async event=>{
  event.preventDefault();if(!canAdd||!allowed||saveAttempt||!validateDraft())return;
  const current=serial,id=banId(),attempt={current},snapshot={id:requestId,banId:id,title:title.value,notes:notes.value,sourceUrl:source.value},attachment=file.files[0];saveAttempt=attempt;for(const field of [...Object.values(fields),submit])field.disabled=true;result.textContent='Saving evidence…';
  try{let upload=null;
   if(attachment){const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Attachment could not be read. Your form has been kept.'));reader.readAsDataURL(attachment);});upload={name:attachment.name,base64:encoded};}
   if(current!==serial||!active()||!allowed)return;
   const r=await fetch('/api/ban-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,file:upload}),cache:'no-store'}),data=await evidenceResponse(r);if(current!==serial)return;if(!r.ok||data.ok!==true||data.id!==snapshot.id)throw Error(data.message||'Evidence was not confirmed. Your form has been kept; refresh the history before retrying.');reset();page=0;result.textContent='Evidence saved and added to the audit history.';await load();
  }catch(e){if(current===serial)result.textContent=e.message||'Evidence could not be saved. Your form has been kept.';}finally{if(saveAttempt===attempt){saveAttempt=null;for(const field of [...Object.values(fields),submit])field.disabled=false;}}
 };
 for(const input of Object.values(fields))input.addEventListener('input',()=>{requestId=crypto.randomUUID();for(const field of Object.values(fields))field.setCustomValidity('');});
 function session(user){serial++;saveAttempt=null;for(const field of [...Object.values(fields),submit])field.disabled=false;page=0;allowed=!!user?.permissions?.includes('web.menu.bans')&&user.permissions.includes('web.bans.view');canAdd=false;reset();result.textContent='';notice.textContent='';pages.replaceChildren();facts.replaceChildren();list.replaceChildren();compose.hidden=true;section.hidden=!allowed||!active();if(allowed&&active())load();}
 window.addEventListener('dune:session',e=>session(e.detail));window.addEventListener('hashchange',()=>{serial++;section.hidden=!allowed||!active();if(active())load();});window.addEventListener('dune:page',()=>{section.hidden=!allowed||!active();if(active())load();});
 const bootstrapSerial=serial;fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(bootstrapSerial===serial)session(d?.user);}).catch(()=>{if(bootstrapSerial===serial)session(null);});
}
