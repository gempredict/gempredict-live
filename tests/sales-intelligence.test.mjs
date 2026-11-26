import assert from 'node:assert/strict';
import test from 'node:test';
import { cardApiSalesAdapter } from '../lib/cardApiSalesAdapter.mjs';
import { evaluateSalesIntelligence,readProviderWindow,salesProviderRegistry } from '../lib/salesIntelligence.mjs';

const now='2026-11-26T12:00:00.000Z';
const identity={subject:'Shohei Ohtani',set:'Topps Series 2',year:'2018',collectorNumber:'700',parallel:'Base'};
const otherAdapter={normalize({reference,currency='USD',value=120,grader='PSA',grade=9,quantity=null},retrievedAt){
 return {providerRecordId:'synthetic-other',source:{marketplace:'ebay',transactionId:reference},saleDate:'2026-11-24',
  retrievedAt,status:'completed',transactionType:'fixed_price',priceConfirmed:true,settlement:'independently_verified',
  reportedAmount:{value,unit:'major',currency,basis:'unknown'},grading:{status:'graded',provider:grader,grade},identity,
  quantity,listingIdentityStatus:'plausible_unverified'};
}};
const registry={primary:'synthetic_other',providers:{
 ...salesProviderRegistry.providers,
 synthetic_other:{enabled:true,adapter:otherAdapter,verifiedTransactionReferences:true,lookbackDays:14},
 synthetic_extra:{enabled:true,adapter:otherAdapter,verifiedTransactionReferences:true,lookbackDays:7},
}};
const cardApiRow={id:'synthetic-card-api',platform:'ebay',sold:'2026-11-24',listingType:'fixed_price',price:120,currency:'USD',
 player:'Shohei Ohtani',set:'Topps Series 2',year:'2018',cardNumber:'700',grader:'PSA',grade:'9',
 identityMatch:{status:'plausible_unverified'},amountReportedConfirmed:true};
const evaluate=batches=>evaluateSalesIntelligence(batches,{registry,now,cohort:'PSA 9'});

test('existing Card API and another adapter combine while preserving grade, currency and outage provenance',()=>{
 const result=evaluate([
  {provider:cardApiSalesAdapter.id,rows:[cardApiRow,{...cardApiRow,id:'synthetic-offer',listingType:'best_offer',
   priceConfirmationStatus:'unknown',amountReportedConfirmed:null,grade:'10'}]},
  {provider:'synthetic_other',rows:[{currency:'CAD',grader:'BGS',grade:8,quantity:2},{grader:null,grade:null}]},
  {provider:'synthetic_extra',error:'provider_unavailable'},
  {provider:'card_ladder',rows:[{}]},
 ]);
 assert.equal(result.summary.recordsRetrieved,4);
 assert.deepEqual(result.summary.failedProviders,['synthetic_extra']);
 assert.deepEqual(result.summary.currencies,{USD:2,CAD:1});
 assert.deepEqual(result.summary.cohortCounts,{'PSA 9':1,'PSA 10':1,'BGS 8':1,Unknown:1});
 assert.equal(result.summary.priceUnknown,1);
 assert.equal(result.evidenceRows[0].settlementStatus,'unverified');
 assert.equal(result.evidenceRows[2].quantity,2);
 assert.equal(result.evidenceRows[2].reportedAmount.basis,'unknown');
 assert.equal(result.summary.valuationEligible,false);
 assert.ok(result.evidenceRows.every(row=>row.rights.retention==='ephemeral_only'&&!row.rights.commercialCalculation));
});
test('provider references flag duplicates and price conflicts without dropping records',()=>{
 const result=evaluate([
  {provider:'synthetic_other',rows:[{reference:'verified-transaction',value:100}]},
  {provider:'synthetic_extra',rows:[{reference:'verified-transaction',value:101}]},
 ]);
 assert.equal(result.summary.duplicateReferenceGroups,1);
 assert.equal(result.summary.conflictingReferenceGroups,1);
 assert.equal(result.summary.recordsRetrieved,2);
 const uncertain=evaluate([
  {provider:'synthetic_other',rows:[{}]},{provider:'synthetic_extra',rows:[{}]},
 ]);
 assert.equal(uncertain.summary.suspectedOverlapGroups,1);
 assert.deepEqual(uncertain.summary.suspectedOverlapIndexes,[0,1]);
 assert.equal(uncertain.summary.duplicateReferenceGroups,0);
 assert.equal(uncertain.comparableEvidence.counts.qualified,0);
});
test('provider failure is isolated in window reads and malformed batches',async()=>{
 const bad={readWindow:async()=>{throw Error('private');}};
 assert.deepEqual(await readProviderWindow(bad,{}),{status:502,error:'provider_unavailable'});
 const result=evaluate([{provider:'synthetic_other',rows:null},{provider:'the_card_api',rows:[cardApiRow]}]);
 assert.deepEqual(result.summary.failedProviders,['synthetic_other']);
 assert.equal(result.summary.recordsRetrieved,1);
});
