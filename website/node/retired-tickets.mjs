// osTicket is the sole ticket store. Retired APIs must never regain broad legacy staff access.
export function retiredTicketResponse(request){
 const path=new URL(request.url).pathname;
 if(!['/api/tickets','/api/cp/tickets','/api/cp/support-profile'].some(base=>path===base||(base!=='/api/cp/support-profile'&&path.startsWith(base+'/'))))return null;
 return new Response(request.method==='HEAD'?null:JSON.stringify({message:'Support tickets are handled in the Support center.',supportUrl:'https://support.dunerealms.com/'}),{status:410,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Link':'<https://support.dunerealms.com/>; rel="alternate"'}});
}
