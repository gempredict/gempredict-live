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
