import {readVisualEvidence,readModelPhotoNotes} from './visualEvidence.mjs';
// One paid request, no retry. Budgets include evidence for all provided sides.
export const VISION_MODEL='claude-sonnet-4-6';
export const VISION_JSON_MAX_BYTES=32768;
export function visionOutputBudget(hasBack){return hasBack?4800:3200;}
export function parseVisionMessage(message){
 // A closed object at the cap is still a capped response, never accepted.
 if(message?.stop_reason==='max_tokens')throw Error('ANALYSIS_RESPONSE_INCOMPLETE');
 if(message?.stop_reason!=='end_turn')throw Error('ANALYSIS_RESPONSE_INVALID');
 const text=(Array.isArray(message?.content)?message.content:[]).filter(b=>b?.type==='text').map(b=>b.text).join('').trim();
 if(!text)throw Error('ANALYSIS_EMPTY_RESPONSE');
 if(Buffer.byteLength(text,'utf8')>VISION_JSON_MAX_BYTES)throw Error('ANALYSIS_RESPONSE_INVALID');
 let parsed;try{parsed=JSON.parse(text);}catch{throw Error('ANALYSIS_RESPONSE_INVALID');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('ANALYSIS_RESPONSE_INVALID');
 return parsed;
}

// Add observation metadata without applying Pokémon number parsing or changing
// the existing sports condition/identity decisions.
export function retainSportsVisionEvidence(raw,inspectedSides){
 const fields=['subject','cardNumber','setCode','language','rarityMark'],areas=['name','collector_line','set_mark','rarity_mark','body_text'];
 const identityReadings=(Array.isArray(raw.identityReadings)?raw.identityReadings:[]).slice(0,24).filter(r=>r&&fields.includes(r.field)&&areas.includes(r.area)&&inspectedSides.includes(r.side)&&['clear','uncertain','unreadable'].includes(r.certainty)&&typeof r.text==='string'&&r.text.length<=80).map(r=>({field:r.field,text:r.text,certainty:r.certainty,side:r.side,area:r.area,alternatives:(Array.isArray(r.alternatives)?r.alternatives:[]).filter(v=>typeof v==='string'&&v.length<=80).slice(0,3)}));
 return {inspectedSides:[...inspectedSides],identityReadings,visualObservations:readVisualEvidence({...raw,inspectedSides}).findings,modelPhotoNotes:readModelPhotoNotes({...raw,inspectedSides})};
}
