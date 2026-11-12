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
 const {category='pokemon',...controllerOptions}=extra;
 const jpeg=async color=>sharp({create:{width:30,height:40,channels:3,background:color}}).jpeg().toBuffer();
 const front=new File([await jpeg('white')],'normalized.jpg',{type:'image/jpeg'}),back=new File([await jpeg('gray')],'normalized.jpg',{type:'image/jpeg'});
 let current={front,back,busy:false,version:'1:1',category,categorySelected:true};const downloads=[];
 const control=createPreparedValidation({getFiles:()=>current,revision,cryptoImpl:webcrypto,dimensions:async file=>{const m=await sharp(Buffer.from(await file.arrayBuffer())).metadata();return {width:m.width,height:m.height};},download:async(blob,name)=>downloads.push({blob,name}),...controllerOptions});
 const a=await control.freeze();
 return {front,back,a,control,downloads,setCurrent:v=>{current={...current,...v};}};
}
async function verified(extra){const s=await setup(extra);for(const kind of ['front','back','manifest']){await s.control.export(s.a,kind);const d=s.downloads.at(-1);await s.control.verifySaved(s.a,kind,new File([await d.blob.arrayBuffer()],d.name,{type:d.blob.type}));}return s;}
async function controlled(s,patch={}){const fields={mode:'condition-validation',validationManifest:JSON.stringify(s.a.manifest),cardType:s.a.category,validationCategorySelected:s.a.category,validationCategoryConfirmed:s.a.category,validationCategoryAttempt:s.a.manifest.attemptId};return runScan({env,headers:auth(),frontBytes:Buffer.from(await s.front.arrayBuffer()),backBytes:Buffer.from(await s.back.arrayBuffer()),...patch,fields:{...fields,...patch.fields}});}
const noMarket=r=>{assert.equal(r.metrics.neutralEbay,0);assert.equal(r.metrics.internal.length,0);assert.equal(r.metrics.upstream,0);assert.equal(r.metrics.valuation,0);};
test('frozen exported JPEGs and local manifest hashes exactly match submitted multipart buffers and SDK bytes',async()=>{
 const s=await verified();const frozen=s.control.consume(s.a,s.a.category);assert.equal(frozen.front,s.front);assert.equal(frozen.back,s.back);assert.throws(()=>s.control.consume(s.a,s.a.category));
 const form=new FormData();form.append('image',frozen.front);form.append('backImage',frozen.back);assert.equal(form.get('image'),s.front);assert.equal(form.get('backImage'),s.back);
 for(const side of ['front','back']){const f=s.a.manifest.files[side],d=s.downloads.find(x=>x.name.endsWith('prepared-'+side+'.jpg'));assert.equal(f.sha256,createHash('sha256').update(Buffer.from(await d.blob.arrayBuffer())).digest('hex'));assert.equal(f.side,side);assert.equal(f.width,30);assert.equal(f.height,40);assert.equal(f.mime,'image/jpeg');}
 const r=await controlled(s,{actualSdkFetch:async()=>new Response(JSON.stringify({type:'message',role:'assistant',id:'msg_mock',model:'claude-sonnet-4-6',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...confirmed,visualObservations:[]})}],usage:{input_tokens:100,output_tokens:100}}),{status:200,headers:{'content-type':'application/json'}})});
 assert.equal(r.status,200);const requestImages=r.metrics.sdkRequest.messages[0].content.filter(v=>v.type==='image');
 for(const [i,side] of ['front','back'].entries())assert.equal(createHash('sha256').update(Buffer.from(requestImages[i].source.data,'base64')).digest('hex'),s.a.manifest.files[side].sha256);
 noMarket(r);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.visionMaxTokens,4800);
});
test('download and hashing failures, absent saved files and incorrect side verification block consumption',async()=>{
 const s=await setup();assert.throws(()=>s.control.consume(s.a,s.a.category));await assert.rejects(s.control.verifySaved(s.a,'front',s.back));assert.throws(()=>s.control.consume(s.a,s.a.category));
 const broken=await setup({download:async()=>{throw Error('local download failed');}});await assert.rejects(broken.control.export(broken.a,'front'));assert.throws(()=>broken.control.consume(broken.a,broken.a.category));
 await assert.rejects(setup({cryptoImpl:{...webcrypto,subtle:{digest:async()=>{throw Error('hash failed');}}}}));
 const wrong=await setup();await wrong.control.export(wrong.a,'front');await assert.rejects(wrong.control.verifySaved(wrong.a,'front',wrong.back));assert.throws(()=>wrong.control.consume(wrong.a,wrong.a.category));
});
test('replacement, selection epoch change and asynchronous preparation races invalidate frozen bytes',async()=>{
 for(const change of [{front:new File(['x'],'replacement.jpg',{type:'image/jpeg'})},{version:'2:1'},{busy:true}]){const s=await verified();s.setCurrent(change);assert.throws(()=>s.control.consume(s.a,s.a.category));}
 const s=await verified();const pending=s.control.verifySaved(s.a,'front',s.front);s.setCurrent({version:'2:1'});await assert.rejects(pending);assert.throws(()=>s.control.consume(s.a,s.a.category));
});
test('server rejects unowned, expired deployment policy, Production and tampered manifests before paid/eBay boundaries',async()=>{
 const s=await verified();const expired=auth();expired.cookie=authorizeDiagnosticOwner({method:'POST',headers:expired},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,Date.now()-16*60*1000).split(';')[0];
 for(const patch of [{headers:{}},{headers:expired},{headers:{...auth(),origin:'https://other.invalid'}},{env:{...env,VERCEL_ENV:'production'}},{env:{...env,VERCEL_GIT_COMMIT_REF:'main'}},{env:{...env,VERCEL_GIT_COMMIT_SHA:'f'.repeat(40)}},{env:{...env,VERCEL_PROJECT_ID:'wrong'}}]){const r=await controlled(s,patch);assert.equal(r.status,403);assert.equal(r.metrics.vision,0);noMarket(r);}
 const manifest=structuredClone(s.a.manifest);manifest.files.front.sha256='0'.repeat(64);const bad=await controlled(s,{fields:{cardType:'sports',mode:'condition-validation',validationManifest:JSON.stringify(manifest)}});assert.equal(bad.status,403);assert.equal(bad.metrics.vision,0);noMarket(bad);
 const none=await controlled(s,{back:false});assert.equal(none.status,403);assert.equal(none.metrics.vision,0);
});
test('both category controlled handlers suppress EVERY marketplace boundary even with complete identity and active credentials',async()=>{
 for(const cardType of ['pokemon','sports']){const s=await verified({category:cardType});
  const headers=auth();const r=await controlled(s,{headers,fields:{mode:'condition-validation',validationManifest:JSON.stringify(s.a.manifest),cardType},vision:{...confirmed,visualObservations:[]}});assert.equal(r.status,200);noMarket(r);assert.equal(r.metrics.vision,1);assert.equal(r.payload.conditionValidation.preparedImagesMatched,true);
  const d=readDiagnosticTicket({method:'POST',headers},r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.equal(d.conditionValidation.attemptId,s.a.manifest.attemptId);assert.equal(d.marketplace.requests,0);assert.equal(d.images.front.preparedSha256,s.a.manifest.files.front.sha256);assert.equal(d.images.back.preparedSha256,s.a.manifest.files.back.sha256);
  const report=protectFinancialReport(JSON.parse(JSON.stringify(reportFromResponse(r.payload))));for(const f of FINANCIAL_FIELDS)assert.equal(report[f],null);assert.equal(report.financialDecision.allowed,false);assert.doesNotMatch(renderReports(report).lower,/PSA 10|10 \/ 10|Lower Submission Risk/);assert.match(protectedCopySummary(report),/withheld/);
 }
 const ordinary=await runScan({env,headers:auth(),vision:confirmed});assert.ok(ordinary.metrics.internal.length>0);assert.ok(ordinary.metrics.upstream>0);assert.equal(ordinary.payload.conditionValidation,undefined);
 const ordinaryPokemon=await runScan({env,headers:auth(),fields:{cardType:'pokemon'},vision:{...confirmed,identifiedCardNumber:'1/10'}});assert.ok(ordinaryPokemon.metrics.neutralEbay>0);
});
test('actual App controlled callback submits exact frozen Files once without invoking mobile preparation again',async()=>{
 const s=await verified();let calls=0,prepares=0;const h=appInteraction({FormData,URL,UploadError,normalizeMobileImage:async f=>{prepares++;return f;},assertUploadBudget:async()=>{},requestPrediction:async options=>{calls++;assert.equal(options.body.get('mode'),'condition-validation');assert.equal(options.body.get('image'),s.front);assert.equal(options.body.get('backImage'),s.back);assert.equal(options.body.get('validationManifest'),JSON.stringify(s.a.manifest));return {response:{ok:true,status:200,headers:{get:()=>null}},data:{success:true,imageAnalysis:{},prediction:{cardTitle:'Synthetic'}}};},rememberScanDiagnostic(report,response,options){assert.equal(options.controlled,true);assert.equal(options.manifest.attemptId,s.a.manifest.attemptId);assert.equal(options.manifest.files.front.sha256,s.a.manifest.files.front.sha256);},predictionFailureResponse:()=>null});
 let tree=h.render();const inputs=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file');await inputs[0].props.onChange({target:{files:[s.front]}});await inputs[1].props.onChange({target:{files:[s.back]}});await new Promise(setImmediate);tree=h.render();const panel=h.nodes(tree,n=>n.props?.getSelectionEpoch&&n.props?.onSubmit)[0];const frozen=s.control.consume(s.a,s.a.category);await panel.props.onSubmit(frozen);assert.equal(calls,1);assert.equal(prepares,2);
});
test('actual owner export UI is hidden without capability and requires reselected saved files before submit',async()=>{
 const {controlledValidationInteraction}=await import('./helpers/renderReports.mjs');const s=await setup();let submitted=0;const downloads=[];
 const props={front:s.front,back:s.back,busy:false,cardType:'pokemon',onCategoryChange:value=>{props.cardType=value;},getSelectionEpoch:()=> '1:1',onSubmit:async p=>{submitted++;assert.equal(p.front,s.front);assert.equal(p.back,s.back);}};
 const bindings={fetch:async()=>({ok:true,json:async()=>({conditionValidationAvailable:true,authorized:true,revision,expiresAt:Date.now()+60000})}),createPreparedValidation:options=>createPreparedValidation({...options,cryptoImpl:webcrypto,dimensions:async()=>({width:30,height:40}),download:async(blob,name)=>downloads.push({blob,name})})};
 const h=controlledValidationInteraction(props,bindings);assert.equal(h.render(),null);await new Promise(setImmediate);let tree=h.render();h.nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'pokemon'}});tree=h.render();const button=(label)=>h.nodes(tree,n=>n.type==='button'&&(Array.isArray(n.props.children)?n.props.children.join(''):n.props.children)===label)[0];
 await button('Freeze prepared front and back').props.onClick();tree=h.render();assert.equal(button('Run controlled Full Analysis once').props.disabled,true);assert.equal(h.nodes(tree,n=>n.type==='p'&&typeof n.props.children==='string'&&n.props.children.includes('Expected request cost: unknown')).length,1);
 for(const [i,kind] of ['front','back','manifest'].entries()){
  await button(kind==='manifest'?'Download manifest':`Download prepared ${kind} JPEG`).props.onClick();tree=h.render();const input=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file')[i];const d=downloads.at(-1);await input.props.onChange({target:{files:[new File([await d.blob.arrayBuffer()],d.name,{type:d.blob.type})],value:'saved'}});await new Promise(setImmediate);tree=h.render();
 }
 assert.equal(button('Run controlled Full Analysis once').props.disabled,true);await button('Run controlled Full Analysis once').props.onClick();assert.equal(submitted,0);h.nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});tree=h.render();h.nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[1].props.onChange({target:{checked:true}});tree=h.render();assert.equal(button('Run controlled Full Analysis once').props.disabled,false);await button('Run controlled Full Analysis once').props.onClick();tree=h.render();assert.equal(submitted,1);assert.equal(button('Run controlled Full Analysis once'),undefined);await button('Freeze prepared front and back').props.onClick();tree=h.render();assert.equal(h.nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.checked,false);assert.equal(button('Run controlled Full Analysis once').props.disabled,true);assert.equal(submitted,1);
 const denied=controlledValidationInteraction(props,{...bindings,fetch:async()=>({ok:false})});assert.equal(denied.render(),null);await new Promise(setImmediate);assert.equal(denied.render(),null);
});
test('asynchronous freeze replacement and dimension failures remain fail-closed',async()=>{
 let release;const gate=new Promise(r=>{release=r;});const s=await setup();
 const c=createPreparedValidation({revision,cryptoImpl:webcrypto,getFiles:()=>({front:s.front,back:s.back,busy:false,version:'1:1',category:'pokemon',categorySelected:true}),dimensions:async()=>{await gate;return {width:30,height:40};},download(){}});
 const p=c.freeze();c.invalidate();release();await assert.rejects(p);
 await assert.rejects(setup({dimensions:async()=>{throw Error('decode failed');}}));
});

