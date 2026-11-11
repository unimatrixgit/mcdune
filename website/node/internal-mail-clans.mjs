import {createHash} from 'node:crypto';
export function clanMailboxId(clanId){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clanId))throw Error('Invalid clan identity');
 const bytes=createHash('sha1').update(Buffer.from(clanId.replaceAll('-',''),'hex')).update('dunerealms-clan-internal-mail').digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function ownClanMailbox(db,user){return db.prepare("SELECT c.id,c.name,c.tag,m.clan_role FROM site_clan_members m JOIN site_clans c ON c.id=m.clan_id WHERE m.user_id=? AND m.clan_role IN ('owner','officer') AND c.active=1").bind(user.id).first();}
export async function ensureClanMailbox(db,clan,broker){
 await initializeClanMail(db);
 const userId=clanMailboxId(clan.id),slug=clan.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);
 if(!slug)throw Error('Clan needs a mail-compatible name');
 const status=await broker({action:'internal_ensure',userId,eligible:true,mailboxKind:'clan',resourceId:clan.id,localPart:slug+'.internal'});
 await db.prepare('INSERT INTO site_clan_mailboxes(clan_id,mailbox_id,created_at) VALUES(?,?,?) ON CONFLICT(clan_id) DO UPDATE SET mailbox_id=excluded.mailbox_id').bind(clan.id,userId,Date.now()).run();return {userId,address:status.address};
}
export async function initializeClanMail(db){await db.prepare('CREATE TABLE IF NOT EXISTS site_clan_mailboxes(clan_id CHAR(36) PRIMARY KEY,mailbox_id CHAR(36) NOT NULL UNIQUE,created_at BIGINT NOT NULL)').run();}
export async function reconcileClanMail(db,broker){
 const {results:active}=await db.prepare('SELECT id,name,tag FROM site_clans WHERE active=1').all();for(const clan of active)await ensureClanMailbox(db,clan,broker);
 const {results:removed}=await db.prepare('SELECT m.clan_id,m.mailbox_id FROM site_clan_mailboxes m LEFT JOIN site_clans c ON c.id=m.clan_id WHERE c.id IS NULL OR c.active=0').all();
 for(const row of removed){await broker({action:'internal_retire_clan',userId:row.mailbox_id,resourceId:row.clan_id});await db.prepare('DELETE FROM site_clan_mailboxes WHERE clan_id=?').bind(row.clan_id).run();}
}
