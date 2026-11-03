// Established October facts; all listing IDs, prices and image bytes are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runScan,runMarketRequest} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {verifyRuntimeCatalogAssets} from '../lib/runtimeCatalogAssets.mjs';
const set={id:'30th',name:'30th Celebration',releaseDate:'2026-09-16',cardCount:{official:128},tcgOnline:'30C'};
const hosted={id:'30th-149',localId:'149',name:'Pikachu ex',rarity:'Special illustration rare',set,updated:'2026-09-17T00:45:22+02:00',variants:{firstEdition:false,holo:false,normal:true,reverse:false,wPromo:false},variants_detailed:[{type:'normal',size:'standard',variantId:'generated'}]};
const vision={identifiedSubject:'Pikachu ex',identifiedYear:'2023',identifiedManufacturer:'Pokemon',identifiedBrandSet:'Paldea Evolved',identifiedCardNumber:'149/128',identifiedParallel:'Holo Special Art',identifiedLanguage:'English',identifiedAutoOrRelic:'none'};
const title='2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare';
const listing=(i,text=title)=>({itemId:'v1|'+(123456789012+i)+'|0',itemWebUrl:'https://www.ebay.com/itm/'+(123456789012+i),title:text,condition:'Ungraded',localizedAspects:[{name:'Language',value:'English'}],price:{value:'40',currency:'USD'}});
const neutral=Array.from({length:3},(_,i)=>listing(i));
const catalogFetch=async url=>({ok:true,json:async()=>structuredClone(!new URL(url).pathname.includes('/en/')?[]:new URL(url).pathname.endsWith('/cards')?[{id:hosted.id,localId:'149',name:hosted.name}]:new URL(url).pathname.includes('/cards/')?hosted:set)});
const scan=patch=>runScan({vision,fields:{cardType:'pokemon'},neutral,items:neutral,catalogFetch,...patch});
function withheld(r){assert.equal(r.status,200);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);assert.equal(r.payload.financialDecision.actionable,false);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.atlas,null);}
test('original Paldea Evolved 2023 observation survives while independent catalog controls 2026 30th identity',async()=>{
 const r=await scan();withheld(r);assert.match(r.metrics.visionPrompt,/identityReadings/);assert.match(r.metrics.visionPrompt,/visualObservations/);assert.doesNotMatch(r.metrics.visionPrompt,/30th Celebration/);const p=r.payload;
 assert.equal(r.metrics.reviewIdentity.set,'30th Celebration');assert.equal(p.originalIdentityObservation.identifiedYear,'2023');assert.equal(p.originalIdentityObservation.identifiedBrandSet,'Paldea Evolved');assert.equal(p.imageAnalysis.identifiedYear,'2023');assert.equal(p.imageAnalysis.identifiedBrandSet,'Paldea Evolved');
 assert.equal(p.canonicalCard.year,'2026');assert.equal(p.canonicalCard.brandSet,'30th Celebration');assert.equal(p.canonicalCard.cardNumber,'149/128');assert.equal(p.canonicalCard.language,'en');assert.equal(p.identityV2.year,'2026');assert.equal(p.identityV2.identityVerified,true);assert.equal(p.identityV2.printingVerified,false);assert.equal(p.identityVerification.catalog.referenceId,'30th-149');
 assert.equal(p.identityVerification.catalog.candidate.printingProvenance.type,'holo');assert.equal(p.runtimeCatalogAssets.snapshot,true);assert.equal(p.runtimeCatalogAssets.license,true);assert.equal(p.marketData.marketSummary.rawComparableCount,3,JSON.stringify(p.marketData.rejectedItems));
 const report=reportFromResponse(p);const restored=protectFinancialReport(JSON.parse(JSON.stringify(report)));assert.equal(restored.canonicalCard.year,'2026');assert.equal(restored.originalIdentityObservation.identifiedYear,'2023');assert.equal(restored.pokemonIdentityStatus.catalogVerified,true);assert.equal(restored.expectedNetValue,null);assert.match(protectedCopySummary(restored),/2026.*30th Celebration.*2023.*Paldea Evolved/);assert.match(protectedCopySummary(restored),/Physical printing: unverified/);assert.match(protectedCopySummary(restored),/withheld/);
});
test('wrong printing, reverse/non-holo, language, set and denominator listings are rejected after canonical reconciliation',async()=>{
 const wrong=[title.replace('Holo Special Illustration Rare','Reverse Holo Special Illustration Rare'),title.replace('Holo Special Illustration Rare','Non-Holo Special Illustration Rare'),title.replace('English','Japanese'),title.replace('30th Celebration','Surging Sparks'),title.replace('149/128','149/165')].map((t,i)=>({...listing(i,t),localizedAspects:[]}));
 const r=await scan({items:wrong});withheld(r);assert.equal(r.payload.marketData.marketSummary.rawComparableCount,0);assert.equal(r.payload.marketData.rejectedItems.length,wrong.length);
});
test('insufficient neutral evidence never fabricates independent variant consensus',async()=>{
 const r=await scan({neutral:neutral.slice(0,2)});withheld(r);assert.notEqual(r.payload.variantVerification.status,'verified');assert.notEqual(r.payload.variantVerification.status,'corrected');
});
test('missing language or conflicting language remains unresolved without a silent English default',async()=>{
 for(const language of [null,'Japanese']){const r=await scan({vision:{...vision,identifiedLanguage:language}});withheld(r);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.identityV2.identityVerified,false);}
});
test('incorrect denominator and ambiguous/incomplete catalog candidates cannot become verified identity',async()=>{
 const wrong=await scan({vision:{...vision,identifiedCardNumber:'149/165'}});withheld(wrong);assert.equal(wrong.payload.pokemonIdentityStatus.catalogVerified,false);
 for(const records of [[{...set}],Array.from({length:5},(_,i)=>({id:'other-'+i,localId:'149',name:'Pikachu ex'}))]){
  const r=await scan({catalogFetch:async()=>({ok:true,json:async()=>records})});withheld(r);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);
 }
});
test('explicit user year/set and printed identifier conflicts require review rather than catalog overwrites',async()=>{
 const r=await scan({fields:{cardType:'pokemon',cardSet:'2023 Paldea Evolved'}});withheld(r);assert.equal(r.payload.canonicalCard.year,'2023');assert.equal(r.payload.canonicalCard.brandSet,'Paldea Evolved');assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);
 const readings=[{field:'cardNumber',text:'149/128',certainty:'clear',side:'front',area:'collector_line',alternatives:[]},{field:'cardNumber',text:'149/165',certainty:'clear',side:'front',area:'collector_line',alternatives:[]}];
 const conflicted=await scan({vision:{...vision,identityReadings:readings}});withheld(conflicted);assert.equal(conflicted.payload.pokemonIdentityStatus.catalogVerified,false);
});
test('changed identities and missing catalog provenance cannot inherit saved verification or financial trust',async()=>{
 const r=await scan();const report=reportFromResponse(r.payload);
 for(const card of [{...report.canonicalCard,cardNumber:'149/165'},{...report.canonicalCard,language:'Japanese'},{...report.canonicalCard,parallel:'Reverse Holo Special Art'}]){
  const restored=protectFinancialReport({...report,canonicalCard:card});assert.equal(restored.pokemonIdentityStatus.catalogVerified,false);assert.equal(restored.rawValue,null);assert.equal(restored.financialDecision.actionable,false);
 }
 const missing=structuredClone(report);delete missing.identityVerification.catalog.referenceId;const restored=protectFinancialReport(missing);assert.equal(restored.pokemonIdentityStatus.catalogVerified,false);assert.match(protectedCopySummary(restored),/Catalog identity: unresolved/);
});
test('invalid runtime snapshot/license fails closed with safe status only',()=>{assert.deepEqual(verifyRuntimeCatalogAssets({readFile:()=>{throw Error('private path');}}),{snapshot:false,license:false});});
test('explicit user language, collector and printing choices cannot be silently replaced or saved as verified',async()=>{
 for(const fields of [{language:'Japanese'},{cardNumber:'149/165'},{parallel:'Reverse Holo Special Art'}]){
  const r=await scan({fields:{cardType:'pokemon',...fields}});withheld(r);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.userIdentityConflicts.length,1);assert.equal(r.payload.variantVerification.status,'needs_confirmation');assert.equal(protectFinancialReport(reportFromResponse(r.payload)).identityV2.identityVerified,false);
 }
});
test('seller consensus without independent catalog evidence remains diagnostic, not a canonical correction',async()=>{
 const r=await scan({catalogFetch:async()=>{throw Error('offline');}});withheld(r);assert.equal(r.payload.canonicalCard.year,'2023');assert.equal(r.payload.canonicalCard.brandSet,'Paldea Evolved');assert.equal(r.payload.identityVerification.year.candidateValue,'2026');assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);
});
