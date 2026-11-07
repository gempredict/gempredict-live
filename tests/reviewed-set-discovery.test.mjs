// Mock hosted responses and image wrappers, not new real scans or retained provider records.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTcgDexCatalog} from '../lib/pokemonCatalog.mjs';
import {resolveReviewedSetCode,createReviewedSetResolver,validateReviewedSets} from '../lib/reviewedSetCodes.mjs';
import {crossCheckCatalog} from '../lib/catalogIdentity.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {IDENTITY_STRING_FIELDS} from '../lib/identityValidation.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const reading=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':field==='cardNumber'?'collector_line':'set_mark',alternatives:[]});
const model={...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:'Charmander',identifiedYear:'2023',identifiedBrandSet:'151',identifiedCardNumber:'004/165',identifiedLanguage:'English',identifiedRarity:'Common',identityConfidence:null,identityReadings:[reading('subject','Charmander'),reading('cardNumber','004/165'),reading('setCode','MEW EN')]};
function transport({missing=false,unavailable=false,ambiguous=false,incomplete=false,cardPatch={},setPatch={}}={}){
 const calls=[],set={id:'sv03.5',name:'151',releaseDate:'2023-09-22',cardCount:{official:165},...setPatch};
 const card={id:'sv03.5-004',name:'Charmander',localId:'004',rarity:'Common',set:{id:set.id,name:set.name,cardCount:{official:set.cardCount.official}},variants:{normal:true,holo:false,reverse:true},...cardPatch};
 // Complete list size is synthetic; no assertion of the hosted 151 total count.
 set.cards=[...Array.from({length:165},(_,i)=>({id:'synthetic-filler-'+i,name:'Synthetic filler',localId:String(i+1)})),...(missing?[]:[{id:card.id,name:card.name,localId:card.localId}]),...(ambiguous?[{id:'synthetic-second-004',name:card.name,localId:card.localId}]:[])];
 if(incomplete)set.cards=[];
 const fetch=async(url,options)=>{calls.push(String(url));assert.equal(options.redirect,'error');if(unavailable)throw Error('private http://internal.invalid secret');const p=new URL(url).pathname;return {ok:true,status:200,json:async()=>structuredClone(p.endsWith('/sets/'+set.id)?set:p.endsWith('/cards')?Array.from({length:5},(_,i)=>({id:'synthetic-global-'+i,name:'Charmander',localId:'004'})):p.endsWith('/cards/synthetic-second-004')?{...card,id:'synthetic-second-004'}:card)};};
 return {calls,fetch};
}
async function scan(options={},patch={}){const t=transport(options);const r=await runScan({fields:{cardType:'pokemon',mode:'identity'},back:false,visionResponse:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(model)}]},catalogFetch:t.fetch,...patch});return {...r,calls:t.calls};}
const query={subject:'Charmander',cardNumber:'004/165',language:'English',printedSetCode:'MEW',printedLanguage:'EN'};
test('MEW/30C resolve from revision-pinned generic set metadata, including language-specific codes',()=>{
 const m=resolveReviewedSetCode('MEW','en');assert.equal(m.set.id,'sv03.5');assert.equal(m.set.officialCount,165);assert.equal(m.set.releaseDate,'2023-09-22');assert.equal(m.set.names.en,'151');assert.match(m.set.provenance.blob,/^[a-f0-9]{40}$/);assert.equal(resolveReviewedSetCode('30C','en').set.id,'30th');assert.equal(resolveReviewedSetCode('MEW','fr').status,'language_mismatch');assert.equal(resolveReviewedSetCode('151','fr').set.id,'sv03.5');
});
test('tampered or stale source revisions cannot create a mapping',()=>{
 const a=JSON.parse(readFileSync('data/tcgdex/reviewed-sets.json'));assert.equal(validateReviewedSets(a).length,2);a.revision='0'.repeat(40);assert.throws(()=>validateReviewedSets(a),/source_invalid/);assert.equal(createReviewedSetResolver([],false)('MEW','en').status,'unavailable');
});
test('a code known only for a different printed language cannot make a request or acquire confidence-based support',async()=>{
 const t=transport();const result=await createTcgDexCatalog({fetchImpl:t.fetch}).catalogLookup({...query,printedLanguage:'FR'});assert.equal(result.complete,false);assert.equal(result.records.length,0);assert.equal(result.reasonCode,'printed_language_conflict');assert.equal(t.calls.length,0);
});
test('reported Charmander history keeps the original ambiguity and digest without becoming an offline replay result',()=>{
 const h=JSON.parse(readFileSync('benchmarks/identity/historical-observations.json')).observations.find(o=>o.id==='H-CHAR-01');assert.equal(h.scanId,'10906ad7-950f-4859-9a8e-174d02b2f6fc');assert.equal(h.catalog.outcome,'ambiguous');assert.equal(h.catalog.reasonCodes[0],'catalog_candidates_ambiguous');assert.equal(h.photoLinkage.preparedHashes.front,'a3a890f2a8da940d215736f3aab03ae9ae472c9bd77635c30a7eabb0dcb3169e');assert.equal(h.photoHashes.front,null);assert.equal(h.evidenceKind,'owner_reported_summary');assert.equal(h.deploymentCommit,null);assert.equal(h.printedReadings[0].text,'MEW EN');
});
test('same mock crowded global page is ambiguous before mapping, unique after scoped lookup',async()=>{
 const t=transport(),old=createTcgDexCatalog({fetchImpl:t.fetch,resolveSetCode:()=>({status:'unknown',candidateCount:0})});const before=await old.catalogLookup(query);assert.equal(before.status,'ambiguous');assert.ok(before.diagnostics.some(d=>d.reasonCode==='catalog_search_page_limit'));assert.equal(before.records.length,0);
 t.calls.length=0;const after=await createTcgDexCatalog({fetchImpl:t.fetch}).catalogLookup(query);assert.equal(after.complete,true);assert.equal(after.records.length,1);assert.equal(after.records[0].cardNumber,'004/165');assert.equal(after.records[0].setCode,'MEW');assert.equal(after.records[0].language,'en');assert.ok(t.calls[0].includes('/sets/sv03.5'));assert.equal(t.calls.length,2);assert.ok(!t.calls.some(c=>c.includes('?')));
});
test('complete handler supports clear MEW EN without rewriting original readings or granting financial eligibility',async()=>{
 const r=await scan();assert.equal(r.status,200);assert.equal(r.payload.canonicalCard.cardNumber,'004/165');assert.equal(r.payload.canonicalCard.year,'2023');assert.equal(r.payload.canonicalCard.brandSet,'151');assert.equal(r.payload.coreCatalogIdentity.supported,true);assert.equal(r.payload.photoIdentityStatus.photoSupported,true);assert.equal(r.payload.originalIdentityObservation.identityReadings[2].text,'MEW EN');assert.equal(r.payload.originalIdentityObservation.identityConfidence,null);assert.equal(r.payload.financialDecision.allowed,false);assert.equal(r.payload.physicalPrintingStatus.verified,false);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.vision,1);
});
test('the same MEW mechanism retrieves another subject without a card-name shortcut',async()=>{
 const t=transport({cardPatch:{id:'synthetic-eevee-133',name:'Eevee',localId:'133'}});const result=await createTcgDexCatalog({fetchImpl:t.fetch}).catalogLookup({...query,subject:'Eevee',cardNumber:'133/165'});assert.equal(result.records.length,1);assert.equal(result.records[0].subject,'Eevee');assert.equal(result.records[0].cardNumber,'133/165');assert.equal(t.calls.length,2);
});
test('wrong denominator, wrong card set and explicitly conflicting provider language never pass',async()=>{
 const t=transport();const denominator=await createTcgDexCatalog({fetchImpl:t.fetch}).catalogLookup({...query,cardNumber:'004/166'});assert.equal(denominator.records.length,0);assert.equal(t.calls.length,1);
 for(const options of [{cardPatch:{set:{id:'other-set',name:'Other',cardCount:{official:165}}}},{cardPatch:{language:'French'}}]){const r=await scan(options);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.photoIdentityStatus.photoSupported,false);assert.equal(r.payload.financialDecision.allowed,false);}
});
test('duplicated reviewed codes remain ambiguous without making a catalog request',async()=>{
 const r=resolveReviewedSetCode('MEW','en').set,resolve=createReviewedSetResolver([r,{...r,id:'other'}]);assert.equal(resolve('MEW','en').status,'ambiguous');const t=transport();const result=await createTcgDexCatalog({fetchImpl:t.fetch,resolveSetCode:resolve}).catalogLookup(query);assert.equal(result.status,'ambiguous');assert.equal(t.calls.length,0);assert.ok(result.diagnostics.some(d=>d.reasonCode==='reviewed_set_code_ambiguous'));
});
test('unknown codes retain bounded global ambiguity and uncertain codes do not become reviewed evidence',async()=>{
 const t=transport();const result=await createTcgDexCatalog({fetchImpl:t.fetch}).catalogLookup({...query,printedSetCode:'UNREVIEWED'});assert.equal(result.status,'ambiguous');assert.equal(t.calls.length,1);
 const r=await scan({}, {visionResponse:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...model,identityReadings:model.identityReadings.map(row=>row.field==='setCode'?{...row,certainty:'uncertain'}:row)})}]}});assert.ok(r.calls[0].includes('/cards?'));assert.equal(r.payload.photoIdentityStatus.photoSupported,false);
});
test('unavailable service and incomplete set list remain unresolved; no retries or fabricated card fallback',async()=>{
 for(const options of [{unavailable:true},{incomplete:true},{missing:true}]){const r=await scan(options);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(r.payload.financialDecision.allowed,false);assert.ok(r.calls.length<=2);assert.equal(r.metrics.vision,1);}
});
test('different legitimate catalog IDs remain ambiguous even if their displayed core fields match',async()=>{
 const r=await scan({ambiguous:true});assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,'ambiguous');assert.equal(r.payload.identityVerification.catalog.candidate,undefined);assert.equal(r.payload.financialDecision.allowed,false);
 const record={id:'a',provider:'tcgdex',subject:'Charmander',cardNumber:'004/165',year:'2023',brandSet:'151',setId:'sv03.5',language:'en',variants:{normal:true}};
 const result=await crossCheckCatalog({subject:'Charmander',cardNumber:'004/165',year:'2023',brandSet:'151'},{catalogSource:'tcgdex',catalogLookup:async()=>[record,{...record,id:'b'}]});assert.equal(result.status,'ambiguous');
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'d7e07bfebada7f71ab1bd666747d0940c5324b01',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('authorized discovery diagnostics explain mapping, bounded strategy and scoped counts without URLs or raw lists',async()=>{
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];const r=await scan({}, {env,headers:req.headers});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.catalogDiscovery.mapping.id,'sv03.5');assert.equal(d.catalogDiscovery.mappingStatus,'resolved');assert.equal(d.catalogDiscovery.strategy,'reviewed_set');assert.deepEqual(d.catalogDiscovery.pageItemCounts,[1]);assert.equal(d.catalogDiscovery.requests,2);assert.equal(d.identity.catalogReference.id,'sv03.5-004');assert.doesNotMatch(JSON.stringify(d.catalogDiscovery),/https?:|Charmander|synthetic|pricing|api-key/);
});
