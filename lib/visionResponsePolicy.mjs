import {readVisualEvidence,readModelPhotoNotes} from './visualEvidence.mjs';
// One paid request, no retry. Budgets include evidence for all provided sides.
export const VISION_MODEL='claude-sonnet-4-6';
export const VISION_JSON_MAX_BYTES=32768;
export function visionOutputBudget(hasBack){return hasBack?4800:3200;}
const stopReasons=['end_turn','max_tokens','refusal','stop_sequence','tool_use','pause_turn','model_context_window_exceeded'];
const phases=['completion','json','schema','normalization'];
const rules=['stop_reason','output_limit','content_shape','empty_output','byte_limit','json_syntax','top_level_object','normalization_failed'];
const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000?v:null;
export function safeVisionValidation(value){
 if(!phases.includes(value?.phase)||!rules.includes(value?.rule))return null;
 return {version:1,phase:value.phase,rule:value.rule,...(Number.isInteger(value.count)&&value.count>=0?{count:Math.min(value.count,VISION_JSON_MAX_BYTES+1)}:{})};
}
export function safeVisionCompletion(message,{maxOutputTokens=null}={}){
 const content=Array.isArray(message?.content)?message.content:[],known=['text','tool_use','thinking','redacted_thinking','server_tool_use','web_search_tool_result'];
 const blockTypes={};for(const b of content.slice(0,32)){const type=known.includes(b?.type)?b.type:'other';blockTypes[type]=(blockTypes[type]||0)+1;}
 const bytes=content.reduce((n,b)=>Math.min(VISION_JSON_MAX_BYTES+1,n+(b?.type==='text'&&typeof b.text==='string'?Buffer.byteLength(b.text,'utf8'):0)),0);
 return {mechanism:'prompt_json',stopReason:stopReasons.includes(message?.stop_reason)?message.stop_reason:'unknown',messageShape:!!message&&typeof message==='object'&&!Array.isArray(message)&&Array.isArray(message.content),contentBlocks:Math.min(content.length,32),contentBlocksTruncated:content.length>32,blockTypes,textUtf8Bytes:bytes,jsonMaxBytes:VISION_JSON_MAX_BYTES,maxOutputTokens:integer(maxOutputTokens),usage:{inputTokens:integer(message?.usage?.input_tokens),outputTokens:integer(message?.usage?.output_tokens)}};
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
export function retainSportsVisionEvidence(raw,inspectedSides){
 const fields=['subject','cardNumber','setCode','language','rarityMark'],areas=['name','collector_line','set_mark','rarity_mark','body_text'];
 const identityReadings=(Array.isArray(raw.identityReadings)?raw.identityReadings:[]).slice(0,24).filter(r=>r&&fields.includes(r.field)&&areas.includes(r.area)&&inspectedSides.includes(r.side)&&['clear','uncertain','unreadable'].includes(r.certainty)&&typeof r.text==='string'&&r.text.length<=80).map(r=>({field:r.field,text:r.text,certainty:r.certainty,side:r.side,area:r.area,alternatives:(Array.isArray(r.alternatives)?r.alternatives:[]).filter(v=>typeof v==='string'&&v.length<=80).slice(0,3)}));
 return {inspectedSides:[...inspectedSides],identityReadings,visualObservations:readVisualEvidence({...raw,inspectedSides}).findings,modelPhotoNotes:readModelPhotoNotes({...raw,inspectedSides})};
}
