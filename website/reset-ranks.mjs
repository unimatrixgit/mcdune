import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openDatabase} from './node/mysql.mjs';
import {DEFAULT_RANKS,accessFor} from './node/permissions.mjs';
import {syncNativeAgents} from './node/native-agents.mjs';
const c=JSON.parse(readFileSync('/home/dunerealms/.config/integrations.json')),db=await openDatabase({DB_HOST:c.host,DB_USER:c.username,DB_PASSWORD:c.password,DB_NAME:c.database}),dir='/home/dunerealms/.config/dev-team-20261102';
try{
 const accounts=await db.query('SELECT id,username,role FROM site_accounts'),extra=await db.query('SELECT * FROM cp_account_ranks');
 const keep={unimatrix999:'owners',grmacken:'web_net_admin',richwjr:'web_network',dunerealms:'web_network',dev:'web_dev'};
 for(const name of Object.keys(keep))if(!accounts.some(a=>a.username===name))throw Error('Expected identity missing: '+name);
 try{writeFileSync(dir+'/before-owner-rank-reset.json',JSON.stringify({accounts,extra}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 const owner=accounts.find(a=>a.username==='unimatrix999'),actions=[];
 for(const key of ['owners','web_net_admin','web_network']){const r=DEFAULT_RANKS.find(r=>r.key===key);actions.push(db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=?').bind(JSON.stringify(r.nodes),key));}
 for(const a of accounts){const role=keep[a.username]||'user';if(a.role!==role){actions.push(db.prepare('UPDATE site_accounts SET role=? WHERE id=?').bind(role,a.id),db.prepare('DELETE FROM site_sessions WHERE user_id=?').bind(a.id),db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),owner.id,'owner-requested-rank-reset',a.username+': '+a.role+' -> '+role,Date.now()));}}
 // Remove secondary website-access assignments only. Earned game/political metadata and receipts are untouched.
 actions.push(db.prepare("DELETE ar FROM cp_account_ranks ar JOIN cp_ranks r ON r.rank_key=ar.rank_key WHERE r.kind='access'"));await db.batch(actions);
 await syncNativeAgents(db);
 const result=[];for(const a of await db.query('SELECT id,username,role FROM site_accounts')){const x=await accessFor(db,a);result.push({username:a.username,role:a.role,ranks:x.ranks,dev:x.nodes.includes('web.tickets.dev')});}
 console.log(JSON.stringify({accounts:result,secondaryAccessRows:await db.query("SELECT COUNT(*) n FROM cp_account_ranks ar JOIN cp_ranks r ON r.rank_key=ar.rank_key WHERE r.kind='access'"),gameLinksForDev:await db.query("SELECT COUNT(*) n FROM site_game_links l JOIN site_accounts a ON a.id=l.user_id WHERE a.username='dev'")},null,2));
}finally{await db.close();}
