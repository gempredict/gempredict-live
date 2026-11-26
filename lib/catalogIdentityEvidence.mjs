import { catalogNameKey, catalogLanguageKey, catalogVariantKey } from './catalogNormalization.mjs';
import { sportsSubjectNames } from './sportsIdentityEvidence.mjs';
import { isCollectorReading } from './collectorReading.mjs';
import { describeVariant } from './variantDescriptor.mjs';
import { readIdentityReadings, parsePrintedSetMark } from './visionIdentityEvidence.mjs';
import { sourceCatalogEvidence } from './sourceCatalogEvidence.mjs';

export const CATALOG_IDENTITY_EVIDENCE_VERSION=1;
export const identityClaimLabels=Object.freeze({
 category:'Category',sportGame:'Sport or game',subjects:'Subjects',manufacturer:'Manufacturer or publisher',
 year:'Release year',set:'Product or set',subset:'Subset',number:'Collector number',language:'Language',
 parallel:'Parallel or variation',printing:'Printing class',photoPose:'Photo pose',finish:'Finish',
 foilTreatment:'Foil treatment',printRun:'Numbered print run',serial:'Copy serial',autograph:'Autograph',relic:'Relic',
 setCode:'Printed set marking',copyrightYear:'Copyright marking',stamp:'Stamp',rookie:'Rookie designation',
});
const core=['category','subjects','year','set','number'];
const printingFields=['printing','parallel','photoPose','finish','foilTreatment','printRun','autograph','relic','stamp'];
const list=value=>Array.isArray(value)?value:[];
const categories=['sports','pokemon','mtg','yugioh','dragonball','onepiece','tcg'];
const approvedRecords=new WeakSet();
const clean=(value,max=120)=>typeof value==='string'&&value.trim()&&value.length<=max&&
 !/[\u0000-\u001f\u007f<>@]/.test(value)&&!/(?:https?:|(?:sk-|tca_|AIza)[a-z0-9_-]{12,})/i.test(value)?value.trim():null;
