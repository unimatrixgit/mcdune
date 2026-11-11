import {gameAuthorized,validUuid} from '../node/game-link.mjs';
import {accessFor} from '../node/permissions.mjs';
import {effectiveAppealStatus} from './native-appeal-status.mjs';

const departmentNodes={
 'web.tickets.support':'Support','web.tickets.appeals':'Ban appeals',
 'web.forum.moderate':'Forum support','web.tickets.legal':'Legal',
 'web.tickets.sales':'Sales','web.tickets.network':'Network staff'
};
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const plain=(value,max)=>String(value??'').replace(/[\x00-\x1f\x7f§]/g,' ').slice(0,max);
const select=`SELECT t.ticket_id,t.number,c.subject,s.state AS ticket_state,s.name AS status_label,d.name AS department,appeal.status AS appeal_status
 FROM drsupport_ticket t
 JOIN drsupport_ticket_status s ON s.id=t.status_id
 JOIN drsupport_department d ON d.id=t.dept_id
 LEFT JOIN drsupport_ticket__cdata c ON c.ticket_id=t.ticket_id
 LEFT JOIN native_ban_appeals appeal ON appeal.ticket_id=t.ticket_id `;

// The bearer credential belongs only to the trusted game server. Its client must
// use the authenticated Player UUID, never a player-supplied target identifier.
export function createGameTickets(db,settings,dependencies={}){
 const access=dependencies.access||((user)=>accessFor(db,user));
 return async request=>{
  if(new URL(request.url).pathname!=='/api/game/tickets')return reply({message:'Not found'},404);
  if(request.method!=='POST')return reply({message:'Method not allowed'},405);
  if(!gameAuthorized(request,settings))return reply({message:'Unauthorized'},401);
  let body;try{body=await request.json();}catch{return reply({message:'Invalid request'},400);}
  if(!body||!validUuid(body.uuid)||!['own','staff'].includes(body.view??'own'))return reply({message:'Invalid ticket view or player UUID'},400);
  const view=body.view??'own';
  try{
   const user=await db.prepare('SELECT a.id,a.username,a.role FROM site_game_links l JOIN site_accounts a ON a.id=l.user_id WHERE l.minecraft_uuid=?').bind(body.uuid).first();
   if(!user)return reply({linked:false,view,tickets:[],message:'Link your Minecraft account in Account Center to view tickets.'});
   const permissions=await access(user),nodes=permissions?.nodes||[];
   let query,args;
   if(view==='own'){
    if(!nodes.includes('web.tickets.view'))return reply({message:'Own ticket permission required.'},403);
    query=select+` WHERE s.state IN ('open','closed') AND EXISTS (SELECT 1 FROM drsupport_user_email e WHERE e.user_id=t.user_id AND e.address=?)`;
    args=[user.id+'@accounts.dunerealms.invalid'];
   }else{
    if(!nodes.includes('web.tickets.staff'))return reply({message:'Staff ticket permission required.'},403);
    const departments=Object.entries(departmentNodes).filter(([node])=>nodes.includes(node)).map(([,name])=>name);
    if(!departments.length)return reply({message:'No permitted support department is assigned.'},403);
    // Current central scope AND current native visibility are both mandatory.
    // assigned_only agents do not acquire department-wide access through this API.
    query=select+` JOIN drsupport_staff agent ON agent.username=? AND agent.isactive=1
     WHERE s.state IN ('open','closed') AND d.name IN (${departments.map(()=>'?').join(',')}) AND (
      (agent.assigned_only=0 AND (agent.dept_id=t.dept_id OR EXISTS (SELECT 1 FROM drsupport_staff_dept_access da WHERE da.staff_id=agent.staff_id AND da.dept_id=t.dept_id)))
      OR t.staff_id=agent.staff_id
      OR EXISTS (SELECT 1 FROM drsupport_team_member tm WHERE tm.staff_id=agent.staff_id AND tm.team_id=t.team_id)
     )`;
    args=[user.id.replaceAll('-',''),...departments];
   }
   const {results}=await db.prepare(query+' ORDER BY t.lastupdate DESC,t.ticket_id DESC LIMIT 30').bind(...args).all();
   const tickets=results.filter(row=>/^[1-9]\d{0,17}$/.test(String(row.ticket_id))).map(row=>{
    const id=String(row.ticket_id);
    return {id,number:plain(row.number||id,32),subject:plain(row.subject||'Support request',200),status:row.ticket_state,
     statusLabel:plain(row.status_label||row.ticket_state,40),department:plain(row.department,80),
     appealStatus:row.appeal_status?effectiveAppealStatus(row.appeal_status,row.ticket_state):null,
     url:'https://support.dunerealms.com/'+(view==='staff'?'scp/':'')+'tickets.php?id='+id};
   });
   return reply({linked:true,view,tickets});
  }catch{return reply({message:'Support tickets are temporarily unavailable.'},503);}
 };
}