test('prepared dimension inspection has a read-only image fallback without JPEG re-encoding',async()=>{
 let revoked=0,decoded=0;
 class FakeImage{async decode(){decoded++;}naturalWidth=30;naturalHeight=40;}
 const d=await preparedDimensions(new File(['synthetic'],'test.jpg'),{bitmap:undefined,ImageImpl:FakeImage,url:{createObjectURL(){return 'blob:local-only';},revokeObjectURL(){revoked++;}}});
 assert.deepEqual(d,{width:30,height:40});assert.equal(decoded,1);assert.equal(revoked,1);
});

// Files on iOS can return an empty/generic MIME despite preserving the JPEG bytes.
// These are synthetic JPEGs, not physical-card accuracy or a device-provider scan.
test('saved JPEG verification uses actual bytes despite iPhone Files MIME metadata, without accepting altered bytes',async()=>{
 for(const mime of ['', 'application/octet-stream','image/jpg']){
  const s=await setup();
  for(const kind of ['front','back','manifest']){
   await s.control.export(s.a,kind);const d=s.downloads.at(-1);
   assert.equal(await s.control.verifySaved(s.a,kind,new File([await d.blob.arrayBuffer()],d.name,{type:mime})),true);
  }
  assert.equal(s.control.consume(s.a,s.a.category).front,s.front);
 }
 const s=await setup();await s.control.export(s.a,'front');
 await assert.rejects(s.control.verifySaved(s.a,'front',new File([await s.back.arrayBuffer()],'front.jpg')));
 assert.throws(()=>s.control.consume(s.a,s.a.category));
 const notJpeg=await setup();await notJpeg.control.export(notJpeg.a,'front');
 await assert.rejects(notJpeg.control.verifySaved(notJpeg.a,'front',new File(['not a JPEG'],'front.jpg',{type:'image/jpeg'})));
});
test('canceling saved-file selection leaves downloaded and previously verified evidence consumable',async()=>{
 const s=await verified();assert.equal(await s.control.verifySaved(s.a,'front',undefined),false);
 assert.equal(s.control.consume(s.a,s.a.category).back,s.back);
});
async function validationUi({dimensions,expiresIn=60000}={}){
 const {controlledValidationInteraction}=await import('./helpers/renderReports.mjs');const s=await setup();const downloads=[],timers=[],events={};let submissions=0,clock=100000;
 const target=prefix=>({addEventListener(name,fn){events[prefix+name]=fn;},removeEventListener(name,fn){if(events[prefix+name]===fn)delete events[prefix+name];}});
 class Clock extends Date{static now(){return clock;}}
 const props={front:s.front,back:s.back,busy:false,cardType:'pokemon',onCategoryChange:value=>{props.cardType=value;},getSelectionEpoch:()=> '1:1',onSubmit:async()=>{submissions++;}};
 const h=controlledValidationInteraction(props,{Date:Clock,window:target('window.'),document:target('document.'),setTimeout(fn){timers.push(fn);return fn;},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({conditionValidationAvailable:true,authorized:true,revision,expiresAt:clock+expiresIn})}),createPreparedValidation:options=>createPreparedValidation({...options,cryptoImpl:webcrypto,dimensions:dimensions|| (async()=>({width:30,height:40})),download:async(blob,name)=>downloads.push({blob,name})})});
 let tree;function render(){tree=h.render();return tree;}const nodes=predicate=>h.nodes(tree,predicate);const button=label=>nodes(n=>n.type==='button'&&(Array.isArray(n.props.children)?n.props.children.join(''):n.props.children)===label)[0];const inputs=()=>nodes(n=>n.type==='input'&&n.props.type==='file');const text=()=>{let out='';const walk=n=>{if(typeof n==='string')out+=n+' ';else if(Array.isArray(n))n.forEach(walk);else if(n?.props)walk(n.props.children);};walk(tree);return out;};
 render();await new Promise(setImmediate);render();if(!nodes(n=>n.type==='select')[0].props.disabled)nodes(n=>n.type==='select')[0].props.onChange({target:{value:'pokemon'}});render();
 return {h,s,downloads,events,timers,render,nodes,button,inputs,text,submissions:()=>submissions,advance(ms){clock+=ms;},async freeze(){await button('Freeze prepared front and back').props.onClick();render();},async download(kind){await button(kind==='manifest'?'Download manifest':`Download prepared ${kind} JPEG`).props.onClick();render();return downloads.at(-1);},async verify(kind,file){await inputs()[['front','back','manifest'].indexOf(kind)].props.onChange({target:{files:file?[file]:[],value:'selected'}});render();}};
}
test('actual verification UI preserves attempt through rerenders, focus, visibility, empty change and cancel events',async()=>{
 const u=await validationUi();await u.freeze();const d=await u.download('front');
 await u.verify('front',new File([await d.blob.arrayBuffer()],d.name));assert.match(u.text(),/Match verified locally/);
 for(let i=0;i<3;i++){u.h.props.getSelectionEpoch=()=> '1:1';u.render();u.events['window.focus']();u.events['document.visibilitychange']();u.render();}
 u.inputs()[1].props.onCancel();u.render();await u.verify('back',undefined);
 assert.equal(u.inputs().length,3);assert.match(u.text(),/frozen pair and existing verification matches are unchanged/);assert.match(u.text(),/Match verified locally/);
 assert.match(u.text(),/Next step:.*saved back/);assert.equal(u.submissions(),0);
});
test('actual verification UI keeps failed-file reason visible after reset and ordinary rerenders',async()=>{
 const u=await validationUi();await u.freeze();await u.download('front');await u.verify('front',u.s.back);
 assert.equal(u.inputs().length,0);assert.match(u.text(),/could not be read or did not match the frozen front file/);assert.match(u.text(),/Files\/Downloads/);
 assert.match(u.text(),/Verification failed — prepare again/);u.render();u.events['window.focus']();u.render();
 assert.equal(u.nodes(n=>n.props?.role==='alert').length,1);assert.match(u.text(),/Freeze the prepared pair/);assert.equal(u.submissions(),0);
 await u.freeze();assert.equal(u.nodes(n=>n.props?.role==='alert').length,0);assert.equal(u.inputs().length,3);
});
test('owner expiry on iPhone picker return remains visible and blocks even delayed verification results',async()=>{
 let block=false,release;const gate=new Promise(r=>{release=r;});
 const u=await validationUi({dimensions:async()=>{if(block)await gate;return {width:30,height:40};}});await u.freeze();const d=await u.download('front');block=true;
 const pending=u.inputs()[0].props.onChange({target:{files:[new File([await d.blob.arrayBuffer()],d.name)],value:'selected'}});
 u.render();u.advance(60001);u.events['window.focus']();u.render();release();await pending;u.render();
 assert.match(u.text(),/Owner authorization expired/);assert.match(u.text(),/Reauthorize Preview Scan Diagnostics/);assert.equal(u.inputs().length,0);assert.equal(u.nodes(n=>n.props?.role==='alert').length,1);assert.doesNotMatch(u.text(),/Match verified locally/);assert.equal(u.submissions(),0);
 // A separate timer-expiry path stays visible without any focus event.
 const v=await validationUi();await v.freeze();v.advance(60001);v.timers.at(-1)();v.render();assert.match(v.text(),/Owner authorization expired/);assert.equal(v.inputs().length,0);
});
test('actual UI verifies all three iPhone-style saved files and retains explicit one-use spending controls',async()=>{
 const u=await validationUi();await u.freeze();
 for(const kind of ['front','back','manifest']){const d=await u.download(kind);await u.verify(kind,new File([await d.blob.arrayBuffer()],d.name));}
 assert.equal(u.nodes(n=>n.type==='span'&&n.props.children==='Match verified locally').length,3);
 assert.match(u.text(),/All three files match/);assert.equal(u.button('Run controlled Full Analysis once').props.disabled,true);
 u.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});u.render();u.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[1].props.onChange({target:{checked:true}});u.render();await u.button('Run controlled Full Analysis once').props.onClick();u.render();
 assert.equal(u.submissions(),1);assert.equal(u.inputs().length,0);assert.equal(u.button('Run controlled Full Analysis once'),undefined);
});

