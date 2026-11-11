import {ELECTION_RULES} from '../control-panel/public/election-rules.mjs';
// Election authority is derived at request time, never from a stale cosmetic rank.
export async function electionAuthority(db,{userId,playerUuid,faction,now=Date.now()}){
 const result={};
 for(const kind of ['house','imperial']){
  const first=Date.parse(ELECTION_RULES[kind].first),period=ELECTION_RULES[kind].weeks*604800000;
  if(now<first+10800000){result[kind]={managed:false};continue;}
  const electionStart=first+Math.floor((now-first)/period)*period;
  result[kind]={managed:true,verified:true,active:false,expiresAt:null};
  if(!userId||!playerUuid||kind==='house'&&!faction)continue;
  try{
   const term=await db.prepare("SELECT t.user_id,t.player_uuid,t.kind,t.faction,t.election_start,t.starts_at,t.expires_at,t.outcome FROM political_office_terms t JOIN site_game_links l ON l.user_id=t.user_id AND LOWER(l.minecraft_uuid)=t.player_uuid JOIN site_accounts a ON a.id=t.user_id WHERE t.kind=? AND t.faction=? AND t.election_start=? AND t.user_id=? AND t.player_uuid=? AND t.outcome='winner' AND t.starts_at<=? AND t.expires_at>? AND a.password_hash NOT LIKE '!%' LIMIT 1").bind(kind,kind==='house'?faction:'imperium',electionStart,userId,playerUuid.toLowerCase(),now,now).first();
   if(term&&term.kind===kind&&term.faction===(kind==='house'?faction:'imperium')&&term.user_id===userId&&term.player_uuid===playerUuid.toLowerCase()&&Number(term.election_start)===electionStart&&term.outcome==='winner'&&Number(term.starts_at)<=now&&Number(term.expires_at)>now)result[kind]={managed:true,verified:true,active:true,expiresAt:Number(term.expires_at)};
  }catch{result[kind]={managed:true,verified:false,active:false,expiresAt:null};}
 }
 return result;
}
