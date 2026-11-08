// Synthetic JPEGs + actual multipart/SDK mocks. Never a live provider request.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {webcrypto,createHash} from 'node:crypto';
import {createPreparedValidation,preparedDimensions} from '../lib/preparedValidation.mjs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports,appInteraction} from './helpers/renderReports.mjs';
import {UploadError} from '../lib/mobileImages.mjs';
const revision='70a859b92790b8cf1d79cf6baa44f6d8c11de7f0';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:revision,VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
function auth(){const headers={host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL};headers.cookie=authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];return headers;}
async function setup(extra={}){
 const jpeg=async color=>sharp({create:{width:30,height:40,channels:3,background:color}}).jpeg().toBuffer();
 const front=new File([await jpeg('white')],'normalized.jpg',{type:'image/jpeg'}),back=new File([await jpeg('gray')],'normalized.jpg',{type:'image/jpeg'});
 let current={front,back,busy:false,version:'1:1'};const downloads=[];
 const control=createPreparedValidation({getFiles:()=>current,revision,cryptoImpl:webcrypto,dimensions:async file=>{const m=await sharp(Buffer.from(await file.arrayBuffer())).metadata();return {width:m.width,height:m.height};},download:async(blob,name)=>downloads.push({blob,name}),...extra});
 const a=await control.freeze();
 return {front,back,a,control,downloads,setCurrent:v=>{current={...current,...v};}};
}
async function verified(extra){const s=await setup(extra);for(const kind of ['front','back','manifest']){await s.control.export(s.a,kind);const d=s.downloads.at(-1);await s.control.verifySaved(s.a,kind,new File([await d.blob.arrayBuffer()],d.name,{type:d.blob.type}));}return s;}
async function controlled(s,patch={}){return runScan({env,headers:auth(),frontBytes:Buffer.from(await s.front.arrayBuffer()),backBytes:Buffer.from(await s.back.arrayBuffer()),fields:{mode:'condition-validation',validationManifest:JSON.stringify(s.a.manifest),cardType:'pokemon'},...patch});}
const noMarket=r=>{assert.equal(r.metrics.neutralEbay,0);assert.equal(r.metrics.internal.length,0);assert.equal(r.metrics.upstream,0);assert.equal(r.metrics.valuation,0);};
test('frozen exported JPEGs and local manifest hashes exactly match submitted multipart buffers and SDK bytes',async()=>{
 const s=await verified();const frozen=s.control.consume(s.a);assert.equal(frozen.front,s.front);assert.equal(frozen.back,s.back);assert.throws(()=>s.control.consume(s.a));
 const form=new FormData();form.append('image',frozen.front);form.append('backImage',frozen.back);assert.equal(form.get('image'),s.front);assert.equal(form.get('backImage'),s.back);
 for(const side of ['front','back']){const f=s.a.manifest.files[side],d=s.downloads.find(x=>x.name.endsWith('prepared-'+side+'.jpg'));assert.equal(f.sha256,createHash('sha256').update(Buffer.from(await d.blob.arrayBuffer())).digest('hex'));assert.equal(f.side,side);assert.equal(f.width,30);assert.equal(f.height,40);assert.equal(f.mime,'image/jpeg');}
 const r=await controlled(s,{actualSdkFetch:async()=>new Response(JSON.stringify({type:'message',role:'assistant',id:'msg_mock',model:'claude-sonnet-4-6',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...confirmed,visualObservations:[]})}],usage:{input_tokens:100,output_tokens:100}}),{status:200,headers:{'content-type':'application/json'}})});
 assert.equal(r.status,200);const requestImages=r.metrics.sdkRequest.messages[0].content.filter(v=>v.type==='image');
 for(const [i,side] of ['front','back'].entries())assert.equal(createHash('sha256').update(Buffer.from(requestImages[i].source.data,'base64')).digest('hex'),s.a.manifest.files[side].sha256);
 noMarket(r);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.visionMaxTokens,4800);
});
test('download and hashing failures, absent saved files and incorrect side verification block consumption',async()=>{
 const s=await setup();assert.throws(()=>s.control.consume(s.a));await assert.rejects(s.control.verifySaved(s.a,'front',s.back));assert.throws(()=>s.control.consume(s.a));
 const broken=await setup({download:async()=>{throw Error('local download failed');}});await assert.rejects(broken.control.export(broken.a,'front'));assert.throws(()=>broken.control.consume(broken.a));
 await assert.rejects(setup({cryptoImpl:{...webcrypto,subtle:{digest:async()=>{throw Error('hash failed');}}}}));
 const wrong=await setup();await wrong.control.export(wrong.a,'front');await assert.rejects(wrong.control.verifySaved(wrong.a,'front',wrong.back));assert.throws(()=>wrong.control.consume(wrong.a));
});
test('replacement, selection epoch change and asynchronous preparation races invalidate frozen bytes',async()=>{
 for(const change of [{front:new File(['x'],'replacement.jpg',{type:'image/jpeg'})},{version:'2:1'},{busy:true}]){const s=await verified();s.setCurrent(change);assert.throws(()=>s.control.consume(s.a));}
 const s=await verified();const pending=s.control.verifySaved(s.a,'front',s.front);s.setCurrent({version:'2:1'});await assert.rejects(pending);assert.throws(()=>s.control.consume(s.a));
});
test('server rejects unowned, expired deployment policy, Production and tampered manifests before paid/eBay boundaries',async()=>{
 const s=await verified();const expired=auth();expired.cookie=authorizeDiagnosticOwner({method:'POST',headers:expired},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,Date.now()-16*60*1000).split(';')[0];
 for(const patch of [{headers:{}},{headers:expired},{headers:{...auth(),origin:'https://other.invalid'}},{env:{...env,VERCEL_ENV:'production'}},{env:{...env,VERCEL_GIT_COMMIT_REF:'main'}},{env:{...env,VERCEL_GIT_COMMIT_SHA:'f'.repeat(40)}},{env:{...env,VERCEL_PROJECT_ID:'wrong'}}]){const r=await controlled(s,patch);assert.equal(r.status,403);assert.equal(r.metrics.vision,0);noMarket(r);}
 const manifest=structuredClone(s.a.manifest);manifest.files.front.sha256='0'.repeat(64);const bad=await controlled(s,{fields:{cardType:'sports',mode:'condition-validation',validationManifest:JSON.stringify(manifest)}});assert.equal(bad.status,403);assert.equal(bad.metrics.vision,0);noMarket(bad);
 const none=await controlled(s,{back:false});assert.equal(none.status,403);assert.equal(none.metrics.vision,0);
});
test('both category controlled handlers suppress EVERY marketplace boundary even with complete identity and active credentials',async()=>{
 const s=await verified();for(const cardType of ['pokemon','sports']){
  const headers=auth();const r=await controlled(s,{headers,fields:{mode:'condition-validation',validationManifest:JSON.stringify(s.a.manifest),cardType},vision:{...confirmed,visualObservations:[]}});assert.equal(r.status,200);noMarket(r);assert.equal(r.metrics.vision,1);assert.equal(r.payload.conditionValidation.preparedImagesMatched,true);
  const d=readDiagnosticTicket({method:'POST',headers},r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.equal(d.conditionValidation.attemptId,s.a.manifest.attemptId);assert.equal(d.marketplace.requests,0);assert.equal(d.images.front.preparedSha256,s.a.manifest.files.front.sha256);assert.equal(d.images.back.preparedSha256,s.a.manifest.files.back.sha256);
  const report=protectFinancialReport(JSON.parse(JSON.stringify(reportFromResponse(r.payload))));for(const f of FINANCIAL_FIELDS)assert.equal(report[f],null);assert.equal(report.financialDecision.allowed,false);assert.doesNotMatch(renderReports(report).lower,/PSA 10|10 \/ 10|Lower Submission Risk/);assert.match(protectedCopySummary(report),/withheld/);
 }
 const ordinary=await runScan({env,headers:auth(),vision:confirmed});assert.ok(ordinary.metrics.internal.length>0);assert.ok(ordinary.metrics.upstream>0);assert.equal(ordinary.payload.conditionValidation,undefined);
 const ordinaryPokemon=await runScan({env,headers:auth(),fields:{cardType:'pokemon'},vision:{...confirmed,identifiedCardNumber:'1/10'}});assert.ok(ordinaryPokemon.metrics.neutralEbay>0);
});
test('actual App controlled callback submits exact frozen Files once without invoking mobile preparation again',async()=>{
 const s=await verified();let calls=0,prepares=0;const h=appInteraction({FormData,URL,UploadError,normalizeMobileImage:async f=>{prepares++;return f;},assertUploadBudget:async()=>{},requestPrediction:async options=>{calls++;assert.equal(options.body.get('mode'),'condition-validation');assert.equal(options.body.get('image'),s.front);assert.equal(options.body.get('backImage'),s.back);assert.equal(options.body.get('validationManifest'),JSON.stringify(s.a.manifest));return {response:{ok:true,status:200,headers:{get:()=>null}},data:{success:true,imageAnalysis:{},prediction:{cardTitle:'Synthetic'}}};},rememberScanDiagnostic(){},predictionFailureResponse:()=>null});
 let tree=h.render();const inputs=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file');await inputs[0].props.onChange({target:{files:[s.front]}});await inputs[1].props.onChange({target:{files:[s.back]}});await new Promise(setImmediate);tree=h.render();const panel=h.nodes(tree,n=>n.props?.getSelectionEpoch&&n.props?.onSubmit)[0];const frozen=s.control.consume(s.a);await panel.props.onSubmit(frozen);assert.equal(calls,1);assert.equal(prepares,2);
});
test('actual owner export UI is hidden without capability and requires reselected saved files before submit',async()=>{
 const {controlledValidationInteraction}=await import('./helpers/renderReports.mjs');const s=await setup();let submitted=0;const downloads=[];
 const props={front:s.front,back:s.back,busy:false,getSelectionEpoch:()=> '1:1',onSubmit:async p=>{submitted++;assert.equal(p.front,s.front);assert.equal(p.back,s.back);}};
 const bindings={fetch:async()=>({ok:true,json:async()=>({conditionValidationAvailable:true,authorized:true,revision,expiresAt:Date.now()+60000})}),createPreparedValidation:options=>createPreparedValidation({...options,cryptoImpl:webcrypto,dimensions:async()=>({width:30,height:40}),download:async(blob,name)=>downloads.push({blob,name})})};
 const h=controlledValidationInteraction(props,bindings);assert.equal(h.render(),null);await new Promise(setImmediate);let tree=h.render();const button=(label)=>h.nodes(tree,n=>n.type==='button'&&(Array.isArray(n.props.children)?n.props.children.join(''):n.props.children)===label)[0];
 await button('Freeze prepared front and back').props.onClick();tree=h.render();assert.equal(button('Run controlled Full Analysis once').props.disabled,true);
 for(const [i,kind] of ['front','back','manifest'].entries()){
  await button(kind==='manifest'?'Download manifest':`Download prepared ${kind} JPEG`).props.onClick();tree=h.render();const input=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file')[i];const d=downloads.at(-1);await input.props.onChange({target:{files:[new File([await d.blob.arrayBuffer()],d.name,{type:d.blob.type})],value:'saved'}});await new Promise(setImmediate);tree=h.render();
 }
 assert.equal(button('Run controlled Full Analysis once').props.disabled,false);await button('Run controlled Full Analysis once').props.onClick();tree=h.render();assert.equal(submitted,1);assert.equal(button('Run controlled Full Analysis once'),undefined);
 const denied=controlledValidationInteraction(props,{...bindings,fetch:async()=>({ok:false})});assert.equal(denied.render(),null);await new Promise(setImmediate);assert.equal(denied.render(),null);
});
test('asynchronous freeze replacement and dimension failures remain fail-closed',async()=>{
 let release;const gate=new Promise(r=>{release=r;});const s=await setup();
 const c=createPreparedValidation({revision,cryptoImpl:webcrypto,getFiles:()=>({front:s.front,back:s.back,busy:false,version:'1:1'}),dimensions:async()=>{await gate;return {width:30,height:40};},download(){}});
 const p=c.freeze();c.invalidate();release();await assert.rejects(p);
 await assert.rejects(setup({dimensions:async()=>{throw Error('decode failed');}}));
});

test('prepared dimension inspection has a read-only image fallback without JPEG re-encoding',async()=>{
 let revoked=0,decoded=0;
 class FakeImage{async decode(){decoded++;}naturalWidth=30;naturalHeight=40;}
 const d=await preparedDimensions(new File(['synthetic'],'test.jpg'),{bitmap:undefined,ImageImpl:FakeImage,url:{createObjectURL(){return 'blob:local-only';},revokeObjectURL(){revoked++;}}});
 assert.deepEqual(d,{width:30,height:40});assert.equal(decoded,1);assert.equal(revoked,1);
});