test('asynchronous saved-file read errors persist visibly and a component remount cannot restore verification claims',async()=>{
 let fail=false;const u=await validationUi({dimensions:async()=>{if(fail)throw Error('synthetic read/decode failure');return {width:30,height:40};}});await u.freeze();const d=await u.download('front');fail=true;
 await u.verify('front',new File([await d.blob.arrayBuffer()],d.name));u.render();assert.match(u.text(),/Saved evidence could not be read/);assert.equal(u.inputs().length,0);assert.equal(u.submissions(),0);
 u.h.unmount();const fresh=await validationUi();assert.equal(fresh.inputs().length,0);assert.match(fresh.text(),/Reloading this page resets/);assert.equal(fresh.button('Run controlled Full Analysis once'),undefined);
 const expired=await validationUi({expiresIn:-1});assert.match(expired.text(),/Owner authorization unavailable or expired/);assert.equal(expired.button('Freeze prepared front and back'),undefined);
});
test('real photo replacement still resets the UI, while an unmounted pending verification cannot publish success',async()=>{
 const u=await validationUi();await u.freeze();u.h.props.front=new File([await u.s.front.arrayBuffer()],'replacement.jpg',{type:'image/jpeg'});u.render();u.render();assert.equal(u.inputs().length,0);assert.match(u.text(),/Selected photos or preparation state changed/);
 let block=false,release;const gate=new Promise(r=>{release=r;});const v=await validationUi({dimensions:async()=>{if(block)await gate;return {width:30,height:40};}});await v.freeze();const d=await v.download('front');block=true;
 const pending=v.inputs()[0].props.onChange({target:{files:[new File([await d.blob.arrayBuffer()],d.name)],value:'selected'}});v.h.unmount();release();await pending;assert.equal(v.submissions(),0);
});

