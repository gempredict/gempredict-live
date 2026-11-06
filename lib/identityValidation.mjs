// Shared server/client vocabulary. Never copies model values, unknown keys or
// parser exception text into errors, responses, logs or diagnostic exports.
export const IDENTITY_STRING_FIELDS=['identifiedSubject','identifiedYear','identifiedBrandSet','identifiedCardNumber','identifiedLanguage','identifiedParallel','identifiedRarity','identifiedFranchise','identifiedManufacturer','identifiedAutoOrRelic','identityNotes'];
const readingKeys=['field','text','certainty','side','area','alternatives'];
const rootKeys=[...IDENTITY_STRING_FIELDS,'identityConfidence','identityReadings'];
const rules=['request_rejected','refusal','message_shape','content_shape','json_transport','stop_reason','output_limit','empty_output','byte_limit','json_syntax','top_level_object','unexpected_fields','required_missing','wrong_type','length_limit','year_format','confidence_range','invalid_enum','unexpected_photo_side','empty_reading'];
const phases=['completion','json','schema','transport','request'];
const types=['missing','null','array','object','string','number','boolean'];
export const identityType=v=>v===undefined?'missing':v===null?'null':Array.isArray(v)?'array':typeof v==='object'?'object':typeof v;
export function safeIdentityValidation(value){
 if(!value||!phases.includes(value.phase)||!rules.includes(value.rule))return null;
 const path=typeof value.path==='string'&&(value.path==='$'||rootKeys.includes(value.path)||/^identityReadings\/(?:[0-9]|1[01])(?:\/(?:field|text|certainty|side|area|alternatives))?$/.test(value.path))?value.path:'$';
 return {version:1,phase:value.phase,rule:value.rule,path,...(types.includes(value.actualType)?{actualType:value.actualType}:{}),...(Number.isInteger(value.count)&&value.count>=0?{count:Math.min(value.count,32769)}:{})};
}
export function failIdentityValidation(phase,rule,path='$',value,extra={}){
 const error=Error(rule==='request_rejected'?'ANALYSIS_PROVIDER_REQUEST_REJECTED':rule==='refusal'?'ANALYSIS_PROVIDER_REFUSED':phase==='transport'?'ANALYSIS_TRANSPORT_INVALID':rule==='output_limit'?'ANALYSIS_RESPONSE_INCOMPLETE':rule==='empty_output'?'ANALYSIS_EMPTY_RESPONSE':'ANALYSIS_RESPONSE_INVALID');
 error.identityValidation=safeIdentityValidation({phase,rule,path,actualType:identityType(value),...extra});throw error;
}
export function validateIdentityObject(raw,sides){
 const fail=(rule,path,value,extra)=>failIdentityValidation('schema',rule,path,value,extra);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('top_level_object','$',raw);
 const unknown=Object.keys(raw).filter(k=>!rootKeys.includes(k));if(unknown.length)fail('unexpected_fields','$',raw,{count:unknown.length});
 for(const k of rootKeys)if(!Object.hasOwn(raw,k))fail('required_missing',k,undefined);
 for(const k of IDENTITY_STRING_FIELDS){if(raw[k]!==null&&typeof raw[k]!=='string')fail('wrong_type',k,raw[k]);if(typeof raw[k]==='string'&&raw[k].length>(k==='identityNotes'?240:80))fail('length_limit',k,raw[k]);}
 if(raw.identifiedYear!==null&&!/^(?:19|20)\d{2}$/.test(raw.identifiedYear))fail('year_format','identifiedYear',raw.identifiedYear);
 if(raw.identityConfidence!==null&&typeof raw.identityConfidence!=='number')fail('wrong_type','identityConfidence',raw.identityConfidence);
 if(raw.identityConfidence!==null&&(!Number.isFinite(raw.identityConfidence)||raw.identityConfidence<0||raw.identityConfidence>100))fail('confidence_range','identityConfidence',raw.identityConfidence);
 if(!Array.isArray(raw.identityReadings))fail('wrong_type','identityReadings',raw.identityReadings);
 if(raw.identityReadings.length>12)fail('length_limit','identityReadings',raw.identityReadings,{count:raw.identityReadings.length});
 for(const [i,r] of raw.identityReadings.entries()){
  const p='identityReadings/'+i;
  if(!r||typeof r!=='object'||Array.isArray(r))fail('wrong_type',p,r);
  const extras=Object.keys(r).filter(k=>!readingKeys.includes(k));if(extras.length)fail('unexpected_fields',p,r,{count:extras.length});
  for(const k of readingKeys)if(!Object.hasOwn(r,k))fail('required_missing',p+'/'+k,undefined);
  for(const [k,allowed] of [['field',['subject','cardNumber','setCode','language','rarityMark','copyrightYear']],['certainty',['clear','uncertain','unreadable']],['area',['name','collector_line','set_mark','rarity_mark','body_text']]])if(!allowed.includes(r[k]))fail('invalid_enum',p+'/'+k,r[k]);
  if(!sides.includes(r.side))fail('unexpected_photo_side',p+'/side',r.side);
  if(typeof r.text!=='string')fail('wrong_type',p+'/text',r.text);
  if(r.text.length>80)fail('length_limit',p+'/text',r.text);
  if(r.certainty!=='unreadable'&&!r.text.trim())fail('empty_reading',p+'/text',r.text);
  if(!Array.isArray(r.alternatives))fail('wrong_type',p+'/alternatives',r.alternatives);
  if(r.alternatives.length>3)fail('length_limit',p+'/alternatives',r.alternatives,{count:r.alternatives.length});
  for(const a of r.alternatives){if(typeof a!=='string')fail('wrong_type',p+'/alternatives',a);if(a.length>80)fail('length_limit',p+'/alternatives',a);}
 }
 return raw;
}
export function identityValidationMessage(value){
 const v=safeIdentityValidation(value);if(!v)return '';
 const labels={identifiedSubject:'card name',identifiedYear:'proposed release year',identifiedBrandSet:'proposed set',identifiedCardNumber:'collector number',identifiedLanguage:'language',identifiedParallel:'printing observation',identifiedRarity:'rarity observation',identifiedFranchise:'franchise',identifiedManufacturer:'manufacturer',identifiedAutoOrRelic:'autograph/relic observation',identityNotes:'uncertainty notes',identityConfidence:'model confidence',identityReadings:'printed readings'};
 const part=v.path.split('/'),field=labels[part[0]]||'response';const location=part.length>1?' (reading '+(Number(part[1])+1)+(part[2]?', '+part[2]:'')+')':'';
 const reasons={request_rejected:'request was rejected by the provider before a usable response was returned',refusal:'was declined by the analysis provider',message_shape:'has an invalid provider-message envelope',content_shape:'contains an unsupported provider content structure',json_transport:'was not a valid JSON transport response',required_missing:'is missing',wrong_type:'has the wrong JSON type',length_limit:'exceeds its allowed length or count',year_format:'must be a four-digit string or null',confidence_range:'must be between 0 and 100 or null',invalid_enum:'contains an unsupported label',unexpected_photo_side:'refers to a photograph that was not supplied',empty_reading:'contains an empty reading',unexpected_fields:'contains unexpected fields',json_syntax:'is not complete valid JSON',top_level_object:'must be a JSON object',stop_reason:'did not finish normally',output_limit:'reached its output limit',empty_output:'contains no text',byte_limit:'exceeds the response size limit'};
 return 'Identity response: '+field+location+' '+reasons[v.rule]+'. No identity was accepted; this is not an upload failure.';
}
