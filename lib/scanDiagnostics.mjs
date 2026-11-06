import {catalogConflictFields} from './catalogComparison.mjs';
import {safeIdentityCompletion} from './identityCompletion.mjs';
import {safeIdentityValidation} from './identityValidation.mjs';
import {catalogOutcome,safeCatalogReasons} from './catalogResolution.mjs';
import {safeScanFailure} from './scanFailures.mjs';
import {conditionAssessmentLabels} from './photoConditionLabels.mjs';
// Request-local observer. Raw images/model bodies are never retained or exported.
import crypto from 'node:crypto';
import sharp from 'sharp';
import {diagnosticSession,issueDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from './scanDiagnosticsAuth.mjs';
import {observationSupport,readVisualEvidence,readModelPhotoNotes} from './visualEvidence.mjs';
import {FINANCIAL_FIELDS} from './financialSafety.mjs';
const attributes=['centering','corners','edges','surface'];
const identityFields=['identifiedYear','identifiedSubject','identifiedBrandSet','identifiedCardNumber','identifiedParallel','identifiedLanguage','identifiedRarity','identifiedManufacturer','identifiedFranchise','identifiedAutoOrRelic','identifiedSport','identifiedTeam','identifiedSerialNumber'];
const canonicalFields=['subject','year','brandSet','cardNumber','language','parallel','rarity'];
const enumValue=(value,values)=>values.includes(value)?value:'unknown';
const count=n=>Number.isFinite(n)?Math.min(100000,Math.max(0,Math.floor(n))):null;
function identityText(value){
 if(typeof value!=='string'||value.length>80||!/[\p{L}\p{N}]/u.test(value)||!/^[\p{L}\p{N} '\-:()./#&+]+$/u.test(value)||
  /https?:|www\.|(?:^|\s)\/|\b(?:sk-|bearer|token|secret|password|credential)|\d+\.\d+\.\d+\.\d+|[a-z0-9]{32}|^(?:file:|[a-z]:\/)|^(?:AKIA|ASIA)[A-Z0-9]{16}$/i.test(value)||value.includes(':')&&/^[a-f0-9:]+$/i.test(value))return null;
 return value;
}
const canonical=card=>Object.fromEntries(canonicalFields.map(f=>[f,identityText(card?.[f])]));
const identityState=value=>value==null?'missing':typeof value!=='string'?'invalid_type':identityText(value)?'returned':'redacted_for_export';
const stateValues=['unassessable','suspected_defect','confirmed_visible_defect','no_defect_observed'];
// Controlled vocabulary summaries, never verbatim provider prose.
function photoNotes(a){
 const terms=['centering','border','corners','edges','surface','whitening','scratches','glare','blur','resolution','sleeve','sharp','soft','unclear','visible','reflection','print lines'];
 return readModelPhotoNotes(a||{}).slice(0,8).map(n=>({attribute:n.attribute,side:n.side,
  mentions:terms.filter(t=>new RegExp('\\b'+t+'\\b','i').test(n.text)),unverified:true}));
}
function normalizedSummary(a){
 return {identityFields:Object.fromEntries(identityFields.map(k=>[k,identityState(a?.[k])])),observations:count(a?.visualObservations?.length)||0,states:Object.fromEntries(attributes.map(k=>[k,enumValue(a?.conditionAssessments?.[k]?.state,stateValues)])),
  safePhotoNotes:photoNotes(a),displayLabels:Object.fromEntries(attributes.map(k=>[k,conditionAssessmentLabels[a?.conditionAssessments?.[k]?.state]||'Unable to assess']))};
}
function modelSummary(raw,sides){
 const object=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const rows=Array.isArray(object.visualObservations)?object.visualObservations:[];
 const all=readVisualEvidence({...object,inspectedSides:sides}).findings;
 const perSide={front:0,back:0,unknown:0},byAttribute=Object.fromEntries(attributes.map(a=>[a,0]));
 const observations=rows.slice(0,32).map((item,index)=>{
  const attribute=enumValue(item?.attribute,attributes),side=enumValue(item?.evidence?.side,['front','back']);perSide[side]++;
  if(attribute!=='unknown')byAttribute[attribute]++;
  const single=readVisualEvidence({visualObservations:[item],inspectedSides:sides}).findings[0];
  const support=single?observationSupport(item):null;
  const final=single&&all.find(f=>f.attribute===single.attribute&&f.code===single.code&&(f.evidence?.side||'unknown')===(single.evidence?.side||'unknown'));
  const reasons=[];
  if(!single)reasons.push('unsupported_attribute_or_code');
  else if(!support)reasons.push('invalid_localization_cue_or_measurement');
  else if(!sides.includes(side))reasons.push('photo_not_provided');
  else if(final?.certainty!==item.certainty)reasons.push('conflicting_or_insufficient_evidence');
  return {index,attribute,side,code:single?.code||'unknown',localizationValid:!!support,accepted:!!final,result:final?.certainty||'rejected',downgraded:!!final&&final.certainty!==item.certainty,reasons};
 });
 return {responseObject:raw&&typeof raw==='object'&&!Array.isArray(raw)?'object':'invalid_or_missing',unexpectedFieldCount:count(Object.keys(object).filter(k=>!identityFields.includes(k)&&!attributes.some(a=>k===a||k===a+'Note')&&!['visualObservations','photoNotes','imageLimitations','identityReadings','identityNotes','identityConfidence'].includes(k)).length),expectedIdentityFields:Object.fromEntries(identityFields.map(k=>[k,identityState(object[k])])),
  originalIdentity:Object.fromEntries(identityFields.map(k=>[k,identityText(object[k])])),
  uncertainty:{identityConfidence:Number.isFinite(object.identityConfidence)&&object.identityConfidence>=0&&object.identityConfidence<=100?object.identityConfidence:null,
   identityNotesPresent:typeof object.identityNotes==='string',readings:Array.isArray(object.identityReadings)?object.identityReadings.slice(0,24).map(r=>({field:enumValue(r?.field,['subject','cardNumber','setCode','language','rarityMark','copyrightYear']),certainty:enumValue(r?.certainty,['clear','uncertain','unreadable']),side:enumValue(r?.side,['front','back'])})):[]},
  structuredField:object.visualObservations==null?'missing':Array.isArray(object.visualObservations)?'array':'invalid',totalRows:rows.length,rowsTruncated:rows.length>32,byAttribute,perSide,observations,
  photoLimitations:readVisualEvidence({...object,inspectedSides:sides}).limitations,
  qualitativeFields:Object.fromEntries(attributes.map(k=>[k,typeof object[k+'Note']==='string'?'returned':'missing'])),safePhotoNotes:photoNotes({...object,inspectedSides:sides})};
}
const marketReasons=['production_host_blocked','missing_or_invalid_deployment_origin','mismatched_deployment_origin','preview_protection_token_unavailable','invalid_internal_base_url','missing_internal_base_url','identity_incomplete','market_request_unavailable'];
function rejectionCounts(m){
 const map={'wrong_player':'subject_mismatch','Subject mismatch':'subject_mismatch','wrong_year':'year_mismatch','Year mismatch':'year_mismatch','wrong_product':'set_mismatch','conflicting_product':'set_mismatch','Conflicting product/set evidence':'set_mismatch','Product/set mismatch or unconfirmed':'set_mismatch','wrong_or_missing_card_number':'collector_number_mismatch','conflicting_card_number':'collector_number_mismatch','Card number mismatch or missing':'collector_number_mismatch','parallel_not_matched':'variant_mismatch','conflicting_parallel':'variant_mismatch','Parallel mismatch or missing':'variant_mismatch','Conflicting parallel':'variant_mismatch','Holo finish mismatch':'variant_mismatch','Unexpected holo finish':'variant_mismatch','Listing language not verified':'language_unverified','Conflicting card language':'language_mismatch','serial_number_not_matched':'serial_mismatch','Numbered print run mismatch':'serial_mismatch','graded_not_raw':'grade_category_mismatch','multiple_card_lot':'lot_excluded','unmatched_auto_or_relic':'auto_relic_mismatch'};
 const counts={};for(const item of (Array.isArray(m?.rejectedItems)?m.rejectedItems:[]).slice(0,100))for(const reason of (Array.isArray(item.rejectionReasons)?item.rejectionReasons:[]).slice(0,8)){
  const code=Object.hasOwn(map,reason)?map[reason]:'other_identity_rejection';counts[code]=(counts[code]||0)+1;
 }return counts;
}
function createScanDiagnostics(req,res,{env=process.env,now=Date.now}={}){
 const session=diagnosticSession(req,env,now());if(!session)return null;
 const d={version:1,scanId:crypto.randomUUID(),commit:session.deployment.commit,environment:'preview',category:'unknown',stage:'full',
  images:{front:{presence:'unknown',validation:'not_established'},back:{presence:'unknown',validation:'not_established'}},
  visionStatus:'not_requested',model:null,normalization:null,marketplace:{attempted:false,requests:0,routing:'not_checked',protection:'not_checked',httpStatuses:[]}};
 let sides=[];
 const original=res.json;
 res.json=function(body){
  try{
   const c=body?.identityVerification?.catalog,variant=body?.variantVerification;
   const comparison=body?.catalogComparison||body?.pokemonIdentityStatus?.comparison;
   const fieldList=value=>(Array.isArray(value)?value:[]).filter(f=>catalogConflictFields.includes(f));
   d.catalogComparison=comparison?{candidateCompared:comparison.candidateCompared===true,initialConflicts:fieldList(comparison.initialConflicts),postCorrectionConflicts:fieldList(comparison.postCorrectionConflicts),finalConflicts:fieldList(comparison.finalConflicts),initialMissingFields:fieldList(comparison.initialMissingFields),finalMissingFields:fieldList(comparison.finalMissingFields),candidateMissingFields:fieldList(comparison.candidateMissingFields),core:{status:enumValue(comparison.core?.status,['supported','unresolved','conflict']),conflicts:fieldList(comparison.core?.conflicts),blockers:(comparison.core?.blockers||[]).filter(v=>['catalog_candidate_missing_or_incomplete','catalog_provenance_missing','catalog_identity_not_established','core_identity_incomplete','language_unconfirmed','collector_number_unconfirmed','protected_identity_ambiguous','core_identity_conflict','prior_core_conflict_unresolved'].includes(v))},printing:{status:enumValue(comparison.printing?.status,['conflict','unresolved','not_verified']),reason:enumValue(comparison.printing?.reason,['catalog_printing_disagreement','printing_evidence_incomplete','prior_printing_comparison_unresolved','physical_printing_not_verified']),initialProposedFinishes:(comparison.printing?.initialProposedFinishes||[]).filter(f=>['normal','holo','reverse'].includes(f)),proposedFinishes:(comparison.printing?.proposedFinishes||[]).filter(f=>['normal','holo','reverse'].includes(f)),catalogFinishFlags:Object.fromEntries(['normal','holo','reverse'].map(f=>[f,typeof comparison.printing?.catalogFinishFlags?.[f]==='boolean'?comparison.printing.catalogFinishFlags[f]:null])),conflicts:fieldList(comparison.printing?.conflicts),retainedConflicts:fieldList(comparison.printing?.retainedConflicts)},requiresConfirmation:comparison.requiresConfirmation===true,confirmationReasons:(comparison.confirmationReasons||[]).filter(v=>['protected_identity_conflict','collector_number_unconfirmed','language_unconfirmed','catalog_field_conflict'].includes(v))}:null;
   const photo=body?.photoIdentityStatus;
   d.photoIdentity=photo?{status:enumValue(photo.status,['supported','unresolved','conflict']),catalogAgrees:photo.catalogAgrees===true,photoSupported:photo.photoSupported===true,missingReadings:(photo.missingReadings||[]).filter(k=>['subject','cardNumber','setCode','language'].includes(k)),conflicts:(photo.conflicts||[]).filter(k=>['subject','cardNumber','setCode','language','parallel'].includes(k)),readingDisposition:(photo.readingDisposition||[]).slice(0,12).map(r=>({index:Number.isInteger(r.index)&&r.index>=0&&r.index<12?r.index:null,field:enumValue(r.field,['subject','cardNumber','setCode','language','rarityMark','copyrightYear']),disposition:enumValue(r.disposition,['retained','unsupported_or_invalid'])}))}:null;
   d.verificationRuntimeFailed=body?.verificationRuntimeFailed===true;
   d.stages=d.stage==='identity'?{identity:body?.success===true?'completed':'failed',condition:'not_requested',marketplace:'not_requested'}:null;
   d.responseStatus=count(res.statusCode??res.code);
   d.failureCode=safeScanFailure(body)?.code||null;
   d.canonicalIdentity=canonical(body?.canonicalCard);
   d.identity={catalogStatus:enumValue(c?.status,['verified','corrected','unavailable','unresolved','needs_confirmation','conflict','ambiguous','insufficient_evidence']),catalogVerified:body?.pokemonIdentityStatus?.catalogVerified===true,catalogOutcome:body?.pokemonIdentityStatus?.catalogOutcome||catalogOutcome(c),catalogReasonCodes:safeCatalogReasons(c),candidateCompared:!!c?.candidate,
    catalogReference:c?.source==='tcgdex'&&/^[a-z0-9-]{1,40}$/i.test(c?.referenceId||'')?{provider:'tcgdex',id:c.referenceId}:null,
    differences:canonicalFields.filter(f=>{const original={subject:'identifiedSubject',year:'identifiedYear',brandSet:'identifiedBrandSet',cardNumber:'identifiedCardNumber',language:'identifiedLanguage',parallel:'identifiedParallel',rarity:'identifiedRarity'};return d.model?.originalIdentity?.[original[f]]!==d.canonicalIdentity[f];}),
    variantStatus:enumValue(variant?.status,['verified','corrected','user_confirmed','needs_confirmation','insufficient_evidence']),
    variantEvidenceCount:count(variant?.evidenceReferences?.length),
    variantFields:Object.fromEntries(['kind','finish','art','color','treatment','printRun','autograph','relic'].map(k=>[k,{support:count(variant?.fields?.[k]?.supportingListingCount),informative:count(variant?.fields?.[k]?.informativeEvidenceCount)}])),
    unresolvedFields:(body?.pokemonIdentityStatus?.gate?.unresolvedFields||[]).filter(f=>['year','set'].includes(f)),
    artwork:enumValue(body?.artworkStatus?.status,['not_verified','unverified']),physicalPrinting:enumValue(body?.physicalPrintingStatus?.status,['unverified','not_verified']),
    printed:{setMarkings:(body?.identityVerification?.printed?.setMarkings||[]).slice(0,4).map(r=>({text:identityText(r.text)&&/^[a-z0-9 .-]{1,24}$/i.test(r.text)?r.text:null,side:enumValue(r.side,['front','back']),certainty:enumValue(r.certainty,['clear','uncertain','unreadable'])})),copyright:(body?.identityVerification?.printed?.copyright||[]).slice(0,4).map(r=>({text:typeof r.text==='string'&&/^(?:©|copyright)?\s*(?:19|20)\d{2}$/i.test(r.text.trim())?r.text:null,year:/^(?:19|20)\d{2}$/.test(r.year||'')?r.year:null,side:enumValue(r.side,['front','back'])}))},
    conflicts:(body?.pokemonIdentityStatus?.conflicts||[]).filter(f=>catalogConflictFields.includes(f)),runtimeAssets:body?.runtimeCatalogAssets?{snapshot:body.runtimeCatalogAssets.snapshot===true,license:body.runtimeCatalogAssets.license===true}:null};
   const m=body?.marketData;
   d.marketplace={...d.marketplace,unavailable:!m||m.success===false,reason:marketReasons.includes(m?.reason)?m.reason:null,accepted:count(m?.marketSummary?.rawComparableCount),rejected:count(m?.marketSummary?.rejectedCount),rejectionCodes:rejectionCounts(m),rejectionSummaryLimit:100};
   const p=body?.prediction||body;
   d.financial={status:body?.financialDecision?.status==='withheld'?'withheld':'unknown',reasons:(body?.financialDecision?.reasons||[]).filter(r=>['independent_identity_unverified','physical_printing_unverified','qualified_completed_sales_bridge_unavailable'].includes(r)),
    monetaryEstimatesBlocked:FINANCIAL_FIELDS.every(f=>p?.[f]==null),gradingRecommendationsBlocked:p?.recommendation==null&&body?.imageAnalysis?.worthGrading==null&&body?.financialDecision?.allowed===false};
   d.finalPresentation=normalizedSummary(body?.imageAnalysis);
   const ticket=issueDiagnosticTicket(d,session,now());
   res.setHeader('Cache-Control','private, no-store');res.setHeader(TICKET_HEADER,ticket);res.setHeader(SCAN_HEADER,d.scanId);
  }catch{ /* Observability failure must not alter any ordinary scan result. */ }
  return original.call(this,body);
 };
 return {
  completion(message,status){d.identityCompletion=safeIdentityCompletion(message,status);},
  validation(value){d.identityValidation=safeIdentityValidation(value);if(d.identityValidation){const v=d.identityValidation;d.visionStatus=v.phase==='request'?'provider_request_rejected':v.phase==='transport'?'transport_rejected':v.rule==='refusal'?'provider_refused':v.phase==='schema'?'schema_rejected':v.phase==='json'?'invalid_json':v.rule==='output_limit'?'output_truncated':v.rule==='empty_output'?'empty_response':'completion_rejected';if(v.phase==='schema'&&d.model)d.model.responseObject='object_rejected_by_schema';}},
  stage(value){if(value==='identity')d.stage='identity';},
  category(value){d.category=enumValue(value,['pokemon','sports','mtg','yugioh','dragonball','onepiece','tcg']);},
  async images(front,back){sides=[];for(const [side,bytes] of [['front',front],['back',back]]){
   if(!bytes){d.images[side]={presence:'absent',validation:'not_provided'};continue;}
   sides.push(side);d.images[side]={presence:'present',validation:'passed',processing:'validated_prepared_upload'};
   try{const m=await sharp(bytes).metadata();Object.assign(d.images[side],{width:Number.isInteger(m.width)&&m.width>0&&m.width<=40000000?m.width:null,height:Number.isInteger(m.height)&&m.height>0&&m.height<=40000000?m.height:null,format:enumValue(m.format,['jpeg','png','webp','gif'])});}catch{d.images[side].processing='metadata_unavailable';}
  }},
  vision(stage){if(['request_started','empty_response','provider_not_configured','provider_authentication_failed','rate_limited','request_failed'].includes(stage))d.visionStatus=stage;},
  model(raw){try{d.model=modelSummary(raw,sides);d.visionStatus=d.model.responseObject==='object'?'response_received':'invalid_json';}catch{d.model={structuredField:'invalid',capture:'unavailable'};}},
  normalized(value){d.visionStatus=value?'normalized':'normalization_failed';d.normalization=normalizedSummary(value);d.normalization.fieldDisposition=Object.fromEntries(identityFields.map(k=>[k,d.model?.expectedIdentityFields?.[k]==='missing'?'not_returned':d.normalization.identityFields[k]==='missing'?'discarded':d.normalization.identityFields[k]==='redacted_for_export'?'redacted_for_export':'retained']));},
  market(stage,value){if(stage==='routing')d.marketplace.routing=value?'validated':'blocked';if(stage==='request'){d.marketplace.attempted=true;d.marketplace.requests++;}if(stage==='status'&&Number.isInteger(value)&&value>=100&&value<=599){if(d.marketplace.httpStatuses.length<6)d.marketplace.httpStatuses.push(value);d.marketplace.protection=[401,403].includes(value)?'rejected':value>=200&&value<300?'request_succeeded':'not_established';}},
 };
}

export function beginScanDiagnostics(...args){
 try{const observer=createScanDiagnostics(...args);if(!observer)return null;
  return Object.fromEntries(Object.entries(observer).map(([name,method])=>[name,(...values)=>{
   try{const result=method(...values);return result&&typeof result.catch==='function'?result.catch(()=>{}):result;}catch{return undefined;}
  }]));
 }catch{return null;}
}
