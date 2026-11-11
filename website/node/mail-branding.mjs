import {readFile} from 'node:fs/promises';
import {accessFor} from './permissions.mjs';
import {staffSealFor,departmentsFor,visibleCommunityBadges} from './native-seals.mjs';
import {badgesFor} from './community-badges.mjs';
import {AWARD_FILES,AWARD_LABELS,RECOGNITION} from './recognition.mjs';
import {currentStaffRanks} from './game-staff-seals.mjs';
export async function mailBrandingFor(db,user){
 const access=await accessFor(db,user),manifest=JSON.parse(await readFile(new URL('../web/assets/seals/manifest.json',import.meta.url),'utf8')),seals=[];
 const add=(path,label)=>{if(path&&!seals.some(s=>s.url.endsWith(path)))seals.push({url:'https://www.dunerealms.com'+path,label});};
 add(staffSealFor({...user,ranks:access.ranks},manifest),access.label);
 if(access.ranks.includes('web_streamer'))add('/assets/seals/rank-streamer-150.png','Streamer');
 for(const seal of RECOGNITION.roles)if(access.ranks.includes(seal.rank))add('/assets/seals/'+seal.file,seal.label);
 for(const department of departmentsFor(access.nodes,access.ranks,user.username))add('/assets/seals/department-'+(department==='legal'?'legal-v2':department)+'-150.png',department.replaceAll('-',' ')+' department');
 const community=JSON.parse(await readFile(new URL('../web/assets/seals/community-manifest.json',import.meta.url),'utf8'));
 for(const badge of visibleCommunityBadges(await badgesFor(db,user.id),access.ranks))if(!currentStaffRanks(access.ranks)||!AWARD_FILES[badge])add(AWARD_FILES[badge]?'/assets/seals/'+AWARD_FILES[badge]:community[badge]?.footer150||community[badge]?.src,AWARD_LABELS[badge]||badge.replaceAll('-',' '));
 return {rankLabel:access.label,seals};
}
