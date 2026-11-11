import {votingHonour} from './electoral-roll.mjs';
import {randomUUID} from 'node:crypto';
import {accessFor} from './permissions.mjs';
import {nativeSyncChange} from './native-sync-outbox.mjs';
export const canAwardCrysknife=(actor,ranks=actor?.ranks||[])=>['unimatrix999','grmacken'].includes(actor?.username?.toLowerCase())||ranks.includes('crysknife');
export const CRYSKNIFE_SEAL='https://www.dunerealms.com/assets/seals/order-crysknife-v1.png';
export async function initializeHonours(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS site_honours(user_id CHAR(36) NOT NULL,rank_key VARCHAR(40) NOT NULL,citation TEXT NOT NULL,awarded_by CHAR(36) NOT NULL,updated_at BIGINT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(user_id,rank_key))').run();
}
export function validCitation(value){return typeof value==='string'&&Array.from(value).length<=2000&&value.split(/\r?\n/).length<=20&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);}
export async function honoursFor(db,user){
 let vote=null;try{vote=await votingHonour(db,user.id);}catch(error){if(!/no such table|doesn't exist/i.test(error.message))throw error;}
 const temporary=vote?[vote]:[];
 if(!(await accessFor(db,user)).ranks.includes('crysknife'))return temporary;
 let row=null;try{row=await db.prepare("SELECT citation,updated_at,version FROM site_honours WHERE user_id=? AND rank_key='crysknife'").bind(user.id).first();}catch(e){if(!/no such table|doesn't exist/i.test(e.message))throw e;}
 return [{rank:'crysknife',title:'Holy Order of The Crysknife',seal:CRYSKNIFE_SEAL,citation:row?.citation||'',version:Number(row?.version||0),updatedAt:Number(row?.updated_at||0)},...temporary];
}
export async function honourAction(db,actor,request,origin){
 const access=await accessFor(db,actor);
 if(!canAwardCrysknife(actor,access.ranks))return Response.json({message:'Only unimatrix999, grmacken and members of the Order may award the Crysknife.'},{status:403});
 if(request.method==='GET'&&new URL(request.url).searchParams.get('recipients')==='1'){
 const page=Number(new URL(request.url).searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>100000)return Response.json({message:'Invalid page.'},{status:400});
 const where="(a.role='crysknife' OR EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key='crysknife')) AND (a.password_hash NOT LIKE '!%' OR a.password_hash='!memorial') AND a.role<>'official_account'";
 const count=await db.prepare('SELECT COUNT(*) AS total FROM site_accounts a WHERE '+where).first();
 const {results}=await db.prepare("SELECT a.username,m.slug,EXISTS(SELECT 1 FROM site_game_links g WHERE g.user_id=a.id) AS linked FROM site_accounts a LEFT JOIN site_memorials m ON m.user_id=a.id WHERE "+where+" ORDER BY a.username LIMIT 9 OFFSET ?").bind((page-1)*9).all();
 return Response.json({recipients:results.map(r=>({username:r.username,profile:r.slug?'https://www.dunerealms.com/memorial/'+encodeURIComponent(r.slug):'https://www.dunerealms.com/people/'+encodeURIComponent(r.username),avatar:'/api/avatars/roster/'+encodeURIComponent(r.username),skin:!!Number(r.linked)})),page,pages:Math.max(1,Math.ceil(Number(count.total)/9)),total:Number(count.total)},{headers:{'Cache-Control':'no-store'}});
 }
 if(request.method==='GET'&&new URL(request.url).searchParams.get('candidates')==='1'){
 const {results}=await db.prepare("SELECT a.id,a.username,a.display_name FROM site_accounts a WHERE a.password_hash NOT LIKE '!%' AND a.role NOT IN ('crysknife','memorial','official_account') AND NOT EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key IN ('crysknife','memorial','official_account')) ORDER BY a.username").all();
 return Response.json({candidates:results},{headers:{'Cache-Control':'no-store'}});
 }
 const url=new URL(request.url);let body;
 if(request.method==='GET'){if([...url.searchParams.keys()].some(k=>k!=='userId'))return Response.json({message:'Invalid query.'},{status:400});body={userId:url.searchParams.get('userId')};}
 else {if(request.method!=='POST'||request.headers.get('origin')!==origin)return Response.json({message:'Origin rejected.'},{status:403});try{body=await request.json();}catch{return Response.json({message:'Invalid request.'},{status:400});}}
 if(typeof body?.userId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.userId))return Response.json({message:'Invalid account.'},{status:400});
 const target=await db.prepare('SELECT id,role FROM site_accounts WHERE id=?').bind(body.userId).first();
 if(!target)return Response.json({message:'Account not found.'},{status:404});
 const rights=await accessFor(db,target);
 if(body.action==='award')return awardCrysknife(db,actor,target,body);
 if(!rights.ranks.includes('crysknife'))return Response.json({message:'Assign the Crysknife rank first.'},{status:409});
 const honour=(await honoursFor(db,target))[0];
 if(request.method==='GET')return Response.json({honour},{headers:{'Cache-Control':'no-store'}});
 if(!validCitation(body.citation)||!Number.isSafeInteger(body.version)||body.version<0)return Response.json({message:'Use up to 20 lines and 2,000 characters.'},{status:400});
 if(body.version!==honour.version)return Response.json({message:'The citation changed. Refresh before saving.'},{status:409});
 const text=body.citation.replaceAll('\r\n','\n').trim();
 try{
 const statement=honour.version===0?db.prepare("INSERT INTO site_honours(user_id,rank_key,citation,awarded_by,updated_at,version) VALUES(?,'crysknife',?,?,?,1)").bind(target.id,text,actor.id,Date.now()):db.prepare("UPDATE site_honours SET citation=?,awarded_by=?,updated_at=?,version=version+1 WHERE user_id=? AND rank_key='crysknife' AND version=?").bind(text,actor.id,Date.now(),target.id,honour.version);
 const result=await db.batch([statement,db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),actor.id,'honour-citation',target.id+' crysknife',Date.now())]);
 if(!result[0].meta.changes)return Response.json({message:'The citation changed. Refresh.'},{status:409});
 }catch(e){if(e.code==='ER_DUP_ENTRY'||String(e.message).includes('UNIQUE'))return Response.json({message:'The citation changed. Refresh.'},{status:409});throw e;}
 return Response.json({ok:true,version:honour.version+1});
}
// Membership, citation and audit commit together. A stale/duplicate request cannot rewrite an award.
async function awardCrysknife(db,actor,target,body){
 if(body.confirmed!==true||!validCitation(body.citation)||!body.citation.trim())return Response.json({message:'Write an honour citation and check the confirmation box.'},{status:400});
 const now=Date.now();
 const grant=db.prepare("INSERT INTO cp_account_ranks(user_id,rank_key) SELECT a.id,'crysknife' FROM site_accounts a WHERE a.id=? AND a.password_hash NOT LIKE '!%' AND a.role NOT IN ('crysknife','memorial','official_account') AND NOT EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key IN ('crysknife','memorial','official_account')) AND EXISTS(SELECT 1 FROM site_accounts issuer WHERE issuer.id=? AND issuer.password_hash NOT LIKE '!%' AND (LOWER(issuer.username) IN ('unimatrix999','grmacken') OR issuer.role='crysknife' OR EXISTS(SELECT 1 FROM cp_account_ranks ir WHERE ir.user_id=issuer.id AND ir.rank_key='crysknife')))").bind(target.id,actor.id);
 try{await db.batch([{async run(c){const r=await grant.run(c);if(!r.meta.changes)throw Error('award-ineligible');return r;}},
 db.prepare("DELETE FROM site_honours WHERE user_id=? AND rank_key='crysknife'").bind(target.id),
 db.prepare("INSERT INTO site_honours(user_id,rank_key,citation,awarded_by,updated_at,version) VALUES(?,'crysknife',?,?,?,1)").bind(target.id,body.citation.replaceAll('\r\n','\n').trim(),actor.id,now),
 db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),actor.id,'crysknife-awarded',JSON.stringify({recipient:target.id,citation:body.citation.trim()}),now),nativeSyncChange(db)]);
 }catch(e){if(e.message==='award-ineligible'||e.code==='ER_DUP_ENTRY'||String(e.message).includes('UNIQUE'))return Response.json({message:'The recipient or your eligibility changed. Refresh the list.'},{status:409});throw e;}
 return Response.json({ok:true,message:'The Crysknife has been awarded. The citation is saved.',nativeSyncPending:true});
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function honourMarkup(honours=[],{showLore=true}={}){return honours.map(h=>'<section class="honour-panel" aria-label="'+esc(h.title)+'"><img src="'+esc(h.seal)+'" alt="'+esc(h.title)+' seal" width="130" height="130"><div><small>DUNEREALMS · '+(h.temporary?'ELECTION PARTICIPATION':'HONORARY ORDER')+'</small><h3>'+esc(h.title)+'</h3><p class="honour-citation">'+esc(h.citation||'Honoured member of the Order.')+'</p></div>'+(showLore&&!h.temporary?'<aside class="honour-stilgar"><img src="https://www.dunerealms.com/assets/stilgar-portrait-v1.png" alt="Minecraft-style portrait of Stilgar" width="180" height="180" loading="lazy"><blockquote>“As written!”</blockquote><cite>Stilgar · Dune: Part Two</cite><p>A blade. A bond. A legacy.</p><small>The Order remembers those who stand beside their community.</small></aside>':'')+'</section>').join('');}
export const HONOUR_CSS='.honour-panel>div{flex:1;min-width:0}.honour-panel .honour-stilgar{flex:0 0 180px;align-self:center;padding:12px;text-align:center;border:1px solid #dbc075;border-radius:12px;background:linear-gradient(145deg,#d7b75c44,#10332b 50%,#a98b3833);box-shadow:inset 0 0 0 3px #d4b46120,0 0 24px #bba45122}.honour-panel .honour-stilgar img{display:block;width:100%;height:auto;max-width:180px;border-radius:7px}.honour-stilgar blockquote{font:italic 1.25rem Georgia,serif;color:#f1d993;margin:12px 0 6px}.honour-stilgar cite{font-size:.7rem;color:#d3c999;font-style:normal}.honour-stilgar p{font-size:.85rem;color:#ead394}.honour-stilgar small{display:block;letter-spacing:normal!important;line-height:1.5;margin-top:8px}@media(max-width:800px){.honour-panel{flex-wrap:wrap}.honour-panel .honour-stilgar{flex-basis:180px;margin-left:auto;margin-right:auto}}.honour-panel{display:flex;align-items:center;gap:24px;padding:24px;margin:24px 0;border:1px solid #bc9c4d;border-radius:16px;background:linear-gradient(135deg,#102e29,#173f4e);box-shadow:inset 0 0 0 5px #c7a65115}.honour-panel img{width:130px;height:130px;object-fit:contain;flex-shrink:0}.honour-panel small{letter-spacing:.13em;color:#cfb874;font-size:.7rem}.honour-panel h3{color:#ead293;font-family:Georgia,serif;margin:8px 0}.honour-citation{white-space:pre-wrap;overflow-wrap:anywhere;color:#eee4cb}.honour-panel p{margin-bottom:0}@media(max-width:560px){.honour-panel{flex-direction:column;align-items:flex-start;padding:20px;gap:12px}}';

export const STILGAR_QUOTE_SOURCE='https://www.duneinfo.com/Content/files/dune-part-two-denis-villeneuve-jon-spaihts.pdf';
