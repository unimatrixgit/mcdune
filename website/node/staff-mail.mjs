import {accessFor,DEFAULT_RANKS} from './permissions.mjs';
import {callMailBroker} from './mail-broker.mjs';

const staffRanks=new Set(DEFAULT_RANKS.filter(rank=>!['user','vip','patron_caravan','patron_guild','patron_grand'].includes(rank.key)).map(rank=>rank.key));
export async function provisionStaffMailbox(db,account){
 const access=await accessFor(db,account);
 if(!access.ranks.some(rank=>staffRanks.has(rank)))return null;
 const result=await callMailBroker({action:'ensure',userId:account.id,username:account.username});
 if(!result.configured||!result.active)return null;
 const existing=await db.prepare('SELECT mailbox_address FROM site_mail_identities WHERE user_id=?').bind(account.id).first();
 if(existing&&existing.mailbox_address!==result.address)throw Error('Verified mailbox mapping conflict; existing mapping preserved');
 if(!existing)await db.prepare("INSERT INTO site_mail_identities(user_id,mailbox_address,verified_at,link_method,active) VALUES(?,?,?,'staff-provisioned',1)").bind(account.id,result.address,Date.now()).run();
 return result;
}
export function startStaffMailSync(db){
 let busy=false;
 const sync=async()=>{if(busy)return;busy=true;try{const{results}=await db.prepare("SELECT id,username,display_name,role FROM site_accounts WHERE password_hash NOT LIKE '!%' AND role<>'memorial'").all();for(const account of results){try{await provisionStaffMailbox(db,account);}catch{console.error('Staff mailbox provisioning pending for central identity',account.id);}}}catch{console.error('Staff mailbox reconciliation temporarily unavailable');}finally{busy=false;}};
 void sync();const timer=setInterval(sync,300000);timer.unref();return()=>clearInterval(timer);
}

