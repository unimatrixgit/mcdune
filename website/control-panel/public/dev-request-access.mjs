// Submission access only; server-side approval and private case visibility remain separate.
export const DEV_REQUEST_STAFF_RANKS=['owners','official_account','corestaff','staff','web_network','web_net_owner','web_net_admin','network_admin','web_dev','web_streamer','web_news','web_forum','web_support','web_sales','web_legal','web_appeal','game_mod','game_admin','game_support','game_appeal','game_quests','game_restoration'];
export const canSubmitDevRequest=user=>{
 if(!user)return false;
 // Older Forgejo releases expose only rank; newer releases also expose ranks.
 const ranks=[user.rank,...(Array.isArray(user.ranks)?user.ranks:[])].filter(Boolean);
 return ranks.some(r=>r==='vip'||r==='council_member'||DEV_REQUEST_STAFF_RANKS.includes(r))
  ||(user.permissions||[]).some(n=>['web.menu.staffmanual','web.tickets.staff','web.forum.moderate','web.posts.edit'].includes(n));
};
