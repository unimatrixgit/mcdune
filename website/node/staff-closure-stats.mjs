import {readFileSync} from 'node:fs';
export const PERSONAL_DEPARTMENT_THRESHOLD=25;
export const STAFF_CLOSURES_SQL=readFileSync(new URL('../integrations/staff-closure-counts.sql',import.meta.url),'utf8');
export const DEPARTMENT_KEYS={'Support':'support','Ban appeals':'ban-appeals','Forum support':'forum-support','Legal':'legal','Sales':'sales','Network staff':'network-staff','Dev team':'dev'};
// Actor is the verified closer, never the assignee. No ticket IDs leave this adapter.
export async function staffClosureStats(db){
 try{
  const {results}=await db.prepare(STAFF_CLOSURES_SQL).all();const stats=new Map();
  for(const row of results){const count=Number(row.closed_count);if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid closure count');const value=stats.get(row.website_id)||{totalClosed:0,departments:{}};value.totalClosed+=count;const key=DEPARTMENT_KEYS[row.department_name];if(key)value.departments[key]=(value.departments[key]||0)+count;stats.set(row.website_id,value);}
  return stats;
 }catch{return null;}
}
export function statsForAccount(stats,id){return stats===null?null:stats.get(id)||{totalClosed:0,departments:{}};}

export const departmentAwardEarned=(stats,key)=>Number.isSafeInteger(stats?.departments?.[key])&&stats.departments[key]>=PERSONAL_DEPARTMENT_THRESHOLD;
