// Explicit operator-run migration for the approved network leadership structure.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../node/mysql.mjs';
import {DEFAULT_RANKS,initializeRanks,accessFor} from '../node/permissions.mjs';
import {syncNativeAgents} from '../node/native-agents.mjs';
const c=JSON.parse(readFileSync('/home/dunerealms/.config/integrations.json'));
const db=await openDatabase({DB_HOST:c.host,DB_USER:c.username,DB_PASSWORD:c.password,DB_NAME:c.database});
try{
 await initializeRanks(db);
 const {results:accounts}=await db.prepare('SELECT id,username,role FROM site_accounts').all();
 const owner=accounts.find(a=>a.username==='unimatrix999');if(owner?.role!=='owners')throw Error('Verified retained Owner is missing');
 const mapping={dunerealms:'web_network',grmacken:'web_net_admin',richwjr:'web_network'};
 if(Object.keys(mapping).some(name=>!accounts.some(a=>a.username===name)))throw Error('Expected account missing');
 const unknownOwners=accounts.filter(a=>a.role==='owners'&&a.username!=='unimatrix999'&&!mapping[a.username]);if(unknownOwners.length)throw Error('Unexpected Owner requires review');
 const {results:extra}=await db.prepare('SELECT user_id,rank_key FROM cp_account_ranks').all();
 writeFileSync('/root/network-leadership-before-'+Date.now()+'.json',JSON.stringify({accounts,extra}),{mode:0o600});
 const actions=[];
 for(const key of ['web_network','web_net_admin']){const rank=DEFAULT_RANKS.find(r=>r.key===key);actions.push(db.prepare('UPDATE cp_ranks SET label=?,rank_level=?,permissions_json=?,version=version+1 WHERE rank_key=?').bind(rank.label,rank.level,JSON.stringify(rank.nodes),key));}
 for(const account of accounts){
  if(mapping[account.username]){
   actions.push(db.prepare('UPDATE site_accounts SET role=? WHERE id=?').bind(mapping[account.username],account.id));
   actions.push(db.prepare("DELETE FROM cp_account_ranks WHERE user_id=? AND rank_key IN ('owners','web_network','web_net_admin')").bind(account.id));
   actions.push(db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(account.id));
   actions.push(db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),owner.id,'network-rank-migration',account.username+' -> '+mapping[account.username],Date.now()));
  }
 }
 actions.push(db.prepare("DELETE FROM cp_account_ranks WHERE rank_key='owners' AND user_id<>?").bind(owner.id));
 await db.batch(actions);
 await syncNativeAgents(db);
 const {results:after}=await db.prepare('SELECT id,username,role FROM site_accounts').all();
 for(const account of after){const access=await accessFor(db,account);if(access.ranks.includes('owners')&&account.username!=='unimatrix999')throw Error('Unexpected remaining Owner');if(mapping[account.username]||account.username==='unimatrix999')console.log(account.username+': '+access.label);}
}finally{await db.close();}
