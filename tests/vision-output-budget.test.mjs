// Synthetic photographs and model observations only; no provider requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import {scan,vision} from './helpers/pikachuFixture.mjs';
import {runScan,confirmed} from './helpers/reconciliationPipeline.mjs';
import {visionOutputBudget,parseVisionMessage,VISION_MODEL} from '../lib/visionResponsePolicy.mjs';
import {buildVisionPrompt} from '../lib/pokemonVisionPrompt.mjs';
import {buildSportsVisionPrompt} from '../lib/visionPromptContract.mjs';
import {reportFromResponse,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports} from './helpers/renderReports.mjs';
const response=(text,stop_reason='end_turn')=>({stop_reason,content:[{type:'text',text}]});
const cues={off_center:'border_width_difference',whitening:'localized_color_loss',scratches:'surface_line',no_defect_observed:'clear_inspected_area'};
const observations=Array.from({length:8},(_,i)=>{const attribute=['centering','corners','edges','surface'][i%4],side=i<4?'front':'back',code=attribute==='centering'?'off_center':attribute==='surface'?'scratches':'whitening';return {attribute,code,certainty:side==='front'?'confirmed':'suspected',evidence:{side,region:[0.05,0.05,0.2,0.2],cue:cues[code],confidence:side==='front'?0.92:0.6,...(code==='off_center'?{measurement:{axis:'horizontal',ratio:[60,40]}}:{})}};});
const readings=number=>['front','back'].flatMap(side=>[{field:'cardNumber',text:number,certainty:'clear',side,area:'collector_line',alternatives:[]},{field:'language',text:'English',certainty:'clear',side,area:'body_text',alternatives:[]}]);
const detail={...vision,identityNotes:'Visible number and language; year/set remain an unverified proposal.',identityReadings:readings('149/128'),visualObservations:observations,imageLimitations:[],photoNotes:[{attribute:'surface',side:'back',text:'Back surface inspection is incomplete near the lower edge.'}]};
function withheld(r){assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.payload.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(r.payload.prediction[f],null,f);assert.equal(r.metrics.sdkMaxRetries,0);}
test('high-detail front/back Pokémon completes with full number, uncertainty, localization, measurement and financial withholding',async()=>{
 const r=await scan({visionResponse:response(JSON.stringify(detail))});withheld(r);
 assert.equal(r.metrics.visionMaxTokens,4800);assert.equal(r.metrics.visionModel,VISION_MODEL);
 assert.equal(r.payload.originalIdentityObservation.identifiedYear,'2023');assert.equal(r.payload.canonicalCard.cardNumber,'149/128');
 assert.equal(r.payload.imageAnalysis.identityReadings[0].text,'149/128');assert.deepEqual(r.payload.imageAnalysis.visualObservations[0].evidence.measurement.ratio,[60,40]);
 assert.ok(r.payload.imageAnalysis.visualObservations.some(o=>o.evidence?.side==='back'));assert.match(renderReports(reportFromResponse(r.payload)).lower,/Back photo/);
});
test('sports response remains compatible with the existing Konnor Griffin identity and condition interface',async()=>{
 const sports={...confirmed,identifiedSport:'Baseball',identifiedTeam:'Pittsburgh Pirates',identifiedSerialNumber:null,identityNotes:'Collector prefix and parallel observed; serial stamp not established.',identityReadings:readings('BCP-86'),visualObservations:observations,centering:'fair',corners:'good',edges:'fair',surface:'fair',centeringNote:'Front borders appear uneven.',cornersNote:'Back corner inspection is limited.',edgesNote:'Front edge whitening visible.',surfaceNote:'Front surface lines require inspection.',primaryLimiter:'Surface lines need physical inspection.',minorConcerns:'Possible edge whitening.',gradingRisk:'Inspection is incomplete.',estimatedGrade:'Uncertain',confidenceLevel:'low',imageSummary:'Front and back inspected with unresolved condition concerns.'};
 const r=await runScan({visionResponse:response(JSON.stringify(sports))});withheld(r);
 assert.equal(r.payload.canonicalCard.cardNumber,'BCP-86');assert.equal(r.payload.imageAnalysis.identifiedYear,'2024');assert.ok(r.payload.imageAnalysis.modelPhotoNotes.some(n=>n.attribute==='surface'&&n.text===sports.surfaceNote));assert.match(r.payload.imageAnalysis.surfaceNote,/surface scratches/);assert.equal(r.payload.imageAnalysis.estimatedGrade,null);assert.equal(r.metrics.visionMaxTokens,4800);
 assert.equal(r.payload.imageAnalysis.identityReadings[0].text,'BCP-86');assert.ok(r.payload.imageAnalysis.visualObservations.some(v=>v.evidence?.side==='back'));
});
test('front-only budget is bounded separately and partial coverage remains valid and unassessed',async()=>{
 const r=await scan({back:false,visionResponse:response(JSON.stringify({...detail,identityReadings:readings('149/128').filter(v=>v.side==='front'),visualObservations:[observations[1]],imageLimitations:['back_not_visible'],photoNotes:[]}))});withheld(r);
 assert.equal(r.metrics.visionMaxTokens,3200);assert.equal(r.payload.imageAnalysis.conditionAssessments.surface.state,'unassessable');assert.ok(r.payload.imageAnalysis.imageLimitations.includes('back_not_visible'));
});
test('capped output is rejected before parsing, including a syntactically closed object at the cap',async()=>{
 for(const text of ['{"identifiedSubject":"Pikachu ex",',JSON.stringify(detail)]){
  const r=await scan({visionResponse:response(text,'max_tokens')});assert.equal(r.payload.code,'ANALYSIS_RESPONSE_INCOMPLETE');assert.equal(r.metrics.vision,1);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.catalog,0);
 }
});
test('strict vision parsing rejects empty, malformed, trailing prose, arrays and attempted JSON repairs',()=>{
 for(const text of ['```json\n{}\n```','{"identifiedSubject":"Pikachu",}','{} trailing prose','[]','null','{"a":'])assert.throws(()=>parseVisionMessage(response(text)),/ANALYSIS_RESPONSE_INVALID/);
 assert.throws(()=>parseVisionMessage(response('')),/ANALYSIS_EMPTY_RESPONSE/);
 assert.throws(()=>parseVisionMessage({content:[{type:'text',text:'{}'}]}),/ANALYSIS_RESPONSE_INVALID/);
 assert.throws(()=>parseVisionMessage(response('{}','refusal')),/ANALYSIS_RESPONSE_INVALID/);
 assert.deepEqual(parseVisionMessage(response('{"identityNotes":"literal { braces } are not JSON boundaries"}')),{identityNotes:'literal { braces } are not JSON boundaries'});
});
test('concise prompts remove duplicated sports forecasts and front/back suffixes, retaining evidence contracts',()=>{
 for(const prompt of [buildVisionPrompt({hasBack:true}),buildSportsVisionPrompt({hasBack:true,typeLabel:'Sports'})]){
  assert.match(prompt,/visualObservations/);assert.match(prompt,/identityReadings/);assert.match(prompt,/measurement/);assert.match(prompt,/full collector|full card/i);assert.match(prompt,/at most 16/);
 }
 const source=fs.readFileSync('pages/api/predict.js','utf8');assert.doesNotMatch(source,/Your job is NOT to guarantee|Hard grading rules|Both front and back images are provided/);
 assert.equal(visionOutputBudget(true),4800);assert.equal(visionOutputBudget(false),3200);
});
test('installed SDK makes exactly one attempted request with maxRetries zero and preserves actual request fields offline',async()=>{
 let calls=0,body;
 const client=new Anthropic({apiKey:'offline-not-a-credential',maxRetries:0,fetch:async(_url,init)=>{calls++;body=JSON.parse(init.body);return new Response(JSON.stringify({type:'error',error:{type:'api_error',message:'synthetic'}}),{status:500,headers:{'content-type':'application/json'}});}});
 await assert.rejects(client.messages.create({model:VISION_MODEL,max_tokens:4800,messages:[{role:'user',content:'offline stub only'}]}));
 assert.equal(calls,1);assert.equal(body.max_tokens,4800);assert.equal(body.model,VISION_MODEL);assert.equal(body.response_format,undefined);assert.equal(body.output_config,undefined);
});
test('schema-sized dual-photo fixture retains dense evidence without accepting invented repairs',async()=>{
 const extraCodes={centering:['miscut','truncated_print_border'],corners:['softening','rounded_corner_outline'],edges:['wear','localized_color_loss'],surface:['print_lines','printed_line']};
 const dense=[...observations,...observations.map(o=>({...o,code:extraCodes[o.attribute][0],evidence:{...o.evidence,cue:extraCodes[o.attribute][1],measurement:undefined}}))];
 const full={...detail,visualObservations:dense,identityReadings:[...readings('149/128'),...['front','back'].flatMap(side=>[{field:'subject',text:'Pikachu ex',certainty:'clear',side,area:'name',alternatives:[]},{field:'setCode',text:'30C',certainty:'uncertain',side,area:'set_mark',alternatives:[]},{field:'rarityMark',text:'Special illustration mark',certainty:'uncertain',side,area:'rarity_mark',alternatives:[]}])],photoNotes:['centering','corners','edges','surface'].map(attribute=>({attribute,side:'back',text:'Back inspection remains incomplete outside the documented areas.'}))};
 const json=JSON.stringify(full);const r=await scan({visionResponse:response(json)});withheld(r);assert.equal(full.visualObservations.length,16);assert.equal(full.identityReadings.length,10);
 assert.equal(r.payload.imageAnalysis.identityReadings.length,10);assert.ok(r.payload.imageAnalysis.visualObservations.length>=8);
 console.log('Synthetic dual-photo fixture: '+Buffer.byteLength(json)+' UTF-8 bytes; '+json.length+' characters. Token count is not asserted without the provider tokenizer.');
});

