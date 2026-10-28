// Benchmark tooling only; not a production provider router.
import {catalogLanguageKey,catalogVariantParts} from '../../lib/catalogNormalization.mjs';
import {createHash} from 'node:crypto';
import https from 'node:https';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {buildVisionPrompt} from '../../lib/visionPrompt.mjs';
import {readVisualEvidence} from '../../lib/visualEvidence.mjs';
export const providers=Object.freeze({
 anthropic:{model:'claude-sonnet-4-6',key:'VISION_BENCH_ANTHROPIC_KEY',url:'https://api.anthropic.com/v1/messages',temperature:0},
 openai:{model:'gpt-4.1-2025-04-14',key:'VISION_BENCH_OPENAI_KEY',url:'https://api.openai.com/v1/responses',temperature:0},
 google:{model:'gemini-3.1-pro-preview',key:'VISION_BENCH_GEMINI_KEY',url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',temperature:1}
});
// Resolve an existing binding in memory; never copy it to a file or mutate env.
// The Anthropic aliases are used only with the fixed api.anthropic.com endpoint.
export function benchmarkCredential(id,env=process.env) {
 const provider=providers[id];
 if(!provider)return undefined;
 return env[provider.key] || (id==='anthropic' ? env.Claude_API_Key || env.CLAUDE_API_KEY : undefined);
}
export function benchmarkProxy(env=process.env) {
 return env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
}
export const hash=v=>createHash('sha256').update(Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const identityFields=['subject','year','brandSet','cardNumber','language','parallel','rarity'];
const predictionFields={subject:'identifiedSubject',year:'identifiedYear',brandSet:'identifiedBrandSet',cardNumber:'identifiedCardNumber',language:'identifiedLanguage',parallel:'identifiedParallel',rarity:'identifiedRarity'};
const key=v=>typeof v==='string'?v.toLowerCase().replace(/[^a-z0-9/]/g,''):'';
export function planBenchmark(manifest,{live=false,authorized=false,env=process.env}={}) {
 const blockers=[];const fixtures=Array.isArray(manifest.fixtures)?manifest.fixtures:[];
 if(!fixtures.length)blockers.push('real_photo_fixtures_missing');
 if(new Set(fixtures.map(f=>f.id)).size!==fixtures.length)blockers.push('duplicate_fixture_ids');
 if(!live||!authorized)blockers.push('paid_calls_not_explicitly_authorized');
 if(!Number.isInteger(manifest.repeats)||manifest.repeats<2||manifest.repeats>10)blockers.push('repeat_count_invalid');
 const calls=fixtures.length*(manifest.repeats||0)*Object.keys(providers).length;
 if(!Number.isInteger(manifest.maxRequests)||calls>manifest.maxRequests||calls>300)blockers.push('request_budget_invalid');
 if(!Number.isFinite(manifest.maxEstimatedCostUSD)||manifest.maxEstimatedCostUSD<=0)blockers.push('cost_budget_missing');
 for(const [id,p] of Object.entries(providers)){
  if(!benchmarkCredential(id,env))blockers.push(`${id}:credential_unavailable`);
  if(!Number.isFinite(manifest.rates?.[id]?.inputPerMillion)||manifest.rates[id].inputPerMillion<=0||!Number.isFinite(manifest.rates?.[id]?.outputPerMillion)||manifest.rates[id].outputPerMillion<=0)blockers.push(`${id}:reviewed_token_rates_missing`);
 }
 for(const f of fixtures){
  if(!/^[a-z0-9_-]{1,64}$/i.test(f.id||''))blockers.push('fixture_id_invalid');
  if(!['pokemon','sports'].includes(f.category)||f.synthetic===true||f.consentToProviderUpload!==true||!f.rightsReference)blockers.push(`${f.id}:real_image_rights_or_consent_missing`);
  if(!f.front?.path||!/^[a-f0-9]{64}$/i.test(f.front?.sha256||'')||f.back?.path&&!/^[a-f0-9]{64}$/i.test(f.back.sha256||''))blockers.push(`${f.id}:front_photo_or_hash_missing`);
  const truth=f.groundTruth;
  if(truth?.verified!==true||!truth.reference||!identityFields.every(field=>typeof truth.identity?.[field]==='string'&&truth.identity[field].trim()))blockers.push(`${f.id}:independent_identity_labels_unverified`);
  if(truth?.conditionReviewed!==true||!Array.isArray(truth.assessableAttributes)||!truth.assessableAttributes.length||truth.assessableAttributes.some(a=>!['centering','corners','edges','surface'].includes(a))||!Array.isArray(truth.visibleDefects)||truth.visibleDefects.some(t=>!t||!truth.assessableAttributes.includes(t.attribute)||t.code==='no_defect_observed'||readVisualEvidence({visualObservations:[t]}).findings.length!==1))blockers.push(`${f.id}:visible_condition_labels_unverified`);
 }
 return {status:blockers.length?'BLOCKED':'READY_FOR_AUTHORIZED_CALLS',plannedRequests:calls,blockers,providers:Object.fromEntries(Object.entries(providers).map(([id,p])=>[id,{model:p.model,temperature:p.temperature}]))};
}
export function providerRequest(id,prompt,images) {
 const p=providers[id];if(!p)throw Error('unsupported_benchmark_provider');
 const inline=images.map(i=>({type:'image',source:{type:'base64',media_type:i.mime,data:i.buffer.toString('base64')}}));
 if(id==='anthropic')return {model:p.model,temperature:p.temperature,max_tokens:2000,messages:[{role:'user',content:[...inline,{type:'text',text:prompt}]}]};
 if(id==='openai')return {model:p.model,temperature:p.temperature,max_output_tokens:2000,input:[{role:'user',content:[{type:'input_text',text:prompt},...images.map(i=>({type:'input_image',image_url:`data:${i.mime};base64,${i.buffer.toString('base64')}`,detail:'high'}))]}]};
 return {contents:[{role:'user',parts:[{text:prompt},...images.map(i=>({inlineData:{mimeType:i.mime,data:i.buffer.toString('base64')}}))]}],generationConfig:{temperature:p.temperature,maxOutputTokens:2000,responseMimeType:'application/json'}};
}
export function parseProviderResponse(id,response) {
 let text,usage,model;
 if(id==='anthropic'){text=response.content?.filter(c=>c.type==='text').map(c=>c.text).join('');usage={input:response.usage?.input_tokens,output:response.usage?.output_tokens};model=response.model;}
 else if(id==='openai'){text=response.output?.flatMap(c=>c.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');usage={input:response.usage?.input_tokens,output:response.usage?.output_tokens};model=response.model;}
 else {text=response.candidates?.[0]?.content?.parts?.filter(p=>p.text&&!p.thought).map(p=>p.text).join('');usage={input:response.usageMetadata?.promptTokenCount,output:(response.usageMetadata?.candidatesTokenCount||0)+(response.usageMetadata?.thoughtsTokenCount||0)};model=response.modelVersion;}
 if(typeof text!=='string')throw Error('benchmark_empty_response');
 let parsed;try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('benchmark_invalid_json');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('benchmark_invalid_object');
 const safeUsage={input:Number.isSafeInteger(usage.input)&&usage.input>=0?usage.input:null,output:Number.isSafeInteger(usage.output)&&usage.output>=0?usage.output:null};
 return {parsed,usage:safeUsage,returnedModel:typeof model==='string'?model.slice(0,100):null};
}
export async function callProvider(id,payload,secret) {
 const p=providers[id];const proxy=benchmarkProxy();
 const body=JSON.stringify(payload),agent=proxy?new HttpsProxyAgent(proxy):undefined;
 try{return await new Promise((resolve,reject)=>{
  const headers={'content-type':'application/json','content-length':Buffer.byteLength(body),...(id==='anthropic'?{'x-api-key':secret,'anthropic-version':'2023-06-01'}:id==='openai'?{authorization:`Bearer ${secret}`}:{'x-goog-api-key':secret})};
  const req=https.request(p.url,{method:'POST',headers,agent,signal:AbortSignal.timeout(45000)},res=>{
   let size=0,data='';res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)res.destroy(Error('benchmark_response_too_large'));else data+=chunk;});
   res.on('error',()=>reject(Error('benchmark_transport_error')));res.on('end',()=>{if(res.statusCode!==200)return reject(Error(`benchmark_http_${res.statusCode}`));try{resolve(JSON.parse(data));}catch{reject(Error('benchmark_invalid_json'));}});
  });req.on('error',()=>reject(Error('benchmark_transport_error')));req.end(body);
 });}finally{agent?.destroy();}
}
export function scoreResponse(parsed,truth,{inspectedSides=['front']}={}) {
 const normalized=(field,v)=>field==='language'?catalogLanguageKey(v):field==='parallel'?JSON.stringify(catalogVariantParts(v)):field==='rarity'&&['sir','specialillustrationrare'].includes(key(v))?'sir':key(v);
 const identity=Object.fromEntries(identityFields.map(field=>[field,normalized(field,parsed[predictionFields[field]])===normalized(field,truth.identity[field])]));
 if(!Array.isArray(parsed.visualObservations))parsed={...parsed,visualObservations:[]};
 const visual=readVisualEvidence({...parsed,inspectedSides});
 const confirmed=visual.findings.filter(f=>f.certainty==='confirmed'&&f.code!=='no_defect_observed');
 const assessable=new Set(truth.assessableAttributes);
 const rawClaims=(Array.isArray(parsed.visualObservations)?parsed.visualObservations:[]).filter(f=>f&&f.code!=='no_defect_observed'&&(!f.certainty||f.certainty==='confirmed'));
 const falsePositive=rawClaims.filter(f=>assessable.has(f.attribute)&&!truth.visibleDefects.some(t=>t.attribute===f.attribute&&t.code===f.code));
 const falseNegative=truth.visibleDefects.filter(t=>!confirmed.some(f=>f.attribute===t.attribute&&f.code===t.code));
 const identityConfidence=Number.isFinite(parsed.identityConfidence)&&parsed.identityConfidence>=0&&parsed.identityConfidence<=100?parsed.identityConfidence:null;
 return {proposedIdentity:Object.fromEntries(identityFields.map(field=>[field,typeof parsed[predictionFields[field]]==='string'?parsed[predictionFields[field]].slice(0,100):null])),identityConfidence,identityMissing:identityFields.filter(field=>!key(parsed[predictionFields[field]])),identity,exactIdentity:Object.values(identity).every(Boolean),confirmedDefects:confirmed.map(f=>({attribute:f.attribute,code:f.code})),falsePositiveDefects:falsePositive.length,falseNegativeDefects:falseNegative.length,
  unsupportedConfirmedClaims:Math.max(0,rawClaims.length-confirmed.length),
  conditionFingerprint:hash(visual.findings.map(f=>[f.attribute,f.code,f.certainty]).sort()),supportFingerprint:hash(visual),identityFingerprint:hash(identityFields.map(f=>parsed[predictionFields[f]]??null))};
}
export async function executeBenchmark(manifest,prepared,{env=process.env,transport=callProvider,testOnly=false}={}) {
 if(transport===callProvider && planBenchmark(manifest,{live:true,authorized:manifest.paidCallsAuthorized===true,env}).status!=='READY_FOR_AUTHORIZED_CALLS')return {status:'BLOCKED',rows:[],providerCallsPerformed:0};
 testOnly = testOnly || transport !== callProvider;
 const rows=[];let estimatedCost=0;
 for(const fixture of manifest.fixtures)for(const id of Object.keys(providers))for(let repeat=0;repeat<manifest.repeats;repeat++){
  if(rows.length>=manifest.maxRequests||estimatedCost>=manifest.maxEstimatedCostUSD) return {status:'STOPPED_AT_BUDGET',testOnly,rows,estimatedCostUSD:estimatedCost};
  const images=prepared.get(fixture.id),prompt=buildVisionPrompt({cardName:'Unknown card from image',typeLabel:fixture.category==='sports'?'Sports Card':'Pokemon',hasBack:images.length>1});
  const payload=providerRequest(id,prompt,images),started=performance.now();
  try {
   const response=await transport(id,payload,benchmarkCredential(id,env));const {parsed,usage,returnedModel}=parseProviderResponse(id,response);
   const cost=usage.input!=null&&usage.output!=null?(usage.input*manifest.rates[id].inputPerMillion+usage.output*manifest.rates[id].outputPerMillion)/1e6:null;
   if(cost!=null)estimatedCost+=cost;
   rows.push({fixtureId:fixture.id,physicalCardId:fixture.physicalCardId||fixture.id,provider:id,repeat,requestedModel:providers[id].model,returnedModel,temperature:providers[id].temperature,promptFingerprint:hash(prompt),imageFingerprints:images.map(i=>hash(i.buffer)),latencyMs:Math.round(performance.now()-started),usage,estimatedCostUSD:cost,...scoreResponse(parsed,fixture.groundTruth,{inspectedSides:images.length>1?['front','back']:['front']})});
   if(cost==null)return {status:'BLOCKED_USAGE_UNAVAILABLE',testOnly,rows,estimatedCostUSD:estimatedCost};
  }catch{rows.push({fixtureId:fixture.id,provider:id,repeat,error:'provider_or_response_failure',latencyMs:Math.round(performance.now()-started)});}
 }
 const summaries=Object.fromEntries(Object.keys(providers).map(id=>{
  const all=rows.filter(r=>r.provider===id),valid=all.filter(r=>!r.error);const latencies=valid.map(r=>r.latencyMs).sort((a,b)=>a-b);
  return [id,{requests:all.length,validResponses:valid.length,exactIdentityRate:valid.length?valid.filter(r=>r.exactIdentity).length/valid.length:null,highConfidenceWrong:valid.filter(r=>r.identityConfidence>=80&&!r.exactIdentity).length,identityAbstentions:valid.reduce((n,r)=>n+r.identityMissing.length,0),identityBrierScore:valid.some(r=>r.identityConfidence!=null)?valid.filter(r=>r.identityConfidence!=null).reduce((n,r)=>n+(r.identityConfidence/100-Number(r.exactIdentity))**2,0)/valid.filter(r=>r.identityConfidence!=null).length:null,identityAccuracy:Object.fromEntries(identityFields.map(field=>[field,valid.length?valid.filter(r=>r.identity[field]).length/valid.length:null])),falsePositiveDefects:valid.reduce((n,r)=>n+r.falsePositiveDefects,0),falseNegativeDefects:valid.reduce((n,r)=>n+r.falseNegativeDefects,0),unsupportedConfirmedClaims:valid.reduce((n,r)=>n+r.unsupportedConfirmedClaims,0),latencyP50Ms:latencies[Math.floor(latencies.length*.5)]??null,latencyP95Ms:latencies[Math.min(latencies.length-1,Math.floor(latencies.length*.95))]??null,
   perImageStability:manifest.fixtures.map(f=>({fixtureId:f.id,identityVersions:new Set(valid.filter(r=>r.fixtureId===f.id).map(r=>r.identityFingerprint)).size,conditionVersions:new Set(valid.filter(r=>r.fixtureId===f.id).map(r=>r.conditionFingerprint)).size})),estimatedCostUSD:valid.reduce((n,r)=>n+(r.estimatedCostUSD||0),0)}];
 }));
 return {status:testOnly?'HARNESS_TEST_ONLY_NOT_MODEL_ACCURACY':rows.some(r=>r.error)?'INCOMPLETE':'COMPLETE_NOT_AUTOMATIC_APPROVAL',testOnly,rows,summaries,estimatedCostUSD:estimatedCost,costLimitations:'Token-rate estimate; cache discounts, regional pricing, tax and actual invoices may differ. Post-response budget stop can overshoot one request; enforce provider account spend limits.'};
}
