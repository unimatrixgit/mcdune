import {randomUUID} from 'node:crypto';
import {electionWindow} from './public/election-rules.mjs';
import {planRoundResult} from './election-ballots.mjs';
export const roundSchema=[
 `CREATE TABLE IF NOT EXISTS political_election_rounds(id CHAR(36) PRIMARY KEY,kind VARCHAR(16) NOT NULL,faction VARCHAR(32) NOT NULL,election_start BIGINT NOT NULL,round_number INTEGER NOT NULL,opens_at BIGINT NOT NULL,closes_at BIGINT NOT NULL,status VARCHAR(32) NOT NULL,winner_id CHAR(36),UNIQUE KEY election_round(kind,faction,election_start,round_number)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_round_candidates(round_id CHAR(36) NOT NULL,application_id CHAR(36) NOT NULL,PRIMARY KEY(round_id,application_id)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_round_events(id CHAR(36) PRIMARY KEY,round_id CHAR(36) NOT NULL,event VARCHAR(32) NOT NULL,payload TEXT NOT NULL,created_at BIGINT NOT NULL,UNIQUE KEY round_event(round_id,event)) ENGINE=InnoDB`
];
export async function initializeRounds(db){for(const sql of roundSchema)await db.prepare(sql).run();}
export async function openFirstRound(db,{kind,faction,start,now=Date.now(),makeId=randomUUID}){
 const window=electionWindow(kind,start,now);if(window.phase==='applications')throw Error('Voting has not started');
 if(kind==='imperial')faction='imperium';
 if(!/^[a-z_]{1,32}$/.test(faction||''))throw Error('Verified faction required');
 const opens=Date.parse(window.votingOpens),closes=Date.parse(window.votingCloses);
 const [result]=await db.batch([{async run(connection){
  const query=async(sql,args=[])=>(await connection.execute(sql,args))[0];
  await query('INSERT INTO political_election_rounds(id,kind,faction,election_start,round_number,opens_at,closes_at,status) VALUES(?,?,?,?,0,?,?,?) ON DUPLICATE KEY UPDATE kind=VALUES(kind)',[makeId(),kind,faction,opens,opens,closes,'building']);
  const [round]=await query('SELECT * FROM political_election_rounds WHERE kind=? AND faction=? AND election_start=? AND round_number=0 FOR UPDATE',[kind,faction,opens]);
  if(round.status==='building'){
   await query("INSERT INTO political_round_candidates(round_id,application_id) SELECT ?,id FROM political_applications WHERE kind=? AND faction=? AND election_start=? AND status='submitted' AND created_at<?",[round.id,kind,faction,opens,opens]);
   await query("UPDATE political_election_rounds SET status='open' WHERE id=?",[round.id]);
   await query('INSERT INTO political_round_events(id,round_id,event,payload,created_at) VALUES(?,?,?,?,?)',[makeId(),round.id,'opened',JSON.stringify({kind,faction,opensAt:opens,closesAt:closes}),now]);
  }
  return {...round,status:round.status==='building'?'open':round.status};
 }}]);return result;
}
export async function finalizeRound(db,{roundId,now=Date.now(),makeId=randomUUID}){
 const [result]=await db.batch([{async run(connection){
  const query=async(sql,args=[])=>(await connection.execute(sql,args))[0];
  const [round]=await query('SELECT * FROM political_election_rounds WHERE id=? FOR UPDATE',[roundId]);
  if(!round)throw Error('Unknown election round');
  if(round.status!=='open')return{status:round.status,winner:round.winner_id,replayed:true};
  if(now<Number(round.closes_at))throw Error('Voting round has not closed');
  const totals=await query('SELECT c.application_id AS id,COALESCE(SUM(a.votes),0) AS votes FROM political_round_candidates c LEFT JOIN political_ballots b ON b.round_id=c.round_id LEFT JOIN political_ballot_allocations a ON a.ballot_id=b.id AND a.application_id=c.application_id WHERE c.round_id=? GROUP BY c.application_id',[round.id]);
  const outcome=planRoundResult({kind:round.kind,start:new Date(Number(round.election_start)).toISOString(),round:Number(round.round_number),candidates:totals.map(row=>({...row,votes:Number(row.votes)}))},now);
  let nextRoundId=null;
  if(outcome.nextRound){
   nextRoundId=makeId();const next=outcome.nextRound;
   await query('INSERT INTO political_election_rounds(id,kind,faction,election_start,round_number,opens_at,closes_at,status) VALUES(?,?,?,?,?,?,?,?)',[nextRoundId,round.kind,round.faction,round.election_start,next.round,next.opensAt,next.closesAt,'open']);
   for(const id of next.candidateIds)await query('INSERT INTO political_round_candidates(round_id,application_id) VALUES(?,?)',[nextRoundId,id]);
   await query('INSERT INTO political_round_events(id,round_id,event,payload,created_at) VALUES(?,?,?,?,?)',[makeId(),nextRoundId,'opened',JSON.stringify({previousRound:round.id,candidateIds:next.candidateIds,opensAt:next.opensAt,closesAt:next.closesAt}),now]);
  }
  await query('UPDATE political_election_rounds SET status=?,winner_id=? WHERE id=?',[outcome.status,outcome.winner,round.id]);
  await query('INSERT INTO political_round_events(id,round_id,event,payload,created_at) VALUES(?,?,?,?,?)',[makeId(),round.id,'closed',JSON.stringify({...outcome,nextRoundId}),now]);
  return{...outcome,nextRoundId,replayed:false};
 }}]);return result;
}
