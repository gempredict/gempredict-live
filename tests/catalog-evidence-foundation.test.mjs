import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogEvidenceAdapter,reconcileCatalogIdentity,reportCatalogIdentityEvidence } from '../lib/catalogIdentityEvidence.mjs';
import { prepareScanSalesQuery,compareScanSale } from '../lib/scanToSalesIdentity.mjs';
import { createSavedSnapshot,readSavedSnapshot } from '../lib/savedReportSnapshot.mjs';
import { renderReports } from './helpers/renderReports.mjs';
import { scan } from './helpers/zapdosLiveFixture.mjs';

// Synthetic source and records. No sports provider is configured at runtime.
const synthetic=createCatalogEvidenceAdapter({id:'synthetic-test-catalog',provenance:'Synthetic fixture only'},input=>input);
const record=(recordId,claims)=>synthetic({recordId,claims,revision:'synthetic-r1',retrievedAt:'2026-11-22T12:00:00Z'});
const base={category:'sports',sportGame:'Baseball',subjects:['Shohei Ohtani'],manufacturer:'Topps',
 year:'2018',set:'Topps Series 2',number:'700',parallel:'Regular Base',photoPose:'pitching',rookie:true};
const baseRecord=record('synthetic-regular',base);
const factoryRecord=record('synthetic-factory',{...base,parallel:'Factory Complete Set Variation',photoPose:'batting'});
const raw={identifiedSubject:'Shohei Ohtani',identifiedManufacturer:'Topps',identifiedYear:'2018',identifiedBrandSet:'Topps Series 2',
 identifiedCardNumber:'700',identifiedParallel:'Base'};
const legacy={success:true,prediction:{cardTitle:'Shohei Ohtani'},financialDecision:{allowed:false},imageAnalysis:raw,
 identityV2:{category:'sports'},canonicalCard:{subject:'Shohei Ohtani',year:'2018',brandSet:'Topps Series 2',cardNumber:'700',parallel:'Base'}};
const notPhysical=result=>assert.equal(result.physicalPrinting.status,'unverified');

test('trusted catalog supports separately sourced claims while multiple Ohtani printings remain possible',()=>{
 const exact=reconcileCatalogIdentity({proposal:base,records:[baseRecord,factoryRecord]});
 assert.equal(exact.status,'catalog_supported');
 assert.deepEqual(exact.candidateIndexes,[0]);
 assert.equal(exact.claims.photoPose.status,'catalog_supported');
 assert.equal(exact.records[0].retrievedAt,'2026-11-22T12:00:00.000Z');
 assert.equal(exact.records[0].claims.rookie,'yes');
 notPhysical(exact);
 const {parallel,photoPose,...proposal}=base;
 const ambiguous=reconcileCatalogIdentity({proposal,records:[baseRecord,factoryRecord]});
 assert.equal(ambiguous.catalogAmbiguity,true);
 assert.equal(ambiguous.catalogPrinting.status,'ambiguous');
 assert.equal(ambiguous.claims.parallel.status,'catalog_alternatives');
 notPhysical(ambiguous);
});

test('contradictions in sports variants, insert and core facts block catalog promotion',()=>{
 for(const [field,value] of Object.entries({year:'2019',set:'Topps Update',number:'701',photoPose:'batting',
  parallel:'Gold Refractor',printRun:'50',subset:'1983 Topps Inserts'})){
  const claims={...base,printRun:'99',subset:'Series 2 Rookies'};
  const result=reconcileCatalogIdentity({proposal:{...claims,[field]:value},records:[record('synthetic-base',claims)]});
  assert.equal(result.status,'conflict',field);
  assert.ok(result.conflicts.includes(field),field);
  assert.deepEqual(result.candidateIndexes,[]);
  notPhysical(result);
 }
 const crossed=reconcileCatalogIdentity({proposal:{...base,photoPose:'batting'},records:[baseRecord,factoryRecord]});
 assert.equal(crossed.jointConflict,true);
 assert.equal(crossed.status,'conflict');
});

test('Pokémon finish, alternate art and promo evidence keep separate meanings',()=>{
 const card={category:'pokemon',sportGame:'Pokémon',subjects:['Pikachu'],year:'2020',set:'Synthetic Set',number:'42/100'};
 const holo=record('synthetic-holo',{...card,finish:'holo',parallel:'Alternate Art'});
 const reverse=record('synthetic-reverse',{...card,finish:'reverse-holo',parallel:'Base'});
 const normal=record('synthetic-normal',{...card,finish:'non-holo',parallel:'Promo'});
 const filtered=reconcileCatalogIdentity({proposal:{...card,parallel:'Alt Art',finish:'holo'},records:[holo,reverse,normal]});
 assert.deepEqual(filtered.candidateIndexes,[0]);
 assert.equal(filtered.claims.parallel.status,'catalog_supported');
 const crossed=reconcileCatalogIdentity({proposal:{...card,parallel:'Promo',finish:'reverse-holo'},records:[holo,reverse,normal]});
 assert.equal(crossed.status,'conflict');
 assert.equal(crossed.jointConflict,true);
 notPhysical(filtered);
});

