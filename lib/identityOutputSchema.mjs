import {IDENTITY_STRING_FIELDS} from './identityValidation.mjs';
// Direct Messages API JSON outputs; no tools, beta headers or helper retries.
// The API does not support maxItems/maxLength/numeric bounds: descriptions guide
// generation, and the unchanged strict local validator enforces those limits.
export function identityOutputFormat(hasBack){
 const properties=Object.fromEntries(IDENTITY_STRING_FIELDS.map(key=>[key,{type:['string','null'],description:key==='identityNotes'?'Brief uncertainty only; at most 240 characters; null if unknown.':key==='identifiedYear'?'Proposed release year as a four-digit string, or null; copyright is not release-year proof.':'At most 80 characters; null when unknown or not visually supported.'}]));
 properties.identityConfidence={type:['number','null'],description:'Self-reported proposal confidence, 0 through 100, or null. Not independent verification.'};
 properties.identityReadings={type:'array',description:'At most 12 printed readings from supplied photographs; [] if unreadable. Never invent readings.',items:{type:'object',properties:{
  field:{type:'string',enum:['subject','cardNumber','setCode','language','rarityMark','copyrightYear']},
  text:{type:'string',description:'Verbatim printed text, at most 80 characters. Preserve complete collector identifiers, denominators, prefixes and uncertainty.'},
  certainty:{type:'string',enum:['clear','uncertain','unreadable']},
  side:{type:'string',enum:hasBack?['front','back']:['front']},
  area:{type:'string',enum:['name','collector_line','set_mark','rarity_mark','body_text']},
  alternatives:{type:'array',description:'At most 3 alternative readings; each at most 80 characters; [] when none.',items:{type:'string'}},
 },required:['field','text','certainty','side','area','alternatives'],additionalProperties:false}};
 return {type:'json_schema',schema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}};
}
