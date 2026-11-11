import {accessFor} from './permissions.mjs';
import {isStaffMailAccess} from './staff-mail-policy.mjs';
export const STAFF_MAILBOX_ID='5a18b987-6f6d-4b33-9aaa-7f7334d18ef2';
export const STAFF_MAIL_RESOURCE='ccedb688-5228-4b5e-8281-42410896004f';
export async function canUseStaffMail(db,user){return isStaffMailAccess(await accessFor(db,user));}
export async function ensureStaffMailbox(broker){const status=await broker({action:'internal_ensure',userId:STAFF_MAILBOX_ID,eligible:true,mailboxKind:'staff',resourceId:STAFF_MAIL_RESOURCE,localPart:'staff.internal'});return {userId:STAFF_MAILBOX_ID,address:status.address};}
