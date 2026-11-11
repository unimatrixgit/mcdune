// Native ticket state is authoritative for whether an undecided appeal is pending.
// Generic close/reopen never invents or erases an approve/deny decision.
export function effectiveAppealStatus(status,ticketState){
 if(['approved','denied','approving'].includes(status))return status;
 if(ticketState==='open')return 'pending';
 if(['closed','archived','deleted'].includes(ticketState))return 'closed';
 return 'unavailable';
}
export function pendingNativeAppeal(db,banId,userId){
 return db.prepare("SELECT a.ticket_id FROM native_ban_appeals a JOIN drsupport_ticket t ON t.ticket_id=a.ticket_id JOIN drsupport_ticket_status s ON s.id=t.status_id WHERE a.ban_id=? AND a.user_id=? AND (a.status='approving' OR (a.status IN ('pending','closed') AND s.state='open')) ORDER BY a.opened_at DESC LIMIT 1").bind(banId,userId).first();
}
