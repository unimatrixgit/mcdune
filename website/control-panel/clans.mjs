import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
class Conflict extends Error {}
const checked=statement=>({async run(connection){const result=await statement.run(connection);if(!result.meta.changes)throw new Conflict('The clan changed. Refresh and try again.');return result;}});
export const CLAN_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS site_clans (id CHAR(36) PRIMARY KEY,name VARCHAR(40) NOT NULL,name_key VARCHAR(80) NOT NULL UNIQUE,tag VARCHAR(6) NOT NULL UNIQUE,description TEXT NOT NULL,owner_id CHAR(36) NOT NULL,active INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,FOREIGN KEY(owner_id) REFERENCES site_accounts(id))`,
 `CREATE TABLE IF NOT EXISTS site_clan_members (user_id CHAR(36) PRIMARY KEY,minecraft_uuid CHAR(36) NULL UNIQUE,clan_id CHAR(36) NOT NULL,clan_role VARCHAR(12) NOT NULL,joined_at BIGINT NOT NULL,FOREIGN KEY(user_id) REFERENCES site_accounts(id),FOREIGN KEY(clan_id) REFERENCES site_clans(id))`,
 `CREATE TABLE IF NOT EXISTS site_clan_requests (clan_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,status VARCHAR(12) NOT NULL,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,decided_by CHAR(36) DEFAULT NULL,PRIMARY KEY(clan_id,user_id),FOREIGN KEY(clan_id) REFERENCES site_clans(id),FOREIGN KEY(user_id) REFERENCES site_accounts(id))`
];
export async function initializeClans(db,{mysql=true}={}){for(const sql of CLAN_SCHEMA)await db.prepare(sql+(mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4':'')).run();}

/** Website clan membership only; never grants a website staff rank or claims game synchronization. */
export function createClans(db,{origin='https://cp.dunerealms.com',authenticate=request=>identity(request,db),access=user=>accessFor(db,user),onClanCreated=async()=>{},onClanDeleted=async()=>{}}={}){
 const membership=id=>db.prepare('SELECT clan_id,clan_role FROM site_clan_members WHERE user_id=?').bind(id).first();
 const clan=id=>db.prepare('SELECT id,name,tag,description,owner_id,version,created_at,updated_at FROM site_clans WHERE id=? AND active=1').bind(id).first();
 const publicClan=row=>{const {owner_id,...safe}=row;return safe;};
 return async request=>{
  const url=new URL(request.url),match=url.pathname.match(/^\/api\/clans(?:\/([a-f0-9-]{36}))?$/i);
  if(!match)return json({message:'Not found'},404);
  if(!['GET','POST'].includes(request.method))return json({message:'Method not allowed'},405);
  const user=await authenticate(request);if(!user)return json({message:'Sign in to use the Clan Center.'},401);
  const rights=await access(user);if(!rights.nodes.includes('web.menu.game'))return json({message:'Game account access is required.'},403);
  const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first(),linked=!!link?.minecraft_uuid;
  const own=await membership(user.id);
  if(request.method==='GET'){
   if(!match[1]){
    const {results}=await db.prepare('SELECT c.id,c.name,c.tag,c.description,c.version,c.created_at,(SELECT COUNT(*) FROM site_clan_members m WHERE m.clan_id=c.id) AS member_count FROM site_clans c WHERE c.active=1 ORDER BY c.name_key,c.id LIMIT 500').all();
    const {results:applications}=await db.prepare("SELECT r.clan_id,r.status,c.name,c.tag FROM site_clan_requests r JOIN site_clans c ON c.id=r.clan_id WHERE r.user_id=? AND r.status='pending' AND c.active=1 ORDER BY r.created_at DESC").bind(user.id).all();
    return json({clans:results,membership:own,applications,linked,username:user.username});
   }
   const record=await clan(match[1]);if(!record)return json({message:'Clan not found.'},404);
   const {results:members}=await db.prepare("SELECT a.username,m.clan_role,m.joined_at FROM site_clan_members m JOIN site_accounts a ON a.id=m.user_id WHERE m.clan_id=? ORDER BY CASE m.clan_role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,a.username").bind(record.id).all();
   const role=own?.clan_id===record.id?own.clan_role:null,canReview=linked&&['owner','officer'].includes(role);
   const requests=canReview?(await db.prepare("SELECT a.username,r.created_at FROM site_clan_requests r JOIN site_accounts a ON a.id=r.user_id WHERE r.clan_id=? AND r.status='pending' ORDER BY r.created_at,a.username").bind(record.id).all()).results:[];
   return json({clan:publicClan(record),members,requests,role,canReview,canManage:linked&&role==='owner',linked});
  }
  if(request.headers.get('origin')!==origin)return json({message:'Request origin rejected.'},403);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request.'},400);}
  if(!body||typeof body!=='object')return json({message:'Invalid request.'},400);
  const action=body.action,now=Date.now();
  if(!['create','request','withdraw','review','role','remove','transfer','leave','edit','archive'].includes(action))return json({message:'Unknown clan action.'},400);
  if(!linked&&!['leave','withdraw'].includes(action))return json({message:'Link your Minecraft account before creating, joining or managing a clan.'},403);
  const audit=(clanId,detail)=>db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'clan-'+action,JSON.stringify({clanId,...detail}),now);
  function fields(){
   const name=typeof body.name==='string'?body.name.normalize('NFKC').trim().replace(/\s+/g,' '):'',tag=typeof body.tag==='string'?body.tag.trim().toUpperCase():'',description=typeof body.description==='string'?body.description.trim():'';
   if(!/^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]{2,39}$/u.test(name)||!(/^[A-Z0-9]{2,6}$/).test(tag)||description.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(description))return null;
   return {name,nameKey:name.toLowerCase(),tag,description};
  }
  try{
   if(action==='create'){
    if(own)return json({message:'Leave your current clan before creating another.'},409);
    const data=fields();if(!data)return json({message:'Use a clan name of 3–40 letters/numbers, a tag of 2–6 letters/numbers, and a description up to 1,000 characters.'},400);
    const recent=await db.prepare("SELECT COUNT(*) AS total FROM account_audit WHERE actor_id=? AND action='clan-create' AND created_at>?").bind(user.id,now-86400000).first();if(Number(recent.total)>=3)return json({message:'You can create at most three clans in 24 hours.'},429);
    const id=randomUUID();await db.batch([
     db.prepare('INSERT INTO site_clans(id,name,name_key,tag,description,owner_id,active,version,created_at,updated_at) VALUES(?,?,?,?,?,?,1,1,?,?)').bind(id,data.name,data.nameKey,data.tag,data.description,user.id,now,now),
     db.prepare("INSERT INTO site_clan_members(user_id,minecraft_uuid,clan_id,clan_role,joined_at) VALUES(?,?,?,'owner',?)").bind(user.id,link.minecraft_uuid,id,now),audit(id,{tag:data.tag})
    ]);await onClanCreated({id,name:data.name,tag:data.tag}).catch(()=>console.error('Clan mailbox creation pending reconciliation'));return json({ok:true,clanId:id},201);
   }
   if(!uuid(body.clanId)||!Number.isSafeInteger(body.version)||body.version<1)return json({message:'Choose a current clan record and refresh before submitting.'},400);
   const record=await clan(body.clanId);if(!record)return json({message:'Clan not found.'},404);
   const role=own?.clan_id===record.id?own.clan_role:null;
   const lock=()=>{
    const restricted=action==='review'?" AND EXISTS (SELECT 1 FROM site_clan_members guard_member WHERE guard_member.clan_id=site_clans.id AND guard_member.user_id=? AND guard_member.clan_role IN ('owner','officer'))":action==='leave'?" AND EXISTS (SELECT 1 FROM site_clan_members guard_member WHERE guard_member.clan_id=site_clans.id AND guard_member.user_id=? AND guard_member.clan_role IN ('officer','member'))":['edit','archive','role','remove','transfer'].includes(action)?" AND owner_id=? AND EXISTS (SELECT 1 FROM site_clan_members guard_member WHERE guard_member.clan_id=site_clans.id AND guard_member.user_id=? AND guard_member.clan_role='owner')":'';
    const args=[now,record.id,body.version];if(restricted)args.push(user.id);if(['edit','archive','role','remove','transfer'].includes(action))args.push(user.id);
    return checked(db.prepare('UPDATE site_clans SET version=version+1,updated_at=? WHERE id=? AND active=1 AND version=?'+restricted).bind(...args));
   };
   if(action==='request'){
    if(own)return json({message:'You already belong to a clan.'},409);
    const pending=await db.prepare("SELECT COUNT(*) AS total FROM site_clan_requests WHERE user_id=? AND status='pending'").bind(user.id).first();if(Number(pending.total)>=10)return json({message:'Withdraw an existing request before applying to another clan.'},429);
    const prior=await db.prepare('SELECT status FROM site_clan_requests WHERE clan_id=? AND user_id=?').bind(record.id,user.id).first();if(prior?.status==='pending')return json({message:'Your join request is already pending.'},409);
    await db.batch([lock(),db.prepare("INSERT INTO site_clan_requests(clan_id,user_id,status,created_at,updated_at) VALUES(?,?,'pending',?,?) ON CONFLICT(clan_id,user_id) DO UPDATE SET status='pending',updated_at=excluded.updated_at,decided_by=NULL").bind(record.id,user.id,now,now),audit(record.id,{})]);
   }else if(action==='withdraw'){
    await db.batch([lock(),checked(db.prepare("UPDATE site_clan_requests SET status='withdrawn',updated_at=? WHERE clan_id=? AND user_id=? AND status='pending'").bind(now,record.id,user.id)),audit(record.id,{})]);
   }else if(action==='leave'){
    if(!role)return json({message:'You are not a member of this clan.'},403);
    if(role==='owner')return json({message:'Transfer ownership or archive the clan before leaving.'},409);
    await db.batch([lock(),checked(db.prepare('DELETE FROM site_clan_members WHERE clan_id=? AND user_id=?').bind(record.id,user.id)),audit(record.id,{})]);
   }else if(action==='review'){
    if(!['owner','officer'].includes(role))return json({message:'Only this clan’s owner and officers can review requests.'},403);
    if(!['accept','decline'].includes(body.decision)||typeof body.target!=='string')return json({message:'Choose a pending request and decision.'},400);
    const target=await db.prepare("SELECT r.user_id,a.id,a.username,a.role FROM site_clan_requests r JOIN site_accounts a ON a.id=r.user_id WHERE r.clan_id=? AND a.username=? AND r.status='pending'").bind(record.id,body.target).first();if(!target)return json({message:'Pending request not found.'},404);
    const statements=[lock(),checked(db.prepare("UPDATE site_clan_requests SET status=?,updated_at=?,decided_by=? WHERE clan_id=? AND user_id=? AND status='pending'").bind(body.decision==='accept'?'accepted':'declined',now,user.id,record.id,target.user_id))];
    if(body.decision==='accept'){
     const targetLink=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(target.user_id).first();if(!targetLink)return json({message:'The applicant must link Minecraft before acceptance.'},409);
     if(!(await access(target)).nodes.includes('web.menu.game'))return json({message:'The applicant no longer has game account access.'},409);
     statements.push(db.prepare("INSERT INTO site_clan_members(user_id,minecraft_uuid,clan_id,clan_role,joined_at) VALUES(?,?,?,'member',?)").bind(target.user_id,targetLink.minecraft_uuid,record.id,now),db.prepare("UPDATE site_clan_requests SET status='withdrawn',updated_at=? WHERE user_id=? AND status='pending' AND clan_id<>?").bind(now,target.user_id,record.id));
    }
    statements.push(audit(record.id,{target:body.target,decision:body.decision}));await db.batch(statements);
   }else{
    if(role!=='owner'||record.owner_id!==user.id)return json({message:'Only this clan’s owner can perform that action.'},403);
    if(action==='edit'){
     const data=fields();if(!data)return json({message:'Enter a valid clan name, tag and description.'},400);
     await db.batch([lock(),db.prepare('UPDATE site_clans SET name=?,name_key=?,tag=?,description=? WHERE id=?').bind(data.name,data.nameKey,data.tag,data.description,record.id),audit(record.id,{tag:data.tag})]);
    }else if(action==='archive'){
     if(body.confirmTag!==record.tag)return json({message:'Type the clan tag to confirm archiving.'},400);
     await db.batch([lock(),db.prepare('UPDATE site_clans SET active=0 WHERE id=?').bind(record.id),db.prepare('DELETE FROM site_clan_members WHERE clan_id=?').bind(record.id),db.prepare("UPDATE site_clan_requests SET status='closed',updated_at=? WHERE clan_id=? AND status='pending'").bind(now,record.id),audit(record.id,{tag:record.tag})]);
     await onClanDeleted(record).catch(()=>console.error('Clan mailbox removal pending reconciliation'));
    }else{
     if(typeof body.target!=='string')return json({message:'Choose a clan member.'},400);
     const target=await db.prepare('SELECT m.user_id,m.clan_role FROM site_clan_members m JOIN site_accounts a ON a.id=m.user_id WHERE m.clan_id=? AND a.username=?').bind(record.id,body.target).first();if(!target)return json({message:'Clan member not found.'},404);
     if(target.user_id===user.id)return json({message:'Use transfer ownership or leave for your own membership.'},409);
     const statements=[lock()];
     if(action==='role'){
      if(!['officer','member'].includes(body.role))return json({message:'Choose Officer or Member.'},400);
      statements.push(checked(db.prepare('UPDATE site_clan_members SET clan_role=? WHERE clan_id=? AND user_id=?').bind(body.role,record.id,target.user_id)));
     }else if(action==='remove')statements.push(checked(db.prepare('DELETE FROM site_clan_members WHERE clan_id=? AND user_id=?').bind(record.id,target.user_id)));
     else if(action==='transfer')statements.push(checked(db.prepare("UPDATE site_clan_members SET clan_role='officer' WHERE clan_id=? AND user_id=?").bind(record.id,user.id)),checked(db.prepare("UPDATE site_clan_members SET clan_role='owner' WHERE clan_id=? AND user_id=?").bind(record.id,target.user_id)),db.prepare('UPDATE site_clans SET owner_id=? WHERE id=?').bind(target.user_id,record.id));
     statements.push(audit(record.id,{target:body.target,role:body.role||null}));await db.batch(statements);
    }
   }
   return json({ok:true,clanId:record.id});
  }catch(error){
   if(error instanceof Conflict)return json({message:error.message},409);
   if(error.code==='ER_DUP_ENTRY'||/UNIQUE constraint|duplicate entry/i.test(error.message))return json({message:'That clan name/tag is reserved, or the player already belongs to a clan. Refresh before retrying.'},409);
   throw error;
  }
 };
}