import {safeVisionCompletion,safeVisionValidation} from '../lib/visionResponsePolicy.mjs';
test('vision parser exposes exact bounded failure categories without accepting or repairing invalid output',()=>{
 const cases=[[response('{'),'json','json_syntax'],[response('[]'),'schema','top_level_object'],[response('null'),'schema','top_level_object'],[response('{}','tool_use'),'completion','stop_reason'],[response('{}','max_tokens'),'completion','output_limit'],[response(''),'completion','empty_output'],[response('x'.repeat(32769)),'json','byte_limit'],[{stop_reason:'end_turn',content:[{type:'text',text:'{}'},{type:'tool_use',input:{secret:'private'}}]},'completion','content_shape']];
 for(const [message,phase,rule]of cases){let error;try{parseVisionMessage(message);}catch(e){error=e;}assert.ok(error);assert.equal(error.visionValidation.phase,phase);assert.equal(error.visionValidation.rule,rule);assert.doesNotMatch(JSON.stringify(error),/private|input|secret/);}
 assert.deepEqual(parseVisionMessage({stop_reason:'end_turn',content:[{type:'text',text:'{"identified'},{type:'text',text:'Subject":"Synthetic"}'}]}),{identifiedSubject:'Synthetic'});
});
test('completion observability contains only fixed block types, bounded lengths, stops and numeric usage',()=>{
 const m={stop_reason:'sk-private-stop',id:'private-response-id',content:[{type:'text',text:'RAW_PRIVATE_MODEL_TEXT'},{type:'unknown-private-type',data:'private-image'},{type:'thinking',thinking:'private'}],usage:{input_tokens:40,output_tokens:4800}};
 const meta=safeVisionCompletion(m,{maxOutputTokens:4800});assert.equal(meta.mechanism,'prompt_json');assert.equal(meta.stopReason,'unknown');assert.deepEqual(meta.blockTypes,{text:1,other:1,thinking:1});assert.equal(meta.maxOutputTokens,4800);assert.equal(meta.usage.outputTokens,4800);assert.doesNotMatch(JSON.stringify(meta),/RAW_PRIVATE|sk-private|private-response|private-image|unknown-private/);assert.equal(safeVisionValidation({phase:'json',rule:'json_syntax',path:'private'}).path,undefined);
 const huge=safeVisionCompletion({stop_reason:'end_turn',content:Array.from({length:100},()=>({type:'text',text:'x'.repeat(1000)}))});assert.equal(huge.contentBlocks,32);assert.equal(huge.contentBlocksTruncated,true);assert.equal(huge.textUtf8Bytes,32769);
});
test('provider rejection metadata preserves only upstream status and published fixed vocabulary',async()=>{
 const {safeVisionProviderFailure}=await import('../lib/visionResponsePolicy.mjs');
 const marker='sk-synthetic-credential private-photo.jpg https://private.invalid/owner';
 const unknown=safeVisionProviderFailure({status:422,type:marker,errorCode:marker,message:marker,apiMessage:marker,headers:{secret:marker},error:{details:{error_code:marker}}});
 assert.deepEqual(unknown,{version:1,upstreamHttpStatus:422,providerErrorType:null,providerErrorCode:null,requestContractReason:'not_identified',reasonBasis:'not_established'});
 for(const status of ['400',NaN,Infinity,99,600,undefined])assert.equal(safeVisionProviderFailure({status}).upstreamHttpStatus,null);
 const nested=safeVisionProviderFailure({status:400,error:{error:{type:'invalid_request_error',message:marker,details:{error_code:'enforced_spend_limit_reached'}}}});
 assert.equal(nested.providerErrorType,'invalid_request_error');assert.equal(nested.providerErrorCode,'enforced_spend_limit_reached');assert.equal(nested.reasonBasis,'provider_error_code');assert.doesNotMatch(JSON.stringify(nested),/sk-|private|\.jpg/);
 const hint=safeVisionProviderFailure({status:400,apiMessage:'Schema is too complex for compilation. '+marker});assert.equal(hint.requestContractReason,'schema_complexity_message_hint');assert.equal(hint.reasonBasis,'recognized_message_hint');assert.ok(!JSON.stringify(hint).includes(marker));
 assert.equal(safeVisionProviderFailure({status:400,apiMessage:'x'.repeat(4096)+'Schema is too complex for compilation.'}).requestContractReason,'not_identified');
});
test('normal Sports Full Analysis accepts complete synthetic Mets prompt JSON through the installed SDK and renders both athletes',async()=>{
 const {metsFullAnalysisObservation}=await import('./helpers/fullAnalysisFixtures.mjs');const raw=metsFullAnalysisObservation();
 const sharp=(await import('sharp')).default;const jpeg=background=>sharp({create:{width:30,height:40,channels:3,background}}).jpeg().toBuffer();const frontBytes=await jpeg('white'),backBytes=await jpeg('gray');
 const r=await runScan({frontBytes,backBytes,fields:{mode:'full',cardType:'sports',cardName:'',cardSet:''},items:[],neutral:[],actualSdkFetch:async()=>new Response(JSON.stringify({type:'message',role:'assistant',id:'msg_synthetic_mets_recovery',model:VISION_MODEL,...response(JSON.stringify(raw))}),{status:200,headers:{'content-type':'application/json'}})});
 withheld(r);const request=r.metrics.sdkRequest,analysis=r.payload.imageAnalysis;
 assert.deepEqual(Object.keys(request).sort(),['max_tokens','messages','model']);assert.equal(request.output_config,undefined);assert.equal(request.output_format,undefined);assert.equal(request.response_format,undefined);assert.equal(request.max_tokens,4800);assert.equal(request.model,'claude-sonnet-4-6');assert.equal(r.payload.hasImageAnalysis,true);assert.notEqual(r.payload.stage,'identity');
 const blocks=request.messages[0].content;assert.deepEqual(blocks.map(b=>b.type),['image','image','text']);for(const b of blocks.slice(0,2)){assert.equal(b.source.type,'base64');assert.equal(b.source.media_type,'image/jpeg');assert.ok(Buffer.from(b.source.data,'base64').length>0);}
 assert.deepEqual(Buffer.from(blocks[0].source.data,'base64'),frontBytes);assert.deepEqual(Buffer.from(blocks[1].source.data,'base64'),backBytes);
 assert.match(r.metrics.visionPrompt,/sportsIdentity/);assert.match(r.metrics.visionPrompt,/serialNumber\|subset\|printedTitle\|foilMark/);assert.doesNotMatch(r.metrics.visionPrompt,/Use schemaVersion|Lindor|Soto|Celebration Confetti/);
 assert.equal(analysis.identifiedSubject,'Francisco Lindor / Juan Soto');assert.equal(analysis.identifiedYear,'2026');assert.equal(analysis.identifiedManufacturer,'Topps');assert.equal(analysis.identifiedBrandSet,'Topps Series 1');assert.equal(analysis.identifiedCardNumber,'52');assert.equal(analysis.identifiedParallel,'Celebration Confetti');assert.equal(analysis.identifiedSerialNumber,null);assert.equal(analysis.identityConfidence,null);
 assert.deepEqual(analysis.sportsIdentity.subjects.map(s=>s.name),['Francisco Lindor','Juan Soto']);assert.equal(analysis.sportsIdentity.subset,'It Takes Two');assert.equal(analysis.sportsIdentity.printedTitle,'It Takes Two');assert.equal(analysis.sportsIdentity.foilTreatment,'confetti-like foil');assert.ok(analysis.identityReadings.some(x=>x.field==='foilMark'));assert.ok(analysis.identityReadings.some(x=>x.field==='subset'));
 assert.equal(r.payload.originalIdentityObservation.identifiedParallel,raw.identifiedParallel);assert.equal(r.payload.originalIdentityObservation.identifiedBrandSet,raw.identifiedBrandSet);assert.equal(r.payload.sportsIdentityAudit.catalogVerified,false);assert.equal(r.payload.sportsIdentityAudit.soldLookupEligible,false);
 for(const attribute of ['centering','corners','edges','surface']){assert.ok(analysis.conditionAssessments[attribute]);assert.ok(analysis.visualObservations.some(o=>o.attribute===attribute));for(const side of ['front','back'])assert.ok(analysis.inspectionCoverage.some(c=>c.attribute===attribute&&c.side===side));}
 assert.ok(analysis.visualObservations.some(o=>o.evidence?.side==='back'&&o.code==='scratches'&&o.certainty==='suspected'));assert.ok(analysis.inspectionCoverage.some(c=>c.attribute==='surface'&&c.side==='front'&&c.status==='unassessable'));assert.deepEqual(analysis.imageLimitations,['glare','perspective']);
 const report=reportFromResponse(r.payload),html=renderReports(report);assert.match(html.upper,/Francisco Lindor/);assert.match(html.upper,/Juan Soto/);assert.match(html.lower,/Possible defect|suspected|Possible surface/i);assert.match(html.lower,/Unable to assess|unassessable|cannot.*assess/i);assert.doesNotMatch(html.upper,/68\/99/);assert.equal(report.financialDecision.allowed,false);assert.equal(r.payload.sportsIdentityEvidence.verified,false);assert.equal(r.payload.sportsIdentityEvidence.exactParallel.status,'unverified');assert.match(html.upper+html.lower,/It Takes Two/);
});
test('sports prompt-JSON retains source-linked subjects when invalid readings are filtered without promoting ambiguous evidence',async()=>{
 const {retainSportsVisionEvidence}=await import('../lib/visionResponsePolicy.mjs');const {metsFullAnalysisObservation}=await import('./helpers/fullAnalysisFixtures.mjs');const {sportsIdentityEvidence}=await import('../lib/sportsIdentityEvidence.mjs');
 const raw=metsFullAnalysisObservation();raw.identityReadings.unshift({field:'unsupported',text:'not retained',side:'front',area:'name',certainty:'clear'});raw.sportsIdentity.subjects.forEach(s=>s.readingIndices=s.readingIndices.map(i=>i+1));
 const out=retainSportsVisionEvidence(raw,['front','back'],{extended:true});assert.deepEqual(out.sportsIdentity.subjects[0].readingIndices,[0,2]);assert.equal(out.identityReadings[0].text,'Francisco Lindor');assert.equal(sportsIdentityEvidence(out.originalIdentityObservation).subjectStatus,'supported_observations');
 raw.sportsIdentity.subjects[0].readingIndices=[0,1];const bad=retainSportsVisionEvidence(raw,['front','back'],{extended:true});assert.deepEqual(bad.sportsIdentity.subjects[0].readingIndices,[]);assert.notEqual(sportsIdentityEvidence(bad.originalIdentityObservation).subjectStatus,'supported_observations');
 raw.sportsIdentity.subjects[0].name={unexpected:'value'};assert.equal(retainSportsVisionEvidence(raw,['front','back'],{extended:true}).sportsIdentity,null);
});
