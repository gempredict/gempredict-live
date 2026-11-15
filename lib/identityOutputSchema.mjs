import {SPORTS_READING_FIELDS} from './sportsIdentityEvidence.mjs';
import {IDENTITY_STRING_FIELDS} from './identityValidation.mjs';
// Direct Messages API JSON outputs; no tools, beta headers or helper retries.
// The API does not support maxItems/maxLength/numeric bounds: descriptions guide
// generation, and the unchanged strict local validator enforces those limits.
export function identityOutputFormat(hasBack,category){
 const properties=Object.fromEntries(IDENTITY_STRING_FIELDS.map(key=>[key,{type:['string','null'],description:key==='identityNotes'?'Brief uncertainty only; at most 240 characters; null if unknown.':key==='identifiedYear'?'Proposed release year as a four-digit string, or null; copyright is not release-year proof.':'At most 80 characters; null when unknown or not visually supported.'}]));
 properties.identityConfidence={type:['number','null'],description:'Self-reported proposal confidence, 0 through 100, or null. Not independent verification.'};
 properties.identityReadings={type:'array',description:'At most 12 printed readings from supplied photographs; [] if unreadable. Never invent readings.',items:{type:'object',properties:{
  field:{type:'string',enum:['subject','cardNumber','setCode','language','rarityMark','copyrightYear',...(category==='sports'?SPORTS_READING_FIELDS:[])]},
  text:{type:'string',description:'Verbatim printed text, at most 80 characters. Preserve complete collector identifiers, denominators, prefixes and uncertainty.'},
  certainty:{type:'string',enum:['clear','uncertain','unreadable']},
  side:{type:'string',enum:hasBack?['front','back']:['front']},
  area:{type:'string',enum:['name','collector_line','set_mark','rarity_mark','body_text']},
  alternatives:{type:'array',description:'At most 3 alternative readings; each at most 80 characters; [] when none.',items:{type:'string'}},
 },required:['field','text','certainty','side','area','alternatives'],additionalProperties:false}};
 if(category==='sports'){
  const details={version:{type:'integer',enum:[1]},subjects:{type:'array',description:'At most four distinct depicted athletes. Separate each full printed name; [] if unresolved. No teams or biographical mentions.',items:{type:'object',properties:{name:{type:'string',description:'Full name, at most 80 characters.'},certainty:{type:'string',enum:['clear','uncertain','unreadable']},readingIndices:{type:'array',description:'At most 12 zero-based indices of subject readings for this athlete. Names must agree exactly; no guessed aliases.',items:{type:'integer'}}},required:['name','certainty','readingIndices'],additionalProperties:false}},
   subset:{type:['string','null'],description:'Observed subset, at most 80 characters; distinct from main product and printed title.'},printedTitle:{type:['string','null'],description:'Printed headline/title, at most 80 characters; not a person name.'},
   serialNumber:{type:['string','null'],description:'Literal stamped copy serial numerator/denominator, at most 80 characters; not collector number or rarity.'},serialReadingIndex:{type:['integer','null'],description:'Zero-based serialNumber reading index; null if unavailable.'},foilTreatment:{type:['string','null'],description:'Visually supported color/foil only, at most 80 characters; null if unknown. Does not identify an exact parallel.'}};
  properties.sportsIdentity={type:['object','null'],properties:details,required:Object.keys(details),additionalProperties:false,description:'Sports-only observations, version 1. Unknown object may be null. Never independent verification.'};
 }
 return {type:'json_schema',schema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}};
}
