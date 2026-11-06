import {isCollectorReading} from './collectorReading.mjs';
import { catalogNameKey, catalogLanguageKey } from './catalogNormalization.mjs';
// Printed text readings are image evidence proposals, never catalog authority.
const allowed = new Set(['subject','cardNumber','setCode','language','rarityMark','copyrightYear']);
const clean = value => typeof value === 'string' ? value.trim().slice(0,80) : '';
export function readIdentityReadings(value) {
 if (!Array.isArray(value)) return [];
 return value.slice(0,12).flatMap(item => {
  if (!item || !allowed.has(item.field) || !['clear','uncertain','unreadable'].includes(item.certainty) || !['front','back'].includes(item.side) || !['name','collector_line','set_mark','rarity_mark','body_text'].includes(item.area)) return [];
  const text=clean(item.text);
  if(item.certainty!=='unreadable'&&!text)return [];
  const alternatives=Array.isArray(item.alternatives)?[...new Set(item.alternatives.map(clean).filter(Boolean))].slice(0,3):[];
  if(item.field==='cardNumber'&&[text,...alternatives].filter(Boolean).some(v=>!isCollectorReading(v)))return [];
  return [{field:item.field,text,certainty:item.certainty,side:item.side,area:item.area,alternatives}];
 });
}
const languageCodes=new Set(['EN','FR','DE','ES','IT','PT','JA','KO','ZH-TW','ID','TH']);
export function parsePrintedSetMark(text){
 const raw=clean(text),combined=raw.toUpperCase().match(/^([A-Z0-9][A-Z0-9.-]{0,11})\s+([A-Z]{2}(?:-[A-Z]{2})?)$/);
 return combined&&languageCodes.has(combined[2])?{raw,code:combined[1],language:combined[2]}:{raw,code:/^[A-Z0-9][A-Z0-9.-]{0,11}$/i.test(raw)?raw.toUpperCase():raw,language:null};
}
export function clearIdentityReading(readings,field){
 const rows=readIdentityReadings(readings).filter(r=>r.certainty==='clear');
 const raw=rows.filter(r=>r.field===field).map(r=>field==='setCode'?parsePrintedSetMark(r.text).code:r.text);
 if(field==='language')raw.push(...rows.filter(r=>r.field==='setCode').map(r=>parsePrintedSetMark(r.text).language).filter(Boolean));
 const values=[...new Map(raw.map(v=>[field==='language'?catalogLanguageKey(v):v,v])).values()];
 return values.length===1?values[0]:null;
}
export function printedIdentityEvidence(analysis){
 const readings=readIdentityReadings(analysis?.identityReadings);
 const copyright=readings.filter(r=>r.field==='copyrightYear').map(r=>{const years=[...new Set(r.text.match(/\b(?:19|20)\d{2}\b/g)||[])];return {...r,years,year:years.length===1?years[0]:null};});
 return {name:readings.filter(r=>r.field==='subject'),collectorNumber:readings.filter(r=>r.field==='cardNumber'),setMarkings:readings.filter(r=>r.field==='setCode'),parsedSetMarkings:readings.filter(r=>r.field==='setCode').map(r=>({...parsePrintedSetMark(r.text),side:r.side,certainty:r.certainty})),languageMarkings:readings.filter(r=>r.field==='language'),copyright,proposedReleaseYear:analysis?.identifiedYear||null,modelConfidence:Number.isFinite(analysis?.identityConfidence)?analysis.identityConfidence:null};
}
export function catalogInvestigation(card, {readings=[],numberProtected=false,enabled=false}={}) {
 if(!enabled)return null;
 const normalized=readIdentityReadings(readings), numbers=normalized.filter(r=>r.field==='cardNumber'&&r.certainty!=='unreadable');
 if(numbers.some(r=>[r.text,...r.alternatives].filter(Boolean).some(v=>!/^\d{1,4}(?:\/\d{1,4})?$/.test(v))))return {blocked:true,reason:'unsupported_printed_collector_format',queries:[]};
 const clearSubjects=[...new Set(normalized.filter(r=>r.field==='subject'&&r.certainty==='clear').map(r=>catalogNameKey(r.text)))];
 const clearLanguages=[...new Set([...normalized.filter(r=>r.field==='language'&&r.certainty==='clear').map(r=>catalogLanguageKey(r.text)),...normalized.filter(r=>r.field==='setCode'&&r.certainty==='clear').map(r=>parsePrintedSetMark(r.text).language).filter(Boolean).map(catalogLanguageKey)])];
 const clearLocals=[...new Set(numbers.filter(r=>r.certainty==='clear').map(r=>r.text.split('/')[0]))];
 if(clearSubjects.length>1||clearLanguages.length>1||clearLocals.length>1)return {blocked:true,reason:'contradictory_clear_printed_readings',queries:[]};
 const clear=[...new Set(numbers.filter(r=>r.certainty==='clear'&&r.text.includes('/')).map(r=>r.text))];
 if(clear.length>1)return {blocked:true,reason:'contradictory_clear_collector_readings',queries:[]};
 const clearSubject=clearIdentityReading(normalized,'subject');
 const subjects=clearSubject?[clearSubject]:[...new Set([...normalized.filter(r=>r.field==='subject'&&r.certainty!=='unreadable').flatMap(r=>[r.text,...r.alternatives]),card?.subject].filter(Boolean))];
 const full=clear.length?clear:numbers.flatMap(r=>[r.text,...r.alternatives]).filter(Boolean);
 const candidates=[...new Set(full.length?full:[String(card?.cardNumber||'').split('/')[0]])].filter(v=>/^\d{1,4}(?:\/\d{1,4})?$/.test(v));
 if(numberProtected&&clear.length&&clear.some(v=>v!==card?.cardNumber))return {blocked:true,reason:'protected_collector_conflict',queries:[]};
 const queries=numberProtected?[{subject:card?.subject,cardNumber:card?.cardNumber}]:subjects.flatMap(subject=>candidates.map(cardNumber=>({subject,cardNumber})));
 if(subjects.length>2||candidates.length>3||queries.length>4)return {blocked:true,reason:'candidate_combination_limit',queries:[]};
 const setCodes=[...new Set(normalized.filter(r=>r.field==='setCode'&&r.certainty==='clear').map(r=>parsePrintedSetMark(r.text).code))];
 if(setCodes.length>1)return {blocked:true,reason:'contradictory_clear_set_codes',queries:[]};
 return {queries,language:clearIdentityReading(normalized,'language'),setCode:setCodes[0]||null,clearNumber:clear[0]||null,requiresNumberConfirmation:!clear.length,reason:clear.length?'printed_number_constraint':full.length?'uncertain_printed_number_candidates':'unverified_proposal_local_number_discovery'};
}
