import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scan,vision} from './helpers/zapdosLiveFixture.mjs';
import {validateReviewedSource,reviewedSourceReceipt,hostedCatalogEvidence} from '../lib/reviewedCatalogSource.mjs';
import {sourceCatalogEvidence,rarityClaim} from '../lib/sourceCatalogEvidence.mjs';
import {protectFinancialReport,protectedCopySummary} from '../lib/financialSafety.mjs';
import {verificationRows} from '../lib/reportVerification.mjs';
import {scan as pikachuScan,vision as pikachuVision} from './helpers/pikachuFixture.mjs';
import {renderIdentityResult} from './helpers/renderReports.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const composite='Special Illustration Rare (full-art holo)';
const asset=()=>JSON.parse(readFileSync(new URL('../data/tcgdex/reviewed-source.json',import.meta.url)));
test('reviewed source requires exact asset, revision and blob integrity',()=>{
 assert.equal(validateReviewedSource(asset()),true);
 for(const mutate of [a=>a.revision='0'.repeat(40),a=>a.files[0].content+='\n',a=>a.files[1].blob='0'.repeat(40),a=>a.repository='other/catalog']){const a=asset();mutate(a);assert.throws(()=>validateReviewedSource(a),/integrity_invalid/);}
});
test('Zapdos retains hosted disagreement and independent IR/holo/stamp/J source facts without opening any gate',async()=>{
 const p=(await scan({model:{identifiedParallel:composite},catalog:{normalOnly:true,cardPatch:{updated:'2026-11-06T10:00:00Z'}}})).payload,s=p.sourceCatalogEvidence;
 assert.equal(s.status,'disagreement');assert.deepEqual(s.differences,['normal','holo']);assert.equal(s.source.revision,asset().revision);
 assert.deepEqual(s.hosted.variants,{normal:true,holo:false,reverse:false});assert.equal(s.hosted.updated,'2026-11-06T10:00:00Z');assert.equal(s.hosted.revision,null);
 assert.equal(s.rarity.value,'Illustration rare');assert.equal(s.rarity.proposalStatus,'conflict');assert.equal(s.artwork.status,'unresolved');
 assert.deepEqual(s.finish.values,['holo']);assert.deepEqual(s.printings.values,[{finish:'holo',stamps:['30th-anniversary']}]);assert.equal(s.regulationMark.value,'J');
 assert.equal(p.originalIdentityObservation.identifiedParallel,composite);assert.equal(p.coreCatalogIdentity.supported,true);assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(p.financialDecision.allowed,false);assert.equal(p.valuationIdentityGate.allowed,false);
 assert.deepEqual(p.identityVerification.catalog.candidate.variants,{normal:true,holo:false,reverse:false});
});
test('missing flags remain incomplete and cannot be filled from source facts',async()=>{
 const p=(await scan({model:{identifiedParallel:'Holo'},catalog:{cardPatch:{variants:null}}})).payload;
 assert.equal(p.sourceCatalogEvidence.status,'incomplete');assert.deepEqual(p.sourceCatalogEvidence.hosted.variants,{normal:null,holo:null,reverse:null});
 assert.equal(p.identityVerification.catalog.candidate.variants,null);assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(p.financialDecision.allowed,false);
});
test('source-compatible flags do not authenticate photo, artwork or model SIR claim',async()=>{
 const p=(await scan({model:{identifiedParallel:composite}})).payload;
 assert.equal(p.sourceCatalogEvidence.status,'consistent');assert.equal(p.sourceCatalogEvidence.rarity.proposalStatus,'conflict');assert.equal(p.sourceCatalogEvidence.photoVerified,false);
 assert.equal(p.sourceCatalogEvidence.mayAuthorizeIdentity,false);assert.equal(p.sourceCatalogEvidence.mayAuthorizeValuation,false);assert.equal(p.photoIdentityStatus.photoSupported,false);
});
test('contradictory model rarity fields cannot conceal a composite SIR claim',async()=>{
 const p=(await scan({model:{identifiedParallel:composite,identifiedRarity:'Illustration rare'}})).payload;
 assert.deepEqual(p.sourceCatalogEvidence.rarity.proposals,['Illustration rare','Special illustration rare']);assert.equal(p.sourceCatalogEvidence.rarity.proposalStatus,'conflict');assert.equal(p.photoIdentityStatus.photoSupported,false);
});
test('different hosted rarity is retained while reviewed source remains independently labeled',async()=>{
 const p=(await scan({catalog:{cardPatch:{rarity:'Special illustration rare'}}})).payload;
 assert.equal(p.sourceCatalogEvidence.rarity.value,'Illustration rare');assert.equal(p.sourceCatalogEvidence.hosted.rarity,'Special illustration rare');assert.ok(p.sourceCatalogEvidence.differences.includes('rarity'));assert.equal(p.sourceCatalogEvidence.status,'disagreement');assert.equal(p.photoIdentityStatus.photoSupported,false);
});
test('rarity classes are separate from foil and full-art description; no rarity is inferred from holo',()=>{
 assert.equal(rarityClaim('full-art holo'),null);assert.equal(rarityClaim(composite),'Special illustration rare');assert.equal(rarityClaim('Illustration rare — holo'),'Illustration rare');assert.equal(rarityClaim('Rare'),null);
});
test('wrong number, denominator, set and language cannot borrow reviewed evidence',async()=>{
 for(const proposal of [{identifiedCardNumber:'134/128'},{identifiedCardNumber:'133/129'},{identifiedLanguage:'Japanese'}]){const model={...proposal,identityReadings:vision.identityReadings.map(r=>({...r,text:r.field==='cardNumber'&&proposal.identifiedCardNumber?proposal.identifiedCardNumber:r.field==='language'&&proposal.identifiedLanguage?proposal.identifiedLanguage:r.text}))};const p=(await scan({model})).payload;assert.equal(p.sourceCatalogEvidence.status,'unavailable');assert.equal(p.financialDecision.allowed,false);}
 const p=(await scan({fields:{cardSet:'2025 Different Set'}})).payload;assert.equal(p.sourceCatalogEvidence.status,'unavailable');assert.equal(p.financialDecision.allowed,false);
});
test('stale source receipts and saved-report alterations cannot mint reviewed support',async()=>{
 const p=(await scan()).payload;
 for(const mutate of [p=>p.identityVerification.catalog.candidate.reviewedSource.revision='0'.repeat(40),p=>p.identityVerification.catalog.candidate.reviewedSource.cardBlob='0'.repeat(40),p=>p.identityVerification.catalog.referenceId='other-133',p=>p.canonicalCard.cardNumber='134/128']){
  const copy=structuredClone(p);mutate(copy);copy.sourceCatalogEvidence={status:'consistent',photoVerified:true};const restored=protectFinancialReport(copy);assert.equal(restored.sourceCatalogEvidence.status,'unavailable');assert.equal(restored.photoIdentityStatus.photoSupported,false);
 }
});
test('alternate stamp and newer hosted metadata are retained, never overwritten by older source revision',async()=>{
 const p=(await scan({catalog:{cardPatch:{updated:'2027-01-01T00:00:00Z',variants_detailed:[{type:'holo',stamp:['pokemon-center'],size:'standard',variantId:'explicit'}],regulationMark:'K'}}})).payload,s=p.sourceCatalogEvidence;
 assert.equal(s.status,'disagreement');assert.ok(s.differences.includes('stamp'));assert.ok(s.differences.includes('regulationMark'));assert.equal(s.hosted.printings[0].stamps[0],'pokemon-center');assert.equal(s.hosted.regulationMark,'K');assert.equal(p.financialDecision.allowed,false);
});
test('genuine explicit non-holo hosted declaration is retained rather than converted to holo',async()=>{
 const p=(await scan({model:{identifiedParallel:'Non-Holo'},catalog:{normalOnly:true,cardPatch:{variants_detailed:[{type:'normal',variantId:'explicit'}]}}})).payload;
 assert.equal(p.sourceCatalogEvidence.status,'disagreement');assert.equal(p.sourceCatalogEvidence.hosted.printings[0].finish,'normal');assert.equal(p.identityVerification.catalog.candidate.variants.normal,true);assert.equal(p.sourceCatalogEvidence.disposition,'retain_both_unresolved');assert.equal(p.financialDecision.allowed,false);
});
test('unreviewed non-holo catalog records cannot inherit another card source evidence',()=>{
 // Sanitized non-holo fixture; not a claim of newly observed provider data.
 const h=hostedCatalogEvidence({id:'synthetic-base-1',variants:{normal:true,holo:false,reverse:true},variants_detailed:[{type:'normal'},{type:'reverse'}]});
 assert.equal(reviewedSourceReceipt(h.id),null);assert.deepEqual(h.variants,{normal:true,holo:false,reverse:true});
 const source=sourceCatalogEvidence({coreCatalogIdentity:{supported:true},identityVerification:{catalog:{source:'tcgdex',referenceId:h.id,candidate:{provider:'tcgdex',hostedEvidence:h}}}});
 assert.equal(source.status,'unavailable');
});
test('uncertain combined regulation/set/language mark is interpreted only as a possibility',async()=>{
 for(const text of ['J 30CEN','J 30C EN']){const base=(await scan()).payload;const reading=base.originalIdentityObservation.identityReadings.find(r=>r.field==='setCode');reading.text=text;const s=sourceCatalogEvidence(base);assert.equal(s.printedMarkings[0].text,text);assert.equal(s.printedMarkings[0].certainty,'uncertain');assert.equal(s.printedMarkings[0].interpretation,'possible_regulation_set_language');assert.equal(s.printedMarkings[0].promotedToClear,false);}
});
test('restored and copied identity reports preserve source versus hosted and rarity disagreement',async()=>{
 const p=protectFinancialReport(JSON.parse(JSON.stringify((await scan({model:{identifiedParallel:composite},catalog:{normalOnly:true}})).payload)));
 assert.equal(p.sourceCatalogEvidence.status,'disagreement');assert.equal(p.sourceCatalogEvidence.rarity.proposalStatus,'conflict');
 assert.match(protectedCopySummary(p),/AI rarity comparison: conflict/);assert.match(protectedCopySummary(p),/30th-anniversary/);
 const rows=verificationRows(p);assert.match(rows.find(r=>r.key==='source_rarity').reason,/distinct/);assert.equal(rows.find(r=>r.key==='source_catalog').status,'Unresolved disagreement');
 const html=renderIdentityResult(p);assert.match(html,/Illustration Rare and Special Illustration Rare are distinct/);assert.match(html,/Source foil treatment: Source supported/);assert.match(html,/30th-anniversary/);assert.doesNotMatch(html,/\$|0%/);
});
test('same reviewed mechanism supports Pikachu SIR without discarding its stricter existing snapshot correction',async()=>{
 const r=await pikachuScan({fields:{mode:'identity',cardType:'pokemon'},visionResponse:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...vision,...pikachuVision,identityReadings:vision.identityReadings.map(r=>({...r,text:r.field==='subject'?'Pikachu ex':r.field==='cardNumber'?'149/128':r.text}))})}]}}),p=r.payload;
 assert.equal(r.status,200);assert.equal(p.sourceCatalogEvidence.source.revision,asset().revision);assert.equal(p.sourceCatalogEvidence.rarity.value,'Special illustration rare');
 assert.equal(p.sourceCatalogEvidence.existingPrintingCorrectionRetained,true);assert.equal(p.identityVerification.catalog.candidate.variants.holo,true);
 assert.equal(p.sourceCatalogEvidence.hosted.variants.normal,true);assert.equal(p.financialDecision.allowed,false);
});
test('new source disagreement vetoes photo support even when clear readings and hosted non-holo proposal agree',async()=>{
 const model={identifiedParallel:'Non-Holo',identityReadings:vision.identityReadings.map(r=>r.field==='setCode'?{...r,text:'30C EN',certainty:'clear'}:r)};
 const r=await scan({model,catalog:{normalOnly:true}}),p=r.payload;
 assert.equal(p.coreCatalogIdentity.supported,true);assert.equal(p.valuationIdentityGate.allowed,false);assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(r.requests,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);
});
test('owner-only diagnostics retain bounded source provenance and disagreement without raw source, model or URLs',async()=>{
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'3bce90f3db3d626ed2a4b2ee169af30663a636fe',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const r=await scan({env,headers:req.headers,model:{identifiedParallel:composite},catalog:{normalOnly:true}});
 const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);
 assert.equal(d.sourceCatalogEvidence.status,'disagreement');assert.equal(d.sourceCatalogEvidence.proposalRarity,'conflict');assert.equal(d.sourceCatalogEvidence.possibleCombinedMarking,true);assert.equal(d.sourceCatalogEvidence.revision,asset().revision);
 assert.doesNotMatch(JSON.stringify(d.sourceCatalogEvidence),/https?:|const card|api-key|base64|thirdParty/);
 const ordinary=await scan({env});assert.equal(ordinary.responseHeaders[TICKET_HEADER],undefined);
});
