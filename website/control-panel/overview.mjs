import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export function createOverview(db,dependencies={}){
 const authenticate=dependencies.identity||((request)=>identity(request,db));
 const access=dependencies.access||((user)=>accessFor(db,user));
 return async request=>{
  if(request.method!=='GET')return json({message:'Method not allowed'},405);
  const user=await authenticate(request);if(!user)return json({message:'Sign in first.'},401);
  const permissions=await access(user),has=node=>permissions.nodes.includes(node),area=new URL(request.url).pathname.endsWith('/staff')?'staff':'user',metrics=[];
  const count=async(key,label,sql,args,href,artwork,description)=>{
   try{const row=await db.prepare(sql).bind(...args).first(),number=Number(row?.total);if(!Number.isFinite(number)||number<0)throw Error();metrics.push({key,label,value:number,available:true,href,artwork,description});}
   catch{metrics.push({key,label,value:null,available:false,href,artwork,description:'Temporarily unavailable'});}
  };
  const tickets=' FROM drsupport_ticket t JOIN drsupport_ticket_status s ON s.id=t.status_id JOIN drsupport_help_topic h ON h.topic_id=t.topic_id ';
  if(area==='user'){
   if(has('web.tickets.view')){
    const own=tickets+' JOIN drsupport_user_email e ON e.user_id=t.user_id WHERE e.address=? AND s.state=?';
    await count('open-tickets','Your open tickets','SELECT COUNT(DISTINCT t.ticket_id) AS total'+own,[user.id+'@accounts.dunerealms.invalid','open'],'#tickets','support','Private support cases awaiting a resolution');
    await count('open-appeals','Your open appeals','SELECT COUNT(DISTINCT t.ticket_id) AS total'+own+" AND LOWER(h.topic)=? AND NOT EXISTS (SELECT 1 FROM native_ban_appeals a WHERE a.ticket_id=t.ticket_id AND a.status IN ('approved','denied'))",[user.id+'@accounts.dunerealms.invalid','open','ban appeal'],'#tickets','boards','Your ban appeals still under review');
   }
   if(has('web.menu.game')){
    try{const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();metrics.push({key:'game-link',label:'Minecraft identity',value:link?.minecraft_uuid?'Linked':'Not linked',available:true,href:'#game',artwork:'account',description:'Your verified connection to the game'});}
    catch{metrics.push({key:'game-link',label:'Minecraft identity',value:null,available:false,href:'#game',artwork:'account',description:'Temporarily unavailable'});}
   }
   metrics.push({key:'rank',label:'Website rank',value:permissions.label,available:true,href:'#security',artwork:'clan',description:'Your current website access level'});
  }else{
   if(!['web.tickets.staff','web.menu.forum','web.menu.posts','web.menu.servers','web.menu.staffmanual','web.menu.permissions','web.menu.exchange'].some(has))return json({message:'Staff overview permission required.'},403);
   if(has('web.tickets.staff')&&has('web.tickets.support'))await count('open-support','Open support tickets','SELECT COUNT(*) AS total'+tickets+' WHERE s.state=? AND LOWER(h.topic) NOT IN (?,?)',['open','ban appeal','report forum post'],'#staff-tickets','support','General support queue');
   if(has('web.tickets.staff')&&has('web.tickets.appeals'))await count('open-appeals','Open appeals','SELECT COUNT(*) AS total'+tickets+" WHERE s.state=? AND LOWER(h.topic)=? AND NOT EXISTS (SELECT 1 FROM native_ban_appeals a WHERE a.ticket_id=t.ticket_id AND a.status IN ('approved','denied'))",['open','ban appeal'],'#staff-tickets','boards','Ban appeals awaiting a decision');
   if(has('web.forum.view')&&has('web.forum.moderate'))await count('forum-reports','Forum reports','SELECT COUNT(*) AS total FROM drforum_reportedcontent WHERE reportstatus<>?', [1],'#forum-admin','boards','Unresolved native MyBB reports');
   if(has('web.posts.view')&&has('web.menu.posts'))await count('news-drafts','News drafts','SELECT COUNT(*) AS total FROM website_posts WHERE status=?',['draft'],'#website-posts','discord','News awaiting publication');
   if(has('web.accounts.view'))await count('accounts','Website accounts','SELECT COUNT(*) AS total FROM site_accounts',[],'#staff','account','Registered community accounts');
  }
  return json({area,username:user.username,rankLabel:permissions.label,updatedAt:Date.now(),metrics});
 };
}
