// Local/private evidence reader only. Reuses the actual image validator; no network or image conversion.
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {validateAnalysisImage} from './uploadValidation.mjs';
import {MAX_IMAGE_BYTES} from './mobileImages.mjs';
import {controlledConditionEvidence,retrospectiveConfirmation} from './referenceValidation.mjs';
import {safeIdentityText} from './identificationBenchmark.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function readBoundedJson(file,max=2*1024*1024){if(!file||statSync(file).size>max)throw Error('validation_input_missing_or_too_large');return JSON.parse(readFileSync(file,'utf8'));}
function safeReview(r={}){
 const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(v)?v:null;
 const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:null;
 const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<10000?v:null;
 const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000?v:null;
 return {version:r.version,cardId:id(r.cardId),ownerApproved:r.ownerApproved===true,physicalCardId:id(r.physicalCardId),reviewer:safeIdentityText(r.reviewer),reviewedAt:typeof r.reviewedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt)?r.reviewedAt:null,referenceManifestVersion:r.referenceManifestVersion,preparedHashes:{front:sha(r.preparedHashes?.front),back:sha(r.preparedHashes?.back)},callAudit:{paidModelCalls:integer(r.callAudit?.paidModelCalls),marketplaceCalls:integer(r.callAudit?.marketplaceCalls),sourceReference:id(r.callAudit?.sourceReference)},costAudit:{estimatedUsd:amount(r.costAudit?.estimatedUsd),observedUsd:amount(r.costAudit?.observedUsd),sourceReference:id(r.costAudit?.sourceReference)},conditionReview:{retrospectiveConfirmation:retrospectiveConfirmation(r.conditionReview?.retrospectiveConfirmation),ownerApproved:r.conditionReview?.ownerApproved===true,referenceAssessmentId:id(r.conditionReview?.referenceAssessmentId),adjudicationId:id(r.conditionReview?.adjudicationId),diagnosticSha256:sha(r.conditionReview?.diagnosticSha256),categories:Object.fromEntries(['corners','edges','surface','centering'].map(k=>[k,['PASS','FAIL','UNRESOLVED','NOT TESTED'].includes(r.conditionReview?.categories?.[k])?r.conditionReview.categories[k]:'NOT TESTED']))}};
}
export async function readControlledValidationAttempt(options,manifest,importEvidence){
 const raw=readBoundedJson(options.input),prepared=readBoundedJson(options['prepared-manifest'],6000),review=options.review?safeReview(readBoundedJson(options.review,24576)):safeReview();
 if(!manifest.cards.some(c=>c.id===options.card)||!options.id)throw Error('validation_card_or_attempt_invalid');
 if(raw.version!==1||raw.environment!=='preview'||raw.stage!=='full'||!raw.conditionValidation||raw.conditionValidation.marketplace!=='not_requested'||raw.conditionValidation.preparedImagesMatched!==true||raw.conditionValidation.reason!=='owner_condition_validation')throw Error('validation_controlled_diagnostic_required');
 if(!/^[-a-f0-9]{36}$/.test(raw.scanId||'')||!/^[a-f0-9]{40}$/.test(raw.commit||'')||!/^[-a-f0-9]{36}$/.test(prepared.attemptId||''))throw Error('validation_scan_metadata_invalid');
 if(prepared.version!==1||prepared.attemptId!==raw.conditionValidation.attemptId||prepared.revision!==raw.commit||raw.conditionValidation.revision!==raw.commit)throw Error('validation_prepared_attempt_or_revision_mismatch');
 const hashes={};
 for(const side of ['front','back']){
  const file=options[side+'-file'];if(!file||statSync(file).size>MAX_IMAGE_BYTES)throw Error('validation_original_prepared_file_required');const bytes=readFileSync(file);
  if(await validateAnalysisImage(bytes)!=='image/jpeg')throw Error('validation_prepared_jpeg_required');const metadata=await sharp(bytes).metadata(),p=prepared.files?.[side],d=raw.images?.[side];hashes[side]=hash(bytes);
  if(!p||p.side!==side||p.mime!=='image/jpeg'||p.sha256!==hashes[side]||p.size!==bytes.length||p.width!==metadata.width||p.height!==metadata.height||d?.preparedSha256!==hashes[side]||d.presence!=='present'||d.validation!=='passed'||d.width!==metadata.width||d.height!==metadata.height||d.format!=='jpeg')throw Error('validation_prepared_pair_mismatch');
 }
 const observation=importEvidence(raw,{id:options.id,cardId:options.card,cohortId:manifest.cohortId,attemptIndex:Number(options.attempt||1),photoHashes:hashes,evidenceDigest:hash(readFileSync(options.input)),allowControlledFull:true});
 if(!observation.id||!observation.cardId||!observation.attemptIndex)throw Error('validation_attempt_metadata_invalid');
 if(raw.synthetic===true||raw.evidenceKind==='synthetic')observation.evidenceKind='synthetic';else if(raw.evidenceKind==='owner_reported_summary')observation.evidenceKind='owner_reported_summary';
 return {evidenceOrigin:observation.evidenceKind==='live_scan'?'owner_exported_controlled_diagnostic':observation.evidenceKind,observation,preparedPairVerified:true,referenceReview:review,conditionEvidence:controlledConditionEvidence(raw)};
}
