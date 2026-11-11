// Public presentation reads only the server-verified Git mapping, never a typed social URL.
export async function publicGitFor(db,userId){
 let row;try{row=await db.prepare('SELECT forgejo_login,profile_url,owned_repo_count,verified_at FROM site_git_identities WHERE user_id=?').bind(userId).first();}
 catch(error){if(error.code==='ER_NO_SUCH_TABLE'||/no such table/i.test(error.message))return null;throw error;}
 if(!row||!Number(row.verified_at)||!/^[A-Za-z0-9_.-]{1,100}$/.test(row.forgejo_login||''))return null;
 let url;try{url=new URL(row.profile_url);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port)return null;
 const expected='/git/'+encodeURIComponent(row.forgejo_login);
 if(!(['www.dunerealms.com','dunerealms.com'].includes(url.hostname)&&url.pathname.replace(/\/$/,'')===expected))return null;
 const count=Math.max(0,Math.floor(Number(row.owned_repo_count)||0));
 return {login:row.forgejo_login,profileUrl:url.href,ownedRepoCount:count,repositoryOwner:count>0};
}
