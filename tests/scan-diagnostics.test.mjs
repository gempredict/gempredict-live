import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {scan,vision} from './helpers/pikachuFixture.mjs';
import {authorizeDiagnosticOwner,diagnosticDeployment,diagnosticSession,readDiagnosticTicket,SESSION_COOKIE,TICKET_HEADER,SCAN_HEADER,MAX_JSON} from '../lib/scanDiagnosticsAuth.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary} from '../lib/financialSafety.mjs';
import {rememberScanDiagnostic,scanDiagnosticAccess} from '../lib/scanDiagnosticClient.mjs';
import {renderReports} from './helpers/renderReports.mjs';
const origin='https://gempredict-live-unit123.vercel.app';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:new URL(origin).host,VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'6dbbbd7dbf9312ba6655c82244d42b68fc11fb33',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
const request=(cookie='',patch={})=>({method:'POST',headers:{host:new URL(origin).host,origin,cookie,...patch}});
const cookie=(at=Date.now())=>authorizeDiagnosticOwner(request(),env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,at).split(';')[0];
function endpoint(req,environment=env){
 const source=fs.readFileSync('pages/api/scan-diagnostics.js','utf8').replace(/^import.*;$/gm,'').replace('export const config','const config').replace('export default function handler','function handler');
 const handler=vm.runInNewContext(source+'\nhandler',{diagnosticDeployment:r=>diagnosticDeployment(r,environment),diagnosticSession:r=>diagnosticSession(r,environment),authorizeDiagnosticOwner:(r,k)=>authorizeDiagnosticOwner(r,k,environment),readDiagnosticTicket:(r,t,s)=>readDiagnosticTicket(r,t,s,environment)});
 const res={headers:{},code:null,setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};handler(req,res);return res;
}
async function captured(patch={}){
 const c=cookie();const r=await scan({env,headers:request(c).headers,...patch});
 assert.equal(r.status,200);assert.ok(r.responseHeaders[TICKET_HEADER]);
 const id=r.responseHeaders[SCAN_HEADER],ticket=r.responseHeaders[TICKET_HEADER];
 const d=readDiagnosticTicket(request(c),ticket,id,env);assert.ok(d);
 return {r,d,ticket,id,c};
}
test('server owner authorization and authenticated Preview export through actual endpoint',async()=>{
 const auth=endpoint({...request(),body:{action:'authorize',key:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}});assert.equal(auth.code,200);
 assert.match(auth.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.doesNotMatch(JSON.stringify(auth.body),/abababab/);
 const {d,id,ticket,c}=await captured();const out=endpoint({...request(c),body:{action:'download',ticket,scanId:id}});
 assert.equal(out.code,200);assert.deepEqual(out.body,d);assert.match(out.headers['Content-Disposition'],/attachment/);assert.match(out.headers['Cache-Control'],/no-store/);
});
test('Production, missing deployment identity, wrong branch/project/origin and browser flags fail closed',()=>{
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL:'0'},{GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'false'},{VERCEL_GIT_COMMIT_SHA:''},{VERCEL_PROJECT_ID:'other'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_GIT_REPO_OWNER:'other'},{GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:''},{GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:''},{GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}]){
  const out=endpoint({...request(),body:{action:'authorize',key:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,enabled:true}}, {...env,...patch,NEXT_PUBLIC_DIAGNOSTICS_ENABLED:'true'});assert.equal(out.code,404);
 }
 assert.equal(endpoint({...request('',{origin:'https://evil.example'}),body:{action:'authorize',key:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}}).code,404);
 assert.equal(endpoint({...request(),body:{action:'authorize',key:'bad'}}).code,401);
 assert.equal(endpoint({...request(),body:{action:'download',ticket:'client diagnostics',scanId:'fake'}}).code,403);
});
test('malformed, expired, cross-scan, cross-session and cross-deployment exports are rejected',async()=>{
 const {ticket,id,c}=await captured();
 for(const bad of ['',ticket+'x',ticket.slice(0,-8),'a'.repeat(7000)])assert.equal(readDiagnosticTicket(request(c),bad,id,env),null);
 assert.equal(readDiagnosticTicket(request(c),ticket,'00000000-0000-4000-8000-000000000000',env),null);
 assert.equal(readDiagnosticTicket(request(cookie()),ticket,id,env),null);
 assert.equal(readDiagnosticTicket(request(c),ticket,id,env,Date.now()+301000),null);
 assert.equal(readDiagnosticTicket(request(c),ticket,id,{...env,VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)}),null);
 assert.equal(readDiagnosticTicket(request(c),ticket,id,{...env,GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ef'.repeat(32)}),null);
 assert.equal(diagnosticSession(request(cookie(Date.now()-901000)),env),null);
});
test('complete handler distinguishes missing observations from rejected evidence and normalized states',async()=>{
 const missing=await captured({vision:{...vision,visualObservations:undefined}});assert.equal(missing.d.model.structuredField,'missing');assert.equal(missing.d.model.totalRows,0);
 const rejected=await captured({vision:{...vision,visualObservations:[{attribute:'corners',code:'whitening',certainty:'confirmed',evidence:{side:'front'}}]}});
 assert.equal(rejected.d.model.structuredField,'array');assert.equal(rejected.d.model.totalRows,1);assert.equal(rejected.d.model.observations[0].localizationValid,false);
 assert.deepEqual(rejected.d.model.observations[0].reasons,['invalid_localization_cue_or_measurement']);assert.equal(rejected.d.finalPresentation.states.corners,'unassessable');
});
test('front-only and front/back diagnostics use validated images and retain accurate stage counts',async()=>{
 const observation={attribute:'surface',code:'scratches',certainty:'confirmed',evidence:{side:'back',region:[0.1,0.1,0.2,0.2],cue:'surface_line',confidence:0.95}};
 const both=await captured({vision:{...vision,visualObservations:[observation]}});
 const {preparedSha256,...imageMetadata}=both.d.images.front;assert.match(preparedSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(imageMetadata,{presence:'present',validation:'passed',processing:'validated_prepared_upload',width:30,height:40,format:'jpeg'});
 assert.equal(both.d.model.perSide.back,1);assert.equal(both.d.normalization.states.surface,'confirmed_visible_defect');
 const front=await captured({back:false,vision:{...vision,visualObservations:[observation]}});
 assert.equal(front.d.images.back.presence,'absent');assert.deepEqual(front.d.model.observations[0].reasons,['photo_not_provided']);assert.equal(front.d.normalization.states.surface,'unassessable');
});
test('catalog verified and financially withheld are separate, marketplace routing/protection are observable',async()=>{
 const {d}=await captured();assert.equal(d.identity.catalogVerified,true);assert.equal(d.identity.catalogReference.provider,'tcgdex');assert.equal(d.financial.status,'withheld');assert.equal(d.financial.monetaryEstimatesBlocked,true);assert.equal(d.financial.gradingRecommendationsBlocked,true);
 assert.equal(d.marketplace.routing,'validated');assert.equal(d.marketplace.attempted,true);assert.equal(d.marketplace.protection,'request_succeeded');
 const failed=await captured({previewStatus:403});assert.equal(failed.d.marketplace.protection,'rejected');assert.equal(failed.d.marketplace.unavailable,true);
});
test('allowlist excludes private data, arbitrary provider payloads, URLs and unrestricted notes',async()=>{
 const sentinels=['hidden@example.com','192.0.2.99','/tmp/private/image.jpg','RAW_PRIVATE_PAYLOAD','sk-private-provider','seller-private-identity','BASE64_IMAGE_PAYLOAD'];
 const {d,ticket}=await captured({vision:{...vision,identifiedSubject:'https://private.invalid',identityNotes:sentinels.join(' '),sellerId:sentinels[5],rawResponse:sentinels.join(' '),photoNotes:[{attribute:'surface',side:'front',text:'Surface glare '+sentinels.join(' ')+'.'}],imageBytes:sentinels[6],cookies:sentinels[0]}});
 const json=JSON.stringify(d);for(const secret of sentinels)assert.ok(!json.includes(secret),secret);
 assert.doesNotMatch(json,/https?:|itemWebUrl|itemId|authorization|apiKey|imageBytes|base64|filename|cookie/i);
 assert.ok(Buffer.byteLength(json)<=MAX_JSON);assert.ok(ticket.length<=6000);assert.equal(d.model.originalIdentity.identifiedSubject,null);
});
test('diagnostics stay outside response bodies, saved/copied reports and browser serialization',async()=>{
 const {r,id,ticket}=await captured();const report=reportFromResponse(r.payload);
 rememberScanDiagnostic(report,{headers:{get:k=>k.includes('Ticket')?ticket:id}});assert.equal(scanDiagnosticAccess(report).scanId,id);
 const saved=JSON.parse(JSON.stringify(report)),restored=protectFinancialReport(saved);
 assert.equal(scanDiagnosticAccess(saved),null);assert.equal(scanDiagnosticAccess(restored),null);
 for(const value of [JSON.stringify(r.payload),JSON.stringify(saved),protectedCopySummary(restored),renderReports(restored).lower]){
  assert.ok(!value.includes(ticket));assert.ok(!value.includes(id));assert.ok(!value.includes('expectedIdentityFields'));
 }
});
test('diagnostic observer is inert when disabled and does not change ordinary handler results',async()=>{
 const off=await scan();assert.equal(off.responseHeaders[TICKET_HEADER],undefined);
 const on=await captured();const stable=value=>JSON.parse(JSON.stringify(value,(k,v)=>k==='retrievedAt'?undefined:v));assert.deepEqual(stable(on.r.payload),stable(off.payload));assert.equal(on.r.metrics.valuation,0);
});
test('oversized model fields and row arrays are bounded without exporting arbitrary field names',async()=>{
 const {d,ticket}=await captured({vision:{...vision,identifiedSubject:'x'.repeat(1000),visualObservations:Array.from({length:100},()=>({attribute:'private-field-name',code:'private-code'})),photoNotes:Array.from({length:100},()=>({attribute:'surface',side:'front',text:'Surface glare private-content.'}))}});
 assert.equal(d.model.observations.length,32);assert.equal(d.model.rowsTruncated,true);assert.equal(d.model.originalIdentity.identifiedSubject,null);
 assert.equal(d.model.observations[0].code,'unknown');assert.deepEqual(d.model.observations[0].reasons,['unsupported_attribute_or_code']);
 assert.ok(ticket.length<=6000);assert.ok(Buffer.byteLength(JSON.stringify(d))<=MAX_JSON);assert.doesNotMatch(JSON.stringify(d),/private-field-name|private-code|private-content/);
});
test('upload validation failure exports no image contents or file diagnostics',async()=>{
 const c=cookie();const r=await scan({env,headers:request(c).headers,badBack:true});assert.equal(r.status,400);assert.equal(r.metrics.vision,0);
 const d=readDiagnosticTicket(request(c),r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);
 assert.ok(d);assert.equal(d.images.back.validation,'not_established');assert.equal(d.model,null);assert.equal(d.responseStatus,400);
});
test('client-supplied diagnostic bodies and public owner key cannot mint trusted export data',async()=>{
 const {ticket,id,c}=await captured();
 const fake=endpoint({...request(c),body:{action:'download',ticket:'forged',scanId:id,diagnostics:{scanId:id,financial:{status:'approved'}}}});assert.equal(fake.code,403);
 const good=endpoint({...request(c),body:{action:'download',ticket,scanId:id,diagnostics:{financial:{status:'approved'}}}});assert.equal(good.code,200);assert.equal(good.body.financial.status,'withheld');
 assert.equal(readDiagnosticTicket(request(c),ticket,id,{...env,GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}),null);
});
test('evidence downgrade and actual rendered display contract are represented without changing the result',async()=>{
 const {r,d}=await captured({vision:{...vision,visualObservations:[{attribute:'corners',code:'whitening',certainty:'confirmed',evidence:{side:'front',region:[0.1,0.1,0.2,0.2],cue:'localized_color_loss',confidence:0.95}}],imageLimitations:['glare']}});
 assert.equal(d.model.observations[0].downgraded,true);assert.deepEqual(d.model.observations[0].reasons,['global_photo_limitation']);assert.equal(d.finalPresentation.displayLabels.corners,'Possible defect');
 assert.match(renderReports(reportFromResponse(r.payload)).lower,/Possible defect/);
});
test('configured but unauthenticated and Production scans never receive diagnostic capabilities',async()=>{
 const unauth=await scan({env,headers:request('',{'x-diagnostics-enabled':'true'}).headers,fields:{cardType:'pokemon',diagnostics:true}});assert.equal(unauth.responseHeaders[TICKET_HEADER],undefined);
 const prod=await scan({env:{...env,VERCEL_ENV:'production'},headers:request(cookie()).headers});assert.equal(prod.responseHeaders[TICKET_HEADER],undefined);
});
test('actual diagnostic control hides download for denied/unauthorized states and restored reports',async()=>{
 const {renderDiagnosticControl}=await import('./helpers/renderReports.mjs');
 const {r,id,ticket}=await captured();const report=reportFromResponse(r.payload);rememberScanDiagnostic(report,{headers:{get:k=>k.includes('Ticket')?ticket:id}});
 assert.equal(await renderDiagnosticControl(null,report),'');assert.equal(await renderDiagnosticControl({enabled:true,authorized:false},report),'');
 assert.match(await renderDiagnosticControl({enabled:true,authorized:true},report),/Download Scan Diagnostics/);
 assert.equal(await renderDiagnosticControl({enabled:true,authorized:true},JSON.parse(JSON.stringify(report))),'');
});

import {diagnosticExpiry,EXPIRY_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
import {prepareDiagnosticExport} from '../lib/diagnosticExport.mjs';
import {controlledDiagnosticInteraction} from './helpers/renderReports.mjs';
const syntheticHandle=(expiresAt=100000+300000)=>({ticket:'synthetic-ticket',scanId:'11111111-1111-4111-8111-111111111111',controlled:true,expiresAt,attemptId:'22222222-2222-4222-8222-222222222222',preparedHashes:{front:'a'.repeat(64),back:'b'.repeat(64)}});
const syntheticExport=h=>({version:1,scanId:h.scanId,environment:'preview',stage:'full',responseStatus:200,conditionValidation:{attemptId:h.attemptId,preparedImagesMatched:true,marketplace:'not_requested'},images:{front:{preparedSha256:h.preparedHashes.front},back:{preparedSha256:h.preparedHashes.back}},model:{originalIdentity:{identifiedSubject:'Fraxure'},observations:[]},canonicalIdentity:{subject:'Fraxure'}});
test('server response exposes the actual bounded diagnostic expiry without extending session or ticket lifetime',async()=>{
 assert.equal(diagnosticExpiry({exp:1500},1000),1500);assert.equal(diagnosticExpiry({exp:9999999},1000),301000);
 const at=Date.now(),{r,c,ticket,id}=await captured();const expires=Number(r.responseHeaders[EXPIRY_HEADER]);assert.ok(expires>at&&expires<=Date.now()+300000);assert.ok(expires<=diagnosticSession(request(c),env).exp);assert.equal(readDiagnosticTicket(request(c),ticket,id,env,expires),null);
});
test('controlled response metadata remains volatile, including an explicit missing-handle state',()=>{
 const report={},h=syntheticHandle();rememberScanDiagnostic(report,{headers:{get:k=>({'X-GemPredict-Diagnostic-Ticket':h.ticket,'X-GemPredict-Diagnostic-Scan':h.scanId,'X-GemPredict-Diagnostic-Expires':String(h.expiresAt)})[k]}},{controlled:true,manifest:{attemptId:h.attemptId,files:{front:{sha256:h.preparedHashes.front},back:{sha256:h.preparedHashes.back}}}});
 assert.equal(scanDiagnosticAccess(report).expiresAt,h.expiresAt);assert.equal(scanDiagnosticAccess(report).controlled,true);assert.equal(JSON.stringify(report),'{}');assert.equal(scanDiagnosticAccess(JSON.parse(JSON.stringify(report))),null);
 const missing={};rememberScanDiagnostic(missing,{headers:{get:()=>null}},{controlled:true});assert.equal(scanDiagnosticAccess(missing).controlled,true);assert.equal(scanDiagnosticAccess(missing).ticket,null);
});
test('explicit export fetch is same-origin, validates exact scan/pair and preserves downloaded JSON bytes',async()=>{
 const h=syntheticHandle(),raw=JSON.stringify(syntheticExport(h),null,2)+'\n';let calls=0;
 const blob=await prepareDiagnosticExport(h,{now:()=>100001,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'/api/scan-diagnostics');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.deepEqual(JSON.parse(options.body),{action:'download',ticket:h.ticket,scanId:h.scanId});return new Response(raw,{status:200});}});
 assert.equal(await blob.text(),raw);assert.equal(calls,1);
 for(const patch of [{scanId:'33333333-3333-4333-8333-333333333333'},{images:{front:{preparedSha256:'c'.repeat(64)}}},{conditionValidation:{attemptId:'other'}}])await assert.rejects(prepareDiagnosticExport(h,{now:()=>100001,fetchImpl:async()=>new Response(JSON.stringify({...syntheticExport(h),...patch}))}),/does not match/);
 let forbidden=0;await assert.rejects(prepareDiagnosticExport(h,{now:()=>h.expiresAt,fetchImpl:async()=>{forbidden++;}}),/expired/);assert.equal(forbidden,0);
 await assert.rejects(prepareDiagnosticExport(h,{now:()=>100001,fetchImpl:async()=>new Response('{}',{status:403})}),/cannot restore/);
 await assert.rejects(prepareDiagnosticExport(h,{now:()=>100001,fetchImpl:async()=>new Response('{}',{status:500})}),/request failed/);
});
async function captureUi({expires=400000,ownerExpires=900000,prepare}={}){
 let clock=100000,fetches=0,downloads=0;const events={},timers=[];class Clock extends Date{static now(){return clock;}}
 const target=prefix=>({addEventListener(n,f){events[prefix+n]=f;},removeEventListener(n){delete events[prefix+n];}});
 const h=controlledDiagnosticInteraction(syntheticHandle(expires),{Date:Clock,window:target('window.'),document:target('document.'),AbortController,setInterval(fn){timers.push(fn);return fn;},clearInterval(){},setTimeout(fn){timers.push(fn);return fn;},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({enabled:true,authorized:true,expiresAt:ownerExpires})}),prepareDiagnosticExport:async(...args)=>{fetches++;return prepare?prepare(...args):new Blob(['synthetic export']);},initiateDiagnosticDownload(){downloads++;}});
 let tree;function render(){tree=h.render();return tree;}const nodes=p=>h.nodes(tree,p);const button=()=>nodes(n=>n.type==='button'&&n.props.children==='Download Scan Diagnostics')[0];function text(){let s='';const walk=n=>{if(typeof n==='string'||typeof n==='number')s+=n+' ';else if(Array.isArray(n))n.forEach(walk);else if(n?.props)walk(n.props.children);};walk(tree);return s;}
 render();await new Promise(setImmediate);render();return {h,render,button,text,nodes,events,timers,advance(ms){clock+=ms;},counts:()=>({fetches,downloads}),async settle(){await new Promise(setImmediate);render();}};
}
test('controlled capture UI requires a fresh second tap, locks repeat taps and preserves controls on Files return',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;});const u=await captureUi({prepare:()=>pending});assert.match(u.text(),/Controlled Scan Complete/);assert.match(u.text(),/300\s+seconds remaining/);
 u.button().props.onClick();u.button().props.onClick();u.render();assert.equal(u.button().props.disabled,true);assert.equal(u.counts().fetches,1);resolve(new Blob(['synthetic']));await u.settle();assert.match(u.text(),/second tap/);assert.equal(u.counts().downloads,0);
 u.button().props.onClick();u.button().props.onClick();u.render();assert.equal(u.counts().downloads,1);assert.match(u.text(),/saving is not confirmed/);
 u.events['window.focus']();u.events['document.visibilitychange']();u.render();assert.match(u.text(),/Download initiated/);u.timers.at(-1)();u.render();u.button().props.onClick();u.render();assert.equal(u.counts().downloads,2);assert.equal(u.counts().fetches,1);
 u.h.unmount();
});
test('controlled capture distinguishes expiry, owner expiry and persistent export failure without resubmitting a scan',async()=>{
 const expired=await captureUi();expired.button().props.onClick();await expired.settle();expired.advance(300001);expired.events['window.focus']();expired.render();expired.render();assert.match(expired.text(),/Expired — the server export window has ended/);assert.equal(expired.button().props.disabled,true);assert.equal(expired.counts().downloads,0);expired.h.unmount();
 const owner=await captureUi({ownerExpires:100100});owner.advance(101);owner.events['document.visibilitychange']();owner.render();assert.match(owner.text(),/Owner authorization expired/);assert.equal(owner.button().props.disabled,true);owner.h.unmount();
 const bad=await captureUi({prepare:async()=>{throw Error('Synthetic export request failed; retry export only.');}});bad.button().props.onClick();await bad.settle();bad.render();bad.events['window.focus']();bad.render();assert.match(bad.text(),/Synthetic export request failed/);assert.equal(bad.counts().downloads,0);assert.equal(bad.button().props.disabled,false);bad.h.unmount();
});
test('actual App places controlled diagnostic capture above its report without attaching evidence to saved reports',async()=>{
 const source=fs.readFileSync('src/App.jsx','utf8');const reportBlock=source.slice(source.indexOf('{results.map(function(saved'));
 assert.ok(reportBlock.indexOf('<ScanDiagnostics report={saved} prominent scrollToCapture={i===0} />')<reportBlock.indexOf('<ResultCard'));
 const {renderDiagnosticControl}=await import('./helpers/renderReports.mjs');const normal={};assert.equal(await renderDiagnosticControl({enabled:true,authorized:true},normal),'');
 // Existing actual App callback and report privacy/financial tests also run in the complete suite.
});
