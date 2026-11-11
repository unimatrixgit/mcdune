import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import {openDatabase} from './node/mysql.mjs';
import {DEFAULT_RANKS} from './node/permissions.mjs';
import {provisionGitIdentity} from './node/git-identity.mjs';
const dir='/home/dunerealms/.config/dev-team-20261102',c=JSON.parse(readFileSync('/home/dunerealms/.config/integrations.json'));
const db=await openDatabase({DB_HOST:c.host,DB_USER:c.username,DB_PASSWORD:c.password,DB_NAME:c.database});
try{
 const ranks=await db.query('SELECT * FROM cp_ranks');
 if(!ranks.some(r=>r.rank_key==='owners'))throw Error('Owner rank missing');
 try{writeFileSync(dir+'/before-ranks.json',JSON.stringify({ranks,accounts:await db.query('SELECT id,username,role FROM site_accounts'),extra:await db.query('SELECT * FROM cp_account_ranks')}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 const devRank=DEFAULT_RANKS.find(r=>r.key==='web_dev');if(!devRank)throw Error('Dev rank source not installed');
 const old=ranks.find(r=>r.rank_key==='web_dev');if(old&&old.label!=='Dev Team')throw Error('Existing Dev rank collision');
 await db.prepare('INSERT INTO cp_ranks(rank_key,label,rank_level,kind,permissions_json,version) VALUES(?,?,?,?,?,1) ON CONFLICT(rank_key) DO UPDATE SET rank_key=excluded.rank_key').bind(devRank.key,devRank.label,devRank.level,devRank.kind,JSON.stringify(devRank.nodes)).run();
 for(const r of ranks.filter(r=>['owners','corestaff','web_network','web_net_admin'].includes(r.rank_key))){const nodes=JSON.parse(r.permissions_json);if(!nodes.includes('web.tickets.dev'))await db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify([...nodes,'web.tickets.dev']),r.rank_key,r.version).run();}
 let account=await db.prepare("SELECT * FROM site_accounts WHERE username='dev'").first();
 if(account&&account.role!=='web_dev')throw Error('Dev account already exists with a different role; no takeover');
 if(!account){const password=randomBytes(48).toString('base64url'),salt=randomBytes(16).toString('hex'),id=randomUUID(),now=Date.now();await db.batch([db.prepare('INSERT INTO site_accounts(id,username,display_name,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,'dev','Dev',salt,scryptSync(password,salt,64).toString('hex'),'web_dev',now),db.prepare('INSERT INTO player_profiles(user_id,display_name,minecraft_name,discord_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,'Dev','','',now,now)]);writeFileSync(dir+'/dev-login.json',JSON.stringify({username:'dev',password}),{mode:0o600,flag:'wx'});account=await db.prepare("SELECT * FROM site_accounts WHERE username='dev'").first();}
 await db.prepare('INSERT INTO site_account_policies(user_id,service_uuid,game_link_exempt) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET game_link_exempt=1').bind(account.id,'00000000-0000-4000-8000-00000000de01').run();
 const git=await provisionGitIdentity(db,account,{});console.log(JSON.stringify({devId:account.id,git,protectedRanks:['owners','corestaff','web_network','web_net_admin'],otherRolesChanged:false}));
}finally{await db.close();}
