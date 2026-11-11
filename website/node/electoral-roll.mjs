const houses={atreides:'House Aerdrecht',harkonnen:'House Harkveen',corrino:'House Korenholt',ordos:'House Oordwijk',fremen:'House Vrijduin',veiled_concord:'Veiled Concord'};
export function rollRow(r){return {username:r.username,election:(r.kind==='imperial'?'Emperor':houses[r.faction]||r.faction)+' · '+new Date(Number(r.election_start)).toISOString().slice(0,10)+' · Round '+(Number(r.round_number)+1),votes:Number(r.votes)};}
export async function votingHonour(db,userId,now=Date.now()){
 const row=await db.prepare(`SELECT MAX(r.closes_at) AS expires_at FROM political_election_rounds r
 WHERE r.status='open' AND r.opens_at<=? AND r.closes_at>?
 AND NOT EXISTS(SELECT 1 FROM political_election_rounds later WHERE later.kind=r.kind AND later.faction=r.faction AND later.election_start=r.election_start AND later.round_number>r.round_number)
 AND EXISTS(SELECT 1 FROM political_ballots b JOIN political_election_rounds original ON original.id=b.round_id JOIN political_voters v ON v.round_id=b.round_id AND v.player_uuid=b.player_uuid WHERE v.user_id=? AND original.kind=r.kind AND original.faction=r.faction AND original.election_start=r.election_start)
 `).bind(now,now,userId).first();
 return row?.expires_at?{rank:'i_voted',title:'I Voted',seal:'https://www.dunerealms.com/assets/seals/office-landsraad.png',citation:'My voice stands in the Electoral Roll. Temporary recognition for participating in the current election.',temporary:true,expiresAt:Number(row.expires_at)}:null;
}
export function createElectoralRoll(db){return async request=>{
 if(request.method!=='GET')return Response.json({message:'Method not allowed.'},{status:405});
 const q=new URL(request.url).searchParams,page=Number(q.get('page')||1),sort=q.get('sort')||'election';
 const orders={username:'username ASC,election_start DESC,round_number DESC',election:'election_start DESC,round_number DESC,username ASC',votes:'votes DESC,username ASC,election_start DESC'};
 if(!Number.isSafeInteger(page)||page<1||page>10000||!Object.hasOwn(orders,sort)||[...q.keys()].some(k=>!['page','sort'].includes(k)))return Response.json({message:'Invalid page or sort.'},{status:400});
 const base=`SELECT u.username,r.kind,r.faction,r.election_start,r.round_number,SUM(v.spent) AS votes FROM political_voters v JOIN political_election_rounds r ON r.id=v.round_id JOIN site_accounts u ON u.id=v.user_id WHERE v.spent>0 AND u.password_hash NOT LIKE '!%' GROUP BY u.id,u.username,r.id,r.kind,r.faction,r.election_start,r.round_number`;
 const total=Number((await db.prepare('SELECT COUNT(*) AS total FROM ('+base+') roll_count').first()).total);
 const {results}=await db.prepare(base+' ORDER BY '+orders[sort]+' LIMIT 50 OFFSET ?').bind((page-1)*50).all();
 return Response.json({rows:results.map(rollRow),page,pages:Math.max(1,Math.ceil(total/50)),total},{headers:{'Cache-Control':'no-store'}});
};}
