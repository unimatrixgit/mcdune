import {gameStaffSeals,protectedStaffRanks} from './game-staff-seals.mjs';
import {AWARD_LABELS,AWARD_FILES} from './recognition.mjs';
import {politicalSeals} from './political-heraldry.mjs';
import{readFileSync,existsSync}from'node:fs';
import{createHash}from'node:crypto';
import{identity}from'./auth.mjs';
import{accessFor,rankFor}from'./permissions.mjs';
import{publicProfileFor}from'./profile.mjs';
import{badgesFor,BADGES,communityBadgeVisible}from'./community-badges.mjs';
import{staffSealFor,departmentsFor}from'./native-seals.mjs';
import{staffClosureStats,statsForAccount,departmentAwardEarned}from'./staff-closure-stats.mjs';
const origin='https://www.dunerealms.com',base=origin+'/assets/seals/';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
const missing=e=>/no such table|doesn't exist|unknown column|no such column/i.test(e.message||'');
async function optional(fn,fallback){try{return await fn();}catch(e){if(missing(e))return fallback;throw e;}}
const departments={'support':'Support','ban-appeals':'Ban appeals','forum-support':'Forum support','legal':'Legal','sales':'Sales','network-staff':'Network staff','dev':'Development'};
const badgeLabels={'alpha-tester':'Alpha Tester','beta-tester':'Beta Tester','launch-contributor':'Launch Contributor','dedicated-tester':'Dedicated Tester','season-tavren-ii':'The Quest for Tavren II Aedrecht','dunegit-owner':'DuneGit Repository Owner'};
export function earnedMemberSeal(request){
 const path=new URL(request.url).pathname,match=path.match(/^\/assets\/seals\/earned\/(personal-department-(?:support|ban-appeals|forum-support|legal|sales|network-staff|dev)-[a-f0-9]{20}\.png)$/);if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method rejected',{status:405});
 const file='/home/dunerealms/apps/integrations/osticket/assets/seals/earned/'+match[1];if(!existsSync(file))return new Response('Seal not found',{status:404});
 return new Response(request.method==='HEAD'?null:readFileSync(file),{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'}});
}
const testerBadges=new Set(['alpha-tester','beta-tester','launch-contributor','dedicated-tester']);
export async function publicForumFor(db,id){
 const row=await optional(()=>db.prepare('SELECT u.uid,u.username,u.usertitle,u.postnum,u.threadnum,u.regdate,u.lastvisit,u.invisible,u.reputation,u.timeonline FROM drforum_dune_accounts a JOIN drforum_users u ON u.uid=a.uid WHERE a.website_id=?').bind(id).first(),undefined);
 if(row===undefined)return{status:'unavailable'};if(!row)return{status:'not-linked'};
 const count=x=>Math.max(0,Math.floor(Number(x)||0));
 return{status:'linked',username:String(row.username),title:String(row.usertitle||''),posts:count(row.postnum),threads:count(row.threadnum),reputation:Math.trunc(Number(row.reputation)||0),joinedAt:count(row.regdate)*1000,lastVisit:row.invisible?null:count(row.lastvisit)*1000,timeOnlineSeconds:row.invisible?null:count(row.timeonline),url:'https://forums.dunerealms.com/member.php?action=profile&uid='+count(row.uid)};
}
export async function memberProfileData(db,target,settings={}){
 const access=await accessFor(db,target),publicProfile=await publicProfileFor(db,target.id),statsMap=await(settings.statsReader||staffClosureStats)(db),staff=access.nodes.includes('web.tickets.staff'),stats=staff?statsForAccount(statsMap,target.id):null;
 let manifest=settings.sealManifest||{};if(!settings.sealManifest){const file=settings.SEAL_MANIFEST_PATH||'/home/dunerealms/apps/integrations/seal-manifest.json';if(existsSync(file))manifest=JSON.parse(readFileSync(file,'utf8'));}
 const showcase=target.username.toLowerCase()==='dunerealms';
 const ranks=[];for(const key of access.ranks){const r=await rankFor(db,key);if(!ranks.some(x=>x.label===r.label))ranks.push({key:r.key,label:r.label});}
 const medals=[];const add=(key,label,url,group)=>{if(!medals.some(m=>m.key===key)&&typeof url==='string'&&/^https:\/\/(www|support|forums)\.dunerealms\.com\/assets\/seals\/[a-zA-Z0-9_./-]+\.png$/.test(url))medals.push({key,label,url:url.replace(/^https:\/\/(support|forums)\.dunerealms\.com\//,'https://www.dunerealms.com/'),group});};
 const personal=showcase?Object.values(manifest).find(a=>a.label?.toLowerCase()===target.username.toLowerCase()&&a.role==='OWNER')?.footer150||null:staffSealFor({...target,ranks:access.ranks},manifest);const namedPersonal=personal&&!personal.includes('/rank-network-staff-');if(personal)add('personal-role',namedPersonal?target.username+' · Personal seal':access.label,personal.startsWith('/')?(personal.includes('main-network')?'https://support.dunerealms.com':'https://www.dunerealms.com')+personal:personal,'Staff');
 for(const key of departmentsFor(access.nodes,access.ranks,target.username)){
  const name=departments[key];if(!name)continue;let url=base+'department-'+key+(key==='legal'?'-v2':'')+'-150.png';
  let label=name+' · Department';if(departmentAwardEarned(stats,key)){const file='personal-department-'+key+'-'+createHash('sha256').update(target.id+'|'+key+'|'+target.username).digest('hex').slice(0,20)+'.png';if(existsSync('/home/dunerealms/apps/integrations/osticket/assets/seals/earned/'+file)){url='https://support.dunerealms.com/assets/seals/earned/'+file;label=name+' · Personal department seal';}}
  add('department-'+key,label,url,'Departments');
 }
 if(access.ranks.includes('web_streamer')||protectedStaffRanks(access.ranks))add('rank-streamer','Streamer · News Team',base+'rank-streamer-150.png','Roles');
 for(const key of showcase?BADGES:await badgesFor(db,target.id))if(BADGES.includes(key))add(key,AWARD_LABELS[key]||badgeLabels[key],base+(AWARD_FILES[key]||key+'-150.png'),AWARD_LABELS[key]?'Awards':'Community');
 for(const [key,asset]of Object.entries(manifest))if(asset.category==='Community'&&!/crysknife/i.test(key+' '+asset.label+' '+asset.footer150)&&(showcase||asset.rank&&access.ranks.includes(asset.rank)))add(key,asset.label,origin+asset.footer150,'Community');
 if(!showcase&&access.ranks.includes('crysknife'))add('rank-crysknife','Holy Order of The Crysknife',base+'order-crysknife-v1.png','Official');
 if(access.ranks.includes('web_dev')||protectedStaffRanks(access.ranks))add('rank-dev','Development',base+'rank-dev-150.png','Official');
 for(const key of (showcase?Object.keys(departments):departmentsFor(access.nodes,access.ranks,target.username).filter(key=>departmentAwardEarned(stats,key))))add('team-'+key,departments[key]+' Award',base+'award-'+key+'-150.png','Awards');
 for(const seal of gameStaffSeals(access.ranks))add(seal.key,seal.label,base+seal.file,'Official');
 for(const seal of politicalSeals(access.ranks))add(seal.key,seal.label,base+seal.file,seal.group);
 const office=await optional(()=>db.prepare('SELECT roles_json,expires_at FROM drforum_dune_political_roles WHERE website_id=?').bind(target.id).first(),null);
 if(office&&Number(office.expires_at)>Date.now()/1000){const known={emperor:'Emperor',house_leader:'Faction leader',specerhuis:'Specerhuis',welvaart:'House of Water',guild_staff:'Vaerkring',landsraad:'Landsraad'};for(const key of JSON.parse(office.roles_json||'[]'))if(known[key])add('office-'+key,known[key],'https://forums.dunerealms.com/assets/seals/office-'+key+'.png','Political offices');}
 const clan=await optional(()=>db.prepare('SELECT c.name,c.tag,c.description,m.clan_role,m.joined_at,(SELECT COUNT(*) FROM site_clan_members n WHERE n.clan_id=c.id) AS member_count FROM site_clan_members m JOIN site_clans c ON c.id=m.clan_id WHERE m.user_id=? AND c.active=1').bind(target.id).first(),undefined);
 return{showcase,personalSeal:namedPersonal?medals.find(m=>m.key==='personal-role'):null,username:target.username,displayName:target.display_name,joinedAt:Number(target.created_at),avatar:'https://cp.dunerealms.com/api/avatars/member/'+encodeURIComponent(target.username),avatarMode:publicProfile.avatar.mode,bio:publicProfile.bio,publicInfo:publicProfile.publicInfo,socials:publicProfile.socials,ranks,medals,forum:await publicForumFor(db,target.id),support:{status:staff?(stats?'available':'unavailable'):'not-staff',closed:stats?.totalClosed??null,departments:stats?.departments||{}},quests:{status:'placeholder',completed:null,active:null},clan:clan===undefined?{status:'unavailable'}:clan?{status:'member',name:clan.name,tag:clan.tag,description:clan.description,role:clan.clan_role,joinedAt:Number(clan.joined_at),members:Math.max(0,Number(clan.member_count))}:{status:'none'}};
}
export function createMemberProfiles(db,settings={}){return async request=>{
 const from=request.headers.get('origin');if(from&&from!==origin)return json({message:'Origin rejected.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:json({}).headers});if(request.method!=='GET')return json({message:'Read-only profile.'},405);
 const actor=await identity(request,db);if(!actor)return json({message:'Sign in with your DuneRealms account to view this profile.'},401);
 const match=new URL(request.url).pathname.match(/^\/api\/people\/([a-z0-9_]{3,32})$/);if(!match)return json({message:'Profile not found.'},404);
 const target=await db.prepare("SELECT id,username,display_name,role,created_at FROM site_accounts WHERE username=? AND password_hash NOT LIKE '!%' AND role<>'memorial'").bind(match[1]).first();if(!target)return json({message:'Profile not found.'},404);
 return json({profile:await memberProfileData(db,target,settings)});
};}
