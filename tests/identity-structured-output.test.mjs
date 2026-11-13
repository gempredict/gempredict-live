// No network calls: actual installed SDK + mocked HTTP, actual multipart handler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VERSION} from '@anthropic-ai/sdk/version';
import {identityOutputFormat} from '../lib/identityOutputSchema.mjs';
import {IDENTITY_STRING_FIELDS,safeIdentityValidation} from '../lib/identityValidation.mjs';
import {parseIdentityMessage} from '../lib/identityStage.mjs';
import {safeIdentityCompletion} from '../lib/identityCompletion.mjs';
import {scan as pikachuScan,vision as pikachuVision} from './helpers/pikachuFixture.mjs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const blank={...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identityConfidence:null,identityReadings:[]};
const reading=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':field==='cardNumber'?'collector_line':'set_mark',alternatives:[]});
const observed={...blank,...pikachuVision,identityConfidence:88,identityReadings:[reading('subject','Pikachu ex'),reading('cardNumber','149/128'),reading('setCode','30C EN')]};
function envelope(value=observed,patch={}){return {id:'msg_offline_fixture',type:'message',role:'assistant',model:'claude-sonnet-4-6',stop_reason:'end_turn',stop_sequence:null,content:[{type:'text',text:JSON.stringify(value)}],usage:{input_tokens:1200,output_tokens:400,cache_creation_input_tokens:0,cache_read_input_tokens:100},...patch};}
function transport(body,status=200){return async()=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
async function scan({body=envelope(),status=200,frontOnly=false,...options}={}){
 let calls=0;const r=await pikachuScan({fields:{mode:'identity',cardType:'pokemon'},back:!frontOnly,...options,actualSdkFetch:async(url,init)=>{calls++;assert.equal(String(url),'https://api.anthropic.com/v1/messages');return transport(body,status)(url,init);}});return {...r,calls};
}
function isolated(r){assert.equal(r.calls,1);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.sdkLogLevel,'off');assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.upstream,0);assert.equal(r.metrics.internal.length,0);assert.equal(r.metrics.visionMaxTokens,2000);}
test('pinned actual SDK sends supported direct JSON output format and no tools, beta, prefilling or fallback',async()=>{
 assert.equal(VERSION,'1.6.0');for(const frontOnly of [false,true]){
  const r=await scan({frontOnly});isolated(r);assert.equal(r.status,200);const body=r.metrics.sdkRequest;assert.deepEqual(body.output_config,{format:identityOutputFormat(!frontOnly)});assert.equal(body.model,'claude-sonnet-4-6');assert.equal(body.messages.length,1);assert.equal(body.messages[0].role,'user');assert.equal(body.tools,undefined);assert.equal(body.tool_choice,undefined);assert.equal(body.output_format,undefined);assert.equal(body.response_format,undefined);assert.equal(r.payload.canonicalCard.year,'2026');assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2023');assert.equal(r.payload.photoIdentityStatus.photoSupported,true);assert.equal(r.payload.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);
 }
});
test('compact provider schema uses supported features and static nullable fields while local bounds remain strict',()=>{
 const format=identityOutputFormat(true),s=format.schema;assert.equal(format.type,'json_schema');assert.deepEqual(s.required,[...IDENTITY_STRING_FIELDS,'identityConfidence','identityReadings']);assert.equal(s.additionalProperties,false);assert.equal(s.properties.identityReadings.items.additionalProperties,false);assert.equal(Object.values(s.properties).filter(p=>Array.isArray(p.type)).length,12);
 const forbidden=['maxItems','maxLength','minLength','minimum','maximum','multipleOf','strict'];function inspect(node){if(!node||typeof node!=='object')return;for(const [key,value] of Object.entries(node)){assert.ok(!forbidden.includes(key),key);if(value&&typeof value==='object')inspect(value);}}inspect(s);
 for(const record of [{...blank,identityConfidence:101},{...blank,identityReadings:Array(13).fill(reading('subject','Pikachu'))},{...blank,identifiedSubject:'x'.repeat(81)}])assert.throws(()=>parseIdentityMessage(envelope(record),['front']),e=>e.identityValidation.phase==='schema');
});
test('actual SDK and handler distinguish refusal, truncation, malformed transport, JSON syntax and local schema failure',async()=>{
 for(const [body,code,phase,rule] of [
  [envelope(blank,{stop_reason:'refusal',content:[{type:'text',text:'Private refusal explanation must not be exported.'}]}),'ANALYSIS_PROVIDER_REFUSED','completion','refusal'],
  [envelope(blank,{stop_reason:'max_tokens'}),'ANALYSIS_RESPONSE_INCOMPLETE','completion','output_limit'],
  ['not transport JSON','ANALYSIS_TRANSPORT_INVALID','transport','json_transport'],
  [[], 'ANALYSIS_TRANSPORT_INVALID','transport','message_shape'],
  [envelope(blank,{content:[{type:'tool_use',name:'private',input:{}}]}),'ANALYSIS_TRANSPORT_INVALID','transport','content_shape'],
  [envelope(blank,{content:[{type:'text',text:'{}'},{type:'text',text:'{}'}]}),'ANALYSIS_TRANSPORT_INVALID','transport','content_shape'],
  [envelope(blank,{content:[{type:'text',text:'{'}]}),'ANALYSIS_RESPONSE_INVALID','json','json_syntax'],
  [envelope({...blank,identifiedYear:2026}),'ANALYSIS_RESPONSE_INVALID','schema','wrong_type']]){
  const r=await scan({body});isolated(r);assert.notEqual(r.status,200);assert.equal(r.payload.code,code);assert.equal(r.payload.identityValidation.phase,phase);assert.equal(r.payload.identityValidation.rule,rule);assert.equal(r.metrics.catalog,0);assert.doesNotMatch(JSON.stringify(r.payload),/Private refusal|not transport|tool_use|msg_offline_fixture/);
 }
});
test('provider rejects request or hits network/rate/server error once; no unstructured paid fallback',async()=>{
 for(const status of [400,401,422,429,500,503]){const r=await scan({body:{type:'error',error:{type:'api_error',message:'private schema issue and credential sentinel'}},status});isolated(r);assert.notEqual(r.status,200);assert.equal(r.payload.code,[400,422].includes(status)?'ANALYSIS_PROVIDER_REQUEST_REJECTED':[401].includes(status)?'ANALYSIS_PROVIDER_AUTH_FAILED':status===429?'ANALYSIS_PROVIDER_RATE_LIMITED':'ANALYSIS_PROVIDER_FAILED');assert.equal(r.metrics.catalog,0);assert.doesNotMatch(JSON.stringify(r.payload),/sentinel|private schema|credential/);}
});
test('schema-valid unknown or uncertain identities complete without inventing facts or independent verification',async()=>{
 for(const body of [envelope(blank),envelope({...blank,identifiedSubject:'Pikachu ex',identityReadings:[{...reading('cardNumber','149/128'),certainty:'uncertain',alternatives:['149/129']}]})]){
  const r=await scan({body});isolated(r);assert.equal(r.status,200);assert.equal(r.payload.identityV2.identityVerified,false);assert.equal(r.payload.photoIdentityStatus.photoSupported,false);assert.equal(r.payload.originalIdentityObservation.identifiedYear,null);assert.equal(r.payload.financialDecision.allowed,false);assert.equal(r.payload.imageAnalysis,null);assert.equal(r.payload.marketData,null);
 }
});
test('sports keeps complete alphanumeric number and never acquires a fabricated catalog from enforced JSON',async()=>{
 let calls=0;const r=await runScan({fields:{mode:'identity',cardType:'sports'},actualSdkFetch:async()=>{calls++;return transport(envelope({...blank,...confirmed,identityReadings:[reading('cardNumber','BCP-86')]}))();}});isolated({...r,calls});assert.equal(r.status,200);assert.equal(r.metrics.catalog,0);assert.equal(r.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(r.payload.originalIdentityObservation.identityReadings[0].text,'BCP-86');assert.equal(r.payload.identityV2.identityVerified,false);
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'2490206a4536a6ad6d6d7373c7c1c43c6bb03254',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('only authorized Preview diagnostics include safe stop metadata and usage on success or refusal',async()=>{
 const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 for(const body of [envelope(),envelope(blank,{stop_reason:'refusal',content:[{type:'text',text:'PRIVATE_REFUSAL https://internal.invalid'}]}),envelope(blank,{stop_reason:'max_tokens'})]){
  const r=await scan({body,env,headers:req.headers});const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.ok(d);assert.equal(d.identityCompletion.mechanism,'json_schema');assert.equal(d.identityCompletion.stopReason,body.stop_reason);assert.equal(d.identityCompletion.httpStatus,200);assert.equal(d.identityCompletion.usage.inputTokens,1200);assert.equal(d.identityCompletion.usage.outputTokens,400);assert.equal(d.identityCompletion.usage.cacheReadInputTokens,100);assert.doesNotMatch(JSON.stringify(d),/PRIVATE_REFUSAL|internal.invalid|msg_offline_fixture|base64|x-api-key/);
 }
 for(const override of [{},{env:{...env,VERCEL_ENV:'production'},headers:req.headers}]){const r=await scan({env,...override});assert.equal(r.responseHeaders[TICKET_HEADER],undefined);assert.equal(r.payload.identityCompletion,undefined);}
});
test('metadata sanitization never copies unknown stop reasons, nonnumeric usage, provider IDs or raw content',()=>{
 const m=safeIdentityCompletion({id:'private',stop_reason:'secret https://invalid',content:[{type:'secret',text:'private'}],usage:{input_tokens:'credential',output_tokens:-1,cache_read_input_tokens:Infinity}},'private');assert.equal(m.stopReason,'unknown');assert.equal(m.httpStatus,null);assert.deepEqual(m.usage,{inputTokens:null,outputTokens:null,cacheCreationInputTokens:null,cacheReadInputTokens:null});assert.doesNotMatch(JSON.stringify(m),/secret|private|https|credential/);assert.equal(safeIdentityValidation({phase:'completion',rule:'refusal',path:'$'}).rule,'refusal');
});
test('actual SDK Zapdos fixture retains 2025 proposal while independent 30C/133/128 facts control canonical 2026',async()=>{
 const {facts}=JSON.parse(fs.readFileSync('tests/fixtures/zapdos-catalog-facts.json','utf8'));
 const set={id:facts.setId,name:facts.setName,releaseDate:facts.releaseDate,cardCount:{official:128},tcgOnline:'30C'};
 const card={id:'mock-zapdos-133',name:facts.subject,localId:'133',rarity:facts.rarity,set,variants:{holo:true,normal:false,reverse:false}};
 const catalogFetch=async url=>({ok:true,status:200,json:async()=>structuredClone(new URL(url).pathname.endsWith('/cards')?[{id:card.id,name:card.name,localId:card.localId}]:new URL(url).pathname.includes('/cards/')?card:set)});
 const proposal={...blank,identifiedSubject:'Zapdos',identifiedYear:'2025',identifiedBrandSet:'Unverified model set',identifiedCardNumber:'133/128',identifiedLanguage:'English',identityConfidence:88,identityReadings:[reading('subject','Zapdos'),reading('cardNumber','133/128'),reading('setCode','30C EN'),reading('copyrightYear','©2026')]};
 const r=await scan({body:envelope(proposal),catalogFetch});isolated(r);assert.equal(r.status,200);assert.equal(r.payload.canonicalCard.year,'2026');assert.equal(r.payload.canonicalCard.cardNumber,'133/128');assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2025');assert.equal(r.payload.photoIdentityStatus.photoSupported,true);assert.equal(r.payload.physicalPrintingStatus.verified,false);assert.equal(r.payload.financialDecision.allowed,false);
});
test('actual SDK upgrade preserves the separate full sports scan request without adding structured format or extra calls',async()=>{
 let calls=0;const r=await runScan({fields:{cardType:'sports'},actualSdkFetch:async()=>{calls++;return transport(envelope({...confirmed,centering:'good',corners:'good',edges:'good',surface:'good'}))();}});assert.equal(calls,1);assert.equal(r.status,200);assert.equal(r.metrics.visionMaxTokens,4800);assert.equal(r.metrics.sdkRequest.output_config,undefined);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(r.payload.financialDecision.allowed,false);
});
test('actual SDK abort or connection failure does not retry, and timeout remains distinguishable',async()=>{
 for(const name of ['AbortError','Error']){let calls=0;const r=await runScan({fields:{mode:'identity',cardType:'pokemon'},actualSdkFetch:async()=>{calls++;const error=Error('private transport exception');error.name=name;throw error;}});assert.equal(calls,1);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.catalog,0);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.code,name==='AbortError'?'ANALYSIS_PROVIDER_TIMEOUT':'ANALYSIS_PROVIDER_FAILED');assert.doesNotMatch(JSON.stringify(r.payload),/private transport/);}
});
