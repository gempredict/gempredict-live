import { blindBenchmarkInput, CONDITION_ATTRIBUTES, evaluateBenchmarkCalibration } from './benchmarkCalibration.mjs';
import { CORE_FIELDS, safeIdentityText, truthReady, validateManifest } from './identificationBenchmark.mjs';

export const ownerBenchmarkBranch = 'feature/owner-benchmark-review-phase5q1';
export const newExactFields = {
 sports_owner: ['manufacturer','subset','parallel','finish','serialNumber','autoOrRelic'],
 pokemon_owner: ['language','rarity','parallel','finish','stamps'],
};
const code = value => !!safeIdentityText(value) && /^[\w.-]{1,100}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
 Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const sides = ['front','back'];

export function ownerSlots(manifest, labels = {}) {
 return manifest.cards.map(card => {
  const review = labels[card.id];
  const coreReviewed = truthReady(card.groundTruth, CORE_FIELDS);
  return {
   id: card.id, name: card.displayName, category: card.category, fields: card.requiredExactFields,
   status: review?.blindReview && coreReviewed && review.printingReview && review.conditionReview ? 'independently_reviewed' :
    coreReviewed || review?.blindReview || Object.keys(card.referenceFacts || {}).length ? 'incomplete' : 'draft',
   coreReviewed,
   printingReviewed: !!review?.printingReview, photosReviewed: !!review?.blindReview,
   conditionReviewed: !!review?.conditionReview, gradeReviewed: !!review?.gradingOutcome,
  };
 });
}

function receipt(value, physicalCardId, photoHashes) {
 if (!code(value?.reviewer) || !code(value?.reference) || !date(value?.date)) return null;
 return {status:'independently_reviewed', reviewer:value.reviewer, reviewedAt:value.date,
  evidenceReference:value.reference, physicalCardId, photoHashes};
}

function source(value, supports) {
 try {
  const url = new URL(value?.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href.length > 400) return null;
  if (!['independent_catalog','manufacturer_checklist'].includes(value.kind)) return null;
  return {kind:value.kind,url:url.href,supports};
 } catch { return null; }
}

function reviewedFields(raw, fields, allowNA) {
 return Object.fromEntries(fields.flatMap(field => {
  if (allowNA && raw?.[field] === 'N/A') return [[field,{status:'not_applicable'}]];
  const value = safeIdentityText(raw?.[field]);
  if (!value || value === 'N/A') return [];
  const normalized = field === 'stamps' ? value.split(',').map(s => s.trim()).filter(Boolean) : value;
  if (Array.isArray(normalized) && (!normalized.length || normalized.length > 12)) return [];
  return [[field,{status:'known',value:normalized}]];
 }));
}

function addTruth(card, step, fields, review, allowNA) {
 const values = reviewedFields(step?.fields, fields, allowNA);
 const reference = source(step, Object.keys(values));
 if (!review || !reference || fields.some(key => !Object.hasOwn(values,key))) return false;
 const prior = card.groundTruth;
 if (fields.some(key => truthReady(prior,[key]) &&
     JSON.stringify(values[key]) !== JSON.stringify(prior.fields[key]))) throw Error('baseline_truth_conflict');
 card.groundTruth = {
  status:'independently_reviewed',
  reviewer:review.reviewer, reviewedAt:review.reviewedAt,
  fields:{...prior.fields,...values},
  sources:[...prior.sources.map(item => ({...item,supports:item.supports.filter(key => !fields.includes(key))})),reference],
 };
 return true;
}

