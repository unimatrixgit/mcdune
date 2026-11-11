import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../control-panel/server.mjs',import.meta.url),'utf8');

test('Control Panel routes the recovered bank modules without replacing legacy bank reads',()=>{
 for(const fragment of [
  "const banking=createBanking(db,settings,dependencies.banking)",
  "const bankTransfers=createBankTransfers(db,settings,dependencies.bankTransfers)",
  "const bankBeneficiaries=createBankBeneficiaries(db,dependencies.bankBeneficiaries)",
  "if(path==='/api/bank/personal'||path==='/api/bank/staff')return banking(request)",
  "if(path==='/api/v1/me/bank')return v1PersonalBank(request)",
  "if(path==='/api/bank/transfer-own'||path==='/api/bank/remittance')return bankTransfers(request)",
  "if(path==='/api/bank/beneficiaries')return bankBeneficiaries(request)"
 ])assert(source.includes(fragment),fragment);
});
test('v1 personal bank adapter is opt-in',()=>{
 assert(source.includes("settings.BANK_API_V1_ENABLED===true||settings.BANK_API_V1_ENABLED==='true'"));
});
