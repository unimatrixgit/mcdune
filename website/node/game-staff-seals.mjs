import {isOwnerRank,DEFAULT_RANKS} from './permissions.mjs';
import {RECOGNITION} from './recognition.mjs';
export const GAME_STAFF_SEALS=[{key:'rank-game-mod',rank:'game_mod',label:'Ingame Moderator',file:'rank-game-mod-150.png'},{key:'rank-game-admin',rank:'game_admin',label:'Ingame Administrator',file:'rank-game-admin-150.png'}];
export const protectedStaffRanks=ranks=>Array.isArray(ranks)&&ranks.some(isOwnerRank);
export function gameStaffSeals(ranks=[]){return [...GAME_STAFF_SEALS,...RECOGNITION.roles].filter(seal=>ranks.includes(seal.rank)||protectedStaffRanks(ranks));}
export function managedRoleSeals(ranks=[]){return [...(ranks.includes('web_streamer')||protectedStaffRanks(ranks)?['rank-streamer']:[]),...(ranks.includes('web_dev')||protectedStaffRanks(ranks)?['rank-dev']:[]),...(ranks.includes('crysknife')?['rank-crysknife']:[]),...gameStaffSeals(ranks).map(s=>s.key)];}

export function currentStaffRanks(ranks=[]){return ranks.some(key=>DEFAULT_RANKS.some(r=>r.key===key&&(key.startsWith('web_')||key.startsWith('game_')||['staff','corestaff','owners','official_account','network_admin'].includes(key))));}
