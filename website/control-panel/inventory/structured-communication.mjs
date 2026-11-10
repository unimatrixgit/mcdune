/** Fictional Belgian-style OGM; use the sale ID as authoritative identity. */
export function exchangeSaleOgm(id) {
  if (typeof id !== 'string' || !/^[1-9][0-9]*$/.test(id)) return null;
  const value=BigInt(id);
  if (value>9999999999n) return null;
  const base=id.padStart(10,'0');
  const check=String(Number(value%97n)||97).padStart(2,'0');
  const digits=base+check;
  return '+++'+digits.slice(0,3)+'/'+digits.slice(3,7)+'/'+digits.slice(7)+'+++';
}
export function validOgm(value) {
  const match=typeof value==='string'&&/^\+\+\+(\d{3})\/(\d{4})\/(\d{5})\+\+\+$/.exec(value);
  if(!match)return false;
  const digits=match.slice(1).join('');
  return Number(digits.slice(10))===(Number(BigInt(digits.slice(0,10))%97n)||97);
}
