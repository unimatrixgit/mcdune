import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMonthlyStatement,publicMonthlyReports} from '../control-panel/monthly-company-reports.mjs';
const sample={ticker:'DRSG',month:'2026-10',status:'published',publishedAt:1793500000000,sourceCutoffAt:1793491200000,revenueCents:10000,operatingExpensesCents:2000,taxCents:1000,profitCents:7000,spiceQuantity:500,spiceSalesCents:9000,ownerUuid:'private'};
test('public report reconciles and omits private account data',()=>{
 const report=projectMonthlyStatement(sample);
 assert.equal(report.profitCents,7000);
 assert.equal(report.ownerUuid,undefined);
 assert.equal(report.spiceQuantity,500);
});
test('drafts are not publicly projected',()=>{
 assert.deepEqual(publicMonthlyReports([{...sample,status:'draft'},sample]).map(r=>r.month),['2026-10']);
 assert.throws(()=>projectMonthlyStatement({...sample,profitCents:7001}));
});
test('unknown values are null, not fabricated zeros',()=>{
 assert.equal(projectMonthlyStatement({...sample,revenueCents:undefined,profitCents:null}).revenueCents,null);
});
