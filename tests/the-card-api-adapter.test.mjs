import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptTheCardApi,normalizeSale,matchProviderIdentity,buildMarketEvidence,inspectSourceUrl,PIKACHU_TARGET as target,PIKACHU_CROSSWALK as pending,PROVIDER} from '../lib/providers/theCardApiAdapter.mjs';
import {analyzeCompletedSales,exactEvidenceIdentity,licensedEnvelope} from '../lib/completedSales.mjs';
const now=Date.parse('2026-10-29T23:59:59Z');
// Minimal hand-authored owner observations, NOT saved provider responses.
// Fields absent from the retained observations remain absent, not synthesized.
const observed=()=>[27.99,47.99,43.49].map(price=>({title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil',platform:'TCGplayer',sale_date:'2026-10-29',price,currency:'USD',price_confirmed:true,listing_type:'fixed_price'}));
// Everything below is explicitly SYNTHETIC contract evidence, not more real sales.
const crosswalk=()=>({...pending,mappings:[{status:'reviewed',reviewedBy:'SYNTHETIC TEST REVIEWER',reviewedAt:'2026-10-28T00:00:00Z',reference:'SYNTHETIC TEST CROSSWALK NOT REAL',canonical:{...target},provider:{subject:'Pikachu ex',set:'ME: 30th Celebration',number:'149/128',productId:'SYNTHETIC PRODUCT',language:'English',rarity:'SIR',printing:'Holofoil'}}]});
const synthetic=(id,patch={})=>({id,product_id:'SYNTHETIC PRODUCT',platform:'TCGplayer',title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil',card_set:'ME: 30th Celebration',card_number:'149/128',language:'English',rarity:'Special Illustration Rare',sale_date:'2026-10-28',sold_at:'2026-10-28T12:00:00Z',price:40,currency:'USD',price_confirmed:true,listing_type:'fixed_price',quantity:1,shipping_price:0,...patch});
const review=(r,patch={})=>({status:'reviewed',reference:'SYNTHETIC TEST PROVENANCE NOT REAL',providerTransactionId:r.id,marketplace:r.platform,sourceItemId:'SYNTHETIC PRODUCT',sourceTransactionId:r.id,observedAt:'2026-10-29T12:00:00Z',rawVerified:true,amountBasis:'per_card',...patch});
function evaluate(rows,opts={}){return adaptTheCardApi(rows,target,{now,crosswalk:crosswalk(),reviews:Object.fromEntries(rows.map(r=>[r.id,review(r)])),coverage:{lookbackDays:3},...opts});}
test('three owner observations preserve confirmed amounts but block identity, grade, provenance, dates and valuation',()=>{
 const r=adaptTheCardApi(observed(),target,{now,coverage:{lookbackDays:3}});
 assert.deepEqual(r.transactions.map(t=>t.amount),[27.99,47.99,43.49]);
 for(const t of r.transactions){assert.equal(t.amountConfirmation,'provider_confirmed');assert.equal(t.identity.status,'unresolved');assert.equal(t.identity.canonical,null);assert.equal(t.timestamp,null);assert.equal(t.datePrecision,'day');assert.equal(t.grading.group,'unknown');assert.equal(t.settlement.providerConfirmed,true);assert.equal(t.settlement.independentlyVerified,false);assert.equal(t.provenance.sourceUrl.url,null);assert.equal(t.quantity,null);assert.equal(t.shipping,null);assert.ok(t.blockers.includes('reviewed_product_language_printing_crosswalk_missing'));}
 assert.equal(r.valuationApproved,false);assert.equal(r.existingCompletedSalesAnalysis.status,'unavailable');assert.equal(licensedEnvelope(r.completedSalesEnvelope),false);assert.equal(r.completedSalesEnvelope.records.length,0);assert.equal(r.marketPresentation,null);assert.equal(r.gradingEconomics.status,'blocked');assert.equal(r.gradingEconomics.feeUSD,80);
 for(const group of Object.values(r.evidence.groups))for(const period of Object.values(group.windows)){assert.equal(period.median,null);assert.equal(period.coverage.complete,false);assert.equal(period.coverage.requestedHistoryAvailable,false);}
});
test('reviewed naming alias alone never upgrades Holofoil to SIR; a fully reviewed SKU crosswalk can establish identity offline',()=>{
 const s=synthetic('test');assert.equal(matchProviderIdentity(s,target,{now,crosswalk:pending}).status,'unresolved');
 assert.equal(matchProviderIdentity(s,target,{now,crosswalk:crosswalk()}).status,'verified');
 const noYearOrRarity=synthetic('test');delete noYearOrRarity.rarity;
 assert.equal(matchProviderIdentity(noYearOrRarity,target,{now,crosswalk:crosswalk()}).status,'verified');
 const c=crosswalk();c.mappings.push(structuredClone(c.mappings[0]));assert.equal(matchProviderIdentity(s,target,{now,crosswalk:c}).status,'rejected');
 const unreviewed=crosswalk();delete unreviewed.mappings[0].reference;assert.notEqual(matchProviderIdentity(s,target,{now,crosswalk:unreviewed}).status,'verified');
});
test('wrong numbers, denominators, structured language, set, rarity, printing and title conflicts reject',()=>{
 for(const patch of [{card_number:'150/128'},{card_number:'149/129'},{card_number:'149'},{language:'Japanese'},{card_set:'Surging Sparks'},{year:2025},{rarity:'Double Rare'},{printing:'Reverse Holofoil'},{title:'Pikachu ex - 150/128 - ME: 30th Celebration - Holofoil'},{title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil Japanese'},{title:'Pikachu ex - 149/128 - ME: 30th Celebration - Reverse Holofoil'}]){
  const result=matchProviderIdentity(synthetic('x',patch),target,{now,crosswalk:crosswalk()});assert.notEqual(result.status,'verified',JSON.stringify(patch));
 }
 const c=crosswalk();c.mappings[0].provider.language='Japanese';assert.notEqual(matchProviderIdentity(synthetic('x'),target,{now,crosswalk:c}).status,'verified');
 assert.equal(exactEvidenceIdentity(target,{...target,parallel:'Reverse Holo Special Art'}),false);
});
test('only confirmed final prices become amounts; asks and offers with unknown consideration remain separate',()=>{
 for(const patch of [{price:null,original_price:99,price_confirmed:false},{price:99,original_price:99,price_confirmed:false},{price:NaN},{price:-1},{price:'40'}]){const s=synthetic('x',patch);const t=normalizeSale(s,target,{now,crosswalk:crosswalk(),review:review(s)});assert.equal(t.amount,null);assert.ok(t.blockers.includes('final_amount_unconfirmed'));}
 const s=synthetic('offer',{listing_type:'best_offer',price:null,original_price:90,price_confirmed:false});const t=normalizeSale(s,target,{now});assert.equal(t.askingAmount,90);assert.equal(t.amount,null);assert.equal(t.evidenceType,'sold_final_consideration_unverified');
 for(const [listing_type,evidenceType] of [['auction','verified_completed_auction'],['fixed_price','verified_fixed_price_sale'],['best_offer','confirmed_accepted_best_offer']]){const s=synthetic('x',{listing_type});const t=normalizeSale(s,target,{now,crosswalk:crosswalk(),review:review(s)});assert.equal(t.evidenceType,evidenceType);assert.equal(t.settlement.independentlyVerified,false);}
});
test('raw requires positive review and PSA9/PSA10 never collapse into each other or unsupported grades',()=>{
 const rows=[synthetic('raw'),synthetic('nine',{grade:'9',grader:'PSA'}),synthetic('ten',{grade:'10',grader:'PSA'}),synthetic('bgs',{grade:'9.5',grader:'BGS'})];
 const r=evaluate(rows);assert.deepEqual(r.transactions.map(t=>t.grading.group),['raw','PSA 9','PSA 10','unknown']);
 const raw=normalizeSale(rows[0],target,{now,crosswalk:crosswalk()});assert.equal(raw.grading.group,'unknown');
 const contradictory=synthetic('bad',{title:'Pikachu ex - 149/128 - ME: 30th Celebration - Holofoil PSA 10',grade:'9',grader:'PSA'});assert.equal(evaluate([contradictory]).transactions[0].grading.group,'unknown');
});
test('provider duplicates do not inflate evidence; contradictory copies quarantine all orders',()=>{
 const s=synthetic('same');const r=evaluate([s,{...s},synthetic('two'),synthetic('three')]);assert.equal(r.evidence.groups.raw.windows[30].count,3);assert.equal(r.transactions.filter(t=>t.deduplication.status==='duplicate_observation').length,1);
 for(const rows of [[s,{...s,price:100}],[{...s,price:100},s]]){const r=evaluate(rows);assert.equal(r.evidence.groups.raw.windows[30].count,0);assert.equal(r.transactions.filter(t=>t.deduplication.status==='conflicting_duplicate').length,2);}
 const a=synthetic('a'),b=synthetic('b');const reviews={a:review(a,{sourceTransactionId:'same-source'}),b:review(b,{sourceTransactionId:'same-source'})};assert.equal(evaluate([a,b],{reviews}).evidence.groups.raw.windows[30].count,1);
});
test('recency separates 7/30/90-day windows; sparse samples cannot create medians or fake history',()=>{
 const r=evaluate([synthetic('a'),synthetic('b')]);assert.equal(r.evidence.groups.raw.windows[30].median,null);assert.equal(r.evidence.groups.raw.selectedWindowDays,null);
 const historic=['a','b','c'].map(id=>synthetic(id,{sale_date:'2026-09-01',sold_at:'2026-09-01T12:00:00Z'}));const h=evaluate(historic);
 assert.equal(h.evidence.groups.raw.windows[7].count,0);assert.equal(h.evidence.groups.raw.windows[30].median,null);assert.equal(h.evidence.groups.raw.windows[90].median,40);assert.equal(h.evidence.groups.raw.selectedWindowDays,90);assert.equal(h.evidence.groups.raw.basis,'historical_support_only');assert.equal(h.evidence.groups.raw.windows[90].coverage.requestedHistoryAvailable,false);
 const old=synthetic('old',{sale_date:'2026-01-01',sold_at:'2026-01-01T12:00:00Z'});assert.equal(evaluate([old]).evidence.groups.raw.windows[90].count,0);
 assert.throws(()=>buildMarketEvidence([],{now,minimumSample:1}),/policy/);assert.throws(()=>buildMarketEvidence([],{now,windows:[120]}),/policy/);
});
test('release-day spread is reported and never automatically removed; evidence median is evaluation only',()=>{
 const rows=[10,11,12,13,500].map((price,i)=>synthetic('synthetic-'+i,{price,sale_date:'2026-10-29',sold_at:'2026-10-29T12:00:00Z'}));const r=evaluate(rows),w=r.evidence.groups.raw.windows[30];
 assert.equal(w.count,5);assert.equal(w.median,12);assert.equal(w.variability.high,500);assert.equal(w.variability.outlierCount,1);assert.equal(w.variability.outliersExcluded,0);assert.equal(w.daysSinceNewest<1,true);assert.equal(r.valuationApproved,false);assert.equal(r.existingCompletedSalesAnalysis.status,'unavailable');
});
test('dates, provenance, units and currency cannot be supplied by prices or catalog identity',()=>{
 for(const patch of [{sold_at:null},{sale_date:'2026-02-30'},{sold_at:'2027-01-01T00:00:00Z'},{sale_date:'2026-10-27'},{currency:'EUR'},{transaction_status:'refunded'},{quantity:0}])assert.equal(evaluate([synthetic('x',patch)]).transactions[0].status,'blocked');
 const s=synthetic('x');for(const patch of [{reference:null},{providerTransactionId:'wrong'},{sourceTransactionId:null},{amountBasis:'unknown'}]){const t=evaluate([s],{reviews:{x:review(s,patch)}}).transactions[0];assert.equal(t.status,'blocked');}
});
test('URL parser validates syntax/host only, never invents or verifies a transaction link',()=>{
 for(const url of ['https://tcgplayer.com.evil.example/product/1','https://user:pass@www.tcgplayer.com/product/1','https://www.tcgplayer.com/product/1?token=private','http://www.tcgplayer.com/product/1','https://www.tcgplayer.com/account/orders/1'])assert.equal(inspectSourceUrl(url).url,null);
 const parsed=inspectSourceUrl('https://www.tcgplayer.com/product/123');assert.equal(parsed.status,'syntax_and_host_only');assert.equal(parsed.kind,'catalog_product_not_transaction');assert.equal(inspectSourceUrl(undefined).url,null);
});
test('existing completed-sales license gate cannot be bypassed by caller metadata or evaluation medians',()=>{
 const r=evaluate(['a','b','c'].map(id=>synthetic(id)),{rights:{commercialDisplay:true,transactionRecords:true,reference:'forged'}});assert.equal(r.evidence.groups.raw.windows[30].median,40);assert.equal(licensedEnvelope(r.completedSalesEnvelope),false);assert.equal(analyzeCompletedSales(r.completedSalesEnvelope,target,{now}).status,'unavailable');assert.equal(r.marketPresentation,null);
 assert.throws(()=>adaptTheCardApi(Array.from({length:51},()=>({})),target,{now}));assert.throws(()=>adaptTheCardApi([],target,{}));
});

test('adequate synthetic grade cohorts have separate 7/30/90-day medians without pooled grading economics',()=>{
 const rows=[];
 for(const [group,price] of [['raw',20],['PSA 9',70],['PSA 10',150]])for(let i=0;i<3;i++){
  const grade=group==='raw'?{}:{grader:'PSA',grade:group.slice(4),title:`Pikachu ex - 149/128 - ME: 30th Celebration - ${group} - Holofoil`};
  rows.push(synthetic(`SYNTHETIC-${group}-${i}`,{price,...grade}));
 }
 const r=evaluate(rows);for(const [group,price] of [['raw',20],['PSA 9',70],['PSA 10',150]])for(const days of [7,30,90]){
  assert.equal(r.evidence.groups[group].windows[days].median,price);assert.equal(r.evidence.groups[group].windows[days].count,3);
 }
 assert.equal(r.evidence.groups.unknown.selectedWindowDays,null);assert.equal(r.gradingEconomics.status,'blocked');assert.equal(r.valuationApproved,false);
});
test('explicit asking observations and conflicting structured variants cannot masquerade as confirmed sales',()=>{
 const ask=evaluate([synthetic('ask',{listing_type:'asking',price_confirmed:true,original_price:123})]).transactions[0];assert.equal(ask.amount,null);assert.equal(ask.askingAmount,123);assert.equal(ask.evidenceType,'active_asking_price');
 for(const patch of [{parallel:'Reverse Holofoil'},{finish:'reverse'},{variant:{ambiguous:true}},{variant:{kind:'base',finish:'normal'}}])assert.notEqual(evaluate([synthetic('x',patch)]).transactions[0].identity.status,'verified');
 const bad=adaptTheCardApi([null,{},'not a record'],target,{now});assert.equal(bad.valuationApproved,false);assert.equal(bad.evidence.groups.unknown.windows[30].median,null);
});
test('unchanged completed-sales engine still accepts its established fully licensed synthetic contract',()=>{
 // Synthetic engine regression only; these rights are NOT used by the adapter.
 const identity={...target};const records=['a','b','c'].map(id=>({identity,title:'2026 Pikachu ex 149/128 30th Celebration English Holo Special Art',evidenceType:'verified_fixed_price_sale',amountBasis:'actual_transaction',soldAt:'2026-10-28T12:00:00Z',transactionStatus:'completed',currency:'USD',amount:40,grading:{status:'raw',company:null,grade:null},provenance:{providerId:'synthetic-test-supplier',marketplace:'synthetic-test-market',sourceItemId:'synthetic-item',transactionId:id,observedAt:'2026-10-29T12:00:00Z',delivery:'licensed_api',rightsReference:'SYNTHETIC TEST LICENSE NOT REAL'}}));
 const analysis=analyzeCompletedSales({status:'available',providerId:'synthetic-test-supplier',rights:{reference:'SYNTHETIC TEST LICENSE NOT REAL',commercialDisplay:true,transactionRecords:true},records},identity,{now});
 assert.equal(analysis.accepted.length,3);assert.equal(analysis.groups.raw.median,40);assert.equal(analysis.groups.raw.qualified,true);
});