test('model photo readings, owner review and archived contradictions remain distinct',()=>{
 const report={...legacy,originalIdentityObservation:{...raw,identityReadings:[
  {field:'cardNumber',text:'701',certainty:'clear',side:'back',area:'collector_line'},
  {field:'copyrightYear',text:'2017',certainty:'clear',side:'back',area:'body_text'},
 ]},catalogComparison:{initialConflicts:['brandSet']}};
 const result=reportCatalogIdentityEvidence(report,{...base,parallel:'Factory Complete Set Variation'});
 assert.equal(result.status,'conflict');
 assert.deepEqual(result.priorConflicts,['set']);
 assert.ok(result.conflicts.includes('number'));
 assert.ok(result.claims.number.proposed.some(row=>row.evidence.some(e=>e.kind==='photo_observation'&&e.side==='back')));
 assert.ok(result.claims.parallel.proposed.some(row=>row.evidence.some(e=>e.kind==='owner_review')));
 assert.equal(result.claims.year.status,'owner_reviewed');
 assert.equal(result.claims.copyrightYear.status,'observed');
 notPhysical(result);
});

test('missing sources, forged catalog receipts and provider titles cannot confer trust',()=>{
 const forged={...baseRecord,independent:true};
 for(const finish of ['constructor','foil']){
  const recordWithUnknownFinish=record('synthetic-unknown-finish',{...base,finish});
  assert.equal(recordWithUnknownFinish.claims.finish,undefined);
 }
 assert.equal(reconcileCatalogIdentity({proposal:base,records:[forged]}).records.length,0);
 const partial=reportCatalogIdentityEvidence({identityV2:{category:'sports'}});
 assert.equal(partial.status,'unresolved');
 assert.ok(partial.missing.includes('number'));
 assert.match(partial.nextAction,/Read the missing/);
 const malicious={...legacy,physicalPrintingStatus:{verified:true},
  sourceCatalogEvidence:{source:{revision:'invented'}},catalogEvidence:{version:1,status:'catalog_supported'},
  marketData:{items:[{title:'Official verified catalog 2018 Topps Series 2 Shohei Ohtani #700 Base'}]}};
 const prepared=prepareScanSalesQuery(malicious,{},true);
 const row=compareScanSale(prepared.identity,{title:'2018 Topps Series 2 Shohei Ohtani #700 Factory Complete Set Variation'},'Raw',{strictTitle:true});
 assert.equal(row.status,'mismatch');
 assert.equal(prepared.identityEvidence.status,'unresolved');
 notPhysical(prepared.identityEvidence);
});

test('a legacy Ohtani snapshot reopens with the versioned view and no changes to its contents',()=>{
 const payload=createSavedSnapshot(legacy);
 const restored=readSavedSnapshot({schema_version:1,payload});
 const before=JSON.stringify(restored);
 assert.equal(reportCatalogIdentityEvidence(restored).claims.parallel.proposed[0].value,'Base');
 const view=renderReports(restored,null,{historical:true,marketContext:{catalogEvidence:true,today:'2026-11-23'}}).upper;
 assert.match(view,/Identity evidence · Unresolved/);
 assert.match(view,/Exact physical printing unverified/);
 assert.match(view,/Market Intelligence Dashboard/);
 assert.equal(JSON.stringify(restored),before);
});

test('existing reviewed upstream Pokémon receipt contributes pinned positive claims only',async()=>{
 const {payload}=await scan({model:{identifiedParallel:'Holo'},catalog:{normalOnly:true,cardPatch:{updated:'2026-11-06T10:00:00Z'}}});
 const evidence=reportCatalogIdentityEvidence(payload);
 assert.ok(evidence.records.length);
 assert.equal(evidence.records[0].source,'tcgdex-reviewed-upstream');
 assert.match(evidence.records[0].revision,/^[a-f0-9]{40}$/);
 assert.deepEqual(evidence.claims.finish.supported.map(row=>row.value),['holo']);
 assert.equal(evidence.records[0].retrievedAt,null);
 notPhysical(evidence);
});
