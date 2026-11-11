import {randomUUID} from 'node:crypto';
import {ELECTION_RULES,electionWindow} from './public/election-rules.mjs';
export const officeLedgerSchema=[
 `CREATE TABLE IF NOT EXISTS political_office_terms(id CHAR(36) PRIMARY KEY,kind VARCHAR(16) NOT NULL,faction VARCHAR(32) NOT NULL,election_start BIGINT NOT NULL,round_id CHAR(36) NOT NULL UNIQUE,application_id CHAR(36),user_id CHAR(36),player_uuid CHAR(36),office VARCHAR(32) NOT NULL,starts_at BIGINT NOT NULL,expires_at BIGINT NOT NULL,outcome VARCHAR(16) NOT NULL,streak INTEGER NOT NULL,UNIQUE KEY office_cycle(kind,faction,election_start)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_office_locks(scope VARCHAR(64) PRIMARY KEY) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_office_events(id CHAR(36) PRIMARY KEY,term_id CHAR(36) NOT NULL,event VARCHAR(32) NOT NULL,payload TEXT NOT NULL,created_at BIGINT NOT NULL,UNIQUE KEY term_event(term_id,event)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_election_honours(player_uuid CHAR(36) NOT NULL,kind VARCHAR(16) NOT NULL,faction VARCHAR(32) NOT NULL,title VARCHAR(128) NOT NULL,term_id CHAR(36) NOT NULL,earned_at BIGINT NOT NULL,PRIMARY KEY(player_uuid,kind,faction)) ENGINE=InnoDB`
];
export async function initializeOfficeLedger(db){for(const sql of officeLedgerSchema)await db.prepare(sql).run();}
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function planOfficeTerm(round,application,previous,now){
 if(!['winner','no_votes'].includes(round.status))throw Error('A final election result is required');
 const start=Number(round.election_start),closed=Number(round.closes_at),period=ELECTION_RULES[round.kind]?.weeks*604800000;
 electionWindow(round.kind,new Date(start).toISOString(),now);
 if(!Number.isFinite(closed)||closed<start+10800000||now<closed)throw Error('Election has not closed');
 if(!/^[a-z_]{1,32}$/.test(round.faction)||round.kind==='imperial'&&round.faction!=='imperium')throw Error('Invalid office scope');
 if(previous&&Number(previous.election_start)>=start)throw Error('Process office results in chronological order');
 const office=round.kind==='imperial'?'emperor':round.faction==='veiled_concord'?'reverent_mother':'house_leader';
 let userId=null,playerUuid=null,streak=0;
 if(round.status==='winner'){
  if(!application||application.id!==round.winner_id||application.kind!==round.kind||application.faction!==round.faction||Number(application.election_start)!==start||!uuid.test(application.user_id)||!uuid.test(application.player_uuid))throw Error('Winner identity does not match election');
  userId=application.user_id;playerUuid=application.player_uuid.toLowerCase();
  streak=previous&&Number(previous.election_start)===start-period&&previous.player_uuid===playerUuid&&previous.outcome==='winner'?Number(previous.streak)+1:1;
 }
 const title=office==='emperor'?'Emperor Emeritus of the Three Crowns':office==='reverent_mother'?'Grand Matriarch of the Veil':'High Lord of the Three Banners';
 return {kind:round.kind,faction:round.faction,electionStart:start,office,userId,playerUuid,applicationId:round.status==='winner'?application.id:null,startsAt:closed,expiresAt:start+period,outcome:round.status,streak,honour:streak>=3?title:null};
}
// This ledger records election facts only. It never edits account roles, game offices or paid/earned ranks.
export async function reconcileOfficeResult(db,{roundId,now=Date.now(),makeId=randomUUID}){
 const [result]=await db.batch([{async run(connection){
  const q=async(sql,args=[])=>(await connection.execute(sql,args))[0];
  const [round]=await q('SELECT * FROM political_election_rounds WHERE id=?',[roundId]);
  if(!round||!['winner','no_votes'].includes(round.status))throw Error('Final result unavailable');
  const scope=round.kind+':'+round.faction;
  await q('INSERT INTO political_office_locks(scope) VALUES(?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',[scope]);
  await q('SELECT scope FROM political_office_locks WHERE scope=? FOR UPDATE',[scope]);
  const [existing]=await q('SELECT * FROM political_office_terms WHERE kind=? AND faction=? AND election_start=? FOR UPDATE',[round.kind,round.faction,round.election_start]);
  if(existing){if(existing.round_id!==round.id)throw Error('Conflicting final result');return {id:existing.id,replayed:true};}
  const [previous]=await q('SELECT * FROM political_office_terms WHERE kind=? AND faction=? ORDER BY election_start DESC LIMIT 1 FOR UPDATE',[round.kind,round.faction]);
  const [application]=round.winner_id?await q('SELECT * FROM political_applications WHERE id=?',[round.winner_id]):[];
  const term=planOfficeTerm(round,application,previous,now),id=makeId();
  await q('INSERT INTO political_office_terms(id,kind,faction,election_start,round_id,application_id,user_id,player_uuid,office,starts_at,expires_at,outcome,streak) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,term.kind,term.faction,term.electionStart,round.id,term.applicationId,term.userId,term.playerUuid,term.office,term.startsAt,term.expiresAt,term.outcome,term.streak]);
  await q('INSERT INTO political_office_events(id,term_id,event,payload,created_at) VALUES(?,?,?,?,?)',[makeId(),id,'result_recorded',JSON.stringify(term),now]);
  if(term.honour)await q('INSERT IGNORE INTO political_election_honours(player_uuid,kind,faction,title,term_id,earned_at) VALUES(?,?,?,?,?,?)',[term.playerUuid,term.kind,term.faction,term.honour,id,term.startsAt]);
  return {id,replayed:false,...term};
 }}]);return result;
}
export function startOfficeLedger(db,{clock=Date.now,onError=()=>console.error('Election office ledger reconciliation failed')}={}){
 let busy=false,stopped=false;
 const tick=async()=>{if(busy||stopped)return;busy=true;try{
  const now=clock();if(now<Date.parse(ELECTION_RULES.house.first))return;
  const rows=await db.prepare("SELECT r.id FROM political_election_rounds r LEFT JOIN political_office_terms t ON t.round_id=r.id WHERE r.status IN ('winner','no_votes') AND r.closes_at<=? AND t.id IS NULL ORDER BY r.election_start,r.round_number LIMIT 100").bind(now).all();
  for(const r of rows.results)await reconcileOfficeResult(db,{roundId:r.id,now});
 }catch(error){onError(error);}finally{busy=false;}};
 const timer=setInterval(tick,15000);timer.unref?.();void tick();return()=>{stopped=true;clearInterval(timer);};
}
