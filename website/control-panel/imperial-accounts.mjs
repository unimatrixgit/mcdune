// Internal Dunemarks identifiers, not SEPA accounts. Never used as authorization.
const types={player:['PL','101'],current:['CA','102'],clan:['CL','201'],faction:['FA','301'],server:['SV','979']};
export const accountSchema=`CREATE TABLE IF NOT EXISTS imperial_bank_accounts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,bank_type VARCHAR(12) NOT NULL,owner_key VARCHAR(64) NOT NULL,created_at BIGINT NOT NULL,UNIQUE KEY bank_owner(bank_type,owner_key)) ENGINE=InnoDB`;
export function accountNumber(type,id){
 const t=types[type];if(!t||!Number.isSafeInteger(Number(id))||Number(id)<1||Number(id)>9999999)throw Error('Invalid bank identifier');
 const base=t[1]+String(id).padStart(7,'0'),check=String(97-Number(BigInt(base)%97n)).padStart(2,'0');
 return ('DR'+t[0]+base+check).match(/.{4}/g).join(' ');
}
export function validAccountNumber(value){
 if(typeof value!=='string')return false;const raw=value.replaceAll(' ','');
 const type=Object.keys(types).find(k=>'DR'+types[k][0]===raw.slice(0,4));
 if(!type||!/^DR[A-Z]{2}\d{12}$/.test(raw)||raw.slice(4,7)!==types[type][1])return false;
 const id=Number(raw.slice(7,14));return id>0&&accountNumber(type,id).replaceAll(' ','')===raw;
}
export async function imperialAccount(db,type,owner){
 if(!types[type]||typeof owner!=='string')throw Error('Invalid bank owner');
 owner=owner.toLowerCase();
 if(['player','current','clan'].includes(type)&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(owner))throw Error('Invalid bank owner');
 if(type==='server'&&owner!=='network'||type==='faction'&&!['atreides','harkonnen','corrino','ordos','fremen','veiled_concord','spacing_guild'].includes(owner))throw Error('Invalid bank owner');
 const existing=await db.prepare('SELECT id FROM imperial_bank_accounts WHERE bank_type=? AND owner_key=?').bind(type,owner).first();
 if(existing)return accountNumber(type,Number(existing.id));
 const [result]=await db.batch([{async run(connection){
  await connection.execute('INSERT INTO imperial_bank_accounts(bank_type,owner_key,created_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE owner_key=VALUES(owner_key)',[type,owner,Date.now()]);
  const [[row]]=await connection.execute('SELECT id FROM imperial_bank_accounts WHERE bank_type=? AND owner_key=? FOR UPDATE',[type,owner]);
  return accountNumber(type,Number(row.id));
 }}]);return result;
}
