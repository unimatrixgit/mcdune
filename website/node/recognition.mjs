import {readFileSync} from 'node:fs';
export const RECOGNITION=JSON.parse(readFileSync(new URL('./recognition-catalog.json',import.meta.url),'utf8'));
export const MANUAL_AWARDS=RECOGNITION.manual;
export const FORUM_AWARDS=RECOGNITION.forum;
export const AWARD_LABELS=Object.fromEntries([...MANUAL_AWARDS,...FORUM_AWARDS].map(a=>[a.key,a.label]));
export const AWARD_FILES=Object.fromEntries([...MANUAL_AWARDS,...FORUM_AWARDS].map(a=>[a.key,a.file]));
export function forumAwardsFor(count,{showcase=false}={}){
 const posts=Number(count);return FORUM_AWARDS.filter(a=>showcase||Number.isSafeInteger(posts)&&posts>=a.threshold);
}
export async function forumPostCount(db,id){
 try{const row=await db.prepare('SELECT u.postnum FROM drforum_dune_accounts a JOIN drforum_users u ON u.uid=a.uid WHERE a.website_id=?').bind(id).first();const n=Number(row?.postnum||0);return Number.isSafeInteger(n)&&n>=0?n:0;}
 catch(e){if(/no such table|doesn.t exist|unknown column|no such column/i.test(e.message||''))return 0;throw e;}
}
