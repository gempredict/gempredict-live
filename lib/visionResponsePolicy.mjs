import {SPORTS_READING_FIELDS,sportsIdentityEvidence} from './sportsIdentityEvidence.mjs';
import {validateIdentityObject,IDENTITY_STRING_FIELDS} from './identityValidation.mjs';
import {readVisualEvidence,readModelPhotoNotes} from './visualEvidence.mjs';
// One paid request, no retry. Budgets include evidence for all provided sides.
export const VISION_MODEL='claude-sonnet-4-6';
export const VISION_JSON_MAX_BYTES=32768;
export function visionOutputBudget(hasBack){return hasBack?4800:3200;}
const stopReasons=['end_turn','max_tokens','refusal','stop_sequence','tool_use','pause_turn','model_context_window_exceeded'];
const phases=['completion','json','schema','normalization','request'];
const rules=['stop_reason','output_limit','content_shape','empty_output','byte_limit','json_syntax','top_level_object','normalization_failed','structured_contract','request_rejected','transport_invalid'];
const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000?v:null;
export function safeVisionValidation(value){
 if(!phases.includes(value?.phase)||!rules.includes(value?.rule))return null;
 return {version:1,phase:value.phase,rule:value.rule,...(Number.isInteger(value.count)&&value.count>=0?{count:Math.min(value.count,VISION_JSON_MAX_BYTES+1)}:{})};
}
export function safeVisionCompletion(message,{maxOutputTokens=null,mechanism='prompt_json'}={}){
 const content=Array.isArray(message?.content)?message.content:[],known=['text','tool_use','thinking','redacted_thinking','server_tool_use','web_search_tool_result'];
 const blockTypes={};for(const b of content.slice(0,32)){const type=known.includes(b?.type)?b.type:'other';blockTypes[type]=(blockTypes[type]||0)+1;}
 const bytes=content.reduce((n,b)=>Math.min(VISION_JSON_MAX_BYTES+1,n+(b?.type==='text'&&typeof b.text==='string'?Buffer.byteLength(b.text,'utf8'):0)),0);
 return {mechanism:mechanism==='json_schema'?'json_schema':'prompt_json',...(mechanism==='json_schema'?{schemaVersion:1}:{}),stopReason:stopReasons.includes(message?.stop_reason)?message.stop_reason:'unknown',messageShape:!!message&&typeof message==='object'&&!Array.isArray(message)&&Array.isArray(message.content),contentBlocks:Math.min(content.length,32),contentBlocksTruncated:content.length>32,blockTypes,textUtf8Bytes:bytes,jsonMaxBytes:VISION_JSON_MAX_BYTES,maxOutputTokens:integer(maxOutputTokens),usage:{inputTokens:integer(message?.usage?.input_tokens),outputTokens:integer(message?.usage?.output_tokens)}};
}
export function parseVisionMessage(message){
 const fail=(phase,rule,code='ANALYSIS_RESPONSE_INVALID',count)=>{const error=Error(code);error.visionValidation=safeVisionValidation({phase,rule,count});throw error;};
 // A closed object at the cap is still capped and must never be accepted.
 if(message?.stop_reason==='max_tokens')fail('completion','output_limit','ANALYSIS_RESPONSE_INCOMPLETE');
 if(message?.stop_reason!=='end_turn')fail('completion','stop_reason');
 if(!message||typeof message!=='object'||Array.isArray(message)||!Array.isArray(message.content)||message.content.length>32||message.content.some(b=>b?.type!=='text'||typeof b.text!=='string'))fail('completion','content_shape');
 const text=message.content.map(b=>b.text).join('').trim();
 if(!text)fail('completion','empty_output','ANALYSIS_EMPTY_RESPONSE');
 const bytes=Buffer.byteLength(text,'utf8');if(bytes>VISION_JSON_MAX_BYTES)fail('json','byte_limit','ANALYSIS_RESPONSE_INVALID',bytes);
 let parsed;try{parsed=JSON.parse(text);}catch{fail('json','json_syntax');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('schema','top_level_object');
 return parsed;
}

// Add observation metadata without applying Pokémon number parsing or changing
// the existing sports condition/identity decisions.
export function retainSportsVisionEvidence(raw,inspectedSides,{extended=false}={}){
 const fields=['subject','cardNumber','setCode','language','rarityMark',...(extended?['copyrightYear',...SPORTS_READING_FIELDS]:[])],areas=['name','collector_line','set_mark','rarity_mark','body_text'];
 const identityReadings=[],indices=new Map();
 for(const [index,r]of (Array.isArray(raw.identityReadings)?raw.identityReadings:[]).slice(0,extended?12:24).entries()){
  if(!r||!fields.includes(r.field)||!areas.includes(r.area)||!inspectedSides.includes(r.side)||!['clear','uncertain','unreadable'].includes(r.certainty)||typeof r.text!=='string'||r.text.length>80||r.certainty!=='unreadable'&&!r.text.trim())continue;
  indices.set(index,identityReadings.length);identityReadings.push({field:r.field,text:r.text,certainty:r.certainty,side:r.side,area:r.area,alternatives:(Array.isArray(r.alternatives)?r.alternatives:[]).filter(v=>typeof v==='string'&&v.length<=80).slice(0,3)});
 }
 const result={inspectedSides:[...inspectedSides],identityReadings,visualObservations:readVisualEvidence({...raw,inspectedSides}).findings,modelPhotoNotes:readModelPhotoNotes({...raw,inspectedSides})};
 if(!extended)return result;
 const text=(v,max=80)=>typeof v==='string'&&v.trim()&&v.length<=max?v:null;
 let sportsIdentity=null;const d=raw.sportsIdentity;
 if(d?.version===1&&Array.isArray(d.subjects)&&d.subjects.length<=4){
  const candidate={version:1,subjects:d.subjects.map(s=>({name:s?.name,certainty:s?.certainty,readingIndices:Array.isArray(s?.readingIndices)&&s.readingIndices.length<=12&&s.readingIndices.every(i=>Number.isInteger(i)&&indices.has(i))?s.readingIndices.map(i=>indices.get(i)):[]})),
   ...Object.fromEntries(['subset','printedTitle','serialNumber','foilTreatment'].map(k=>[k,text(d[k])])),serialReadingIndex:Number.isInteger(d.serialReadingIndex)&&indices.has(d.serialReadingIndex)?indices.get(d.serialReadingIndex):null};
  // Reuse the existing sports detail validator, without requiring legacy Full
  // Analysis to adopt the identification-only action or a provider schema.
  try{validateIdentityObject({...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identityConfidence:null,identityReadings,sportsIdentity:candidate},inspectedSides,'sports');sportsIdentity=candidate;}catch{ /* Invalid optional details remain unavailable, never verified. */ }
 }
 const confidence=typeof raw.identityConfidence==='number'&&Number.isFinite(raw.identityConfidence)&&raw.identityConfidence>=0&&raw.identityConfidence<=100?raw.identityConfidence:null;
 const originalIdentityObservation=structuredClone({...Object.fromEntries([...IDENTITY_STRING_FIELDS,'identifiedSport','identifiedTeam','identifiedSerialNumber'].map(k=>[k,text(raw[k],k==='identityNotes'?240:80)])),identityConfidence:confidence,identityReadings,sportsIdentity});
 return {...result,sportsIdentity,originalIdentityObservation,sportsIdentityEvidence:sportsIdentityEvidence(originalIdentityObservation),identityConfidence:confidence};
}

// Fixed vocabulary only. Never retain SDK message, headers, IDs, body or details.
// HTTP status is upstream evidence, not GemPredict's response status.
export function safeVisionProviderFailure(error){
 const body=error?.error?.error??error?.error;
 const types=['invalid_request_error','authentication_error','permission_error','billing_error','not_found_error','rate_limit_error','timeout_error','api_error','overloaded_error'];
 const codes=['request_body_encoding_invalid','request_body_encoding_unsupported','request_body_too_large_after_decoding','enforced_spend_limit_reached','organization_on_hold'];
 const status=Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:null;
 const type=error?.type??body?.type,code=error?.errorCode??body?.details?.error_code;
 const provided=error?.apiMessage??body?.message,text=typeof provided==='string'?provided.slice(0,4096):'';
 const recognizedCode=codes.includes(code)?code:null;
 return {version:1,upstreamHttpStatus:status,providerErrorType:types.includes(type)?type:null,providerErrorCode:recognizedCode,
  requestContractReason:recognizedCode||([400,422].includes(status)&&/schema is too complex for compilation/i.test(text)?'schema_complexity_message_hint':'not_identified'),
  reasonBasis:recognizedCode?'provider_error_code':[400,422].includes(status)&&/schema is too complex for compilation/i.test(text)?'recognized_message_hint':'not_established'};
}
