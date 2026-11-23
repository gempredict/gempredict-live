import { isCollectorReading } from './collectorReading.mjs';
import { catalogNameKey } from './catalogNormalization.mjs';
import { sportsSubjectNames } from './sportsIdentityEvidence.mjs';
import { hasConflictingProduct, productKey } from './ebayIdentityMatch.mjs';
import { assessMarketGrade, compareMarketPrinting } from './marketPrintingEvidence.mjs';
import { describeVariant } from './variantDescriptor.mjs';

export const scanSalesFields = Object.freeze({
  year:'Release year', manufacturer:'Manufacturer', set:'Set', number:'Collector number',
  subset:'Subset', parallel:'Parallel', finish:'Finish', printRun:'Print run',
  serial:'Observed copy serial', photoPose:'Photo pose', autograph:'Autograph', relic:'Relic',
});
const text = (value, max=80) => typeof value === 'string' && value.length<=max && value.trim() &&
  !/[\u0000-\u001f\u007f]/.test(value) && !/https?:|(?:sk-|tca_|AIza)[a-z0-9_-]{12,}/i.test(value) ? value.trim() : null;
const num = value => text(String(value??''),40);
const known = (value,pattern) => typeof value==='string'&&pattern.test(value)?value:null;
const fieldKey = value => catalogNameKey(value);
const numberKey = value => String(value||'').replace(/^#\s*/,'').replace(/\s/g,'').toUpperCase();
const has = (haystack,needle) => !!fieldKey(needle) && (' '+fieldKey(haystack)+' ').includes(' '+fieldKey(needle)+' ');
const booleanLabel = value => value===true?'yes':value===false?'no':null;
const plain = value => value&&typeof value==='object'&&!Array.isArray(value);
const unique = values => [...new Set(values)];
const missing = identity => [
  ...(identity.subjects.length?[]:['subjects']),
  ...Object.keys(scanSalesFields).filter(field=>identity[field]==null),
];

export function extractScanSalesIdentity(report) {
  const c=report?.canonicalCard||{}, raw=report?.originalIdentityObservation||report?.imageAnalysis||{};
  const sport=report?.sportsIdentityEvidence, detail=report?.imageAnalysis?.sportsIdentity;
  const category=['sports','pokemon','mtg','yugioh','dragonball','onepiece','tcg']
    .includes(report?.identityV2?.category)?report.identityV2.category:null;
  const canonicalSubject=text(c.subject,320)||text(raw.identifiedSubject,320);
  const subjects=category==='sports'?
    (sport?.subjects?.length?sport.subjects.map(row=>text(row.name)).filter(Boolean):sportsSubjectNames(canonicalSubject||'')):
    [text(canonicalSubject)].filter(Boolean);
  const parallel=text(c.parallel)||text(raw.identifiedParallel);
  const variant=describeVariant([parallel,report?.imageAnalysis?.observedFoilTreatment,detail?.foilTreatment].filter(Boolean).join(' '));
  const treatment=describeVariant([c.autoOrRelic,raw.identifiedAutoOrRelic].filter(Boolean).join(' '));
  const season=String(c.year??raw.identifiedYear??'');
  const serial=text(sport?.serial?.value)||text(detail?.serialNumber)||text(raw.identifiedSerialNumber);
  const conflictSources=[
    ['original catalog disagreement',report?.catalogComparison?.initialConflicts],
    ['catalog',report?.catalogComparison?.finalConflicts],
    ['user',report?.userIdentityConflicts?.map?.(row=>row?.field)],
    ['subjects',sport?.conflicts],
    ['subjects',sport?.unresolved],
  ];
  const conflicts=unique(conflictSources.flatMap(([from,items])=>
    Array.isArray(items)?items.slice(0,12).filter(item=>typeof item==='string'&&/^[a-z_]{1,60}$/i.test(item)).map(item=>from+': '+item):[]));
  if (variant.ambiguous) conflicts.push('printing: conflicting finish or treatment');
  if (report?.catalogComparison?.printing?.status==='conflict') conflicts.push('printing: catalog conflict');
  const identity={
    category,subjects,
    year:known(season,/^(?:19|20)\d{2}$/),manufacturer:text(c.manufacturer)||text(raw.identifiedManufacturer),
    set:text(c.brandSet)||text(raw.identifiedBrandSet),number:text(c.cardNumber,40)||text(raw.identifiedCardNumber,40),
    subset:text(c.subset)||text(sport?.subset?.value)||text(detail?.subset),
    parallel,finish:variant.ambiguous?null:variant.finish,
    printRun:known(num(c.printRun),/^[1-9]\d{0,6}$/),
    photoPose:null,
    serial:known(serial,/^\d{1,6}\/\d{1,6}$/),
    autograph:booleanLabel(treatment.autograph ?? (c.autoOrRelic==='none'?false:null)),
    relic:booleanLabel(treatment.relic ?? (c.autoOrRelic==='none'?false:null)),
  };
  const independentlyVerified = report?.identityV2?.identityVerified===true &&
    report?.identityV2?.printingVerified===true && report?.physicalPrintingStatus?.verified===true;
  const originalProposals = [
    ['Subjects',text(raw.identifiedSubject,320),identity.subjects.join(' / ')],
    ['Year',text(raw.identifiedYear),identity.year],
    ['Set',text(raw.identifiedBrandSet),identity.set],
    ['Collector number',text(raw.identifiedCardNumber,40),identity.number],
    ['Parallel',text(raw.identifiedParallel),identity.parallel],
  ].filter(([,proposed,chosen])=>proposed&&chosen&&fieldKey(proposed)!==fieldKey(chosen))
   .map(([field,proposed,chosen])=>({field,proposed,chosen}));
  return {identity,conflicts,originalProposals,missing:missing(identity),
    requiresReview:!independentlyVerified||conflicts.length>0||
      category==='sports'&&(subjects.length!==1||sport?.subjectStatus!=='supported_observations')};
}

export function prepareScanSalesQuery(report, edits, confirmed) {
  const original=extractScanSalesIdentity(report);
  if (!original.identity.category) return {error:'saved_category_unsupported'};
  if (edits!==undefined && (!plain(edits)||Object.keys(edits).some(key=>!Object.hasOwn(scanSalesFields,key)&&key!=='subjects'))) {
    return {error:'invalid_reviewed_identity'};
  }
  const identity={...original.identity};
  for (const [key,value] of Object.entries(edits||{})) {
    if (key==='subjects') {
      if (!Array.isArray(value)||value.length<1||value.length>4||value.some(name=>!text(name))||
          (identity.category!=='sports'&&value.length!==1)) return {error:'invalid_reviewed_identity'};
      identity.subjects=value.map(name=>text(name));
    } else {
      if (value!==''&&!text(value,key==='number'?40:80)) return {error:'invalid_reviewed_identity'};
      identity[key]=text(value,key==='number'?40:80);
    }
  }
  if (!identity.subjects.length || unique(identity.subjects.map(fieldKey)).length!==identity.subjects.length ||
      identity.subjects.some(name=>!fieldKey(name)) ||
      !known(identity.year,/^(?:19|20)\d{2}$/)||!identity.set||!isCollectorReading(identity.number,identity.category==='sports'?'sports':'pokemon')||
      identity.printRun&&!known(identity.printRun,/^[1-9]\d{0,6}$/)||
      identity.serial&&!known(identity.serial,/^\d{1,6}\/\d{1,6}$/)||
      ['autograph','relic'].some(key=>identity[key]&&!['yes','no'].includes(identity[key]))||
      identity.photoPose&&!['pitching','batting'].includes(identity.photoPose)||
      identity.finish&&!['holo','non-holo','reverse-holo'].includes(identity.finish)) return {error:'invalid_reviewed_identity'};
  if ((original.requiresReview||JSON.stringify(identity)!==JSON.stringify(original.identity)) && confirmed!==true) {
    return {error:'owner_identity_review_required'};
  }
  // Discovery deliberately uses a smaller title query: provider title search is not a
  // trusted exact-card crosswalk. Full identity remains mandatory for post-retrieval review.
  // Query one reviewed subject plus year and collector number, never requiring every
  // subject, parallel or a particular spelling of the set to appear in a listing title.
  const discovery=[identity.subjects[0],identity.year,identity.number.replace(/^#\s*/, '')];
  const q=discovery.join(' ') .replace(/[^\p{L}\p{N}# '&+.,:/_-]/gu,' ').replace(/\s+/g,' ').trim();
  if(q.length<4||q.length>120) return {error:'identity_query_too_long'};
  return {identity,q,category:identity.category==='sports'?'sports':'tcg',
    searchMode:'discovery_then_verify',searchedSubject:identity.subjects[0],
    conflicts:original.conflicts,missing:missing(identity),ownerReviewed:confirmed===true};
}

const basePrinting = /^(?:base|normal|regular|none|standard)$/i;

function titleConflicts(target,title) {
  const conflicts=[];
  const years=[...title.replace(/#\s*[a-z0-9]+(?:[-/][a-z0-9]+)*/gi,'').matchAll(/\b(?:19|20)\d{2}\b/g)].map(match=>match[0]);
  if (years.some(year=>year!==target.year && year!==numberKey(target.number))) conflicts.push('year');
  if (hasConflictingProduct(title,target.set)) conflicts.push('set');
  const collectorNumbers=[...title.matchAll(/(?:#\s*|\bno\.\s*|\bcard (?:no\.\s*|number\s+))((?=[a-z0-9/-]*\d)[a-z0-9]+(?:[-/][a-z0-9]+)*)\b/gi)];
  if (collectorNumbers.some(match=>numberKey(match[1])!==numberKey(target.number))) conflicts.push('card_number');
  return conflicts;
}

export function compareScanSale(target,row,cohort,{strictTitle=false}={}) {
  const matched=[], unknown=[], mismatches=[];
  const field=(name,expected,actual,key=fieldKey)=>{
    if (!expected||!actual||!key(expected)||!key(actual)) unknown.push(name);
    else (key(expected)===key(actual)?matched:mismatches).push(name);
  };
  const title=row.title||'';
  const titleEvidence=(value,key=fieldKey)=>strictTitle&&value&&(' '+key(title)+' ').includes(' '+key(value)+' ')?value:null;
  field('year',target.year,row.year||titleEvidence(target.year));
  field('set',target.set,row.set||titleEvidence(target.set,productKey),strictTitle?productKey:fieldKey);
  field('manufacturer',target.manufacturer,row.manufacturer||titleEvidence(target.manufacturer));
  const explicitNumbers=[...title.matchAll(/#\s*([a-z0-9]+(?:[-/][a-z0-9]+)*)/gi)].map(match=>numberKey(match[1]));
  field('card_number',target.number,row.cardNumber||(strictTitle&&explicitNumbers.includes(numberKey(target.number))?target.number:null),numberKey);
  const names=target.subjects||[], reported=sportsSubjectNames(row.player||'');
  const groupAgrees=reported.length===names.length&&reported.every(person=>names.some(name=>fieldKey(name)===fieldKey(person)));
  if (reported.length>1&&!groupAgrees ||
      reported.length===1&&!names.some(name=>fieldKey(name)===fieldKey(reported[0]))&&(strictTitle||!names.some(name=>has(row.title,name)))) {
    mismatches.push('subjects');
  } else if (names.length&&names.every(name=>has(row.title,name))&&
      (reported.length===0&&names.length===1||groupAgrees)) matched.push('subjects');
  else unknown.push('subjects');
  (target.subset&&has(row.title,target.subset)?matched:unknown).push('subset');
  const card={subject:names.join(' / '),brandSet:target.set,cardNumber:target.number};
  const expected=describeVariant(target.parallel), actual=describeVariant(row.title,card);
  const variantConflict=['color','treatment','art'].some(key=>expected[key]&&actual[key]&&expected[key]!==actual[key])||
    expected.finish&&actual.finish&&expected.finish!==actual.finish || (expected.kind==='base'||strictTitle&&basePrinting.test(target.parallel||''))&&actual.kind==='parallel';
  if (variantConflict) mismatches.push('parallel');
  else (target.parallel&&has(row.title,target.parallel)&&!actual.ambiguous?matched:unknown).push('parallel');
  field('finish',target.finish,actual.finish);
  field('print_run',target.printRun,row.printRun||actual.printRun);
  field('autograph',target.autograph,booleanLabel(actual.autograph));
  field('relic',target.relic,booleanLabel(actual.relic));
  if (actual.ambiguous) unknown.push('ambiguous_variant_terms');
  if (/\b(?:lot of|card lot|bundle|you pick)\b/i.test(row.title||'')) mismatches.push('possible_lot');
  let gradeEvidence;
  if (strictTitle) {
    mismatches.push(...titleConflicts(target,title));
    const printing=compareMarketPrinting(target,row,{match:matched.includes('parallel'),
      conflict:variantConflict||mismatches.includes('finish')});
    matched.push(...printing.matches);
    unknown.push(...printing.unknown);
    mismatches.push(...printing.conflicts);
    gradeEvidence=assessMarketGrade(row,cohort);
    ({matched,unknown,mismatch:mismatches}[gradeEvidence.status]).push('grade');
  } else if(cohort==='Raw'&&!row.grade) unknown.push('grade');
  else field('grade',cohort,row.grade&&row.grader?`${row.grader} ${row.grade}`:null);
  const conflicts=unique(mismatches);
  return {status:conflicts.length?'mismatch':unknown.length?'plausible_unverified':'exact_listing_evidence',
    matched:unique(matched).filter(name=>!conflicts.includes(name)),unknown:unique(unknown).filter(name=>!conflicts.includes(name)&&!matched.includes(name)),mismatches:conflicts,...(gradeEvidence?{gradeEvidence}:{})};
}
