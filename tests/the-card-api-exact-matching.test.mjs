import test from 'node:test';
import assert from 'node:assert/strict';
import {completionDateCheck} from '../lib/providers/theCardApiDates.mjs';
import {normalizeSale,PIKACHU_TARGET} from '../lib/providers/theCardApiAdapter.mjs';
import {CASES,candidateMatch,summarizeCoverage} from '../scripts/the-card-api/coverage.mjs';
const now=Date.parse('2026-10-29T23:00:00Z');
// Synthetic contract examples, not additional observed transactions.
const base={id:'synthetic',platform:'TCGplayer',title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil',card_set:'ME: 30th Celebration',card_number:'149/128',sale_date:'2026-10-29',sold_at:'2026-10-29T12:00:00Z',price:27.99,original_price:null,currency:'USD',price_confirmed:true,listing_type:'fixed_price'};
const body=data=>({data,pagination:{total:data.length,page:1,limit:25},meta:{}});
test('documented structured set and full number can screen a candidate without full title terms',()=>{
 assert.equal(candidateMatch({...base,title:'Pikachu ex'},CASES[1]),true);
 for(const patch of [{card_number:'149'},{card_number:'150/128'},{card_set:'Surging Sparks'},{language:'Japanese'},{printing:'Reverse Holofoil'},{rarity:'Double Rare'},{title:'Pikachu ex - 150/128 - ME: 30th Celebration - Holofoil'},{title:'Pikachu ex - 149/128 - Surging Sparks - Holofoil'}])assert.equal(candidateMatch({...base,...patch},CASES[1]),false);
 const r=summarizeCoverage(body([{...base,title:'Pikachu ex'}]),CASES[1],now);assert.equal(r.candidateExactCardMatches,1);assert.equal(r.localIdentityStatus.verified,0);assert.equal(r.valuationApproved,false);assert.equal(r.priceStatistics.median,null);
});
test('date failure taxonomy separates missing, impossible, future and conflicting dates without echoing values',()=>{
 assert.deepEqual(completionDateCheck(base,now),{valid:true,reason:null});
 for(const [patch,reason] of [[{sale_date:null},'sale_date_missing_or_invalid'],[{sold_at:'PRIVATE'},'sold_at_missing_or_invalid'],[{sold_at:'2026-10-29T24:00:00Z'},'sold_at_missing_or_invalid'],[{sold_at:'2026-02-30T12:00:00Z'},'sold_at_calendar_invalid'],[{sold_at:'2026-10-30T00:00:00Z'},'completion_in_future'],[{sale_date:'2026-10-28'},'sale_date_sold_at_conflict']]){
  const check=completionDateCheck({...base,...patch},now);assert.deepEqual(check,{valid:false,reason});assert.doesNotMatch(JSON.stringify(check),/PRIVATE|2026/);
  assert.ok(normalizeSale({...base,...patch},PIKACHU_TARGET,{now}).blockers.includes('transaction_timestamp_missing_invalid_or_conflicting'));
 }
});
test('aggregate reason and field support counts reveal gaps without retaining field values',()=>{
 const rows=[{...base,product_id:'PRIVATE PRODUCT',language:null,listing_url:'https://www.tcgplayer.com/product/123'}, {...base,id:'synthetic2',sold_at:'PRIVATE',card_number:'150/128'}];
 const r=summarizeCoverage(body(rows),CASES[1],now);assert.deepEqual(r.allReturned.dateFailureReasons,{sold_at_missing_or_invalid:1});assert.deepEqual(r.allReturned.identityFieldSupport.product_id,{present:1,missing:1,null:0});assert.deepEqual(r.allReturned.identityFieldSupport.language,{present:0,missing:1,null:1});assert.equal(r.allReturned.sources.publicCatalogRoutes,1);assert.equal(r.valuationApproved,false);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|https:|synthetic/);
});
test('three owner-reported amounts retain unresolved printing, raw classification and settlement',()=>{
 for(const price of [27.99,47.99,43.49]){
  // Only title/date/amount facts are observed; synthetic base IDs/time are excluded.
  const r={title:base.title,sale_date:base.sale_date,price,currency:'USD',price_confirmed:true,listing_type:'fixed_price'};
  assert.equal(candidateMatch(r,CASES[1]),true);const n=normalizeSale(r,PIKACHU_TARGET,{now});assert.equal(n.identity.status,'unresolved');assert.equal(n.grading.group,'unknown');assert.equal(n.settlement.independentlyVerified,false);assert.equal(n.status,'blocked');
 }
});
