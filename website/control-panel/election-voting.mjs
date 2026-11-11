import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {createPoliticsPreview} from './politics-preview.mjs';
import {ELECTION_RULES,imperialVoteAllowance} from './public/election-rules.mjs';
import {openFirstRound,finalizeRound} from './election-rounds.mjs';
import {castBallot} from './election-ballots.mjs';
const houses=['atreides','harkonnen','corrino','ordos','fremen'];
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export function cycleStart(kind,now){const rule=ELECTION_RULES[kind];if(!rule)throw Error('Unknown election');const first=Date.parse(rule.first),period=rule.weeks*604800000;return first+Math.max(0,Math.floor((now-first)/period))*period;}
export async function advanceElection(db,kind,faction,now=Date.now()){
 const start=cycleStart(kind,now);if(now<start)return null;
 await openFirstRound(db,{kind,faction,start:new Date(start).toISOString(),now});
 for(let step=0;step<12;step++){
  const round=await db.prepare('SELECT * FROM political_election_rounds WHERE kind=? AND faction=? AND election_start=? ORDER BY round_number DESC LIMIT 1').bind(kind,faction,start).first();
  if(round.status!=='open'||Number(round.closes_at)>now)return round;
  await finalizeRound(db,{roundId:round.id,now});
 }
 throw Error('Election round reconciliation requires attention');
}
export function startElectionClock(db,{clock=Date.now,onError=()=>console.error('Election clock failed')}={}){
 let busy=false,stopped=false;
 const tick=async()=>{if(busy||stopped)return;busy=true;try{const now=clock();for(const faction of houses)await advanceElection(db,'house',faction,now);await advanceElection(db,'imperial','imperium',now);}catch(error){onError(error);}finally{busy=false;}};
 const timer=setInterval(tick,15000);timer.unref?.();void tick();return()=>{stopped=true;clearInterval(timer);};
}
export function createElectionVoting(db,settings={},deps={}){
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin,auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u)),clock=deps.clock||Date.now;
 const linked=deps.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 const excluded=deps.excluded||(async u=>!!await db.prepare("SELECT a.id FROM site_accounts a WHERE a.id=? AND (a.role IN ('official_account','memorial') OR a.password_hash LIKE '!%' OR EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key IN ('official_account','memorial')) OR EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=a.id AND p.game_link_exempt=1))").bind(u.id).first());
 const preview=deps.preview||createPoliticsPreview(db,settings),advance=deps.advance||advanceElection,cast=deps.cast||castBallot;
 return async request=>{
  const url=new URL(request.url),kind=url.pathname.split('/').at(-1);
  if(!ELECTION_RULES[kind]||url.search)return reply({message:'Unknown election.'},400);
  if(!['GET','POST'].includes(request.method))return reply({message:'Method not allowed.'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply({message:'Invalid request origin.'},403);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const permitted=async u=>(await access(u)).nodes.includes('web.menu.game')&&!await excluded(u);
  if(!await permitted(user))return reply({message:'A personal player account is required.'},403);
  const player=await linked(user);if(!player)return reply({message:'Link your Minecraft account first.'},403);
  const response=await preview(new Request(origin+'/api/politics/preview',{headers:request.headers}));if(!response.ok)return reply({message:'Faction verification unavailable.'},503);
  const verified=await response.json(),current=await auth(request);
  if(!current||current.id!==user.id||!await permitted(current)||(await linked(current))?.toLowerCase()!==player.toLowerCase())return reply({message:'Account access changed. Refresh.'},403);
  if(!verified.linked||verified.factionStatus!=='verified'||!houses.includes(verified.faction))return reply({message:'Verified faction membership required.'},403);
  if(kind==='imperial'&&verified.officeStatus!=='verified')return reply({message:'Current office could not be verified. No votes have been spent.'},503);
  const context={linked:true,playerUuid:player,faction:verified.faction,houseLeader:verified.houseLeader===true},faction=kind==='house'?context.faction:'imperium',now=clock(),start=cycleStart(kind,now);
  const round=await advance(db,kind,faction,now);
  if(request.method==='POST'){
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply({message:'JSON required.'},415);
   const raw=await request.text();if(raw.length>6000)return reply({message:'Ballot too large.'},413);
   let input;try{input=JSON.parse(raw);}catch{return reply({message:'Invalid ballot.'},400);}
   if(!round||round.status!=='open'||input?.kind!==kind||input.roundId!==round.id)return reply({message:'Voting is not open for this round.'},409);
   try{return reply({ballot:await cast(db,{actor:current,context,input,now,clock})});}catch{return reply({message:'Vote not accepted. Refresh to check your remaining votes and the current round.'},409);}
  }
  let candidates;
  if(round){const result=await db.prepare('SELECT a.id,a.public_id,a.motivation,u.username,COALESCE(SUM(v.votes),0) AS votes FROM political_round_candidates c JOIN political_applications a ON a.id=c.application_id JOIN site_accounts u ON u.id=a.user_id LEFT JOIN political_ballots b ON b.round_id=c.round_id LEFT JOIN political_ballot_allocations v ON v.ballot_id=b.id AND v.application_id=a.id WHERE c.round_id=? GROUP BY a.id,a.public_id,a.motivation,u.username ORDER BY votes DESC,u.username ASC').bind(round.id).all();candidates=result.results;}
  else {const result=await db.prepare("SELECT a.id,a.public_id,a.motivation,u.username,0 AS votes FROM political_applications a JOIN site_accounts u ON u.id=a.user_id WHERE a.kind=? AND a.faction=? AND a.election_start=? AND a.status='submitted' ORDER BY u.username").bind(kind,faction,start).all();candidates=result.results;}
  const voter=round?await db.prepare('SELECT capacity,spent FROM political_voters WHERE player_uuid=? AND round_id=?').bind(player.toLowerCase(),round.id).first():null;
  const capacity=kind==='house'?1:imperialVoteAllowance(context),remaining=voter?Math.max(0,Math.min(capacity,Number(voter.capacity))-Number(voter.spent)):capacity;
  return reply({kind,faction,start:new Date(start).toISOString(),round:round?{id:round.id,number:Number(round.round_number),status:round.status,opensAt:Number(round.opens_at),closesAt:Number(round.closes_at),winnerId:round.winner_id}:null,remaining,candidates:candidates.map(c=>({...c,votes:Number(c.votes)}))});
 };
}