const label=value=>{
 const text=clean(value);
 return text&&!/^(?:unknown|unresolved|n\/?a|not applicable)$/i.test(text)?text:null;
};
const numberKey=value=>String(value||'').trim().replace(/^#\s*/,'').replace(/\s+/g,'').toUpperCase();
const yesNo=value=>value===true||value==='yes'?'yes':value===false||value==='no'?'no':null;
function finishKey(value) {
 const normalized=catalogNameKey(value);
 if(/^(?:normal|non ?holo(?:graphic|foil)?|non ?foil)$/.test(normalized))return 'non-holo';
 if(/^(?:reverse|reverse ?holo(?:graphic|foil)?|reverse ?foil)$/.test(normalized))return 'reverse-holo';
 return /^(?:holo|holofoil|holographic)$/.test(normalized)?'holo':null;
}
const base=value=>/^(?:regular(?: base)?|base|standard|normal)(?: (?:card|rookie|printing|version))?$/i.test(value||'');
function printClass(value) {
 if(!value)return null;
 if(base(value))return 'base';
 if(/\bfactory[- ]+(?:complete[- ]+)?set\b|\bcomplete[- ]+set[- ]+(?:variation|version|exclusive)\b/i.test(value))return 'factory-set';
 if(/\b(?:photo|image|picture)[- ]+variation\b/i.test(value))return 'photo-variation';
 if(/\b(?:short print|ssp)\b/i.test(value))return 'short-print';
 if(/\bpromo(?:tional)?\b/i.test(value))return 'promo';
 if(/\binsert\b/i.test(value))return 'insert';
 return describeVariant(value).kind==='parallel'?'parallel':null;
}
const numeric=value=>Number.isSafeInteger(value)?String(value):clean(value,12);
function normalizeClaims(input) {
 input=input&&typeof input==='object'?input:{};
 const category=categories.includes(input.category)?input.category:null;
 const rawSubjects=Array.isArray(input.subjects)?input.subjects.slice(0,4):[];
 const subjects=[...new Map(rawSubjects.map(v=>label(v)).filter(Boolean).map(v=>[catalogNameKey(v),v])).values()];
 const year=numeric(input.year),run=numeric(input.printRun);
 const number=clean(input.number,40),serial=clean(input.serial,20),parallel=label(input.parallel);
 const printing=['base','factory-set','photo-variation','short-print','promo','insert','parallel'].includes(input.printing)?
  input.printing:printClass(parallel);
 const values={
  category,sportGame:label(input.sportGame),subjects:subjects.length?Object.freeze(subjects):null,manufacturer:label(input.manufacturer),
  year:/^(?:19|20)\d{2}$/.test(year||'')?year:null,set:label(input.set),subset:label(input.subset),
  number:number&&isCollectorReading(number,category==='sports'?'sports':'pokemon')?numberKey(number):null,
  language:clean(input.language,20),parallel,printing,photoPose:label(input.photoPose),finish:finishKey(input.finish),
  foilTreatment:label(input.foilTreatment),printRun:/^[1-9]\d{0,6}$/.test(run||'')?run:null,
  serial:/^\d{1,6}\/\d{1,6}$/.test(serial||'')?serial:null,autograph:yesNo(input.autograph),relic:yesNo(input.relic),
  setCode:clean(input.setCode,32),copyrightYear:clean(input.copyrightYear,80),stamp:label(input.stamp),rookie:yesNo(input.rookie),
 };
 return Object.freeze(Object.fromEntries(Object.entries(values).filter(([,v])=>v!==null)));
}

function key(field,value) {
 if(field==='subjects')return value.map(catalogNameKey).sort().join('|');
 if(field==='number'||field==='serial')return numberKey(value);
 if(field==='language')return catalogLanguageKey(value);
 if(field==='parallel') {
  if(base(value))return 'base';
  const normalized=catalogVariantKey(value);
  if(/^(?:alt(?:ernate)? art(?:work)?|aa)$/.test(normalized))return 'alternate art';
  return normalized;
 }
 return catalogNameKey(value);
}
const agrees=(field,a,b)=>key(field,a)===key(field,b);

// Instantiate only in reviewed adapter code. Object identity is the in-process
// provenance boundary. JSON, client input and returned marketplace rows cannot
// mint an approved record by carrying the same fields or a trusted-looking flag.
export function createCatalogEvidenceAdapter(source, project, {allowEmptyClaims=false}={}) {
 const id=clean(source?.id,80),provenance=clean(source?.provenance,160);
 if(!id||!provenance||typeof project!=='function')throw new TypeError('Invalid catalog adapter');
 return input=>{
  const projected=project(input);
  const recordId=clean(projected?.recordId,100),revision=clean(projected?.revision,100);
  const time=typeof projected?.retrievedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(projected.retrievedAt)?Date.parse(projected.retrievedAt):NaN;
  const retrievedAt=Number.isFinite(time)?new Date(time).toISOString():null;
  if(!recordId||(!revision&&!retrievedAt))return null;
  const claims=normalizeClaims(projected.claims);
  if(!allowEmptyClaims&&!Object.keys(claims).length)return null;
  const record=Object.freeze({source:id,provenance,recordId,revision,retrievedAt,claims});
  approvedRecords.add(record);
  return record;
 };
}

function collapse(field,entries) {
 const values=new Map();
 for(const entry of entries) {
  const normalized=key(field,entry.value);
  if(values.has(normalized))values.get(normalized).evidence.push(entry.evidence);
  else values.set(normalized,{value:entry.value,evidence:[entry.evidence]});
 }
 return [...values.values()];
}

export function reconcileCatalogIdentity({proposal,savedProposal,reviewed,observations=[],records=[],priorConflicts=[]}={}) {
 const ai=normalizeClaims(proposal),saved=normalizeClaims(savedProposal),owner=normalizeClaims(reviewed);
 const catalog=[...new Set(list(records).slice(0,32).filter(record=>approvedRecords.has(record)))];
 const seen=new Map();
 for(const row of (Array.isArray(observations)?observations:[]).slice(0,16)) {
  if(!Object.hasOwn(identityClaimLabels,row?.field)||!['front','back'].includes(row.side)||
    !['clear','uncertain'].includes(row.certainty))continue;
  const value=normalizeClaims({category:ai.category||owner.category,[row.field]:row.value})[row.field];
  if(value===undefined)continue;
  const entries=seen.get(row.field)||[];
  entries.push({value,evidence:{kind:'photo_observation',side:row.side,certainty:row.certainty,
   area:['name','collector_line','set_mark','rarity_mark','body_text'].includes(row.area)?row.area:null}});
  seen.set(row.field,entries);
 }
 const claims={};
 for(const field of Object.keys(identityClaimLabels)) {
  const entries=[];
  if(ai[field]!==undefined)entries.push({value:ai[field],evidence:{kind:'ai_proposal'}});
  else if(saved[field]!==undefined)entries.push({value:saved[field],evidence:{kind:'saved_proposal'}});
  if(owner[field]!==undefined)entries.push({value:owner[field],evidence:{kind:'owner_review'}});
  entries.push(...(seen.get(field)||[]));
  const proposed=collapse(field,entries);
  const firm=collapse(field,entries.filter(row=>row.evidence.certainty!=='uncertain'));
  const supported=collapse(field,catalog.flatMap((record,index)=>record.claims[field]===undefined?[]:
   [{value:record.claims[field],evidence:{kind:'catalog',recordIndex:index}}]));
  const contradictory=firm.length>1 || firm.length===1&&supported.length>0&&
    !supported.some(row=>agrees(field,row.value,firm[0].value));
  const agreesWithCatalog=firm.length===1&&supported.some(row=>agrees(field,row.value,firm[0].value));
  claims[field]={status:contradictory?'conflict':agreesWithCatalog?'catalog_supported':
   supported.length>1?'catalog_alternatives':supported.length?'catalog_record_only':
   firm.some(row=>row.evidence.some(e=>e.kind==='photo_observation'))?'observed':
   owner[field]!==undefined?'owner_reviewed':ai[field]!==undefined||saved[field]!==undefined?'proposed':'unresolved',
   proposed,supported};
 }
 const firmValues=Object.fromEntries(Object.entries(claims).flatMap(([field,claim])=>{
  const firm=claim.proposed.filter(row=>row.evidence.some(e=>e.certainty!=='uncertain'));
  return firm.length===1?[[field,firm[0].value]]:[];
 }));
 const candidateIndexes=catalog.flatMap((record,index)=>Object.entries(firmValues).every(([field,value])=>
  record.claims[field]===undefined||agrees(field,record.claims[field],value))?[index]:[]);
 for(const [field,claim] of Object.entries(claims)) {
  if(claim.status!=='catalog_supported')continue;
  const firm=claim.proposed.find(row=>row.evidence.some(e=>e.certainty!=='uncertain'));
  if(!claim.supported.some(row=>row.value!==undefined&&row.evidence.some(e=>candidateIndexes.includes(e.recordIndex))&&
     agrees(field,row.value,firm.value))) claim.status='catalog_record_only';
 }
 const conflicts=Object.keys(claims).filter(field=>claims[field].status==='conflict');
 const prior=[...new Set((Array.isArray(priorConflicts)?priorConflicts:[]).slice(0,30).filter(f=>Object.hasOwn(identityClaimLabels,f)))];
 const missing=core.filter(field=>firmValues[field]===undefined);
 const coherentCore=candidateIndexes.some(index=>core.every(field=>catalog[index].claims[field]!==undefined&&firmValues[field]!==undefined));
 const status=conflicts.length||prior.length||catalog.length&&!candidateIndexes.length?'conflict':
  coherentCore?'catalog_supported':'unresolved';
 const missingPrinting=printingFields.filter(field=>claims[field].status!=='catalog_supported');
 const candidatePrintings=new Set(candidateIndexes.map(index=>{
  const candidate=catalog[index];
  return JSON.stringify(printingFields.map(field=>candidate.claims[field]===undefined?null:key(field,candidate.claims[field])));
 }));
 const catalogAmbiguity=candidatePrintings.size>1;
 const printingConflict=[...conflicts,...prior].some(field=>printingFields.includes(field))||
  catalog.length>0&&!candidateIndexes.length;
 const printingSupported=claims.printing.status==='catalog_supported'||claims.parallel.status==='catalog_supported'||
  claims.finish.status==='catalog_supported';
 const catalogPrinting={status:printingConflict?'conflict':catalogAmbiguity?'ambiguous':
   coherentCore&&printingSupported?'catalog_record_consistent':'unresolved',missing:missingPrinting};
 return {
  version:CATALOG_IDENTITY_EVIDENCE_VERSION,status,claims,records:catalog,candidateIndexes,
  conflicts,priorConflicts:prior,missing,missingPrinting,
  catalogAmbiguity,catalogPrinting,
  jointConflict:catalog.length>0&&!candidateIndexes.length,
  physicalPrinting:{status:'unverified',reason:'independent_physical_comparison_required'},
  nextAction:status==='conflict'?'Review conflicting claims against the printed card and an independent catalog record of the exact variation.':
   missing.length?'Read the missing identity details from the card before seeking an independent catalog record.':
   status==='unresolved'?'Find an independent catalog record that identifies this card. Compare the physical card for printing differences.':
   'Compare the physical card with the exact catalog printing using diagnostic artwork, finish, stamps or numbering.',
 };
}

const fields={subject:'subjects',player:'subjects',cardNumber:'number',collectorNumber:'number',
 brandSet:'set',set:'set',year:'year',language:'language',parallel:'parallel',finish:'finish',subset:'subset',
 serialNumber:'serial',manufacturer:'manufacturer'};
const pinnedCatalog=createCatalogEvidenceAdapter({id:'tcgdex-reviewed-upstream',provenance:'Pinned upstream card and set blobs'},input=>input);
function reportCatalog(report) {
 const source=sourceCatalogEvidence(report);
 if(!source.source)return [];
 const receipt=report.identityVerification.catalog;
 const candidate=receipt.candidate;
 const finishValues=source.printings?.values||[];
 // Reviewed upstream printings are positive alternatives. Generated hosted
 // booleans are not negative evidence and catalog art is not photo evidence.
 return (finishValues.length?finishValues:[{}]).flatMap((printing,index)=>{
  const record=pinnedCatalog({recordId:receipt.referenceId+':'+(index+1),revision:source.source.revision,
   claims:{category:'pokemon',sportGame:'Pokémon',subjects:[candidate.subject],number:candidate.cardNumber,
    set:candidate.brandSet,year:candidate.year,language:candidate.language,finish:printing.finish,
    stamp:printing.stamps?.length===1?printing.stamps[0]:null}});
  return record?[record]:[];
 });
}

export function reportCatalogIdentityEvidence(report={},reviewed) {
 const raw=report.originalIdentityObservation||report.imageAnalysis||{};
 const photo=report.imageAnalysis||{};
 const category=report.identityV2?.category;
 const parallel=raw.identifiedParallel;
 const variant=describeVariant(parallel);
 const treatment=describeVariant(raw.identifiedAutoOrRelic);
 const proposal={category,sportGame:category==='pokemon'?'Pokémon':raw.identifiedSport||raw.identifiedFranchise,
  subjects:category==='sports'?sportsSubjectNames(raw.identifiedSubject||''):[raw.identifiedSubject],
  manufacturer:raw.identifiedManufacturer,year:raw.identifiedYear,set:raw.identifiedBrandSet,
  subset:raw.subset||photo.sportsIdentity?.subset,number:raw.identifiedCardNumber,language:raw.identifiedLanguage,
  parallel,finish:variant.finish,foilTreatment:variant.treatment,printRun:variant.printRun,
  serial:raw.identifiedSerialNumber,autograph:treatment.autograph,relic:treatment.relic};
 const observations=readIdentityReadings(raw.identityReadings||photo.identityReadings,category).map(row=>{
  const field=fields[row.field]||(row.field==='setCode'||row.field==='copyrightYear'?row.field:null);
  return {...row,certainty:field==='subjects'&&proposal.subjects.length>1?'uncertain':row.certainty,field,value:field==='subjects'?[row.text]:field==='setCode'?parsePrintedSetMark(row.text).code:row.text};
 });
 const inspected=photo.inspectedSides;
 if(Array.isArray(inspected)&&inspected.includes('front')){
  const foil=photo.observedFoilTreatment||photo.sportsIdentity?.foilTreatment;
  if(foil)observations.push({field:'foilTreatment',value:foil,side:'front',certainty:'uncertain'});
 }
 const saved=report.canonicalCard||{};
 const savedProposal={category,subjects:category==='sports'?sportsSubjectNames(saved.subject||''):[saved.subject],
  manufacturer:saved.manufacturer,year:saved.year,set:saved.brandSet,number:saved.cardNumber,language:saved.language,
  subset:saved.subset,parallel:saved.parallel,finish:saved.variant?.finish,printRun:saved.printRun};
 const comparison=report.catalogComparison;
 const priorConflicts=[...list(comparison?.initialConflicts),...list(comparison?.postCorrectionConflicts),
  ...list(comparison?.finalConflicts),...list(report.userIdentityConflicts).map(row=>row?.field)]
  .map(field=>fields[field]).filter(Boolean);
 return reconcileCatalogIdentity({proposal,savedProposal,reviewed,observations,records:category==='pokemon'?reportCatalog(report):[],priorConflicts});
}
