import {publicGitFor} from './git-public.mjs';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {identity} from './auth.mjs';
import {avatarForAccount} from './avatar.mjs';
import {json} from './game-link.mjs';
import {evidenceMime} from '../control-panel/evidence.mjs';
import {syncNativeProfile} from './native-profiles.mjs';
import {honoursFor} from './honours.mjs';
export const SOCIAL_DOMAINS={website:[],discord:['discord.com','discord.gg'],youtube:['youtube.com','youtu.be'],twitch:['twitch.tv'],twitter:['twitter.com','x.com'],facebook:['facebook.com','fb.com'],github:['github.com'],dunehub:[],instagram:['instagram.com'],tiktok:['tiktok.com']};
export function normalizeSocials(input={}){
 const socials={};for(const [key,domains]of Object.entries(SOCIAL_DOMAINS)){
  const value=input?.[key];if(!value)continue;if(typeof value!=='string')throw Error('Invalid social link');
  const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||url.href.length>500||url.port&&url.port!=='443'||domains.length&&!domains.some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw Error('Invalid social link');
  socials[key]=url.href;
 }return socials;
}
export async function publicProfileFor(db,userId,origin='https://cp.dunerealms.com'){
 const row=await db.prepare('SELECT bio,public_info,socials_json FROM site_profiles WHERE user_id=?').bind(userId).first();
 let socials={};try{socials=normalizeSocials(JSON.parse(row?.socials_json||'{}'));}catch{}
 const avatar=await avatarForAccount(db,userId);
 const git=await publicGitFor(db,userId);delete socials.dunehub;if(git)socials.dunehub=git.profileUrl;
 const account=await db.prepare('SELECT id,role FROM site_accounts WHERE id=?').bind(userId).first();
 return{honours:account?await honoursFor(db,account):[],bio:row?.bio||'',publicInfo:row?.public_info||'',socials,git,avatar:{...avatar,url:new URL(avatar.url,origin).href}};
}
export function createProfile(db,settings,origin){return async request=>{
 const user=await identity(request,db);if(!user)return json({message:'Sign in first'},401);const path=new URL(request.url).pathname;
 if(request.method==='GET'){const profile=await db.prepare('SELECT * FROM site_profiles WHERE user_id=?').bind(user.id).first();const account=await db.prepare('SELECT username,display_name FROM site_accounts WHERE id=?').bind(user.id).first();return json({profile:{...account,honours:await honoursFor(db,user),bio:profile?.bio||'',birthday:profile?.birthday||'',publicBirthday:!!profile?.public_birthday,publicInfo:profile?.public_info||'',socials:JSON.parse(profile?.socials_json||'{}'),git:await publicGitFor(db,user.id),avatar:await avatarForAccount(db,user.id)}});}
 if(request.method!=='POST'||request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
 if(path==='/api/account/avatar'){
  if(!settings.AVATAR_DIR)return json({message:'Avatar uploads are not configured'},503);let form;try{form=await request.formData();}catch{return json({message:'Invalid upload'},400);}const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size<1||file.size>2*1024*1024)return json({message:'Upload a PNG, JPEG or WebP avatar up to 2 MB'},400);const bytes=Buffer.from(await file.arrayBuffer()),mime=evidenceMime(bytes,file.name);if(!mime?.startsWith('image/'))return json({message:'Use PNG, JPEG or WebP'},400);const id=randomUUID();await mkdir(resolve(settings.AVATAR_DIR),{recursive:true,mode:0o700});await writeFile(join(resolve(settings.AVATAR_DIR),id+'.bin'),bytes,{flag:'wx',mode:0o600});await db.prepare('INSERT INTO site_profiles(user_id,socials_json,avatar_key,avatar_mime,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_key=excluded.avatar_key,avatar_mime=excluded.avatar_mime,updated_at=excluded.updated_at').bind(user.id,'{}',id,mime,Date.now()).run();return json({ok:true,avatar:await avatarForAccount(db,user.id)});
 }
 let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}if(path==='/api/account/avatar/remove'){await db.prepare('UPDATE site_profiles SET avatar_key=NULL,avatar_mime=NULL,updated_at=? WHERE user_id=?').bind(Date.now(),user.id).run();return json({ok:true});}
 if(path!=='/api/account/profile')return json({message:'Not found'},404);
 if(typeof body.displayName!=='string'||body.displayName.trim().length<2||body.displayName.length>40||typeof body.bio!=='string'||body.bio.length>1000||typeof body.publicInfo!=='string'||body.publicInfo.length>500)return json({message:'Check your display name, bio and public information lengths'},400);
 const birthday=body.birthday||null;if(birthday&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||!Number.isFinite(Date.parse(birthday))||Date.parse(birthday)>Date.now()))return json({message:'Choose a valid birthday'},400);
 let socials;try{socials=normalizeSocials(body.socials);}catch{return json({message:'Use HTTPS links to the matching social service, without login details.'},400);}
 await db.batch([db.prepare('UPDATE site_accounts SET display_name=? WHERE id=?').bind(body.displayName.trim(),user.id),db.prepare('INSERT INTO site_profiles(user_id,bio,birthday,public_birthday,public_info,socials_json,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,birthday=excluded.birthday,public_birthday=excluded.public_birthday,public_info=excluded.public_info,socials_json=excluded.socials_json,updated_at=excluded.updated_at').bind(user.id,body.bio,birthday,body.publicBirthday?1:0,body.publicInfo,JSON.stringify(socials),Date.now())]);
 const profile=await publicProfileFor(db,user.id,origin);await syncNativeProfile({id:user.id,username:user.username,displayName:body.displayName.trim(),publicProfile:profile});return json({ok:true});
};}
