import test from 'node:test';
import assert from 'node:assert/strict';
import {scan} from './helpers/pikachuFixture.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {requestPrediction,predictionFailureResponse} from '../lib/predictionTransport.mjs';
import {scanFailure} from '../lib/scanFailures.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
import {rememberScanDiagnostic,scanDiagnosticAccess} from '../lib/scanDiagnosticClient.mjs';
import {renderReports} from './helpers/renderReports.mjs';
import {reportFromResponse} from '../lib/financialSafety.mjs';
const text=(value,stop='end_turn')=>({stop_reason:stop,usage:{output_tokens:2400},content:[{type:'text',text:value}]});
test('successful front/back upload then truncated provider output has a specific classification and no downstream valuation',async()=>{
 const r=await scan({visionResponse:text('{"identifiedSubject":"Pikachu ex",','max_tokens')});
 assert.equal(r.status,502);assert.equal(r.metrics.images,2);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.catalog,0);assert.equal(r.metrics.internal.length,0);
 assert.equal(r.payload.code,'ANALYSIS_RESPONSE_INCOMPLETE');assert.equal(r.payload.failureCategory,'analysis_provider');assert.match(r.payload.error,/output limit/);assert.doesNotMatch(r.payload.error,/clearer|bad photo|API key/i);
});
test('provider authentication, rate limit, timeout and request errors are distinct from Preview sign-in and upload errors',async()=>{
 for(const [error,code] of [[{status:401},'ANALYSIS_PROVIDER_AUTH_FAILED'],[{status:429},'ANALYSIS_PROVIDER_RATE_LIMITED'],[{name:'APIConnectionTimeoutError'},'ANALYSIS_PROVIDER_TIMEOUT'],[{status:500},'ANALYSIS_PROVIDER_FAILED']]){
  const r=await scan({visionError:error});assert.equal(r.metrics.images,2);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.code,code);assert.equal(r.payload.failureCategory,'analysis_provider');assert.notEqual(r.status,401);assert.notEqual(r.status,429);assert.doesNotMatch(JSON.stringify(r.payload),/private provider exception/);
 }
});
test('missing provider configuration, empty text, invalid JSON and failed normalization do not become upload errors',async()=>{
 for(const [patch,code] of [[{env:{CLAUDE_API_KEY:''}},'ANALYSIS_PROVIDER_UNAVAILABLE'],[{visionResponse:text('')},'ANALYSIS_EMPTY_RESPONSE'],[{visionResponse:text('not JSON')},'ANALYSIS_RESPONSE_INVALID'],[{normalizationError:true},'ANALYSIS_NORMALIZATION_FAILED']]){
  const r=await scan(patch);assert.equal(r.payload.code,code);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.catalog,0);assert.doesNotMatch(r.payload.error,/clearer/);
 }
});
test('validation, verification runtime and report generation failures have separate safe classifications',async()=>{
 const upload=await scan({badBack:true});assert.equal(upload.status,400);assert.equal(upload.payload.code,'UPLOAD_PROCESSING_FAILED');assert.equal(upload.metrics.vision,0);
 const verify=await scan({verificationError:true});assert.equal(verify.payload.code,'VERIFICATION_RUNTIME_FAILED');assert.equal(verify.payload.failureCategory,'verification_runtime');assert.equal(verify.metrics.vision,1);
 const report=await scan({reportError:true});assert.equal(report.payload.code,'UNEXPECTED_SCAN_ERROR');assert.equal(report.payload.failureCategory,'internal');assert.doesNotMatch(JSON.stringify(report.payload),/private report runtime/);
});
test('marketplace or catalog unavailability preserves condition reports and communicates unresolved verification without impersonating vision failure',async()=>{
 const market=await scan({previewStatus:403});assert.equal(market.status,200);assert.equal(market.payload.hasImageAnalysis,true);assert.equal(market.payload.financialDecision.allowed,false);assert.ok(market.payload.scanNotices.some(n=>n.code==='MARKETPLACE_UNAVAILABLE'));assert.match(renderReports(reportFromResponse(market.payload)).upper,/Marketplace discovery is unavailable/);
 const catalog=await scan({catalogFetch:async()=>{throw Error('offline');}});assert.equal(catalog.status,200);assert.ok(catalog.payload.scanNotices.some(n=>n.code==='VERIFICATION_UNRESOLVED'));assert.equal(catalog.payload.financialDecision.allowed,false);
});
test('diagnostic authorization/configuration faults cannot stop a valid scan',async()=>{
 const r=await scan({diagnosticError:true});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.responseHeaders[TICKET_HEADER],undefined);
});
test('transport preserves a private failure response capability and safe public code without serializing headers or provider errors',async()=>{
 const failure=scanFailure('ANALYSIS_RESPONSE_INCOMPLETE');const response={status:failure.status,ok:false,type:'basic',headers:{get:k=>k==='content-type'?'application/json':'private-ticket'},json:async()=>({...failure.payload,error:'private vendor error secret'})};
 let caught;try{await requestPrediction({},async()=>response);}catch(e){caught=e;}
 assert.equal(caught.code,'analysis_provider');assert.equal(caught.scanCode,'ANALYSIS_RESPONSE_INCOMPLETE');assert.equal(predictionFailureResponse(caught),response);assert.doesNotMatch(caught.message,/private vendor/);assert.doesNotMatch(JSON.stringify(caught),/private-ticket|headers/);
 const opaque={};rememberScanDiagnostic(opaque,{headers:{get:k=>k.includes('Ticket')?'private-ticket':'00000000-0000-4000-8000-000000000000'}});assert.ok(scanDiagnosticAccess(opaque));assert.equal(JSON.stringify(opaque),'{}');
});
test('authorized failed scan exports a safe breadcrumb through the same transport error path before any final report',async()=>{
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'933008b002673a2813c19653abdb3882f6c26d4e',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};const cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];req.headers.cookie=cookie;
 const r=await runScan({env,headers:req.headers,visionResponse:text('{','max_tokens')});assert.equal(r.status,502);
 const response={status:r.status,ok:false,type:'basic',headers:{get:k=>k==='content-type'?'application/json':r.responseHeaders[Object.keys(r.responseHeaders).find(h=>h.toLowerCase()===k.toLowerCase())]},json:async()=>r.payload};
 let error;try{await requestPrediction({},async()=>response);}catch(e){error=e;}
 const handle={};rememberScanDiagnostic(handle,predictionFailureResponse(error));const capability=scanDiagnosticAccess(handle);assert.ok(capability);
 const d=readDiagnosticTicket(req,capability.ticket,capability.scanId,env);assert.equal(d.failureCode,'ANALYSIS_RESPONSE_INCOMPLETE');assert.equal(d.responseStatus,502);assert.equal(d.images.front.validation,'passed');assert.equal(d.images.back.validation,'passed');assert.equal(d.visionStatus,'output_truncated');assert.equal(d.marketplace.attempted,false);
});
