import {identityOutputFormat} from './identityOutputSchema.mjs';
import {validateIdentityObject,IDENTITY_STRING_FIELDS} from './identityValidation.mjs';
import {parseVisionMessage} from './visionResponsePolicy.mjs';
import {diagnosticSession} from './scanDiagnosticsAuth.mjs';
export const FULL_ANALYSIS_SCHEMA_VERSION=1;
const attributes=['centering','corners','edges','surface'];
const limitations=['glare','blur','sleeve','back_not_visible','limited_resolution','perspective','cropped','occluded'];
const codes={centering:['off_center','miscut'],corners:['whitening','softening','bend','crease'],edges:['whitening','chipping','wear','peeling'],surface:['scratches','print_lines','dent','crease','bend','staining']};
const cues=['border_width_difference','truncated_print_border','localized_color_loss','rounded_corner_outline','surface_deformation','missing_edge_fragment','lifted_layer','surface_line','printed_line','surface_depression','color_patch','clear_inspected_area'];
const enumeration=values=>({type:'string',enum:values});
const object=(properties,optional=[])=>({type:'object',properties,required:Object.keys(properties).filter(k=>!optional.includes(k)),additionalProperties:false});
const array=(items,max)=>({type:'array',items,description:`At most ${max} items; [] when unsupported.`,maxItems:max});
const region=()=>({...array({type:'number',minimum:0,maximum:1},4),minItems:4});
// Rich local schema. Only the API-supported subset is sent; bounds remain local.
export function fullAnalysisSchema(hasBack,category){
 if(!['pokemon','sports'].includes(category))throw Error('unsupported_full_analysis_category');
 const base=identityOutputFormat(hasBack,category).schema;
 const sides=hasBack?['front','back']:['front'];
 const properties={schemaVersion:{type:'integer',enum:[1]},...base.properties};
 if(category==='sports'){
  for(const k of ['identifiedSport','identifiedTeam','identifiedSerialNumber'])properties[k]={type:['string','null'],maxLength:80};
  const d=properties.sportsIdentity;d.type='object';
  const optional=['subset','printedTitle','serialNumber','serialReadingIndex','foilTreatment'];
  for(const k of optional)d.properties[k].type=k==='serialReadingIndex'?'integer':'string';
  d.required=d.required.filter(k=>!optional.includes(k));
 }
 const evidence=object({side:enumeration(sides),region:region(),cue:enumeration(cues),confidence:{type:'number',minimum:0,maximum:1},measurement:object({axis:enumeration(['horizontal','vertical']),ratio:{...array({type:'number',minimum:0,maximum:100},2),minItems:2}})},['measurement']);
 properties.visualObservations=array(object({attribute:enumeration(attributes),code:enumeration([...new Set(Object.values(codes).flat()),'no_defect_observed']),certainty:enumeration(['confirmed','suspected','unassessable']),evidence},['evidence']),hasBack?16:8);
 properties.inspectionCoverage=array(object({attribute:enumeration(attributes),side:enumeration(sides),regions:array(object({region:region(),status:enumeration(['inspected','partial','unassessable'])}),4),limitations:array(object({code:enumeration(limitations),region:region()},['region']),4)}),8);
 properties.imageLimitations=array(enumeration(limitations),8);
 properties.photoNotes=array(object({attribute:enumeration(attributes),side:enumeration(sides),text:{type:'string',maxLength:80}},['side']),4);
 return object(properties,category==='sports'?['sportsIdentity']:[]);
}
export function fullAnalysisOutputFormat(hasBack,category){
 const simplify=value=>Array.isArray(value)?value.map(simplify):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['maxLength','minimum','maximum','maxItems','minItems'].includes(k)).map(([k,v])=>[k,simplify(v)])):value;
 return {type:'json_schema',schema:simplify(fullAnalysisSchema(hasBack,category))};
}
function fail(){const error=Error('ANALYSIS_RESPONSE_INVALID');error.visionValidation={version:1,phase:'schema',rule:'structured_contract'};throw error;}
function validate(value,schema){
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 if(!types.some(t=>t===type||t==='integer'&&Number.isSafeInteger(value)))fail();
 if(typeof value==='number'&&(!Number.isFinite(value)||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))fail();
 if(schema.enum&&!schema.enum.includes(value))fail();
 if(typeof value==='string'&&value.length>(schema.maxLength??240))fail();
 if(value===null)return;
 if(type==='object'){
  if(Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))||schema.required.some(k=>!Object.hasOwn(value,k)))fail();
  for(const [k,v]of Object.entries(value))validate(v,schema.properties[k]);
 }
 if(type==='array'){
  if(value.length>(schema.maxItems??12)||value.length<(schema.minItems??0))fail();
  for(const v of value)validate(v,schema.items);
 }
}
export function adaptFullAnalysis(raw,sides,category){
 validate(raw,fullAnalysisSchema(sides.includes('back'),category));
 const identity=Object.fromEntries([...IDENTITY_STRING_FIELDS,'identityConfidence','identityReadings'].map(k=>[k,raw[k]]));
 if(category==='sports'&&raw.sportsIdentity){const d=raw.sportsIdentity;identity.sportsIdentity={...d,...Object.fromEntries(['subset','printedTitle','serialNumber','serialReadingIndex','foilTreatment'].map(k=>[k,d[k]??null]))};}
 try{validateIdentityObject(identity,sides,category);}catch{fail();}
 const validRegion=r=>r[2]>0&&r[3]>0&&r[0]+r[2]<=1.001&&r[1]+r[3]<=1.001;
 for(const row of raw.visualObservations){
  if(![...codes[row.attribute],'no_defect_observed'].includes(row.code))fail();
  if(row.evidence&&!validRegion(row.evidence.region))fail();
 }
 for(const row of raw.inspectionCoverage)if(row.regions.some(r=>!validRegion(r.region))||row.limitations.some(l=>l.region&&!validRegion(l.region)))fail();
 // Absent optional evidence stays absent; never create defect boxes or observations.
 const {schemaVersion,...adapted}=structuredClone(raw);
 return {...adapted,...identity,inspectionCoverage:adapted.inspectionCoverage.map(r=>({...r,limitations:r.limitations.map(l=>({...l,region:l.region??null}))}))};
}
export function parseFullAnalysisMessage(message,sides,category){return adaptFullAnalysis(parseVisionMessage(message),sides,category);}
// Only called after the existing server has verified the immutable controlled pair.
// No browser flag/query/header can enable this. Deployment configuration stays OFF.
export function fullAnalysisStructuredEnabled(req,controlled,category,env=process.env){
 return env.GEMPREDICT_PREVIEW_FULL_STRUCTURED_OUTPUT_ENABLED==='true'&&!!controlled&&['pokemon','sports'].includes(category)&&!!diagnosticSession(req,env);
}
export const fullAnalysisStructuredGuidance=' Use schemaVersion 1. Schema identity proposals are unverified. Omit optional unsupported sports details, evidence, measurements and note sides. Unknown nullable identity fields stay null; observation arrays may be empty. Sports subjects are distinct depicted athletes with exact subject-reading indices; preserve subset, printedTitle, stamped serialNumber and foilTreatment separately. Sports readings may additionally use serialNumber, subset, printedTitle and foilMark. No invented readings, coordinates, grades, valuations or probabilities.';
