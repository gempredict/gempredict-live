import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCompletedSales, fetchCompletedSales, EVIDENCE_TYPES } from '../lib/completedSales.mjs';
import { calculateGradingEconomics } from '../lib/gradingEconomics.mjs';
import { financialEvidence } from '../lib/financialEvidence.mjs';
import { analyzePopulation } from '../lib/gradingPopulation.mjs';
import { protectValuation, reportFromPrediction, safeStoredReport, isValuationTrusted, isMarketAnalysisAvailable, marketAnalysisSummary } from '../lib/valuationProtection.mjs';
import { verifiedIdentity, verifiedVariant } from './helpers/verifiedIdentity.mjs';
import { syntheticSales, syntheticProbability } from './helpers/soldFixtures.mjs';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
const card={subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',parallel:'Holo Special Art',language:'English',autoOrRelic:'none'};
const now=Date.parse('2026-10-26T12:00:00Z');
const analyze=envelope=>analyzeCompletedSales(envelope,card,{now});
const payload=(sales=null)=>({...verifiedIdentity(card),variantVerification:verifiedVariant(card),prediction:{rawValue:56.99,psa9Value:75,psa10Value:180,psa10Probability:30},marketData:{marketSummary:{rawUsedCount:1,rawMedian:56.99,marketConfidence:20}},completedSales:sales});
test('synthetic transaction groups remain separate, deterministic, dated and source-referenced',()=>{
 const e=syntheticSales(card);const result=analyze(e);
 assert.equal(result.groups.raw.median,40);assert.equal(result.groups['PSA 9'].median,120);assert.equal(result.groups['PSA 10'].median,200);assert.equal(result.accepted.length,9);
 assert.equal(result.groups.raw.count,3);assert.equal(result.groups.raw.daysSinceNewest,6);assert.equal(result.groups.raw.qualified,true);
 assert.deepEqual(analyze({...e,records:[...e.records].reverse()}).groups,result.groups);
});
test('one $56.99 asking listing and modeled $75/$180/30% never authorize Skip It or verified FMV',()=>{
 const p=protectValuation(payload());const r=reportFromPrediction(p);
 assert.equal(r.valuationVerification.status,'provisional');assert.equal(isMarketAnalysisAvailable(r),true);assert.equal(isValuationTrusted(r),false);
 assert.equal(r.rawValue,56.99);assert.equal(r.marketData.marketSummary.fairMarketValue,null);assert.equal(r.marketData.marketSummary.valuationTrusted,false);
 assert.equal(r.verdict,'provisional');assert.equal(r.atlas,null);assert.equal(r.gemPredictScore,null);
 assert.equal(r.psa9Value,75);assert.equal(r.psa10Value,180);assert.equal(r.psa10Probability,30);assert.equal(r.expectedNetValue,-30.49);
 assert.equal(r.financialDecision.graded['PSA 9'].source,'modeled_estimate');assert.match(marketAnalysisSummary(r),/Provisional.*active_asking_price_listings.*modeled_estimate/);
});
test('actual sold prices take priority without clamping observed losing graded prices above raw',()=>{
 const result=financialEvidence({...payload(syntheticSales(card,{raw:100,psa9:50,psa10:70})),prediction:{psa9Value:500,psa10Value:1000,psa10Probability:30}},{now});
 assert.equal(result.projection.rawValue,100);assert.equal(result.projection.psa9Value,50);assert.equal(result.projection.psa10Value,70);assert.equal(result.projection.expectedGradedValue,56);
 assert.equal(result.status,'actionable');assert.equal(result.verdict,'skip');assert.equal(result.probability.qualified,false);assert.equal(result.netRange.high,-110);
});
test('positive Grade It requires recent raw/PSA9/PSA10 sales, calibration and robust modeled outcome',()=>{
 const base=payload(syntheticSales(card,{raw:20,psa9:150,psa10:250}));
 const uncalibrated=financialEvidence(base,{now});assert.equal(uncalibrated.actionable,false);
 const qualified=financialEvidence({...base,probabilityEvidence:syntheticProbability(card)},{now});
 assert.equal(qualified.actionable,true);assert.equal(qualified.verdict,'grade');assert.equal(qualified.probability.historicalPopulationRateUsed,false);
 const wrong=financialEvidence({...base,probabilityEvidence:{...syntheticProbability(card),identity:{...card,parallel:'Reverse Holo Special Art'}}},{now});assert.equal(wrong.actionable,false);
});
test('wrong set, year, number, variant, language, finish and conflicting structured attributes are excluded',()=>{
 for(const patch of [{brandSet:'Obsidian Flames'},{year:'2023'},{cardNumber:'149/198'},{parallel:'Reverse Holo Special Art'},{parallel:'Non-Holo Special Art'},{language:'Japanese'}]){
  const e=syntheticSales(card);e.records=e.records.map(r=>({...r,identity:{...r.identity,...patch}}));assert.equal(analyze(e).accepted.length,0);
 }
 const e=syntheticSales(card);e.records[0].localizedAspects=[{name:'Year Manufactured',value:'2023'}];assert.ok(analyze(e).excluded.some(x=>x.reason==='listing_evidence_conflict'));
});
test('confirmed Best Offers and fixed sales qualify; ambiguous offers, asks and models do not',()=>{
 for(const type of Object.values(EVIDENCE_TYPES)){
  const e=syntheticSales(card);e.records=e.records.map(r=>({...r,evidenceType:type}));
  assert.equal(analyze(e).accepted.length, ['verified_completed_auction','verified_fixed_price_sale','confirmed_accepted_best_offer'].includes(type)?9:0);
 }
 const e=syntheticSales(card);e.records[0].amountBasis='original_asking_price';assert.equal(analyze(e).accepted.length,8);
});
test('duplicate transactions do not inflate samples; conflicting copies quarantine both',()=>{
 const e=syntheticSales(card);e.records.push(structuredClone(e.records[0]));let r=analyze(e);assert.equal(r.groups.raw.count,3);assert.equal(r.excluded.at(-1).reason,'duplicate_transaction');
 e.records.at(-1).amount=999;r=analyze(e);assert.equal(r.groups.raw.count,2);assert.equal(r.groups.raw.qualified,false);assert.equal(r.excluded.filter(x=>x.reason==='contradictory_duplicate').length,2);
});
test('invalid/future/missing dates, stale sales, non-USD, refunded and unproven records fail safely',()=>{
 for(const patch of [{soldAt:null},{soldAt:'2026-02-30T12:00:00Z'},{soldAt:'2027-01-01T12:00:00Z'},{soldAt:'2026-01-01T12:00:00Z'},{currency:'EUR'},{transactionStatus:'refunded'},{provenance:null},{amount:NaN}]){
 const e=syntheticSales(card);e.records=e.records.map(r=>({...r,...patch}));assert.equal(analyze(e).accepted.length,0);
 }
 const e=syntheticSales(card,{date:'2026-09-01T12:00:00Z'});assert.equal(analyze(e).groups.raw.qualified,false);
 assert.equal(analyze(syntheticSales(card,{count:1})).groups.raw.qualified,false);
 const f=syntheticSales(card);f.records=[null,{},...f.records];assert.equal(analyze(f).accepted.length,9);
});
test('raw versus grader metadata and numeric grades cannot contradict titles or collapse BGS into PSA',()=>{
 const e=syntheticSales(card);e.records[3].grading.grade='10';assert.ok(analyze(e).excluded.some(x=>x.reason==='grade_label_conflict'));
 const b=syntheticSales(card);b.records=[{...b.records[3],title:b.records[3].title.replace('PSA 9','BGS 9.5'),grading:{status:'graded',company:'BGS',grade:'9.5'}}];
 const r=analyze(b);assert.equal(r.groups['BGS 9.5'].count,1);assert.equal(r.groups['PSA 10'],undefined);
});
test('no configured provider performs zero fetches; timeout, malformed and unlicensed providers return unavailable',async()=>{
 assert.equal((await fetchCompletedSales(card)).reason,'provider_not_configured');
 for(const lookup of [async()=>{throw Error('private token');},async()=>({status:'available',records:[]}),()=>new Promise(()=>{})]){
  const result=await fetchCompletedSales(card,{provider:{id:'synthetic-test-supplier',lookup},timeoutMs:5});assert.equal(result.status,'unavailable');assert.doesNotMatch(JSON.stringify(result),/private token/);
 }
 const e=await fetchCompletedSales(card,{provider:{id:'synthetic-test-supplier',lookup:async()=>syntheticSales(card)}});assert.equal(e.status,'available');
});
test('population distributions remain historical, provenance-bearing and distinct from individual probability',()=>{
 const record={identity:card,grader:'PSA',totalPSAPopulation:100,gradeDistribution:{'8':10,'9':60,'10':30},observedAt:'2026-10-20T12:00:00Z',provenance:{providerId:'synthetic-test-supplier',reference:'synthetic-pop-report',rightsReference:'synthetic-test-license-not-real'}};
 const r=analyzePopulation(record,card,{now});assert.equal(r.historicalGemRate,.3);assert.equal(r.individualCardProbability,null);assert.equal(r.psa9Population,60);
 assert.ok(r.historicalRateInterval95[0]<.3 && r.historicalRateInterval95[1]>.3);
 for(const patch of [{identity:{...card,parallel:'Reverse Holo Special Art'}},{totalPSAPopulation:999},{gradeDistribution:{'9':-1,'10':2}},{observedAt:null}])assert.equal(analyzePopulation({...record,...patch},card,{now}).status,'unavailable');
 assert.equal(analyzePopulation({...record,totalPSAPopulation:0,gradeDistribution:{'9':0,'10':0}},card,{now}).historicalGemRate,null);
 const separate=financialEvidence({...payload(),prediction:{...payload().prediction,psa10Probability:17},populationRecord:record},{now});
 assert.equal(separate.probability.qualified,false);assert.equal(separate.probability.valuePercent,17);
});
test('saved financial mutations and stale trusted flags cannot unlock a recommendation',()=>{
 const result=reportFromPrediction(protectValuation(payload()));
 for(const patch of [{rawValue:1000},{psa10Value:9999},{verdict:'grade'},{financialBasis:null},{expectedNetValue:999}]){
  const r=safeStoredReport({...result,...patch});assert.equal(isValuationTrusted(r),false);assert.equal(r.atlas,null);assert.equal(r.rawValue,null);
 }
 const again=safeStoredReport(JSON.parse(JSON.stringify(result)));assert.equal(isMarketAnalysisAvailable(again),true);assert.equal(again.verdict,'provisional');
 for(const field of ['subject','cardNumber','year','brandSet']){const r=safeStoredReport({...result,canonicalCard:{...card,[field]:null}});assert.equal(isMarketAnalysisAvailable(r),false);assert.equal(r.rawValue,null);}
});
test('real handler keeps Browse and defaults sold data to unavailable; client submitted fake sales are ignored',async()=>{
 const scenario=liveReportScenario();
 const r=await runPipeline({...scenario,market:scenario.neutral,fields:{cardName:'Pikachu ex',cardType:'pokemon',completedSales:syntheticSales(card)}});
 assert.equal(r.metrics.valuationBrowse,6);assert.equal(r.report.financialDecision.sales.status,'unavailable');assert.equal(r.report.verdict,'provisional');assert.equal(r.report.marketData.marketSummary.fairMarketValue,null);
});
test('financial invalidation is sticky across repeated save/reopen and forged cached flags',()=>{
 const r=reportFromPrediction(protectValuation(payload()));
 const invalid=safeStoredReport({...r,psa10Value:9999});
 for(const report of [invalid,{...invalid,valuationVerification:{...invalid.valuationVerification,status:'trusted'},atlas:{cached:'untrusted'}}]){
  const again=safeStoredReport(report);assert.equal(again.rawValue,null);assert.equal(isValuationTrusted(again),false);assert.equal(again.atlas,null);
 }
});
test('saved qualified sales retain trust; missing, downgraded and altered evidence cannot retain it',()=>{
 const r=reportFromPrediction(protectValuation(payload(syntheticSales(card,{raw:100,psa9:50,psa10:70}))));
 assert.equal(isValuationTrusted(r),true);assert.equal(isValuationTrusted(safeStoredReport(r)),true);
 for(const patch of [{completedSales:null},{variantVerification:null},{probabilityEvidence:{kind:'population_gem_rate',valuePercent:100}},{canonicalCard:{...card,cardNumber:'150/128'}}]){
  const report=safeStoredReport({...r,...patch});
  if(patch.probabilityEvidence) assert.equal(report.financialDecision.probability.qualified,false);
  else {assert.equal(isValuationTrusted(report),false);assert.equal(report.rawValue,null);}
 }
});
test('structured descriptors cannot conceal a contradictory printing label or ambiguous identity',()=>{
 for(const patch of [{parallel:'Reverse Holo Special Art'},{variant:{kind:'parallel',finish:'holo',art:'special art',ambiguous:true}}]){
  const e=syntheticSales(card);e.records=e.records.map(r=>({...r,identity:{...r.identity,...patch}}));assert.equal(analyze(e).accepted.length,0);
 }
});
test('mixed timestamp offsets use actual transaction chronology; bounded responses never authorize actions',()=>{
 const e=syntheticSales(card);e.records[0].soldAt='2026-10-20T23:00:00-02:00';e.records[1].soldAt='2026-10-21T00:00:00+02:00';
 const r=analyze(e);assert.equal(r.groups.raw.newest,e.records[0].soldAt);
 assert.equal(financialEvidence(payload({...syntheticSales(card,{raw:100,psa9:50,psa10:70}),truncated:true}),{now}).actionable,false);
});
test('sports transaction identity preserves product, serial parallel, autograph and memorabilia dimensions',()=>{
 const sports={subject:'Shane Smith',year:'2026',brandSet:'Topps Series 1',cardNumber:'155',parallel:'Green Sand Glitter /99',printRun:'99',autoOrRelic:'none',manufacturer:'Topps',product:'Series 1'};
 const e=syntheticSales(sports);const valid=analyzeCompletedSales(e,sports,{now});assert.equal(valid.accepted.length,9);
 for(const patch of [{parallel:'Base'},{parallel:'Green Sand Glitter /199',printRun:'199'},{autoOrRelic:'auto'},{autoOrRelic:'relic'},{manufacturer:'Panini'},{product:'Chrome'}]){
  const wrong={...e,records:e.records.map(r=>({...r,identity:{...r.identity,...patch}}))};assert.equal(analyzeCompletedSales(wrong,sports,{now}).accepted.length,0);
 }
});
test('exact live Pikachu identity with one $56.99 ask retains correction and provisional modeled economics',async()=>{
 const s=liveReportScenario();
 const r=await runPipeline({...s,market:[{...s.neutral[0],price:{value:'56.99',currency:'USD'}}],model:{psa9Value:75,psa10Value:180,psa10Probability:30}});
 assert.equal(r.payload.canonicalCard.brandSet,'30th Celebration');assert.equal(r.payload.canonicalCard.parallel,'Holo Special Art');
 assert.equal(r.payload.valuationIdentityGate.allowed,true);assert.equal(r.report.rawValue,56.99);
 assert.equal(r.report.financialDecision.observedAsking.confidence,20);assert.equal(r.report.expectedNetValue,-30.49);
 assert.equal(r.report.verdict,'provisional');assert.equal(r.report.atlas,null);assert.equal(isValuationTrusted(r.report),false);
 assert.doesNotMatch(r.report.analysis,/Paldea Evolved/);
});
test('qualified positive decisions survive saving only while calibration and exact variant evidence remain valid',()=>{
 const p={...payload(syntheticSales(card,{raw:20,psa9:150,psa10:250})),probabilityEvidence:syntheticProbability(card)};
 const r=reportFromPrediction(protectValuation(p));assert.equal(isValuationTrusted(r),true);assert.equal(r.verdict,'grade');
 assert.equal(isValuationTrusted(safeStoredReport(r)),true);
 for(const probabilityEvidence of [null,{...syntheticProbability(card),status:'unvalidated'},{...syntheticProbability(card),observedAt:'2025-01-01T00:00:00Z'},{...syntheticProbability(card),kind:'historical_gem_rate'}]){
  const safe=safeStoredReport({...r,probabilityEvidence});assert.equal(isValuationTrusted(safe),false);assert.equal(safe.rawValue,null);assert.equal(safe.atlas,null);
 }
});
test('legitimate sold transactions support analysis without active inventory; asks are not a prerequisite',async()=>{
 const s=liveReportScenario();
 const initial=await runPipeline(s);
 const sales=syntheticSales(initial.payload.canonicalCard,{raw:100,psa9:50,psa10:70});
 const result=await runPipeline({...s,market:[],soldProvider:{id:sales.providerId,lookup:async()=>sales}});
 assert.equal(result.report.rawValue,100);assert.equal(result.report.financialDecision.observedAsking,null);
 assert.equal(result.report.financialDecision.rawSource,'completed_sales');assert.equal(isValuationTrusted(result.report),true);
});

test('consistent legacy asking reports migrate to provisional without preserving old final recommendations',()=>{
 const current=reportFromPrediction(protectValuation(payload()));
 const legacy={...current,...calculateGradingEconomics(payload().prediction,56.99),financialBasis:{version:1,rawSource:'selected_market_median',rawMedian:56.99},valuationVerification:{status:'trusted'}};
 legacy.marketData.marketSummary.valuationTrusted=true;
 const safe=safeStoredReport(legacy);assert.equal(safe.financialBasis.version,2);assert.equal(safe.rawValue,56.99);assert.equal(safe.verdict,'provisional');assert.equal(isValuationTrusted(safe),false);assert.equal(safe.atlas,null);
});