test('untouched Pokémon default cannot freeze a controlled test without a deliberate category choice',async()=>{
 const s=await setup();const {controlledValidationInteraction}=await import('./helpers/renderReports.mjs');const props={front:s.front,back:s.back,busy:false,cardType:'pokemon',onCategoryChange(){},getSelectionEpoch:()=> '1:1',onSubmit(){throw Error('must not submit');}};
 const h=controlledValidationInteraction(props,{fetch:async()=>({ok:true,json:async()=>({conditionValidationAvailable:true,authorized:true,revision,expiresAt:Date.now()+60000})}),createPreparedValidation:options=>createPreparedValidation({...options,cryptoImpl:webcrypto,dimensions:async()=>({width:30,height:40})})});h.render();await new Promise(setImmediate);const tree=h.render();assert.equal(h.nodes(tree,n=>n.type==='select')[0].props.value,'');assert.equal(h.nodes(tree,n=>n.type==='button'&&n.props.children==='Freeze prepared front and back')[0].props.disabled,true);
 const missing=createPreparedValidation({revision,cryptoImpl:webcrypto,getFiles:()=>({front:s.front,back:s.back,busy:false,version:'1:1',category:'pokemon',categorySelected:false})});await assert.rejects(missing.freeze(),/category explicitly/);h.unmount();
});
test('category change after freezing or acknowledgment clears both approvals and frozen preparation',async()=>{
 const u=await validationUi();await u.freeze();const confirm=()=>u.nodes(n=>n.type==='input'&&n.props['aria-label']==='Confirm selected category')[0];confirm().props.onChange({target:{checked:true}});u.render();u.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[1].props.onChange({target:{checked:true}});u.render();
 u.nodes(n=>n.type==='select')[0].props.onChange({target:{value:'sports'}});u.render();u.render();assert.equal(u.h.props.cardType,'sports');assert.equal(u.inputs().length,0);await u.freeze();assert.equal(confirm().props.checked,false);assert.equal(u.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[1].props.checked,false);assert.equal(u.submissions(),0);
 const frozen=await verified();frozen.setCurrent({category:'sports'});assert.throws(()=>frozen.control.consume(frozen.a,'pokemon'),/changed or expired/);
});
test('server rejects missing, invalid, mismatched and stale category confirmations before all paid or marketplace boundaries',async()=>{
 const s=await verified();const base={mode:'condition-validation',cardType:'pokemon',validationManifest:JSON.stringify(s.a.manifest),validationCategorySelected:'pokemon',validationCategoryConfirmed:'pokemon',validationCategoryAttempt:s.a.manifest.attemptId};
 for(const patch of [{cardType:''},{cardType:'invalid'},{validationCategorySelected:''},{validationCategoryConfirmed:''},{validationCategoryConfirmed:'sports'},{validationCategoryAttempt:'00000000-0000-4000-8000-000000000000'},{cardType:'sports',validationCategorySelected:'sports',validationCategoryConfirmed:'sports'}]){
  const r=await runScan({env,headers:auth(),frontBytes:Buffer.from(await s.front.arrayBuffer()),backBytes:Buffer.from(await s.back.arrayBuffer()),fields:{...base,...patch}});assert.equal(r.status,403);assert.equal(r.metrics.vision,0);noMarket(r);
 }
 const legacy=structuredClone(s.a.manifest);delete legacy.category;const r=await controlled(s,{fields:{validationManifest:JSON.stringify(legacy)}});assert.equal(r.status,403);assert.equal(r.metrics.vision,0);
});
test('explicit sports selection executes sports analysis/audit and all four diagnostic category stages agree',async()=>{
 const s=await verified({category:'sports'});assert.throws(()=>s.control.consume(s.a,'pokemon'),/Confirm the selected category/);const frozen=s.control.consume(s.a,'sports');assert.equal(frozen.category,'sports');
 const headers=auth();const r=await controlled(s,{headers,vision:{...confirmed,identifiedSubject:'Synthetic dual-player sports card',visualObservations:[]}});assert.equal(r.status,200);assert.equal(r.payload.sportsIdentityAudit.category,'sports');assert.equal(r.payload.financialDecision.allowed,false);noMarket(r);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);
 const d=readDiagnosticTicket({method:'POST',headers},r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.equal(d.category,'sports');assert.deepEqual({...d.categoryRouting},{selected:'sports',confirmed:'sports',accepted:'sports',executed:'sports',sportsAuditRan:true,sportsAuditStatus:r.payload.sportsIdentityAudit.status});
 const p=await verified();const ph=auth();const pr=await controlled(p,{headers:ph});assert.equal(pr.status,200);const pd=readDiagnosticTicket({method:'POST',headers:ph},pr.responseHeaders[TICKET_HEADER],pr.responseHeaders[SCAN_HEADER],env);assert.equal(pd.categoryRouting.executed,'pokemon');assert.equal(pd.categoryRouting.sportsAuditRan,false);
});

test('actual App rejects a stale controlled callback after a category change without submitting any request',async()=>{
 const s=await verified();let requests=0;const h=appInteraction({FormData,URL,UploadError,normalizeMobileImage:async f=>f,assertUploadBudget:async()=>{},requestPrediction:async()=>{requests++;throw Error('must not request');},rememberScanDiagnostic(){},predictionFailureResponse:()=>null});let tree=h.render();const inputs=h.nodes(tree,n=>n.type==='input'&&n.props.type==='file');await inputs[0].props.onChange({target:{files:[s.front]}});await inputs[1].props.onChange({target:{files:[s.back]}});await new Promise(setImmediate);tree=h.render();const stale=h.nodes(tree,n=>n.props?.getSelectionEpoch&&n.props?.onSubmit)[0].props.onSubmit;
 h.nodes(tree,n=>n.type==='select'&&n.props.value==='pokemon')[0].props.onChange({target:{value:'sports'}});h.render();const original=s.control.consume(s.a,'pokemon');await stale({...original,category:'sports',confirmedCategory:'sports',manifest:JSON.stringify({...s.a.manifest,category:'sports'})});assert.equal(requests,0);
});