export function buildOwnerReviewPacket(base, drafts) {
 if (!Array.isArray(drafts) || drafts.length > 22) throw Error('review_limit');
 const manifest = structuredClone(base);
 const labels = {}, statuses = {}, blindInputs = {}, pending = {};
 const seen = new Set();
 for (const draft of drafts) {
  if (!code(draft?.id) || seen.has(draft.id)) throw Error('invalid_slot');
  seen.add(draft.id);
  let card = manifest.cards.find(slot => slot.id === draft.id);
  if (!card) {
   if (!/^GP-OWNER-[a-f0-9-]{36}$/.test(draft.id) || !Object.hasOwn(newExactFields,draft.category) ||
       !safeIdentityText(draft.name) || manifest.cards.length >= base.cards.length + 10) throw Error('invalid_new_slot');
   card = {id:draft.id,displayName:safeIdentityText(draft.name),category:draft.category,physicalCardId:draft.id,
    requiredExactFields:newExactFields[draft.category],photos:{},groundTruth:{status:'unreviewed',fields:{},sources:[]}};
   manifest.cards.push(card);
   manifest.categoryPlan[card.category] = (manifest.categoryPlan[card.category] || 0) + 1;
  }
  const hashes = Object.fromEntries(sides.filter(side => sha(draft.hashes?.[side])).map(side => [side,draft.hashes[side]]));
  const stamp = step => receipt(step,card.physicalCardId,hashes);
  const result = labels[card.id] = {};
  const asserted = {
   core:reviewedFields(draft.core?.fields,CORE_FIELDS,false),
   printing:reviewedFields(draft.printing?.fields,card.requiredExactFields,true),
  };
  const gaps = pending[card.id] = {reasons:[],asserted};
  const corePreviouslyReviewed = truthReady(card.groundTruth,CORE_FIELDS);
  if (draft.mode !== 'reviewed') {
   statuses[card.id] = draft.mode === 'owner_reported' ? 'owner_reported' : 'draft';
   gaps.reasons.push('Draft and owner-reported labels are excluded from scoring.');
   continue;
  }
  const core = stamp(draft.core);
  const coreAdded = addTruth(card,draft.core,CORE_FIELDS,core,false);
  if (coreAdded) result.coreReview = core;

  const photoReview = stamp(draft.photo);
  const quality = draft.photo?.qualityLimitations ?? [];
  if (!Array.isArray(quality) || quality.length > 8 || !quality.every(code)) throw Error('invalid_photo_quality');
  if (hashes.front && hashes.back && hashes.front !== hashes.back && photoReview &&
      draft.photo.cardOnlyPixels === true && draft.photo.metadataStripped === true) {
   card.photos = Object.fromEntries(sides.map(side => [side,{status:'retained_and_reviewed',sha256:hashes[side]}]));
   result.blindReview = {...photoReview,cardOnlyPixels:true,metadataStripped:true,gradeOrSlabVisible:false,
    identityAssessable:draft.photo.identityAssessable === true,qualityLimitations:quality};
   blindInputs[card.id] = blindBenchmarkInput(card,result.blindReview,hashes);

   const printing = stamp(draft.printing);
   if (addTruth(card,draft.printing,card.requiredExactFields,printing,true)) result.printingReview = printing;

   const condition = stamp(draft.condition);
   const rows = draft.condition?.observations;
   if (condition && Array.isArray(rows) && rows.length > 0 && rows.length <= 48) {
    const regions = new Set();
    result.conditionReview = {...condition,regions:rows.map(row => {
     const key = [row?.attribute,row?.side,row?.location].join('/');
     if (!CONDITION_ATTRIBUTES.includes(row?.attribute) || !sides.includes(row?.side) || !code(row?.location) ||
         !['defect','clear','uncertain'].includes(row?.state) || regions.has(key) ||
         !Array.isArray(row.limitations) || row.limitations.length > 8 || !row.limitations.every(code)) throw Error('invalid_condition');
     regions.add(key);
     return {attribute:row.attribute,side:row.side,location:row.location,state:row.state,limitations:row.limitations};
    })};
   }

   const grade = draft.grading?.grade;
   const grading = stamp(draft.grading);
   if (grading && Number.isInteger(grade) && grade >= 1 && grade <= 10) result.gradingOutcome = {...grading,service:'PSA',grade};
  }
  if (coreAdded) delete asserted.core;
  if (result.printingReview) delete asserted.printing;
  if (!coreAdded && !corePreviouslyReviewed) gaps.reasons.push('Core identity needs complete fields, an independent source and a review receipt.');
  if (!result.blindReview) gaps.reasons.push('Two distinct prepared photos, a photo review receipt and both blind-input confirmations are required.');
  if (!result.printingReview) gaps.reasons.push('Exact printing needs linked photos, supported fields, an independent source and a review receipt.');
  if (!result.conditionReview) gaps.reasons.push('Visible condition needs linked photos, a review receipt and at least one regional finding.');
  if (draft.grading?.grade && !result.gradingOutcome) gaps.reasons.push('The optional PSA outcome needs its own grading evidence receipt and linked photos.');
  statuses[card.id] = gaps.reasons.length ? 'incomplete' : 'independently_reviewed';
 }
 validateManifest(manifest);
 return {version:1,manifest,labels,statuses,blindInputs,pending};
}

export function redactedReviewScorecard(packet) {
 const {coverage} = evaluateBenchmarkCalibration(packet.manifest, [], packet.labels);
 return {version:1,coverage,measurements:'unavailable_without_evidence_linked_blind_trials'};
}
