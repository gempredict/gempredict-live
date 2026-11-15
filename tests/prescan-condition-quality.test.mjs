// Synthetic photos/responses only. No live provider, marketplace or owner credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {createHash,webcrypto} from 'node:crypto';
import {requireOwnerDiagnosticAccess} from '../lib/scanDiagnosticClient.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
import {createPreparedValidation} from '../lib/preparedValidation.mjs';
import {conditionPresentation} from '../lib/visualEvidence.mjs';
import {collectorConditions,collectorLimitations} from '../lib/collectorPresentation.mjs';
import {conditionSnapshot} from '../lib/unifiedReportPresentation.mjs';
import {reportFromResponse,protectFinancialReport,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {UploadError} from '../lib/mobileImages.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {fullMessage,metsFullAnalysisObservation} from './helpers/fullAnalysisFixtures.mjs';
import {appInteraction,renderReports,renderDiagnosticControl,controlledValidationInteraction} from './helpers/renderReports.mjs';
const revision='66059e29f4df1033bc95bf858191eea303be5163';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:revision,VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
const origin='https://'+env.VERCEL_URL;
function owner(age=0){const req={method:'POST',headers:{host:env.VERCEL_URL,origin}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,Date.now()-age).split(';')[0];return req.headers;}
const status=(patch={})=>({enabled:true,conditionValidationAvailable:true,authorized:true,expiresAt:Date.now()+60000,revision,...patch});
const fakeStatus=(value)=>async(url,opts)=>{assert.equal(url,'/api/scan-diagnostics');assert.equal(opts.cache,'no-store');assert.equal(opts.credentials,'same-origin');assert.equal(opts.redirect,'error');assert.equal(opts.method,undefined);return {ok:true,json:async()=>value};};
async function image(){return sharp({create:{width:30,height:40,channels:3,background:'#fff'}}).jpeg().toBuffer();}
async function app(check,{optIn=true,send}={}){
 let calls=0,checks=0;const bytes=await image();
 const h=appInteraction({FormData,URL,UploadError,normalizeMobileImage:async f=>f,assertUploadBudget:async()=>{},requireOwnerDiagnosticAccess:async()=>{checks++;return check();},requestPrediction:async options=>{calls++;return send?send(options):{response:{ok:true,status:200,headers:new Headers()},data:{success:true,imageAnalysis:{},prediction:{cardTitle:'Synthetic'}}};},rememberScanDiagnostic(){},predictionFailureResponse:()=>null});
 let tree=h.render();const files=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file');await files[0].props.onChange({target:{files:[new File([bytes],'front.jpg',{type:'image/jpeg'})]}});await files[1].props.onChange({target:{files:[new File([bytes],'back.jpg',{type:'image/jpeg'})]}});await new Promise(setImmediate);tree=h.render();
 if(optIn){h.nodes(tree,n=>typeof n.props?.onValidationChange==='function')[0].props.onValidationChange(true);tree=h.render();}
 const submit=()=>h.nodes(tree,n=>n.type==='button'&&n.props.children==='Analyze My Card')[0].props.onClick();
 return {h,submit,render(){tree=h.render();return tree;},counts:()=>({calls,checks}),text:()=>{const out=[];const walk=n=>{if(typeof n==='string')out.push(n);else if(Array.isArray(n))n.forEach(walk);else if(n&&typeof n==='object'&&n.type!=='style')walk(n.props?.children);};walk(tree);return out.join(' ');}};
}
const clean=(attribute='corners',side='front',region=[.1,.1,.1,.1])=>({attribute,code:'no_defect_observed',certainty:'confirmed',evidence:{side,region,cue:'clear_inspected_area',confidence:.95}});
const cover=(attribute='corners',side='front',state='inspected',limits=[])=>({attribute,side,regions:[{region:[0,0,1,1],status:state}],limitations:limits});
function example(){return conditionPresentation({inspectedSides:['front','back'],visualObservations:[clean(),clean('edges'),{attribute:'surface',code:'scratches',certainty:'suspected',evidence:{side:'back',region:[.2,.2,.1,.1],cue:'surface_line',confidence:.6}},{attribute:'surface',code:'scratches',certainty:'unassessable',evidence:{side:'front'}}],inspectionCoverage:[cover(),cover('edges','front','partial'),cover('surface','back','partial'),cover('surface','front','unassessable',[{code:'glare',region:[.4,.4,.2,.2]}])],imageLimitations:['glare'],photoNotes:[{attribute:'surface',side:'front',text:'Glare prevents surface inspection.'}]});}

test('client blocks missing, expired and unavailable diagnostic authorization before submitting Full Analysis',async()=>{
 for(const patch of [{authorized:false,expiresAt:null},{expiresAt:Date.now()-1},{enabled:false},{conditionValidationAvailable:false}]){const u=await app(()=>requireOwnerDiagnosticAccess({fetchImpl:fakeStatus(status(patch))}));await u.submit();u.render();assert.deepEqual(u.counts(),{calls:0,checks:1});assert.match(u.text(),/Owner validation blocked/);assert.match(u.text(),/No scan submitted/);}
});
test('network or non-OK authorization check blocks, and never auto-authorizes or stores owner keys',async()=>{
 for(const fetchImpl of [async()=>{throw Error('network');},async()=>({ok:false,status:404})]){const u=await app(()=>requireOwnerDiagnosticAccess({fetchImpl}));await u.submit();u.render();assert.equal(u.counts().calls,0);assert.match(u.text(),/Authorize Preview Scan Diagnostics/);}
});
test('valid opt-in authorization submits one normal Full Analysis, with diagnostic intent; double taps stay locked',async()=>{
 let release;const wait=new Promise(r=>{release=r;});const u=await app(async()=>{await wait;return requireOwnerDiagnosticAccess({fetchImpl:fakeStatus(status())});},{send:async options=>{assert.equal(options.body.get('ownerValidation'),'true');assert.equal(options.body.get('mode'),null);assert.ok(options.body.get('image'));return {response:{ok:true,status:200,headers:new Headers()},data:{success:true,imageAnalysis:{},prediction:{cardTitle:'Synthetic'}}};}});const first=u.submit();await u.submit();assert.equal(u.counts().checks,1);assert.equal(u.counts().calls,0);release();await first;assert.deepEqual(u.counts(),{checks:1,calls:1});
});
test('ordinary customer Full Analysis bypasses the owner-only opt-in without authorization or extra request',async()=>{
 const u=await app(()=>{throw Error('must not check ordinary scan');},{optIn:false,send:async options=>{assert.equal(options.body.get('ownerValidation'),null);return {response:{ok:true,status:200,headers:new Headers()},data:{success:true,imageAnalysis:{},prediction:{cardTitle:'Synthetic'}}};}});await u.submit();assert.deepEqual(u.counts(),{calls:1,checks:0});
});
test('server blocks explicit owner validation with absent/expired/disabled authorization or inert observer before model calls',async()=>{
 for(const patch of [{headers:{}},{headers:owner(901000)},{headers:owner(),env:{...env,GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'false'}},{headers:owner(),diagnosticError:true},{headers:owner(),env:{...env,VERCEL_ENV:'production'}}]){const r=await runScan({env,fields:{cardType:'sports',ownerValidation:'true'},...patch});assert.equal(r.status,403);assert.equal(r.metrics.vision,0);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.internal.length,0);assert.match(r.payload.error,/diagnostic/i);}
});
test('authorized server owner Full Analysis uses one prompt-JSON call, returns export, and never unlocks money',async()=>{
 const headers=owner(),r=await runScan({env,headers,fields:{cardType:'sports',ownerValidation:'true'},visionResponse:fullMessage(metsFullAnalysisObservation()),items:[],neutral:[]});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.sdkRequest.output_config,undefined);const d=readDiagnosticTicket({method:'POST',headers},r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.provider.sdkAttempts,1);const p=reportFromResponse(r.payload);assert.equal(p.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(p[f],null);assert.equal(p.imageAnalysis.psa10Probability,null);
 const ordinary=await runScan({env,fields:{cardType:'sports'},visionResponse:fullMessage(metsFullAnalysisObservation()),items:[],neutral:[]});assert.equal(ordinary.status,200);assert.equal(ordinary.metrics.vision,1);assert.equal(ordinary.responseHeaders[TICKET_HEADER],undefined);
});
test('explicit owner validation rejects malformed intent and photo-free or identification-only misuse',async()=>{
 for(const patch of [{fields:{ownerValidation:'yes'}},{fields:{ownerValidation:'true',mode:'identity'}},{fields:{ownerValidation:true},textOnly:true}]){const r=await runScan({env,headers:owner(),...patch});assert.equal(r.status,400);assert.equal(r.metrics.vision,0);}
});
test('prepared controlled App callback also checks fresh diagnostics before submission',async()=>{
 const bytes=await image(),front=new File([bytes],'front.jpg',{type:'image/jpeg'}),back=new File([bytes],'back.jpg',{type:'image/jpeg'});const state={front,back,busy:false,version:'1:1',category:'pokemon',categorySelected:true};const exports=[];
 const control=createPreparedValidation({revision,getFiles:()=>state,cryptoImpl:webcrypto,dimensions:async()=>({width:30,height:40}),download:async(blob,name)=>exports.push({blob,name})});const attempt=await control.freeze();for(const kind of ['front','back','manifest']){await control.export(attempt,kind);const d=exports.at(-1);await control.verifySaved(attempt,kind,new File([await d.blob.arrayBuffer()],d.name,{type:d.blob.type}));}const frozen=control.consume(attempt,'pokemon');
 let calls=0;const u=appInteraction({FormData,URL,UploadError,normalizeMobileImage:async f=>f,assertUploadBudget:async()=>{},requireOwnerDiagnosticAccess:()=>requireOwnerDiagnosticAccess({fetchImpl:fakeStatus(status({authorized:false}))}),requestPrediction:async()=>{calls++;},predictionFailureResponse:()=>null});let tree=u.render();const inputs=u.nodes(tree,n=>n.type==='input'&&n.props.type==='file');await inputs[0].props.onChange({target:{files:[front]}});await inputs[1].props.onChange({target:{files:[back]}});await new Promise(setImmediate);tree=u.render();await u.nodes(tree,n=>n.props?.getSelectionEpoch&&n.props?.onSubmit)[0].props.onSubmit(frozen);assert.equal(calls,0);assert.match(JSON.stringify(u.render(),(k,v)=>k==='ref'?undefined:v),/Owner validation blocked/);
});
test('collector summary leads with supported and tentative observations, separately labels back suspected damage and unknown front provenance',()=>{
 const a=example(),before=JSON.stringify(a),view=conditionSnapshot(collectorConditions(a));assert.match(view.find(r=>r.key==='corners').brief,/Front corners: no visible defect in inspected regions/);assert.match(view.find(r=>r.key==='edges').brief,/no obvious defect reported \(tentative\)/);const surface=view.find(r=>r.key==='surface').brief;assert.match(surface,/Back surface: suspected scratches/);assert.match(surface,/Reported front \(side unverified\): unable to assess reliably/);assert.match(view.find(r=>r.key==='centering').brief,/Front centering: not assessed/);assert.equal(JSON.stringify(a),before);
});
test('primary condition summary omits repeated technical caveats while expandable original evidence and warning provenance survive',()=>{
 const a=example(),safe=protectFinancialReport({identityV2:{category:'sports'},imageAnalysis:a}),html=renderReports(safe).upper;const condition=html.slice(html.indexOf('class="gp-condition-grid"')),primary=condition.split('<details>')[0];assert.match(primary,/no visible defect in inspected regions/);assert.match(primary,/suspected scratches/);assert.match(primary,/unassessed areas remain unknown/);assert.doesNotMatch(primary,/confidence|inspection evidence is insufficient|model-proposed region|Image regions|Because/);assert.equal((primary.match(/whole-card cleanliness/g)||[]).length,1);assert.match(condition,/Inspection coverage &amp; original evidence/);assert.match(condition,/invalid_localization_cue_or_measurement/);assert.match(condition,/reportedSide/);assert.match(condition,/Glare prevents surface inspection/);assert.match(condition,/0\.4, 0\.4, 0\.2, 0\.2/);assert.deepEqual(safe.imageAnalysis.visualObservations,a.visualObservations);assert.equal(collectorLimitations(a,{compact:true}).filter(s=>s==='glare').length,1);
});
test('contradictions remain conservative and explicitly disclosed after presentation changes',()=>{
 const raw={inspectedSides:['front'],visualObservations:[clean(),{attribute:'corners',code:'whitening',certainty:'suspected',evidence:{side:'front',region:[.1,.1,.1,.1],cue:'localized_color_loss',confidence:.6}}],inspectionCoverage:[cover()]};const a=conditionPresentation(raw);assert.equal(a.visualObservations[0].certainty,'unassessable');assert.notEqual(a.visualObservations[0].observationStatus,'tentative_visible_area_observation');const html=renderReports(protectFinancialReport({imageAnalysis:a})).upper;assert.match(html,/Overlapping observations disagree/);assert.match(html,/suspected whitening/);assert.equal(a.psa10Probability,null);
});
test('Sports and Pokémon round trips keep exact evidence, rendering design, financial and grade withholding',async()=>{
 for(const category of ['sports','pokemon']){const r=await runScan({fields:{cardType:category},vision:{...metsFullAnalysisObservation(),...example()},items:[],neutral:[]});assert.equal(r.status,200);const safe=reportFromResponse(r.payload),restored=protectFinancialReport(JSON.parse(JSON.stringify(safe)));assert.deepEqual(restored.imageAnalysis.visualObservations,safe.imageAnalysis.visualObservations);assert.deepEqual(restored.imageAnalysis.inspectionCoverage,safe.imageAnalysis.inspectionCoverage);assert.equal(restored.financialDecision.allowed,false);assert.equal(restored.identityV2.printingVerified,false);for(const f of FINANCIAL_FIELDS)assert.equal(restored[f],null);assert.equal(restored.imageAnalysis.estimatedGrade,null);assert.equal(restored.imageAnalysis.psa10Probability,null);assert.match(renderReports(restored).upper,/Detailed Condition Findings/);}
 // Locked style and certainty engine are byte-for-byte unchanged.
 const lockedHashes={"src/components/ReportStyle.jsx": "8beab61266fb72f9b6862c7e25561ddf8aa624706e124c356599f462b2dc9666", "lib/visualEvidence.mjs": "35a2eb99d208027ead2beb438805a2a7ca4ee42b52dc55b588b2ac694c5b149d"};
 for(const [path,hash] of Object.entries(lockedHashes))assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash);
});


test('Preview owner opt-in shows authorization and expiry; missing capability stays blocked until explicitly deselected',async()=>{
 const props={validationRequired:true,onValidationChange(){}};
 const active=await renderDiagnosticControl(status(),null,props);assert.match(active,/Owner validation/);assert.match(active,/active until/);assert.match(active,/Refresh diagnostic authorization/);
 const missing=await renderDiagnosticControl(status({authorized:false,expiresAt:null}),null,props);assert.match(missing,/missing or expired/);assert.match(missing,/Authorize Preview Scan Diagnostics/);
 const unavailable=await renderDiagnosticControl({enabled:false,authorized:false},null,props);assert.match(unavailable,/owner validation is blocked/);assert.match(unavailable,/checked/);
 assert.equal(await renderDiagnosticControl({enabled:false,authorized:false},null,{onValidationChange(){},validationRequired:false}),'');
});
