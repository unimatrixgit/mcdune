import {randomUUID} from 'node:crypto';
import {electionWindow,imperialVoteAllowance} from './public/election-rules.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validateBallot(input,context,now=Date.now(),roundWindow=null){
 if(!input||!uuid.test(input.requestId||'')||!['house','imperial'].includes(input.kind)||input.confirmed!==true)throw Error('Confirm your definitive vote');
 if(!context?.linked||!context.faction||!uuid.test(context.playerUuid||''))throw Error('Verified faction membership required');
 const window=electionWindow(input.kind,input.start,now);if(roundWindow)window.phase=now>=Number(roundWindow.opens_at)&&now<Number(roundWindow.closes_at)?'voting':'closed';if(window.phase!=='voting')throw Error('Voting is not open');
 const capacity=input.kind==='house'?1:imperialVoteAllowance(context);
 if(!Array.isArray(input.allocations)||!input.allocations.length||input.allocations.length>capacity)throw Error('Choose eligible candidates');
 const seen=new Set();let total=0;
 const allocations=input.allocations.map(a=>{if(!a||!uuid.test(a.applicationId||'')||seen.has(a.applicationId.toLowerCase())||!Number.isInteger(a.votes)||a.votes<1||a.votes>capacity)throw Error('Invalid vote allocation');seen.add(a.applicationId.toLowerCase());total+=a.votes;return{applicationId:a.applicationId.toLowerCase(),votes:a.votes};}).sort((a,b)=>a.applicationId.localeCompare(b.applicationId));
 if(total>capacity)throw Error('Vote allowance exceeded');
 return {kind:input.kind,start:Date.parse(window.votingOpens),faction:input.kind==='house'?context.faction:'imperium',capacity,total,allocations,requestId:input.requestId.toLowerCase()};
}
export const ballotSchema=[
 `CREATE TABLE IF NOT EXISTS political_voters (round_id CHAR(36) NOT NULL,player_uuid CHAR(36) NOT NULL,kind VARCHAR(16) NOT NULL,election_start BIGINT NOT NULL,user_id CHAR(36) NOT NULL,faction VARCHAR(32) NOT NULL,capacity INTEGER NOT NULL,spent INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(player_uuid,round_id)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_ballots (id CHAR(36) PRIMARY KEY,round_id CHAR(36) NOT NULL,request_id CHAR(36) NOT NULL,player_uuid CHAR(36) NOT NULL,kind VARCHAR(16) NOT NULL,election_start BIGINT NOT NULL,payload TEXT NOT NULL,created_at BIGINT NOT NULL,UNIQUE KEY voter_request(player_uuid,request_id)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_ballot_allocations (ballot_id CHAR(36) NOT NULL,application_id CHAR(36) NOT NULL,votes INTEGER NOT NULL,PRIMARY KEY(ballot_id,application_id)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS political_ballot_events (id CHAR(36) PRIMARY KEY,ballot_id CHAR(36) NOT NULL UNIQUE,actor_id CHAR(36) NOT NULL,event VARCHAR(32) NOT NULL,created_at BIGINT NOT NULL) ENGINE=InnoDB`
];
export async function initializeBallots(db){for(const sql of ballotSchema)await db.prepare(sql).run();}
// Private append-only repository. Never expose player_uuid or audit rows to candidates.
// Not yet mounted: runoff scheduling and result finalization remain separate work.
export async function castBallot(db,{actor,context,input,now=Date.now(),clock=Date.now,makeId=randomUUID}){
 if(!actor?.id)throw Error('Authenticated voter required');
 if(!uuid.test(input?.roundId||'')||!uuid.test(context?.playerUuid||''))throw Error('Verified election round required');
 const player=context.playerUuid.toLowerCase();
 const [result]=await db.batch([{async run(connection){
  const query=async(sql,args=[])=>(await connection.execute(sql,args))[0];
  const [round]=await query('SELECT * FROM political_election_rounds WHERE id=? FOR UPDATE',[input.roundId]);
  if(!round||round.kind!==input.kind||Number(round.election_start)!==Date.parse(input.start)||round.faction!==(input.kind==='house'?context.faction:'imperium')||round.status!=='open')throw Error('Election round is not open');
  const vote=validateBallot(input,context,clock(),round),payload=JSON.stringify({kind:vote.kind,start:vote.start,roundId:round.id,allocations:vote.allocations});
  await query('INSERT INTO political_voters(round_id,player_uuid,kind,election_start,user_id,faction,capacity,spent) VALUES(?,?,?,?,?,?,?,0) ON DUPLICATE KEY UPDATE player_uuid=VALUES(player_uuid)',[round.id,player,vote.kind,vote.start,actor.id,context.faction,vote.capacity]);
  const [voter]=await query('SELECT user_id,faction,capacity,spent FROM political_voters WHERE player_uuid=? AND round_id=? FOR UPDATE',[player,round.id]);
  if(voter.user_id!==actor.id||voter.faction!==context.faction)throw Error('Voter identity or faction changed');
  const [link]=await query('SELECT minecraft_uuid FROM site_game_links WHERE user_id=? FOR UPDATE',[actor.id]);if(link?.minecraft_uuid?.toLowerCase()!==player)throw Error('Linked account changed');
  const [previous]=await query('SELECT id,payload FROM political_ballots WHERE player_uuid=? AND request_id=?',[player,vote.requestId]);
  if(previous){if(previous.payload!==payload)throw Error('Submission identifier already used');return{id:previous.id,created:false,remaining:Number(voter.capacity)-Number(voter.spent)};}
  validateBallot(input,context,clock(),round);
  // Allowance is captured at the first successful ballot; later changes cannot
  // manufacture additional votes. A lower current allowance also prevents spending.
  const available=Math.min(Number(voter.capacity),vote.capacity)-Number(voter.spent);if(vote.total>available)throw Error('No sufficient votes remain');
  for(const allocation of vote.allocations){
   const [entry]=await query('SELECT application_id FROM political_round_candidates WHERE round_id=? AND application_id=?',[round.id,allocation.applicationId]);if(!entry)throw Error('Candidate is not in this round');
   const [candidate]=await query('SELECT kind,faction,election_start,status FROM political_applications WHERE id=? FOR UPDATE',[allocation.applicationId]);
   if(!candidate||candidate.kind!==vote.kind||Number(candidate.election_start)!==vote.start||candidate.faction!==vote.faction||candidate.status!=='submitted')throw Error('Candidate is not eligible for this election');
  }
  const id=makeId();
  await query('INSERT INTO political_ballots(id,round_id,request_id,player_uuid,kind,election_start,payload,created_at) VALUES(?,?,?,?,?,?,?,?)',[id,round.id,vote.requestId,player,vote.kind,vote.start,payload,now]);
  for(const a of vote.allocations)await query('INSERT INTO political_ballot_allocations(ballot_id,application_id,votes) VALUES(?,?,?)',[id,a.applicationId,a.votes]);
  await query('UPDATE political_voters SET spent=spent+? WHERE player_uuid=? AND round_id=?',[vote.total,player,round.id]);
  await query('INSERT INTO political_ballot_events(id,ballot_id,actor_id,event,created_at) VALUES(?,?,?,?,?)',[makeId(),id,actor.id,'vote_received',now]);
  return{id,created:true,remaining:Number(voter.capacity)-Number(voter.spent)-vote.total};
 }}]);return result;
}
// A tie is never broken by UUID/name/order. A runoff must be held instead.
export function electionOutcome(candidates){
 const rows=candidates.filter(c=>Number.isSafeInteger(c.votes)&&c.votes>0);
 if(!rows.length)return{status:'no_votes',winner:null,runoff:[]};
 const high=Math.max(...rows.map(c=>c.votes)),leaders=rows.filter(c=>c.votes===high).map(c=>c.id).sort();
 return leaders.length===1?{status:'winner',winner:leaders[0],runoff:[]}:{status:'runoff_required',winner:null,runoff:leaders};
}
export function planRoundResult({kind,start,round=0,candidates},now=Date.now()){
 if(!Number.isSafeInteger(round)||round<0||round>1000)throw Error('Invalid election round');
 const base=electionWindow(kind,start,now),opens=Date.parse(base.votingOpens)+round*10800000,closes=opens+10800000;
 if(now<closes)throw Error('Voting round has not closed');
 const result=electionOutcome(candidates);
 return {...result,round,opensAt:opens,closesAt:closes,nextRound:result.status==='runoff_required'?{round:round+1,opensAt:closes,closesAt:closes+10800000,candidateIds:result.runoff}:null};
}
