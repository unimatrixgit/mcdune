export async function publicBanCards(db){

 const {results}=await db.prepare("SELECT id,source_key,player_name,banned_by,reason,scope,created_text,expires_text FROM moderation_bans WHERE active=1 AND scope<>'yousmp-legacy' AND source_key NOT LIKE 'demo:%' ORDER BY first_seen DESC,id DESC LIMIT 12").all();
 return Response.json({bans:results.map(({source_key,...ban})=>({...ban,demo:source_key.startsWith('demo:')}))},{headers:{'Cache-Control':'no-store'}});
}

const appealProjection="(SELECT CASE WHEN a.status IN ('approved','denied','approving') THEN a.status WHEN s.state='open' THEN 'pending' ELSE 'closed' END FROM native_ban_appeals a LEFT JOIN drsupport_ticket t ON t.ticket_id=a.ticket_id LEFT JOIN drsupport_ticket_status s ON s.id=t.status_id WHERE a.ban_id=moderation_bans.id ORDER BY a.opened_at DESC,a.id DESC LIMIT 1) AS appeal_status";
const publicRecord=b=>({id:b.id,player:b.player_name,issuedBy:/^(console|0)$/i.test(String(b.banned_by).trim())?'Network':b.banned_by,reason:b.reason,scope:b.scope==='network'?'Network':b.scope,issued:b.created_text,expires:b.expires_text,status:Number(b.active)===0?'Unbanned':'Active',appealStatus:['pending','approving'].includes(b.appeal_status)?'pending':['approved','denied'].includes(b.appeal_status)?b.appeal_status:null});
export async function publicAppealCards(db,request){
 const raw=Number(new URL(request.url).searchParams.get('page')||1),requested=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,100000):1;
 const where="scope<>'yousmp-legacy' AND source_key NOT LIKE 'demo:%' AND (SELECT a.status FROM native_ban_appeals a WHERE a.ban_id=moderation_bans.id ORDER BY a.opened_at DESC,a.id DESC LIMIT 1) IN ('approved','denied')";
 const total=Number((await db.prepare('SELECT COUNT(*) AS total FROM moderation_bans WHERE '+where).first())?.total||0),pages=Math.max(1,Math.ceil(total/6)),page=Math.min(requested,pages);
 const {results}=await db.prepare('SELECT id,player_name,banned_by,reason,scope,created_text,expires_text,active,'+appealProjection+' FROM moderation_bans WHERE '+where+' ORDER BY (SELECT MAX(a.decided_at) FROM native_ban_appeals a WHERE a.ban_id=moderation_bans.id) DESC,id DESC LIMIT 6 OFFSET '+((page-1)*6)).all();
 return Response.json({bans:results.map(publicRecord),page,pages,total,pageSize:6},{headers:{'Cache-Control':'no-store'}});
}
export async function publicBanList(db,request){
 const url=new URL(request.url),raw=Number(url.searchParams.get('page')||1),q=(url.searchParams.get('q')||'').trim().slice(0,80);
 const requested=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,100000):1;
 const where="(active=1 OR EXISTS (SELECT 1 FROM native_ban_appeals a WHERE a.ban_id=moderation_bans.id)) AND scope<>'yousmp-legacy' AND source_key NOT LIKE 'demo:%'"+(q?' AND (player_name LIKE ? OR reason LIKE ? OR scope LIKE ?)':'');
 const values=q?Array(3).fill('%'+q+'%'):[];
 const count=await db.prepare('SELECT COUNT(*) AS total FROM moderation_bans WHERE '+where).bind(...values).first();
 const total=Number(count?.total||0),pages=Math.max(1,Math.ceil(total/50)),page=Math.min(requested,pages);
 const {results}=await db.prepare('SELECT id,player_name,banned_by,reason,scope,created_text,expires_text,active,'+appealProjection+' FROM moderation_bans WHERE '+where+' ORDER BY REPLACE(created_text,\'T\',\' \') DESC,id DESC LIMIT 50 OFFSET '+((page-1)*50)).bind(...values).all();
 const bans=results.map(publicRecord);
 return Response.json({bans,page,pages,total,pageSize:50},{headers:{'Cache-Control':'no-store'}});
}

export async function publicAccountBans(db){const{results}=await db.prepare('SELECT reference,account_name,reason,issued_by,issued_at FROM account_ban_records ORDER BY issued_at DESC LIMIT 100').all();return Response.json({bans:results.map(r=>({...r,status:'Permanently banned',scope:'DuneRealms account and connected services',expires:'Never'}))},{headers:{'Cache-Control':'no-store'}});}
