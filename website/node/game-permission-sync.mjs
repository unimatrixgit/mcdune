import {randomUUID} from 'node:crypto';
import {accessFor,rankFor} from './permissions.mjs';
import {gameNodesForRank} from './game-ranks.mjs';
export async function syncGamePermissions(db,{settings=process.env,fetcher=fetch,access=user=>accessFor(db,user)}={}){
 if((settings.SERVER_CONTROL_TOKEN||'').length<64)throw Error('Game permission bridge unavailable');
 const {results:stored}=await db.prepare("SELECT rank_key FROM cp_ranks WHERE kind='access' AND rank_level>0 ORDER BY rank_key").all();const ranks=[];
 for(const row of stored){if(!/^[a-z][a-z0-9_]{2,29}$/.test(row.rank_key))throw Error('Rank cannot be projected to game');const rank=await rankFor(db,row.rank_key),game=await gameNodesForRank(db,rank);ranks.push({id:rank.key,permissions:Object.fromEntries(game.nodes.map(n=>[n,true]))});}
 const {results:accounts}=await db.prepare("SELECT a.id,a.username,a.role,l.minecraft_uuid FROM site_accounts a JOIN site_game_links l ON l.user_id=a.id WHERE a.password_hash NOT LIKE '!%' AND a.role<>'memorial' ORDER BY a.id").all();const users=[];
 for(const user of accounts){if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(user.minecraft_uuid))throw Error('Invalid verified identity');const rights=await access(user);users.push({uuid:user.minecraft_uuid.toLowerCase(),ranks:rights.ranks});}
 const revision=randomUUID(),r=await fetcher('http://127.0.0.1:15433/permissions/teams',{method:'POST',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({revision,actor:'website-sync',ranks,users}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Game permission synchronization unavailable');const d=await r.json();if(d.ok!==true||d.revision!==revision)throw Error('Game permission synchronization unconfirmed');
}
