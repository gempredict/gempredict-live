import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runScan,confirmed,exactTitle,syntheticListing} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {matchListing,identityComplete} from '../lib/ebayIdentityMatch.mjs';
import {internalMarketContext} from '../lib/internalMarketAuth.mjs';
import {buildGemPredictScore} from '../lib/gemPredictScore.js';
const id={player:confirmed.identifiedSubject,year:'2024',set:confirmed.identifiedBrandSet,cardNumber:'BCP-86',parallel:'Mojo Refractor',autoOrRelic:'none'};
function withheld(r){assert.equal(r.status,200);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);assert.equal(r.payload.prediction.verdict,'withheld');assert.equal(r.payload.valuationVerification.status,'untrusted');assert.equal(r.payload.financialDecision.actionable,false);assert.equal(r.payload.atlas,null);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.imageAnalysis.worthGrading,null);}
test('real multipart sports handler retains the confirmed fixture and both images; candidate asks never authorize valuation',async()=>{
 const r=await runScan();withheld(r);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.images,2);assert.equal(r.metrics.catalog,0);assert.equal(r.payload.canonicalCard.year,'2024');assert.equal(r.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(r.payload.marketData.marketSummary.rawComparableCount,1);assert.equal(r.payload.marketData.items[0].matchScore,100);assert.equal(r.payload.marketData.marketSummary.averageMatchScore,100);assert.equal(r.payload.marketData.marketSummary.rawMedian,40);assert.equal(r.payload.marketData.marketSummary.fairMarketValue,null);assert.equal(r.payload.marketData.discoveryOnly,true);assert.ok(r.metrics.internal.length<=6);for(const q of r.metrics.internal){assert.equal(q.year,'2024');assert.equal(q.set,id.set);assert.equal(q.cardNumber,'BCP-86');assert.equal(q.parallel,'Mojo Refractor');}
});
test('incorrect 2022 proposal is not hardcoded to 2024 and rejects the correct-year listing; finance stays blocked',async()=>{
 const r=await runScan({vision:{identifiedYear:'2022'}});withheld(r);assert.equal(r.payload.canonicalCard.year,'2022');assert.equal(r.payload.identityV2.identityVerified,false);assert.equal(r.payload.marketData.marketSummary.rawComparableCount,0);assert.ok(r.payload.marketData.rejectedItems[0].rejectionReasons.includes('wrong_year'));
});
test('cross-set, year, extra color and serial conflicts cannot become comparables through broad query attempts',async()=>{
 for(const title of ['2026 Bowman Sterling Konnor Griffin Purple Mojo /250',exactTitle.replace('Bowman Chrome Prospects','Bowman Sterling'),exactTitle.replace('Mojo Refractor','Purple Mojo Refractor /250'),exactTitle.replace('BCP-86','XBCP-86')]){
  const r=await runScan({items:[syntheticListing(title)]});withheld(r);assert.equal(r.payload.marketData.marketSummary.rawComparableCount,0,title);assert.equal(r.payload.marketData.marketSummary.rawMedian,null);assert.equal(r.payload.marketData.rejectedItems.length,1);
 }
});
test('a wrong parallel proposal cannot match the plain Mojo fixture',async()=>{
 const r=await runScan({vision:{identifiedParallel:'Purple Mojo Refractor'}});withheld(r);assert.equal(r.payload.marketData.marketSummary.rawComparableCount,0);assert.ok(r.payload.marketData.rejectedItems[0].rejectionReasons.includes('parallel_not_matched'));
});
test('incomplete identity performs no marketplace lookup or financial-model call',async()=>{
 const r=await runScan({vision:{identifiedCardNumber:null}});withheld(r);assert.equal(r.metrics.internal.length,0);assert.equal(r.payload.marketData.reason,'identity_incomplete');assert.equal(identityComplete({}),false);
});
test('Preview rejects production/moving aliases, forged hosts, invalid origins and missing protection before fetching',async()=>{
 for(const env of [{NEXT_PUBLIC_SITE_URL:'https://gempredict-live.vercel.app'},{NEXT_PUBLIC_SITE_URL:'https://different-preview.vercel.app'},{VERCEL_URL:undefined},{VERCEL_URL:'gempredict-live.vercel.app'},{NEXT_PUBLIC_SITE_URL:'https://user:password@gempredict-live-unit123.vercel.app'}]){const r=await runScan({env,headers:{host:'gempredict-live-unit123.vercel.app'}});withheld(r);assert.equal(r.metrics.internal.length,0);}
 const r=await runScan({headers:{'x-vercel-oidc-token':''}});withheld(r);assert.equal(r.metrics.internal.length,0);assert.equal(r.payload.marketData.reason,'preview_protection_token_unavailable');
 for(const status of [307,401,403,500]){const r=await runScan({previewStatus:status});withheld(r);assert.equal(r.metrics.upstream,0);}
});
test('unavailable marketplace never revives model prices or recommendation',async()=>{const r=await runScan({marketStatus:503});withheld(r);assert.equal(r.payload.marketData,null);});
test('unsafe cached/forged reports, copies and repeated normalization cannot restore financial trust',async()=>{
 const fresh=await runScan();const report=reportFromResponse(fresh.payload);
 for(const input of [report,{...report,rawValue:999,expectedNetValue:999,verdict:'grade',atlas:{decision:'grade'},financialDecision:{actionable:true},valuationVerification:{status:'trusted'},identityV2:{identityVerified:true,printingVerified:true}}, {cardTitle:'Legacy report',rawValue:40,expectedNetValue:80,verdict:'grade'}]){
  const safe=protectFinancialReport(JSON.parse(JSON.stringify(input)));assert.equal(safe.verdict,'withheld');assert.equal(safe.rawValue,null);assert.equal(safe.expectedNetValue,null);assert.equal(safe.atlas,null);assert.equal(buildGemPredictScore(safe),null);assert.match(protectedCopySummary(input),/withheld/);assert.doesNotMatch(protectedCopySummary(input),/\$999|Grade It/);assert.deepEqual(protectFinancialReport(safe),safe);
 }
 assert.equal(report.sportsIdentityAudit.catalogVerified,false);assert.equal(report.identityEvidence.verified,false);
});
test('collector, set, parallel and serial contracts preserve exact identity without conflating copy numbering',()=>{
 assert.equal(matchListing(exactTitle,id).accepted,true);
 for(const value of ['XBCP-86','BCP-860','BCP-86A','BCP-86/250'])assert.equal(matchListing(exactTitle.replace('BCP-86',value),id).accepted,false,value);
 for(const title of [exactTitle+' #BCP-87',exactTitle+' Bowman Sterling',exactTitle+' /250',exactTitle+' 12/250',exactTitle+' Gold'])assert.equal(matchListing(title,id).accepted,false,title);
 assert.equal(matchListing(exactTitle+' 12/250',{...id,printRun:'250'}).accepted,true);assert.equal(matchListing(exactTitle+' 12/250',{...id,printRun:'99'}).accepted,false);assert.equal(matchListing(exactTitle,{...id,printRun:'250'}).accepted,false);
 assert.equal(matchListing('Pikachu ex 149/128 Holo',{player:'Pikachu ex',year:'2026',set:'30th Celebration',cardNumber:'149/128',parallel:'Holo'}).accepted,false);
});
test('bad back bytes stop the complete handler before any model/market call; front-only remains supported',async()=>{
 const invalid=await runScan({badBack:true});assert.equal(invalid.status,400);assert.equal(invalid.metrics.vision,0);assert.equal(invalid.metrics.internal.length,0);
 const r=await runScan({back:false});withheld(r);assert.equal(r.metrics.images,1);
});
test('Opulent report keeps upload/condition/confirmation/copy/save controls and invokes the shared protection boundary',()=>{
 const ui=fs.readFileSync('src/App.jsx','utf8');for(const marker of ['normalizeMobileImage(file)','backImageFile','ImageAnalysisCard','IdentityReview','Copy Summary','Save Report','reportFromResponse(data)','stored.map(protectFinancialReport)','data=protectFinancialReport(data)'])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(fs.readFileSync('pages/api/predict.js','utf8'),/preMarketQuery|preLiveRawMarket|fetch\(preMarketUrl/);
 assert.ok(ui.includes('Identity unverified'));
});
test('query-only and partial direct eBay requests fail before credentials are sent; score contract is finite',async()=>{
 const {runMarketRequest}=await import('./helpers/reconciliationPipeline.mjs');
 for(const query of [{q:'Konnor Griffin Mojo'},{q:exactTitle,player:id.player},{...id,year:''}]){const r=await runMarketRequest(query);assert.equal(r.status,400);assert.equal(r.calls,0);}
 const r=await runMarketRequest({...id,q:exactTitle});assert.equal(r.status,200);assert.equal(r.payload.items[0].matchScore,100);assert.equal(r.payload.marketSummary.averageMatchScore,100);assert.equal(r.payload.marketSummary.valuationTrusted,false);
});
test('text-only and non-sports flows preserve reports but cannot create trusted financial estimates',async()=>{
 const text=await runScan({textOnly:true,fields:{financialDecision:{allowed:true},identityV2:{identityVerified:true,printingVerified:true}}});assert.equal(text.status,200);assert.equal(text.metrics.vision,0);assert.equal(text.metrics.valuation,0);assert.equal(text.payload.prediction.verdict,'withheld');
 const pokemon=await runScan({fields:{cardType:'pokemon'}});withheld(pokemon);assert.equal(pokemon.metrics.catalog,1);assert.equal(pokemon.payload.catalogCrossCheck.status,'catalog_unavailable');
});
test('no financial eligibility means shared recommendation engine cannot promote a high score or model grade',async()=>{
 const {default:recommendationEngine}=await import('../lib/recommendationEngine.js');
 assert.equal(recommendationEngine({score:{score:100},identityConfidence:{score:100},marketEvidence:{confidence:0},prediction:{verdict:'grade'}}).action,'verify_identity');
});
