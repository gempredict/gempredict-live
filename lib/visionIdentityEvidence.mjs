import { catalogNameKey, catalogLanguageKey } from './catalogNormalization.mjs';
// Printed text readings are image evidence proposals, never catalog authority.
const allowed = new Set(['subject','cardNumber','setCode','language','rarityMark']);
const clean = value => typeof value === 'string' ? value.trim().slice(0,80) : '';
export function readIdentityReadings(value) {
 if (!Array.isArray(value)) return [];
 return value.slice(0,12).flatMap(item => {
  if (!item || !allowed.has(item.field) || !['clear','uncertain','unreadable'].includes(item.certainty) || !['front','back'].includes(item.side) || !['name','collector_line','set_mark','rarity_mark','body_text'].includes(item.area)) return [];
  const text=clean(item.text);
  if(item.certainty!=='unreadable'&&!text)return [];
  const alternatives=Array.isArray(item.alternatives)?[...new Set(item.alternatives.map(clean).filter(Boolean))].slice(0,3):[];
  if(item.field==='cardNumber'&&[text,...alternatives].filter(Boolean).some(v=>!/^\d{1,4}(?:\/\d{1,4})?$/.test(v)))return [];
  return [{field:item.field,text,certainty:item.certainty,side:item.side,area:item.area,alternatives}];
 });
}
export function clearIdentityReading(readings, field) {
 const values=[...new Set(readIdentityReadings(readings).filter(r=>r.field===field&&r.certainty==='clear').map(r=>r.text))];
 return values.length===1?values[0]:null;
}
export function catalogInvestigation(card, {readings=[],numberProtected=false,enabled=false}={}) {
 if(!enabled||numberProtected)return null;
 const normalized=readIdentityReadings(readings), numbers=normalized.filter(r=>r.field==='cardNumber'&&r.certainty!=='unreadable');
 const clearSubjects=[...new Set(normalized.filter(r=>r.field==='subject'&&r.certainty==='clear').map(r=>catalogNameKey(r.text)))];
 const clearLanguages=[...new Set(normalized.filter(r=>r.field==='language'&&r.certainty==='clear').map(r=>catalogLanguageKey(r.text)))];
 const clearLocals=[...new Set(numbers.filter(r=>r.certainty==='clear').map(r=>r.text.split('/')[0]))];
 if(clearSubjects.length>1||clearLanguages.length>1||clearLocals.length>1)return {blocked:true,reason:'contradictory_clear_printed_readings',queries:[]};
 const clear=[...new Set(numbers.filter(r=>r.certainty==='clear'&&r.text.includes('/')).map(r=>r.text))];
 if(clear.length>1)return {blocked:true,reason:'contradictory_clear_collector_readings',queries:[]};
 const clearSubject=clearIdentityReading(normalized,'subject');
 const subjects=clearSubject?[clearSubject]:[...new Set([...normalized.filter(r=>r.field==='subject'&&r.certainty!=='unreadable').flatMap(r=>[r.text,...r.alternatives]),card?.subject].filter(Boolean))];
 const full=clear.length?clear:numbers.flatMap(r=>[r.text,...r.alternatives]).filter(Boolean);
 const candidates=[...new Set(full.length?full:[String(card?.cardNumber||'').split('/')[0]])].filter(v=>/^\d{1,4}(?:\/\d{1,4})?$/.test(v));
 const queries=subjects.flatMap(subject=>candidates.map(cardNumber=>({subject,cardNumber})));
 if(subjects.length>2||candidates.length>3||queries.length>4)return {blocked:true,reason:'candidate_combination_limit',queries:[]};
 const setCodes=[...new Set(normalized.filter(r=>r.field==='setCode'&&r.certainty==='clear').map(r=>r.text))];
 if(setCodes.length>1)return {blocked:true,reason:'contradictory_clear_set_codes',queries:[]};
 return {queries,language:clearIdentityReading(normalized,'language'),setCode:setCodes[0]||null,clearNumber:clear[0]||null,requiresNumberConfirmation:!clear.length,reason:clear.length?'printed_number_constraint':full.length?'uncertain_printed_number_candidates':'unverified_proposal_local_number_discovery'};
}
