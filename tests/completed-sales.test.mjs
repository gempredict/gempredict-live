import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qualifyCompletedSales as qualify,completedSalesView,completedSalesEconomicsReference,SALES_COHORTS} from '../lib/completedSales.mjs';
import {readLiveCompletedSales,evaluateOfflineSalesAdapter} from '../lib/completedSalesProvider.mjs';
import {salesContext,pokemonTarget,sportsTarget,syntheticSale as sale,syntheticSales,offlineFixtureAdapter} from './helpers/completedSalesFixture.mjs';
import {renderReports,unifiedReportInteraction} from './helpers/renderReports.mjs';
import {reportFromResponse,protectFinancialReport,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {fraxureScan} from './helpers/fraxureFixture.mjs';
const reason=(r,code,context=salesContext())=>{const b=qualify([r],context);assert.equal(b.qualified.length,0);assert.ok(b.quarantined[0].reasons.includes(code),JSON.stringify(b.quarantined));};
const summary=b=>b.summaries[0].samples[0];
test('synthetic exact Pokémon printing uses reviewed mapping, full denominator, language and distinct finish evidence',()=>{
 const b=qualify(syntheticSales(),salesContext());assert.equal(b.qualified.length,3);assert.equal(summary(b).medianMinor,4349);assert.equal(summary(b).lowMinor,2799);assert.equal(summary(b).highMinor,4799);assert.equal(b.automaticEconomicsAllowed,false);
 for(const [field,value] of Object.entries({year:'2020',set:'Cosmic Eclipse',collectorNumber:'155/235',language:'Japanese',rarity:'Rare',parallel:'Holo',finish:'holo',variation:'alternate',stamp:'anniversary',regulationMark:'J'}))reason(sale('1',{identity:{...pokemonTarget,[field]:value}}),'provider_'+field+'_conflict');
 reason(sale('1',{identityEvidence:{method:'ai_prediction',mappingId:'synthetic-mapping'}}),'exact_printing_evidence_missing');
 for(const change of [{revision:'stale'},{productId:'different'}])reason(sale('1',{identityEvidence:{...sale().identityEvidence,...change}}),'exact_printing_evidence_missing');
 const c=salesContext();c.mappings[0].identity.collectorNumber='155/235';reason(sale(),'identity_collectorNumber_mismatch',c);
 const incomplete=salesContext({...pokemonTarget,finish:null});reason(sale(),'target_identity_incomplete',incomplete);
});
test('sports alphanumeric numbers and exact parallels stay strict; copy serial is distinct from print-run identity',()=>{
 const t={...sportsTarget,parallel:'Green Refractor',printRun:'99'},c=salesContext(t),r=sale('1',{identity:t,copySerial:'96/99'});
 assert.equal(qualify([r],c).qualified.length,1);assert.equal(qualify([{...r,copySerial:'12/99'}],c).qualified.length,1);
 reason({...r,identity:{...t,collectorNumber:'BCP-68'}},'provider_collectorNumber_conflict',c);
 reason({...r,identity:{...t,printRun:'250'}},'provider_printRun_conflict',c);
 reason({...r,copySerial:'96/250'},'copy_serial_print_run_conflict',c);
 reason({...r,copySerial:'100/99'},'copy_serial_print_run_conflict',c);
 reason({...r,identity:{...t,parallel:'Green Foil'}},'provider_parallel_conflict',c);
 // A stamp alone cannot establish the exact parallel.
 reason({...r,identityEvidence:null,copySerial:'96/99'},'exact_printing_evidence_missing',c);
});
test('raw, PSA 8/9/10 have separate medians and no unsupported grader, grade, qualifier or inferred raw status',()=>{
 const records=SALES_COHORTS.flatMap((g,i)=>syntheticSales(g,[String(10+i*10),String(20+i*10),String(30+i*10)]));
 const b=qualify(records,salesContext());assert.deepEqual(b.summaries.map(x=>x.samples[0].medianMinor),[2000,3000,4000,5000]);
 for(const g of [{status:'graded',provider:'BGS',grade:10,qualifier:null,verified:true},{status:'graded',provider:'PSA',grade:7,qualifier:null,verified:true},{status:'graded',provider:'PSA',grade:9,qualifier:'OC',verified:true},{status:'raw',provider:null,grade:null,qualifier:null,verified:false},null])reason(sale('1',{grading:g}),'grade_or_raw_status_unverified');
});
test('completed amount must be confirmed; asking/ended/canceled/refunded sales and unresolved best offers are excluded',()=>{
 for(const status of ['active','ended','canceled','refunded','unknown'])reason(sale('1',{status}),'not_completed_sale');
 reason(sale('1',{priceConfirmed:false,original_price:27.99}),'final_amount_unconfirmed');
 reason(sale('1',{transactionType:'accepted_offer',finalOfferPriceConfirmed:false}),'final_amount_unconfirmed');
 assert.equal(qualify([sale('1',{transactionType:'accepted_offer',finalOfferPriceConfirmed:true})],salesContext()).qualified.length,1);
 reason(sale('1',{settlement:'independently_verified'}),'independent_settlement_reference_missing');
 assert.equal(qualify([sale()],salesContext()).qualified[0].settlement,'provider_confirmed');
});
test('quantity, lots, money units and inclusion semantics cannot default to usable amounts',()=>{
 for(const amount of [null,{value:27.99,currency:'USD',basis:'per_card',unit:'major'},{value:'27.99',currency:null,basis:'per_card',unit:'major'},{value:2799,currency:'USD',basis:'listing',unit:'minor'},{value:27.99,currency:'USD',basis:'per_card',unit:'minor'},{value:'27.999',currency:'USD',basis:'per_card',unit:'major'},{value:'27.99',currency:'JPY',basis:'per_card',unit:'major'}])reason(sale('1',{amount}),'amount_units_currency_or_basis_unknown');
 for(const overrides of [{quantity:null},{quantity:2},{lotStatus:'lot'},{lotStatus:null}])reason(sale('1',overrides),'single_card_quantity_not_established');
 for(const overrides of [{shipping:null},{tax:'unknown'}])reason(sale('1',overrides),'price_inclusions_unknown');
 reason(sale('1',{condition:null}),'raw_condition_unestablished');
 const mixed=qualify([...syntheticSales(),sale('played',{condition:'lightly_played'})],salesContext());assert.equal(mixed.summaries[0].samples.length,2);
 const b=qualify([sale('1',{amount:{value:2799,currency:'USD',unit:'minor',basis:'per_card'}})],salesContext());assert.equal(b.qualified[0].minor,2799);
});
test('dedup uses underlying transaction not shared listing; contradictions and cancellation updates quarantine both',()=>{
 const a=sale('1'),b=sale('2');assert.equal(qualify([a,b],salesContext()).qualified.length,2);
 const duplicate=qualify([a,{...a,providerRecordId:'different-record'}],salesContext());assert.equal(duplicate.qualified.length,1);assert.deepEqual(duplicate.quarantined[0].reasons,['duplicate_transaction']);
 for(const changed of [{...a,amount:{...a.amount,value:'99.99'}},{...a,status:'canceled'}]){const out=qualify([a,changed],salesContext());assert.equal(out.qualified.length,0);assert.ok(out.quarantined.some(q=>q.reasons.includes('conflicting_duplicate_transaction')));}
 reason(sale('1',{source:{...a.source,transactionId:null}}),'stable_transaction_identity_missing');
 const c=salesContext();c.policies[0].providerRecordIsUniqueTransaction=true;assert.equal(qualify([sale('1',{source:{...a.source,transactionId:null}})],c).qualified.length,1);
});
test('dates, freshness, exact mapping and permissions fail closed independently of record rights claims',()=>{
 for(const saleDate of ['2026-02-30','not-a-date','2026-11-11','2026-01-01'])reason(sale('1',{saleDate}),'sale_date_invalid_or_outside_window');
 reason(sale('1',{retrievedAt:null}),'data_freshness_unestablished');
 reason(sale('1',{retrievedAt:'2026-11-07T11:00:00Z'}),'data_freshness_unestablished');
 for(const override of [{approved:false},{rights:{commercialCalculation:true,summaryDisplay:false,reference:'x',expiresAt:'2026-12-01T00:00:00Z'}},{rights:{commercialCalculation:true,summaryDisplay:true,reference:'x',expiresAt:'2026-11-01T00:00:00Z'}}]){const c=salesContext();Object.assign(c.policies[0],override);reason(sale('1',{commercialUseApproved:true}),'commercial_use_not_authorized',c);}
 reason(sale('1',{commercialUseApproved:true}),'commercial_use_not_authorized',{...salesContext(),policies:[]});
});
test('sparse, currency and price-basis partitions; exact even median arithmetic; no fake lookback history',()=>{
 const b=qualify(syntheticSales('Raw',['20','30']),salesContext());assert.equal(summary(b).count,2);assert.equal(summary(b).medianMinor,null);assert.equal(summary(b).lowMinor,null);
 const even=qualify(syntheticSales('Raw',['1.00','1.01','2.00','2.01']),salesContext());assert.equal(summary(even).medianMinor,150.5);assert.equal(completedSalesEconomicsReference(even,{group:'Raw',currency:'USD',shipping:'excluded',tax:'excluded',condition:'near_mint'}).available,false);
 const records=syntheticSales();records.push(sale('eur',{amount:{value:'99',unit:'major',basis:'per_card',currency:'EUR'}}),sale('inc',{shipping:'included'}));const out=qualify(records,salesContext());assert.equal(out.summaries[0].samples.length,3);assert.equal(out.coverage.lookbackDays,3);assert.equal(out.coverage.complete,false);assert.equal(out.coverage.reportedTotal,2105);assert.equal(summary(out).firstSale,'2026-11-09');
});
test('licensed summary-only policy never exports individual transactions to the view; unsafe source URLs are suppressed',()=>{
 const c=salesContext();c.policies[0].rights.transactionDisplay=false;const b=qualify(syntheticSales(),c);assert.equal(summary(b).transactions.length,0);const html=renderReports({cardTitle:'Synthetic card'},b).upper;assert.doesNotMatch(html,/Permitted supporting transactions|synthetic-source-0|example.invalid/);assert.match(html,/Transaction display is not authorized/);
 for(const url of ['https://example.invalid/transaction/wrong-sale','https://evil.invalid/x','http://example.invalid/x','https://example.invalid/x?token=secret','https://user:secret@example.invalid/x'])assert.equal(qualify([sale('1',{source:{...sale().source,url}})],salesContext()).qualified[0].sourceUrl,null);
});
test('offline fixture adapter and zero-request disabled live path enforce row bounds with no network/retry fallback',async()=>{
 const result=await evaluateOfflineSalesAdapter(offlineFixtureAdapter(syntheticSales()),salesContext());assert.equal(result.qualified.length,3);
 await assert.rejects(evaluateOfflineSalesAdapter(offlineFixtureAdapter(Array.from({length:76},(_,i)=>sale(String(i)))),salesContext()),/cap/);
 await assert.rejects(evaluateOfflineSalesAdapter({mode:'live',read:()=>{throw Error('must not call');}},salesContext()),/Only offline/);
 for(const options of [{enabled:true,credentials:'not-real',approved:true},{}])assert.deepEqual(await readLiveCompletedSales(options),{enabled:false,status:'provider_disabled',reason:'No commercially approved completed-sales provider or reviewed live mapping',requests:0});
 assert.throws(()=>qualify(syntheticSales(),{...salesContext(),windowDays:91}),/bounded/);
 const provider=fs.readFileSync('lib/completedSalesProvider.mjs','utf8');assert.doesNotMatch(provider,/fetch\(|https:\/\/|process.env/);
});
test('actual unified report renders all four qualified sample cohorts but no automatic economics; saved/client forgery fails closed',async()=>{
 const e=qualify(SALES_COHORTS.flatMap(g=>syntheticSales(g)),salesContext());const response=await fraxureScan();const report=reportFromResponse(response.payload),html=renderReports(report,e).upper;
 for(const group of SALES_COHORTS)assert.ok(html.includes('<h4>'+group+'</h4>'));assert.match(html,/USD 43.49/);assert.match(html,/3 sales/);assert.match(html,/Provider-confirmed amount; settlement not independently verified/);assert.match(html,/Provider lookback: 3 days/);assert.match(html,/Completeness: partial sample/);assert.match(html,/Valuation and grading recommendations are withheld/);
 const forged=JSON.parse(JSON.stringify(e));assert.equal(completedSalesView(forged),null);assert.equal(completedSalesView({...e}),null);assert.ok(Object.isFrozen(e.qualified));
 const saved=protectFinancialReport({...report,completedSales:e,rawValue:4349,financialDecision:{allowed:true}});for(const f of FINANCIAL_FIELDS)assert.equal(saved[f],null);assert.equal(saved.financialDecision.allowed,false);
 assert.doesNotMatch(renderReports(saved).upper,/USD 43.49|Permitted supporting transactions/);assert.match(renderReports(saved,forged).upper,/Verified sales data isn&#x27;t available yet/);assert.doesNotMatch(protectedCopySummary(saved),/USD 43.49/);
 const readOnly=completedSalesEconomicsReference(e,{group:'PSA 9',currency:'USD',shipping:'excluded',tax:'excluded'});assert.equal(readOnly.available,true);assert.equal(readOnly.salePrice,43.49);assert.equal(readOnly.automaticEconomicsAllowed,false);assert.ok(Object.isFrozen(readOnly));
 let copied='',out;const ui=unifiedReportInteraction(report,{navigator:{clipboard:{writeText:s=>{copied=s;}}}});const tree=ui.render({completedSalesEvidence:e,onSave:r=>{out=r;}});for(const name of ['Copy Summary','Save Report'])ui.nodes(tree,n=>n.type==='button'&&n.props.children===name)[0].props.onClick();assert.equal(out.completedSalesEvidence,undefined);assert.equal(out.financialDecision.allowed,false);assert.doesNotMatch(copied,/USD 43.49/);
});
