import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateComparableSales} from '../lib/comparableSalesEvidence.mjs';
import {freeResearchSale} from '../lib/cardApiSalesAdapter.mjs';
import {createCatalogEvidenceAdapter,reconcileCatalogIdentity} from '../lib/catalogIdentityEvidence.mjs';
import {salesContext,sportsTarget,syntheticSale} from './helpers/completedSalesFixture.mjs';

const target={...sportsTarget,subject:'Shohei Ohtani',year:'2018',set:'Topps Series 2',collectorNumber:'700',
 parallel:'Base',variation:'Pitching photo'};
const claims={category:'sports',subjects:['Shohei Ohtani'],year:'2018',set:'Topps Series 2',number:'700',parallel:'Base',photoPose:'pitching'};
const pinned=createCatalogEvidenceAdapter({id:'synthetic-catalog',provenance:'Synthetic fixture only'},input=>input);
const catalog=pinned({recordId:'synthetic-ohtani',revision:'fixture-1',claims});
const identityEvidence=reconcileCatalogIdentity({proposal:claims,records:[catalog]});
const context=()=>{
 const policy=salesContext(target);
 policy.policies[0].reviewedTransactionEvidence=true;
 return {...policy,identityEvidence,verifyPhysicalTarget:proof=>proof.target===policy.target&&proof.identityEvidence===identityEvidence};
};
const receipt=(id='1',override={})=>syntheticSale(id,{
 identity:target,buyerPremium:'excluded',settlement:'independently_verified',settlementReference:'synthetic-payment',
 finalAmountEvidence:{status:'independently_verified',reference:'synthetic-receipt'},...override,
});
const grade=(provider,grade)=>({status:'graded',provider,grade,qualifier:null,verified:true});
const row=(record,options={})=>evaluateComparableSales([record],{...context(),...options}).rows[0];

test('a synthetic independently reviewed sale passes both gates; public economics stays withheld',()=>{
 const result=evaluateComparableSales([receipt()],context());
 assert.equal(result.version,1);
 assert.equal(result.counts.qualified,1,JSON.stringify(result.rows[0].reasons));
 assert.equal(result.rows[0].finalAmountStatus,'independently_verified');
 assert.equal(result.rows[0].settlementStatus,'independently_verified');
 assert.equal(result.readiness.automaticEconomicsAllowed,false);
 for(const identity of [undefined,identityEvidence]){
  const unverified=row(receipt(),{identityEvidence:identity,verifyPhysicalTarget:undefined});
  assert.notEqual(unverified.classification,'qualified');
  assert.ok(unverified.reasons.includes('target_physical_printing_unverified'));
 }
});

test('factory set, photo variation, different grade, active listings and lots are mismatches',()=>{
 for(const [record,reason,options] of [
  [receipt('1',{identity:{...target,parallel:'Factory Complete Set Variation'}}),'provider_parallel_conflict'],
  [receipt('1',{identity:{...target,variation:'Batting photo'}}),'provider_variation_conflict'],
  [receipt('1',{grading:grade('PSA',10)}),'requested_grade_mismatch',{cohort:'PSA 9'}],
  [receipt('1',{status:'active'}),'active_asking_listing'],
  [receipt('1',{quantity:2,lotStatus:'lot'}),'multi_card_transaction'],
 ]){
  const result=row(record,options);
  assert.equal(result.classification,'mismatch',reason);
  assert.ok(result.reasons.includes(reason),reason);
 }
 for(const provider of ['Beckett','CGC','SGC','TAG']){
  const result=row(receipt('1',{grading:grade(provider,9)}));
  assert.equal(result.grading.company,provider==='Beckett'?'BGS':provider);
  assert.notEqual(result.classification,'qualified');
 }
});

test('unknown offer, unknown Raw status, provider-only prices and cost inclusions remain unqualified',()=>{
 const offer=row(receipt('1',{transactionType:'accepted_offer',finalOfferPriceConfirmed:false}));
 assert.equal(offer.classification,'insufficient');
 assert.equal(offer.reportedAmount,null);
 const unknown=row(receipt('1',{grading:null}),{cohort:'Raw'});
 assert.equal(unknown.grading.status,'unknown');
 assert.equal(unknown.classification,'insufficient');
 const fixed=row(receipt('1',{settlement:'provider_confirmed',finalAmountEvidence:null,shipping:null,buyerPremium:null}));
 assert.equal(fixed.classification,'plausible');
 assert.equal(fixed.finalAmountStatus,'provider_reported');
 assert.equal(fixed.settlementStatus,'unverified');
 for(const reason of ['independent_settlement_missing','price_inclusions_unknown','buyer_premium_treatment_unknown'])assert.ok(fixed.reasons.includes(reason));
});

test('only supported transaction IDs deduplicate; conflicting premium copies withhold both',()=>{
 const a=receipt('1'),b=receipt('2',{source:{...a.source,listingId:'alternate-listing'}});
 const duplicate=evaluateComparableSales([a,b],context());
 assert.deepEqual(duplicate.rows.map(row=>row.classification),['qualified','mismatch']);
 assert.ok(duplicate.rows[1].reasons.includes('duplicate_transaction'));
 const conflict=evaluateComparableSales([a,{...b,buyerPremium:'included'}],context());
 assert.equal(conflict.counts.qualified,0);
 assert.ok(conflict.rows.every(row=>row.reasons.includes('conflicting_duplicate_buyer_premium')));
 assert.equal(evaluateComparableSales([a,receipt('2')],context()).counts.qualified,2);
});

test('the Free tier remains temporary and reports unknown Best Offers separately from provider prices',()=>{
 const listing={id:'synthetic-free',platform:'ebay',sold:'2026-11-14',price:120,currency:'USD',
  identityMatch:{status:'plausible_unverified',gradeEvidence:{label:'Grade status unknown'}}};
 const contextFree={...context(),scope:'free_research',cohort:'Raw'};
 const fixed=freeResearchSale({...listing,listingType:'fixed_price',amountReportedConfirmed:true},contextFree.now);
 const offer=freeResearchSale({...listing,id:'synthetic-offer',listingType:'best_offer',amountReportedConfirmed:false},contextFree.now);
 const result=evaluateComparableSales([fixed,offer],contextFree);
 assert.equal(result.counts.restricted,2);
 assert.ok(result.rows.every(row=>row.researchCandidate&&row.insufficientTransactionEvidence&&row.rights.retention==='ephemeral_only'));
 assert.deepEqual(result.rows.map(row=>row.finalAmountStatus),['provider_reported','unknown']);
 assert.ok(result.rows.every(row=>row.source.transactionId===null&&row.quantity===null));
});

test('readiness requires comparable cohort samples on the same currency and inclusion basis',()=>{
 const records=['Raw','PSA 8','PSA 9','PSA 10'].flatMap(group=>[0,1,2].map(index=>
  receipt(group.replace(' ','')+'-'+index,group==='Raw'?{}:{grading:grade('PSA',Number(group.slice(4)))})));
 const accepted=evaluateComparableSales(records,context());
 assert.equal(accepted.counts.qualified,12);
 assert.deepEqual(accepted.readiness.blockers,['automatic_economics_not_enabled']);
 const split=evaluateComparableSales(records.map((r,index)=>index>=9?{...r,buyerPremium:'included'}:r),context());
 assert.equal(split.counts.qualified,12);
 assert.ok(split.readiness.blockers.includes('insufficient_compatible_cohort_samples'));
});
