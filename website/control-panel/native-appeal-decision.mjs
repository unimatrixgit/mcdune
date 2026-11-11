import {randomUUID} from 'node:crypto';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function decideNativeAppeal(db,settings,{user,access,ban,body,fetcher=fetch}){
 if(!['web.bans.manage','web.tickets.staff','web.tickets.appeals'].every(node=>access.nodes.includes(node)))return json({message:'Appeal decision permission required.'},403);
 if(!['approve','deny','reopen'].includes(body.action)||!Number.isSafeInteger(Number(body.ticketId))||Number(body.ticketId)<1||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500||/[\x00-\x1f]/.test(body.reason))return json({message:'Choose an action and enter a single-line reason of 5–500 characters.'},400);
 const appeal=await db.prepare('SELECT * FROM native_ban_appeals WHERE ban_id=? AND ticket_id=?').bind(ban.id,Number(body.ticketId)).first();
 if(!appeal)return json({message:'The ticket is not linked to this ban.'},404);
 const now=Date.now(),reason=body.reason.trim(),demo=ban.source_key.startsWith('demo:');
 const conflict=()=>Object.assign(new Error('Appeal changed during decision'),{appealConflict:true});
 const checked=statement=>({async run(connection){const result=await statement.run(connection);if(Number(result.meta.changes)!==1)throw conflict();return result;}});
 const commit=async statements=>{try{await db.batch(statements);return true;}catch(error){if(error.appealConflict)return false;throw error;}};
 const changed=()=>json({message:'The appeal changed during this decision. Refresh to review its status.'},409);
 const audit=(action)=>db.prepare('INSERT INTO moderation_events(id,ban_id,actor_id,action,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').bind(randomUUID(),ban.id,user.id,action,reason,JSON.stringify({ticketId:Number(body.ticketId),demo}),now);
 if(body.action==='reopen'){
  if(appeal.status==='approving')return json({message:'Approval is in progress; retry that decision first.'},409);
  if(appeal.status==='pending')return json({ok:true,status:'pending',replayed:true});
  if(!await commit([checked(db.prepare("UPDATE native_ban_appeals SET status='pending',decision_reason=NULL,decided_by=NULL,decided_at=NULL WHERE id=? AND status=?").bind(appeal.id,appeal.status)),audit('appeal-reopened')]))return changed();return json({ok:true,status:'pending'});
 }
 const target=body.action==='approve'?'approved':'denied';
 if(appeal.status===target)return json({ok:true,status:target,replayed:true});
 if(!['pending','closed',...(body.action==='approve'?['approving']:[])].includes(appeal.status))return json({message:'This appeal already has a different decision. Reopen it before deciding again.'},409);
 if(body.action==='approve'){
  if(appeal.status!=='approving'){
   const claimed=await db.prepare("UPDATE native_ban_appeals SET status='approving' WHERE id=? AND status IN ('pending','closed')").bind(appeal.id).run();
   if(!claimed.meta.changes)return json({message:'Another staff action changed this appeal. Refresh first.'},409);
  }
  if(!demo){
   try{
    const response=await fetcher('http://127.0.0.1:15433/bans/action',{method:'POST',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({key:ban.native_key,action:'remove',created:ban.created_text,actor:user.username,reason}),signal:AbortSignal.timeout(18000)});
    const confirmed=await response.json();if(!response.ok||confirmed.confirmed!==true||confirmed.absent!==true||confirmed.key!==ban.native_key)throw Error('Removal unconfirmed');
   }catch{
    await db.prepare("UPDATE native_ban_appeals SET status='pending' WHERE id=? AND status='approving'").bind(appeal.id).run();await audit('appeal-approval-unconfirmed').run();return json({message:'The game host did not confirm ban removal. The appeal remains pending; no approval was recorded.'},503);
   }
  }
 }
 const expected=body.action==='approve'?'approving':appeal.status;
 const committed=await commit([checked(db.prepare('UPDATE native_ban_appeals SET status=?,decision_reason=?,decided_by=?,decided_at=? WHERE id=? AND status=?').bind(target,reason,user.username,now,appeal.id,expected)),...(body.action==='approve'&&!demo?[db.prepare('UPDATE moderation_bans SET active=0,updated_at=? WHERE id=?').bind(now,ban.id)]:[]),audit('appeal-'+target+(demo?'-demo':''))]);
 if(!committed)return changed();
 return json({ok:true,status:target,demo,banRemoved:body.action==='approve'&&!demo});
}
