import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {ensureStaffMailbox,STAFF_MAILBOX_ID} from './internal-mail-staff.mjs';
import {automatedMailTemplate} from './automated-mail-templates.mjs';
export async function initializeMailReports(db){await db.prepare('CREATE TABLE IF NOT EXISTS site_mail_reports(id CHAR(36) PRIMARY KEY,reporter_id CHAR(36) NOT NULL,reporter_name VARCHAR(40) NOT NULL,source_scope VARCHAR(12) NOT NULL,staff_message_id VARCHAR(254) NULL,ticket_id INT NULL,ticket_number VARCHAR(32) NULL,created_at BIGINT NOT NULL)').run();await db.prepare('DELETE FROM site_mail_reports WHERE created_at<?').bind(Date.now()-30*86400000).run();}
function reportId(userId,source,body){const b=createHash('sha1').update(JSON.stringify([userId,source,body.folder,body.uidValidity,body.uid])).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export async function reportInternalMail(db,{user,sourceId,scope,body,broker}){
 if(!['personal','clan'].includes(scope))throw Object.assign(Error('Report mail is available for personal and clan inboxes.'),{status:403});
 if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>2000)throw Object.assign(Error('Describe why you are reporting this message (up to 2,000 characters).'),{status:400});
 await initializeMailReports(db);const id=reportId(user.id,sourceId,body),saved=await db.prepare('SELECT * FROM site_mail_reports WHERE id=?').bind(id).first();if(saved?.staff_message_id)return {ok:true,reported:true,replay:true};
 const reference={folder:body.folder,uid:body.uid,uidValidity:body.uidValidity};const original=await broker({action:'internal_get',userId:sourceId,...reference});
 await db.prepare('INSERT INTO site_mail_reports(id,reporter_id,reporter_name,source_scope,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET id=excluded.id').bind(id,user.id,user.username,scope,Date.now()).run();
 const staff=await ensureStaffMailbox(broker),mail=automatedMailTemplate('mail-report',{subject:original.subject,recipientName:'Staff',message:'Reported by: '+user.username+'\n\nReason:\n'+body.reason.trim(),url:'https://cp.dunerealms.com/#staff-inbox'});
 const text='Reported by: '+user.username+'\nSource: '+(scope==='clan'?'Shared clan mailbox':'Personal mailbox')+'\nSubject: '+original.subject+'\n\nReason:\n'+body.reason.trim()+'\n\nThe original message, including its attachments, is attached. Staff may create a Legal ticket on behalf of the reporter.';
 const sent=await broker({action:'internal_send',userId:sourceId,requestId:id,to:[staff.address],cc:[],bcc:[],senderName:user.username+' · Mail report',subject:'Mail report · '+String(original.subject||'(No subject)').slice(0,170),text,html:mail.html,forward:reference,reportId:id});
 if(!sent.accepted)throw Object.assign(Error('Report delivery is pending. Retry the same report.'),{status:503});
 await db.prepare('UPDATE site_mail_reports SET staff_message_id=? WHERE id=?').bind(sent.messageId,id).run();return {ok:true,reported:true};
}
export function nativeReportTicket(payload){return new Promise((resolve,reject)=>{const child=spawn('/usr/bin/php',['/home/dunerealms/apps/integrations/osticket/mail-report-ticket.php'],{stdio:['pipe','pipe','ignore']});let output='',done=false;const timer=setTimeout(()=>{done=true;child.kill();reject(Object.assign(Error('Ticket conversion is pending; retry checks the existing report.'),{status:503}));},60000);child.on('error',()=>{clearTimeout(timer);reject(Object.assign(Error('Ticket bridge unavailable.'),{status:503}));});child.stdout.on('data',v=>{output+=v;if(output.length>65536)child.kill();});child.on('close',code=>{if(done)return;clearTimeout(timer);try{const v=JSON.parse(output);if(code||!v.ok)throw Error();resolve(v);}catch{reject(Object.assign(Error('Ticket conversion requires review; a duplicate will not be created automatically.'),{status:503}));}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload));});}
export async function convertReportedMail(db,{body,broker,createTicket=nativeReportTicket}){
 await initializeMailReports(db);const message=await broker({action:'internal_get',userId:STAFF_MAILBOX_ID,folder:body.folder,uid:body.uid,uidValidity:body.uidValidity});
 if(!message.reportId)throw Object.assign(Error('This message is not a linked mail report.'),{status:400});
 const report=await db.prepare('SELECT * FROM site_mail_reports WHERE id=?').bind(message.reportId).first();if(!report||report.staff_message_id!==message.messageId)throw Object.assign(Error('The report’s original record could not be verified.'),{status:403});
 if(report.ticket_id)return {ok:true,ticketId:report.ticket_id,ticketNumber:report.ticket_number,replay:true};
 const part=message.attachments?.find(p=>p.contentType==='message/rfc822');if(!part)throw Object.assign(Error('The original message attachment is required.'),{status:409});
 const attachment=await broker({action:'internal_attachment',userId:STAFF_MAILBOX_ID,folder:body.folder,uid:body.uid,uidValidity:body.uidValidity,partId:part.partId});
 const ticket=await createTicket({reportId:report.id,reporterId:report.reporter_id,reporterName:report.reporter_name,subject:message.subject,text:message.text,attachmentBase64:attachment.dataBase64});
 await db.prepare('UPDATE site_mail_reports SET ticket_id=?,ticket_number=? WHERE id=?').bind(ticket.ticketId,ticket.ticketNumber,report.id).run();return ticket;
}
