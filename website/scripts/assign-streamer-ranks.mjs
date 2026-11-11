import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../node/mysql.mjs';
import {initializeRanks,accessFor} from '../node/permissions.mjs';
import {syncNativeAgents} from '../node/native-agents.mjs';
const c=JSON.parse(readFileSync('/home/dunerealms/.config/integrations.json'));
const db=await openDatabase({DB_HOST:c.host,DB_USER:c.username,DB_PASSWORD:c.password,DB_NAME:c.database});
try{
 await initializeRanks(db);
 const owner=await db.prepare("SELECT id,role FROM site_accounts WHERE username='unimatrix999'").first();if(owner?.role!=='owners')throw Error('Retained Owner missing');
 for(const name of ['itsmrsui','unimatrix999']){
  const account=await db.prepare('SELECT id,username,role FROM site_accounts WHERE username=?').bind(name).first();if(!account)throw Error('Requested account missing');
  await db.batch([
   db.prepare("INSERT INTO cp_account_ranks(user_id,rank_key) VALUES(?,'web_streamer') ON CONFLICT(user_id,rank_key) DO UPDATE SET user_id=excluded.user_id").bind(account.id),
   db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),owner.id,'streamer-rank-assigned',name+' + web_streamer',Date.now())
  ]);
  console.log(name+': '+(await accessFor(db,account)).label);
 }
 await syncNativeAgents(db);
}finally{await db.close();}
