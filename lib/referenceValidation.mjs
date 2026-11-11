// Offline scorecard projection only: no scanner, network, grade model or financial authority.
import {validateManifest,sanitizeObservation,safeIdentityText} from './identificationBenchmark.mjs';
export const REFERENCE_FIELDS=['subject','year','set','cardNumber','parallel','finish','language','autoOrRelic','serialNumber','printRun'];
const categories=['corners','edges','surface','centering'];
const known=field=>field?.status==='known'&&field.value!=null;
const text=v=>safeIdentityText(typeof v==='number'?String(v):v);
const normalize=v=>text(v)?.toLowerCase().replace(/\s+/g,' ').trim()||null;
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const code=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(v)?v:null;
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<10000?n:null;
const amount=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=10000?n:null;
const result=(status,reason,extra={})=>({status,reason,...extra});
export function compareReferenceFields(card,observed={},eligible=true){
 return Object.fromEntries(REFERENCE_FIELDS.map(field=>{
  const truth=card.groundTruth.fields[field],actual=text(observed[field]);
  if(!eligible)return [field,result('NOT TESTED','no_linked_completed_attempt',{expected:truth.value,observed:actual,basis:truth.assertionStatus})];
  if(!known(truth))return [field,result('UNRESOLVED','ground_truth_not_established',{expected:null,observed:actual,basis:truth.assertionStatus})];
  if(!actual)return [field,result('UNRESOLVED','observation_missing_or_redacted',{expected:truth.value,observed:null,basis:truth.assertionStatus})];
  if(card.category.startsWith('sports')&&['parallel','finish'].includes(field)&&normalize(actual)==='mojo')return [field,result('UNRESOLVED','mojo_wording_does_not_establish_exact_parallel',{expected:truth.value,observed:actual,basis:truth.assertionStatus})];
  const match=[truth.value,...(truth.approvedAliases||[])].some(v=>normalize(v)===normalize(actual));
  return [field,result(match?'PASS':'FAIL',match?'matches_declared_reference':'reference_'+field+'_mismatch',{expected:truth.value,observed:actual,basis:truth.assertionStatus,independentlyVerified:false})];
 }));
}
export function ownerReferenceBinding(review,card,hashes){
 return review?.version===1&&review.referenceManifestVersion===1&&review.cardId===card.id&&review.ownerApproved===true&&!!code(review.physicalCardId)&&!!text(review.reviewer)&&typeof review.reviewedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt)&&sha(hashes?.front)&&sha(hashes?.back)&&review.preparedHashes?.front===hashes.front&&review.preparedHashes?.back===hashes.back;
}
export function controlledConditionEvidence(diagnostic){
 const allowedStates=['unassessable','suspected_defect','confirmed_visible_defect','no_defect_observed'];
 return {states:Object.fromEntries(categories.map(k=>[k,allowedStates.includes(diagnostic.finalPresentation?.states?.[k])?diagnostic.finalPresentation.states[k]:null])),
  findings:(diagnostic.model?.observations||[]).slice(0,32).filter(o=>categories.includes(o.attribute)).map(o=>({index:Number.isInteger(o.index)&&o.index>=0&&o.index<32?o.index:null,localizationValid:typeof o.localizationValid==='boolean'?o.localizationValid:null,attribute:o.attribute,side:['front','back'].includes(o.side)?o.side:null,code:code(o.code),certainty:['confirmed','suspected','unassessable','no_defect_observed','rejected'].includes(o.result)?o.result:null,accepted:typeof o.accepted==='boolean'?o.accepted:null,downgraded:typeof o.downgraded==='boolean'?o.downgraded:null,region:null,locationStatus:'not_retained_by_diagnostic',reasons:(o.reasons||[]).slice(0,12).map(code).filter(Boolean)})),
  limitations:(diagnostic.model?.photoLimitations||[]).slice(0,16).map(v=>typeof v==='string'?code(v):code(v?.code)).filter(Boolean),coverage:diagnostic.model?.coverageSummary?{field:code(diagnostic.model.coverageSummary.field),rows:count(diagnostic.model.coverageSummary.rows),scopes:(diagnostic.model.coverageSummary.scopes||[]).slice(0,8).map(c=>({attribute:categories.includes(c.attribute)?c.attribute:null,side:['front','back'].includes(c.side)?c.side:null,regions:count(c.regions),reason:code(c.reason)}))}:null};
}
export function retrospectiveConfirmation(value){
 if(value?.timing!=='after_analysis'||!code(value.sourceReference))return null;
 const allowed={corners:['whitening','softening'],edges:['wear','whitening','chipping'],surface:['scratches','print_lines','dent','crease'],centering:['off_center']};
 return {timing:'after_analysis',sourceReference:code(value.sourceReference),basis:'owner_statement_not_blinded_ground_truth',findings:(Array.isArray(value.findings)?value.findings:[]).slice(0,16).filter(f=>allowed[f?.attribute]?.includes(f.code)).map(f=>({attribute:f.attribute,code:f.code,side:['front','back'].includes(f.side)?f.side:null})),establishesLocalization:false,establishesSeverity:false,establishesBlindedAccuracy:false};
}
export function evaluateReferenceScorecard(manifest,attempts=[],{verifiedPreparedAttempts=new WeakSet()}={}){
 validateManifest(manifest);if(manifest.cohortId!=='phase3l-reference-pair-v1'||manifest.version!==1||manifest.cards.length!==2||!Array.isArray(attempts)||attempts.length>100)throw Error('reference_validation_manifest_or_attempts_invalid');
 const ids=new Set(),scans=new Set();for(const a of attempts){if(!a?.observation?.id||ids.has(a.observation.id)||!manifest.cards.some(c=>c.id===a.observation.cardId))throw Error('reference_validation_attempt_reference_invalid');ids.add(a.observation.id);const scan=a.observation.scanId;if(scan&&scans.has(scan))throw Error('reference_validation_duplicate_scan');if(scan)scans.add(scan);}
 const rows=manifest.cards.map(card=>{
  const own=attempts.filter(a=>a.observation.cardId===card.id),runs=own.map(a=>{
   const o=sanitizeObservation(a.observation),review=a.referenceReview;
   const synthetic=o.evidenceKind!=='live_scan'||a.evidenceOrigin!=='owner_exported_controlled_diagnostic';
   // Serialized booleans/hashes are not fresh proof of retained photo bytes.
   const bytesVerified=o.cohortId===manifest.cohortId&&verifiedPreparedAttempts.has(a)&&a.preparedPairVerified===true;
   const bound=!synthetic&&bytesVerified&&ownerReferenceBinding(review,card,o.photoHashes);
   const completed=o.technical.validCompletedResponse===true,eligible=bound&&completed;
   const proposed=compareReferenceFields(card,o.originalAI,eligible),canonical=compareReferenceFields(card,o.canonical,eligible);
   const rawComparison=compareReferenceFields(card,o.originalAI,bytesVerified&&completed),finalComparison=compareReferenceFields(card,o.canonical,bytesVerified&&completed);
   const preliminaryIdentity=Object.fromEntries(REFERENCE_FIELDS.map(k=>[k,{expected:rawComparison[k].expected,original:rawComparison[k].observed,canonical:finalComparison[k].observed,originalComparison:rawComparison[k].status==='PASS'?'matches_declared_reference':rawComparison[k].status==='FAIL'?'mismatch':rawComparison[k].reason,canonicalComparison:finalComparison[k].status==='PASS'?'matches_declared_reference':finalComparison[k].status==='FAIL'?'mismatch':finalComparison[k].reason,formalApprovalRequired:!eligible}]));
   const observedOriginalErrors=REFERENCE_FIELDS.filter(k=>rawComparison[k].status==='FAIL');
   const observedCanonicalCorrections=observedOriginalErrors.filter(k=>finalComparison[k].status==='PASS');
   const runtimeCoreReported=!card.category.startsWith('sports')&&o.dimensions.coreCatalog==='supported'&&o.catalog.selectedReference?.provider==='tcgdex'&&o.catalog.provenance.provider==='tcgdex';
   const failures=[...new Set(REFERENCE_FIELDS.filter(k=>proposed[k].status==='FAIL'||canonical[k].status==='FAIL'))];
   const exactPrinting=result('UNRESOLVED','physical_printing_not_independently_established');
   const reference=review?.conditionReview;
   const reviewed=eligible&&reference?.ownerApproved===true&&!!code(reference.referenceAssessmentId)&&!!code(reference.adjudicationId)&&reference.referenceAssessmentId!==reference.adjudicationId&&reference.diagnosticSha256===o.evidenceDigest;
   const condition=Object.fromEntries(categories.map(k=>[k,reviewed&&['PASS','FAIL','UNRESOLVED','NOT TESTED'].includes(reference.categories?.[k])?result(reference.categories[k],'owner_human_adjudication',{source:'human_review_not_model_confidence'}):result(completed?'NOT TESTED':'NOT TESTED','owner_approved_condition_reference_or_adjudication_missing')]));
   const audit=review?.callAudit,hasAudit=bound&&!!code(audit?.sourceReference),cost=review?.costAudit,hasCost=bound&&!!code(cost?.sourceReference);
   const unknownCounts={paidModelCalls:null,marketplaceCalls:null};
   const unsupportedSportsClaim=card.category.startsWith('sports')&&o.claims.catalogVerified===true;
   const runtimeCatalogSupport=!card.category.startsWith('sports')&&o.claims.catalogVerified===true&&o.catalog.outcome==='supported'&&o.catalog.selectedReference?.provider==='tcgdex'&&o.catalog.provenance.provider==='tcgdex';
   const unexpectedCalls=hasAudit&&(count(audit.marketplaceCalls)>0||count(audit.paidModelCalls)>1);
   return {attemptId:o.id,scanId:o.scanId,revision:o.deploymentCommit,diagnosticSha256:o.evidenceDigest,evidenceKind:o.evidenceKind,
    status:synthetic?'NOT TESTED':!completed?'FAIL':!bound?'UNRESOLVED':unsupportedSportsClaim||unexpectedCalls||failures.length||Object.values(condition).some(v=>v.status==='FAIL')?'FAIL':'UNRESOLVED',
    reasons:[...(synthetic?['synthetic_or_historical_evidence_excluded']:[]),...(!bound?['prepared_photos_not_owner_bound_to_reference']:[]),...(!completed?['technical_response_not_completed']:[]),...failures.map(k=>'material_'+k+'_mismatch'),...(unexpectedCalls?['controlled_request_budget_violation']:[]),...(unsupportedSportsClaim?['unsupported_sports_catalog_verification_claim']:[]),'exact_printing_not_established'],
    technical:result(completed?'PASS':'FAIL',o.technical.failureCode||(!completed?'incomplete_or_unavailable_response':'completed'),{phase:o.technical.phase,rule:o.technical.rule,stopReason:o.technical.stopReason}),
    photoLinkage:{preparedPairVerified:bytesVerified,preparedPairClaimed:a.preparedPairVerified===true,ownerReferenceBound:bound,originalToPreparedLinkage:'not_automatically_established'},
    preliminaryIdentity,observedOriginalErrors,observedCanonicalCorrections,
    runtimeCoreCatalog:{status:runtimeCoreReported?'reported_supported':'not_established',basis:'retained_diagnostic_not_new_independent_review',printingVerified:false},
    prediction:proposed,canonical,originalAI:o.originalAI,canonicalIdentity:o.canonical,catalog:o.catalog,verificationDimensions:o.dimensions,unresolvedReasons:o.unresolvedReasons,
    independentCatalog:result(unsupportedSportsClaim?'FAIL':runtimeCatalogSupport?'PASS':'UNRESOLVED',unsupportedSportsClaim?'unsupported_sports_catalog_verification_claim':card.category.startsWith('sports')?'no_independent_runtime_sports_catalog':runtimeCatalogSupport?'runtime_core_catalog_support_reported':'runtime_catalog_support_not_established',{reportedRuntimeSupport:o.claims.catalogVerified,selectedReference:o.catalog.selectedReference,physicalReferenceIndependentlyReviewed:false,basis:'retained_diagnostic_no_new_catalog_fetch'}),exactPrinting,
    condition:{retrospectiveConfirmation:retrospectiveConfirmation(reference?.retrospectiveConfirmation),blindedBenchmarkEstablished:false,accuracy:reviewed?'human_adjudicated':'NOT TESTED',categories:condition,evidence:a.conditionEvidence||{states:{},findings:[],limitations:[]},referenceAssessmentAvailable:reviewed},
    calls:hasAudit?{paidModelCalls:count(audit.paidModelCalls),marketplaceCalls:count(audit.marketplaceCalls),basis:'owner_retained_boundary_audit'}:unknownCounts,
    costs:{estimatedUsd:hasCost?amount(cost.estimatedUsd):null,observedUsd:hasCost?amount(cost.observedUsd):null,basis:hasCost?'owner_retained_cost_reference':'unknown'},usage:o.usage,financialStatus:'WITHHELD'};
  });
  return {cardId:card.id,expectedIdentity:card.displayName,groundTruth:card.groundTruth,independentReferences:card.independentReferences||[],physicalPrintingGroundTruth:'not_independently_reviewed',conditionGroundTruth:card.conditionReference,status:!runs.some(r=>r.evidenceKind==='live_scan')?'NOT RUN':runs.some(r=>r.status==='FAIL')?'FAIL':'UNRESOLVED',attempts:runs,
   identityBaseline:!runs.length?compareReferenceFields(card,{},false):null,conditionBaseline:!runs.length?Object.fromEntries(categories.map(k=>[k,result('NOT TESTED','no_real_photo_attempt_or_human_reference')])):null,
   calls:!runs.length?{paidModelCalls:0,marketplaceCalls:0,basis:'not_run'}:null,costs:!runs.length?{estimatedUsd:null,observedUsd:0,basis:'no_requests_made'}:null};
 });
 return {version:1,cohortId:manifest.cohortId,baselineCommit:manifest.baselineCommit,status:rows.every(r=>r.status==='NOT RUN')?'NOT RUN':rows.some(r=>r.status==='FAIL')?'FAIL':'UNRESOLVED',accuracyRate:null,rows,limitations:['Owner-supplied reference facts are not independently verified physical-copy facts.','Correct predictions never authorize printing verification or financial outputs.','Diagnostic redaction/missing fields remain unresolved; exact defect coordinates are not reconstructed.','Full-scan token usage and exact provider billing/call counts may not be retained; unknown values remain unknown.','No overall accuracy percentage is calculated.']};
}
const cell=v=>String(v??'unknown').replace(/[|<>\r\n]/g,' ');
export function referenceScorecardMarkdown(result){
 const out=['# Phase 3L controlled real-card validation',`Baseline: ${result.baselineCommit}`,`Overall: **${result.status}**. No accuracy percentage is available.`];
 for(const c of result.rows){out.push(`\n## ${c.cardId} — ${c.expectedIdentity}`,`Status: **${c.status}**. Ground truth: owner supplied; independent physical-printing review pending.`);
  if(!c.attempts.length){out.push('Real front/back photographs and a new owner-authorized scan are unavailable. This case is NOT RUN.', '| Field | Expected | Original AI | Canonical | Result |','|---|---|---|---|---|',...REFERENCE_FIELDS.map(k=>`| ${k} | ${cell(c.groundTruth.fields[k].value)} | Not observed | Not observed | NOT TESTED |`),'Condition: corners, edges, surface and centering — NOT TESTED. No owner-approved physical condition assessment.','Paid model calls: 0. Marketplace calls: 0. Observed spend: USD 0 (no requests). Expected per-request cost: unknown.');continue;}
  for(const a of c.attempts){out.push(`\n### ${a.attemptId} — ${a.status}`,`Technical: ${a.technical.status}; failure/reason: ${a.technical.reason}; rule: ${a.technical.rule||'unknown'}.`,`Prepared JPEG / manifest integrity: ${a.photoLinkage.preparedPairVerified?'VERIFIED — actual files read and matched':'NOT VERIFIED in this evaluation'}. Owner physical-card linkage / formal approval: ${a.photoLinkage.ownerReferenceBound?'recorded':'MISSING / UNRESOLVED'}.`,
   `Runtime core catalog: ${a.runtimeCoreCatalog.status}; independently reviewed physical reference: no. Overall catalog: ${a.catalog.outcome||'unknown'}. Exact printing: ${a.exactPrinting.status}.`,
   `Observed original identity mismatches: ${a.observedOriginalErrors.join(', ')||'none established'}. Canonical corrections matching the declared reference: ${a.observedCanonicalCorrections.join(', ')||'none established'}. These comparisons do not replace formal approval.`,
   '', '| Field | Expected | Original AI / comparison | Canonical / comparison |','|---|---|---|---|',...REFERENCE_FIELDS.map(k=>`| ${k} | ${cell(a.preliminaryIdentity[k].expected)} | ${cell(a.preliminaryIdentity[k].original)} / ${a.preliminaryIdentity[k].originalComparison} | ${cell(a.preliminaryIdentity[k].canonical)} / ${a.preliminaryIdentity[k].canonicalComparison} |`),'', 'Formal approval-gated identity scoring:', '','| Field | Reference | AI / status | Canonical / status |','|---|---|---|---|',...REFERENCE_FIELDS.map(k=>`| ${k} | ${cell(c.groundTruth.fields[k].value)} | ${cell(a.prediction[k].observed)} / ${a.prediction[k].status} | ${cell(a.canonical[k].observed)} / ${a.canonical[k].status} |`),`Reasons: ${a.reasons.join(', ')}.`,`Owner retrospective confirmation: ${a.condition.retrospectiveConfirmation?a.condition.retrospectiveConfirmation.findings.map(f=>(f.side||'side unspecified')+' '+f.attribute+' '+f.code).join('; ')+' — AFTER ANALYSIS, not blinded ground truth; no localization or severity established.':'not recorded in structured review context'}.`,
   `Blinded condition benchmark established: no. Condition accuracy: ${a.condition.accuracy}. Findings: ${a.condition.evidence.findings.length}; exact coordinates not retained in diagnostic.`,...categories.map(k=>`${k}: ${a.condition.categories[k].status} (${a.condition.evidence.states[k]||'finding state unknown'}).`),'| Finding | Side | Code | Certainty | Disposition / location |','|---|---|---|---|---|',...a.condition.evidence.findings.map(f=>`| ${cell(f.attribute)} | ${cell(f.side)} | ${cell(f.code)} | ${cell(f.certainty)} | ${cell(f.reasons.join(', '))}; coordinates not retained |`),`Photo limitations: ${a.condition.evidence.limitations.join(', ')||'not retained or none reported'}.`,`Paid model calls: ${a.calls.paidModelCalls??'unknown'}; marketplace calls: ${a.calls.marketplaceCalls??'unknown'}. Estimated/observed USD: ${a.costs.estimatedUsd??'unknown'} / ${a.costs.observedUsd??'unknown'}. Financial outputs: WITHHELD.`);}
 }
 out.push('\n## Limits',...result.limitations.map(s=>'- '+s),'\nSTOP before any new paid scan or engine remediation.');return out.join('\n')+'\n';
}
