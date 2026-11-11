export const TERMS_VERSION='2026-11-05-v1';
import {identity} from './auth.mjs';
export const FIRST_LOGIN_SCHEMA=`CREATE TABLE IF NOT EXISTS site_first_login(user_id CHAR(36) PRIMARY KEY,password_changed INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL)`;
export async function firstLoginState(db,user){
 if(!user)return null;
 const row=await db.prepare('SELECT password_changed FROM site_first_login WHERE user_id=?').bind(user.id).first();if(!row)return null;
 const email=await db.prepare('SELECT address,verified_at FROM site_contact_emails WHERE user_id=?').bind(user.id).first();
 const passwordRequired=!row.password_changed,emailRequired=!email?.verified_at||!email.address||email.address.toLowerCase()==='no_reply@dunerealms.com';
 const accepted=await db.prepare('SELECT version FROM site_terms_acceptances WHERE user_id=? AND version=?').bind(user.id,TERMS_VERSION).first();const termsRequired=!accepted;
 return passwordRequired||emailRequired||termsRequired?{passwordRequired,emailRequired,termsRequired}:null;
}
export async function firstLoginGate(request,db){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/')&&!path.startsWith('/sso/')&&!path.startsWith('/git/'))return null;
 if(['/api/auth/login','/api/auth/logout','/api/auth/session','/api/auth/password','/api/auth/terms','/api/account/email'].includes(path))return null;
 const state=await firstLoginState(db,await identity(request,db));return state?Response.json({message:'Complete your first sign-in: change your password and verify your own email address.',firstLogin:state,securityUrl:'https://cp.dunerealms.com/#security'},{status:428,headers:{'Cache-Control':'no-store'}}):null;
}
