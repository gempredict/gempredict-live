// Audit reproductions only. No provider payloads, credentials, URLs or live calls.
// All review metadata, IDs, timestamps and prices below are SYNTHETIC scaffolding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptTheCardApi,matchProviderIdentity,PIKACHU_TARGET as card,PIKACHU_CROSSWALK as pending} from '../lib/providers/theCardApiAdapter.mjs';
import {analyzeCompletedSales} from '../lib/completedSales.mjs';
import {scoreListing,getListingType} from '../lib/ebayIdentityMatch.mjs';
import {matchesVariantValuation,expandVariantAliases} from '../lib/variantVerification.mjs';
const now=Date.parse('2026-10-29T23:59:59Z');
const observedTitle='Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil';
const row=()=>({id:'SYNTHETIC-ID',platform:'TCGplayer',title:observedTitle,card_set:'ME: 30th Celebration',card_number:'149/128',sale_date:'2026-10-28',sold_at:'2026-10-28T12:00:00Z',price:1,currency:'USD',price_confirmed:true,listing_type:'fixed_price',grade:null,grader:null,condition:'SYNTHETIC CONDITION',shipping_price:0});
const crosswalk=()=>({...pending,mappings:[{status:'reviewed',reviewedBy:'SYNTHETIC',reviewedAt:'2026-10-28T00:00:00Z',reference:'SYNTHETIC NOT REAL',canonical:{...card},provider:{subject:'Pikachu ex',set:'ME: 30th Celebration',number:'149/128',productId:'SYNTHETIC-PRODUCT',language:'English',rarity:'SIR',printing:'Holofoil'}}]});
const review=r=>({status:'reviewed',reference:'SYNTHETIC NOT REAL',providerTransactionId:r.id,marketplace:'TCGplayer',sourceItemId:'SYNTHETIC-PRODUCT',sourceTransactionId:r.id,observedAt:'2026-10-29T12:00:00Z',rawVerified:true,amountBasis:'per_card'});
test('usable product_id is a hard current adapter dependency, not supplied by title or provider transaction ID',()=>{
 const r=row(),c=crosswalk();
 assert.equal(matchProviderIdentity(r,card,{now,crosswalk:c}).status,'unresolved');
 for(const patch of [{product_id:null},{productId:'SYNTHETIC-PRODUCT'},{sourceItemId:'SYNTHETIC-PRODUCT'},{product_id:123}])assert.notEqual(matchProviderIdentity({...r,...patch},card,{now,crosswalk:c}).status,'verified');
 assert.equal(matchProviderIdentity({...r,product_id:'SYNTHETIC-PRODUCT'},card,{now,crosswalk:c}).status,'verified');
});
test('real title shape fails downstream language and special-art checks even with hypothetical valid rights/provenance',()=>{
 const descriptor={player:card.subject,year:card.year,set:card.brandSet,cardNumber:card.cardNumber,parallel:expandVariantAliases(card.parallel),language:card.language,autoOrRelic:card.autoOrRelic};
 const score=scoreListing(expandVariantAliases(observedTitle),'',descriptor,{});
 assert.equal(score.comparable,false);assert.ok(score.reasons.some(r=>/language/i.test(r)));assert.ok(score.reasons.some(r=>/parallel/i.test(r)));
 assert.equal(matchesVariantValuation({title:observedTitle},card),false);
 const records=['a','b','c'].map(id=>({identity:{...card},title:observedTitle,evidenceType:'verified_fixed_price_sale',amountBasis:'actual_transaction',soldAt:'2026-10-28T12:00:00Z',transactionStatus:'completed',currency:'USD',amount:1,grading:{status:'raw',company:null,grade:null},provenance:{providerId:'SYNTHETIC',marketplace:'SYNTHETIC',sourceItemId:'SYNTHETIC',transactionId:id,observedAt:'2026-10-29T12:00:00Z',delivery:'licensed_api',rightsReference:'SYNTHETIC NOT REAL'}}));
 const a=analyzeCompletedSales({status:'available',providerId:'SYNTHETIC',rights:{reference:'SYNTHETIC NOT REAL',commercialDisplay:true,transactionRecords:true},records},card,{now});
 assert.equal(a.accepted.length,0);assert.ok(a.excluded.every(x=>x.reason==='listing_evidence_conflict'));
});
test('PSA fields alone do not satisfy downstream graded-title classification',()=>{
 assert.equal(getListingType(observedTitle,'',{grading:{status:'graded',company:'PSA',grade:'9'}}),'raw');
});
test('current exporter intentionally blocks rights and drops condition/shipping/quantity: do not call it live-ready',()=>{
 const r={...row(),product_id:'SYNTHETIC-PRODUCT',quantity:1};
 const a=adaptTheCardApi([r],card,{now,crosswalk:crosswalk(),reviews:{[r.id]:review(r)}});
 assert.equal(a.transactions[0].status,'eligible_for_offline_evidence');
 assert.equal(a.completedSalesEnvelope.records.length,1);
 assert.equal(a.completedSalesEnvelope.status,'unavailable');assert.equal(a.completedSalesEnvelope.truncated,true);assert.equal(a.completedSalesEnvelope.records[0].provenance.delivery,'license_not_established');
 for(const field of ['condition','shipping','quantity','localizedAspects'])assert.equal(Object.hasOwn(a.completedSalesEnvelope.records[0],field),false);
 assert.equal(a.existingCompletedSalesAnalysis.status,'unavailable');assert.equal(a.valuationApproved,false);
});
test('current grade normalizer does not enforce boolean qualifier flags: audited gap, not an approval',()=>{
 const r={...row(),product_id:'SYNTHETIC-PRODUCT',grade:'9',grader:'PSA',has_grade_qualifier:true,grade_qualifier:null,label:null};
 const a=adaptTheCardApi([r],card,{now,crosswalk:crosswalk(),reviews:{[r.id]:review(r)}});
 // This documents the current permissive intermediate label; no production path is enabled.
 assert.equal(a.transactions[0].grading.group,'PSA 9');assert.equal(a.valuationApproved,false);assert.equal(a.existingCompletedSalesAnalysis.status,'unavailable');
});
