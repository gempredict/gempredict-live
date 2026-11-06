import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {scan as pikachuScan,vision as pikachuVision} from './helpers/pikachuFixture.mjs';
import {renderIdentityResult} from './helpers/renderReports.mjs';
import {IDENTITY_OUTPUT_TOKENS,buildIdentityPrompt,parseIdentityMessage,identifyFromPhotos} from '../lib/identityStage.mjs';
import {FINANCIAL_FIELDS,protectFinancialReport,protectedCopySummary} from '../lib/financialSafety.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const {facts}=JSON.parse(fs.readFileSync('tests/fixtures/zapdos-catalog-facts.json','utf8'));
const reading=(field,text,side='front',certainty='clear',alternatives=[])=>({field,text,certainty,side,area:field==='subject'?'name':field==='cardNumber'?'collector_line':'set_mark',alternatives});
const defaults=Object.fromEntries(['identifiedSubject','identifiedYear','identifiedBrandSet','identifiedCardNumber','identifiedLanguage','identifiedParallel','identifiedRarity','identifiedFranchise','identifiedManufacturer','identifiedAutoOrRelic','identityNotes','identityConfidence'].map(k=>[k,null]));
const zapdos={...defaults,identifiedSubject:'Zapdos',identifiedYear:'2025',identifiedBrandSet:'Unverified model set',identifiedCardNumber:'133/128',identifiedLanguage:'English',identityConfidence:88,identityReadings:[reading('subject','Zapdos'),reading('cardNumber','133/128'),reading('setCode','30C EN'),reading('copyrightYear','©2026')]};
const message=(object,stop_reason='end_turn')=>({stop_reason,content:[{type:'text',text:typeof object==='string'?object:JSON.stringify(object)}]});
// Mock response wrappers; no actual hosted records or synthetic sale data.
function catalog({missing=false,unavailable=false,ambiguous=false,incomplete=false}={}){
 const set={id:facts.setId,name:facts.setName,releaseDate:facts.releaseDate,cardCount:{official:128},tcgOnline:'30C'};
 const card={id:'mock-zapdos',name:facts.subject,localId:'133',rarity:facts.rarity,set,variants:{holo:true,reverse:false,normal:false}};
 const fillers=Array.from({length:128},(_,i)=>({id:'mock-filler-'+i,localId:String(i+1),name:'Synthetic member'}));
 return async url=>{if(unavailable)throw Error('private runtime https://private.invalid');const u=new URL(url);const data=u.pathname.endsWith('/sets/30th')?{...set,cards:incomplete?[]:[...fillers,...(missing?[]:[{id:card.id,name:card.name,localId:card.localId}]),...(ambiguous?[{id:'mock-alternate',name:card.name,localId:card.localId}]:[])]}:u.pathname.endsWith('/cards/mock-zapdos')?card:u.pathname.endsWith('/cards/mock-alternate')?{...card,id:'mock-alternate',rarity:'Special illustration rare'}:[];return {ok:true,status:200,json:async()=>structuredClone(data)};};
}
async function identify(options={}){return runScan({fields:{cardType:'pokemon',mode:'identity'},visionResponse:message(zapdos),catalogFetch:catalog(),...options});}
function isolated(r){assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.visionMaxTokens,IDENTITY_OUTPUT_TOKENS);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.upstream,0);assert.equal(r.metrics.internal.length,0);assert.ok(r.metrics.catalog<=9);assert.equal(r.payload.marketData,null);assert.equal(r.payload.imageAnalysis,null);assert.deepEqual(r.payload.stages,{identity:'completed',condition:'not_requested',marketplace:'not_requested'});assert.equal(r.payload.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);assert.equal(r.payload.prediction.recommendation,null);assert.equal(r.payload.prediction.verdict,'withheld');}
test('identity-only handler corrects Zapdos from independent facts, never makes condition or market requests',async()=>{
 const r=await identify();isolated(r);assert.equal(r.payload.canonicalCard.year,'2026');assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,true);assert.equal(r.payload.photoIdentityStatus.photoSupported,true);assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2025');assert.equal(r.payload.originalIdentityObservation.identityConfidence,88);assert.equal(r.payload.printedIdentityEvidence.setMarkings[0].text,'30C EN');assert.equal(r.payload.printedIdentityEvidence.copyright[0].text,'©2026');assert.equal(r.payload.physicalPrintingStatus.verified,false);assert.equal(r.metrics.images,2);
 assert.match(r.metrics.visionPrompt,/Do not assess condition/);assert.ok(r.metrics.visionPrompt.includes('FRONT')&&r.metrics.visionPrompt.includes('BACK'));
 const rendered=renderIdentityResult(r.payload);assert.match(rendered,/2026.*Zapdos/);assert.match(rendered,/Original AI Observation — Unverified/);assert.match(rendered,/2025/);assert.match(rendered,/Condition analysis: not requested/);assert.doesNotMatch(rendered,/\$|PSA submission fee|0%|PSA 10 probability|Estimated grade/);
});
test('identity-only Pikachu retains narrow printing provenance and original observation',async()=>{
 const model={...defaults,...pikachuVision,identityReadings:[reading('subject','Pikachu ex'),reading('cardNumber','149/128'),reading('setCode','30C EN')]};
 const r=await pikachuScan({fields:{cardType:'pokemon',mode:'identity'},visionResponse:message(model)});isolated(r);assert.equal(r.payload.canonicalCard.year,'2026');assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,true);assert.equal(r.payload.photoIdentityStatus.photoSupported,true);assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2023');
 const forged=structuredClone(r.payload);delete forged.identityVerification.catalog.referenceId;assert.equal(protectFinancialReport(forged).pokemonIdentityStatus.catalogVerified,false);
 assert.match(protectedCopySummary(protectFinancialReport(JSON.parse(JSON.stringify(r.payload)))),/2023.*withheld/);
});
test('sports identification preserves BCP-86 without claiming catalog verification',async()=>{
 const model={...defaults,...confirmed,identityReadings:[reading('subject','Konnor Griffin'),reading('cardNumber','BCP-86')]};
 const r=await identify({fields:{mode:'identity',cardType:'sports'},visionResponse:message(model)});isolated(r);assert.equal(r.metrics.catalog,0);assert.equal(r.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(r.payload.printedIdentityEvidence.collectorNumber[0].text,'BCP-86');assert.equal(r.payload.identityV2.identityVerified,false);assert.match(renderIdentityResult(r.payload),/No trusted independent catalog/);assert.match(renderIdentityResult(r.payload),/Unverified proposal/);
});
test('missing, unavailable, incomplete and ambiguous catalog results preserve unverified proposals',async()=>{
 for(const [option,outcome] of [['missing','not_found'],['unavailable','unavailable'],['incomplete','incomplete'],['ambiguous','ambiguous']]){
  const r=await identify({catalogFetch:catalog({[option]:true})});isolated(r);assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,outcome);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.deepEqual(r.payload.pokemonIdentityStatus.conflicts,[]);assert.equal(r.payload.originalIdentityObservation.identifiedSubject,'Zapdos');assert.equal(r.payload.canonicalCard.year,'2025');assert.match(renderIdentityResult(r.payload),/Unverified proposal/);
 }
});
test('explicit user conflict and contradictory printed readings are never silently overwritten',async()=>{
 const conflict=await identify({fields:{mode:'identity',cardType:'pokemon',cardSet:'2025 Unverified model set'}});isolated(conflict);assert.equal(conflict.payload.pokemonIdentityStatus.catalogOutcome,'conflict');assert.equal(conflict.payload.canonicalCard.year,'2025');
 const conflicting={...zapdos,identityReadings:[...zapdos.identityReadings,reading('language','FR')]};const r=await identify({visionResponse:message(conflicting)});isolated(r);assert.equal(r.payload.pokemonIdentityStatus.catalogVerified,false);assert.ok(r.payload.identityVerification.catalog.reasonCodes.includes('contradictory_clear_printed_readings'));
});
test('front-only and partial identity evidence produce useful results without invented back, rarity or printing',async()=>{
 const r=await identify({back:false});isolated(r);assert.equal(r.metrics.images,1);
 const partial=await identify({back:false,visionResponse:message({...defaults,identifiedSubject:'Zapdos',identityReadings:[reading('cardNumber','133/128','front','uncertain',['133/129'])]})});isolated(partial);assert.equal(partial.payload.pokemonIdentityStatus.catalogVerified,false);assert.equal(partial.payload.originalIdentityObservation.identifiedYear,null);assert.equal(partial.payload.originalIdentityObservation.identityReadings[0].certainty,'uncertain');assert.equal(partial.payload.originalIdentityObservation.identityReadings[0].alternatives[0],'133/129');assert.match(renderIdentityResult(partial.payload),/Rarity: Unverified/);
});
test('complete JSON contract rejects truncation, malformed, empty, extra financial fields and unsupported back attribution',async()=>{
 for(const response of [message(zapdos,'max_tokens'),message('{"identifiedSubject":"Zapdos"'),message(''),message('[]'),message({...zapdos,rawValue:123}),message({...zapdos,identityReadings:[reading('subject','Zapdos','back')]})]){
  const r=await identify({back:false,visionResponse:response});assert.notEqual(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.catalog,0);assert.equal(r.metrics.internal.length,0);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.payload.failureCategory,'analysis_provider');
 }
 assert.throws(()=>parseIdentityMessage(message({...zapdos,identityConfidence:101}),['front']));
});
test('provider failure is distinct from catalog unresolved and does not retry',async()=>{
 for(const status of [401,429,503]){const r=await identify({visionError:{status}});assert.notEqual(r.status,200);assert.equal(r.payload.failureCategory,'analysis_provider');assert.equal(r.metrics.vision,1);assert.equal(r.metrics.catalog,0);assert.equal(r.metrics.valuation,0);}
 const runtime=await identifyFromPhotos({client:{messages:{create:()=>({withResponse:async()=>({data:message(zapdos),response:{status:200}})})}},front:Buffer.from('mock'),frontMime:'image/jpeg',cardType:'pokemon',fetchImpl:async()=>{throw Error('offline');}});assert.equal(runtime.pokemonIdentityStatus.catalogOutcome,'unavailable');
});
test('identity action requires valid front photo and explicit mode; malformed uploads stop before any paid call',async()=>{
 for(const options of [{textOnly:true},{badBack:true},{fields:{mode:'unsupported',cardType:'pokemon'}}]){const r=await identify(options);assert.equal(r.status,400);assert.equal(r.metrics.vision,0);}
});
const diagnosticEnv={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'c3e29f61a1df472c49d6a1e181c4bc9af475fbca',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('owner-authorized diagnostics distinguish identity stages and provider failure without raw responses or photos',async()=>{
 const env=diagnosticEnv,req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 for(const options of [{},{catalogFetch:catalog({missing:true})},{visionResponse:message('{')},{visionError:{status:503}}]){
  const r=await identify({env,headers:req.headers,...options});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.stage,'identity');assert.equal(d.stages.condition,'not_requested');assert.equal(d.stages.marketplace,'not_requested');assert.equal(d.marketplace.attempted,false);assert.equal(d.marketplace.requests,0);assert.equal(d.stages.identity,r.status===200?'completed':'failed');assert.doesNotMatch(JSON.stringify(d),/base64|private runtime|private provider|https?:|mock\.preview\.signature|identityReadings/);
  if(r.status===200){assert.ok(['supported','not_found'].includes(d.identity.catalogOutcome));assert.equal(d.normalization.fieldDisposition.identifiedSubject,'retained');}
 }
 const unauthorized=await identify({env});assert.equal(unauthorized.responseHeaders[TICKET_HEADER],undefined);
 const production=await identify({env:{...env,VERCEL_ENV:'production'},headers:req.headers});assert.equal(production.responseHeaders[TICKET_HEADER],undefined);
});
test('UI exposes a separate identity action through the protected multipart transport and guards duplicate clicks',()=>{
 const source=fs.readFileSync('src/App.jsx','utf8');for(const text of ['Identify Card',"handleSubmit('identity')","formData.append(\"mode\",\"identity\")",'scanInFlight.current','assertUploadBudget(formData)','requestPrediction({ method: "POST", body: formData })','<IdentityResult report={identityResult}','<ResultCard','<ImageAnalysisCard'])assert.ok(source.includes(text),text);
 const prompt=buildIdentityPrompt({cardType:'sports',hasBack:false});assert.ok(prompt.length<2600);assert.match(prompt,/alphanumeric/);assert.match(prompt,/Copyright text is not proof/);
});
test('verification runtime failure retains successful observation with an explicit runtime notice',async()=>{
 const r=await identify({verificationError:true});isolated(r);assert.equal(r.payload.verificationRuntimeFailed,true);assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2025');assert.equal(r.payload.pokemonIdentityStatus.catalogOutcome,'unavailable');assert.deepEqual(r.payload.pokemonIdentityStatus.conflicts,[]);assert.equal(r.payload.scanNotices[0].failureCategory,'verification_runtime');assert.match(renderIdentityResult(r.payload),/catalog verification encountered a runtime problem/);
});
test('installed SDK identity request makes one attempt with a 45-second timeout override and no retries',async()=>{
 const {default:Anthropic}=await import('@anthropic-ai/sdk');let calls=0,body;
 const client=new Anthropic({apiKey:'mock',maxRetries:0,fetch:async(url,options)=>{calls++;body=JSON.parse(options.body);return new Response('{}',{status:503,headers:{'content-type':'application/json'}});}});
 await assert.rejects(identifyFromPhotos({client,front:Buffer.from('mock'),frontMime:'image/jpeg',cardType:'pokemon'}));assert.equal(calls,1);assert.equal(body.max_tokens,2000);assert.equal(body.model,'claude-sonnet-4-6');assert.equal(body.messages.length,1);
});
test('actual upload and Identify Card callbacks submit only identity mode once, then show an identity result',async()=>{
 const {appInteraction}=await import('./helpers/renderReports.mjs');
 const {requestPrediction,predictionFailureResponse}=await import('../lib/predictionTransport.mjs');
 const {rememberScanDiagnostic}=await import('../lib/scanDiagnosticClient.mjs');
 const {UploadError}=await import('../lib/mobileImages.mjs');
 const payload=(await identify({back:false})).payload;
 let calls=0,release;const held=new Promise(resolve=>{release=resolve;});
 const h=appInteraction({FormData,URL,normalizeMobileImage:async file=>file,assertUploadBudget:async()=>{},UploadError,rememberScanDiagnostic,predictionFailureResponse,requestPrediction:options=>requestPrediction(options,async(url,options)=>{
  calls++;assert.equal(url,'/api/predict');assert.equal(options.redirect,'manual');assert.equal(options.credentials,'same-origin');assert.equal(options.body.get('mode'),'identity');assert.ok(options.body.get('image'));assert.equal(options.body.get('backImage'),null);await held;return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
 })});
 let tree=h.render();const file=new File([new Uint8Array([1,2,3])],'mock-prepared.jpg',{type:'image/jpeg'});
 h.nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0].props.onChange({target:{files:[file],value:'front'}});await new Promise(setImmediate);
 tree=h.render();const button=h.nodes(tree,n=>n.type==='button'&&n.props.children==='Identify Card')[0];assert.equal(button.props.disabled,false);
 const pending=button.props.onClick();await button.props.onClick();await new Promise(setImmediate);assert.equal(calls,1);release();await pending;
 tree=h.render();const result=h.nodes(tree,n=>n.props?.report?.stage==='identity')[0];assert.ok(result);assert.equal(result.props.report.pokemonIdentityStatus.catalogVerified,true);assert.equal(result.props.report.imageAnalysis,null);assert.ok(result.props.report.cardTitle);assert.equal(result.props.report.rawValue,null);
});
test('dense front/back identity JSON retains all twelve readings, uncertainty and separate rarity status',async()=>{
 const values={subject:'Zapdos',cardNumber:'133/128',setCode:'30C EN',language:'EN',rarityMark:'Illustration mark uncertain',copyrightYear:'©2026'};
 const readings=['front','back'].flatMap(side=>Object.entries(values).map(([field,text])=>reading(field,text,side,field==='rarityMark'?'uncertain':'clear',field==='rarityMark'?['Unreadable mark']:[])));
 const r=await identify({visionResponse:message({...zapdos,identityNotes:'Printed number is clear. Rarity mark is uncertain; no physical printing claim.',identityReadings:readings})});isolated(r);assert.equal(r.payload.originalIdentityObservation.identityReadings.length,12);assert.equal(r.payload.originalIdentityObservation.identityReadings[10].certainty,'uncertain');assert.equal(r.payload.rarityVerification.status,'catalog_supported');assert.equal(r.payload.variantVerification.status,'insufficient_evidence');assert.equal(r.payload.artworkStatus.verified,false);assert.equal(r.payload.physicalPrintingStatus.verified,false);
 console.log('Synthetic identity JSON bytes:',Buffer.byteLength(JSON.stringify({...zapdos,identityReadings:readings})),'; provider tokens not measured offline.');
});
