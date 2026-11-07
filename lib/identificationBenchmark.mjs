// Offline measurement only. Never imported by a scanner handler; no network or provider calls.
export const CORE_FIELDS=['subject','year','set','cardNumber'];
export const IDENTITY_FIELDS=[...CORE_FIELDS,'manufacturer','subset','language','rarity','parallel','finish','stamps','serialNumber','autograph','regulationMark','franchise','autoOrRelic','printRun'];
export const CATEGORY_COUNTS={pokemon_standard:2,pokemon_ir:2,pokemon_sir:2,pokemon_promo:2,sports_base:1,sports_parallel:2,sports_serial_or_auto:1};
const list=value=>Array.isArray(value)?value:[];
const bool=value=>value===true?true:value===false?false:null;
const number=value=>Number.isFinite(value)&&value>=0?value:null;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;
const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)?value:null;
const code=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(value)?value:null;
export function safeIdentityText(value){
 if(typeof value!=='string'||value.length>160||/[\x00-\x1f\x7f]|https?:|data:|base64|bearer |api[_-]?key|authorization|cookie|sk-ant-/i.test(value)||/[A-Za-z0-9_-]{48,}/.test(value))return null;
 return value.trim()||null;
}
const scalar=value=>typeof value==='boolean'?value:safeIdentityText(value);
function identity(value){return Object.fromEntries(IDENTITY_FIELDS.map(k=>[k,k==='stamps'?list(value?.[k]).slice(0,12).map(safeIdentityText).filter(Boolean):scalar(value?.[k])]));}
function url(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash?u.href:null;}catch{return null;}}
function references(value){return list(value).slice(0,20).map(s=>({kind:['independent_catalog','manufacturer_checklist','owner_summary','retained_diagnostic','catalog_reference'].includes(s?.kind)?s.kind:'unknown',url:url(s?.url),path:typeof s?.path==='string'&&/^(docs|tests\/fixtures|benchmarks\/identity)\/[a-zA-Z0-9_./-]+$/.test(s.path)?s.path:null,revision:commit(s?.revision),blob:commit(s?.blob),supports:list(s?.supports).filter(k=>IDENTITY_FIELDS.includes(k))}));}
export function sanitizeObservation(value){
 const readings=list(value?.printedReadings).slice(0,24).map(r=>({field:code(r?.field),text:safeIdentityText(r?.text),certainty:['clear','uncertain','unreadable'].includes(r?.certainty)?r.certainty:null,side:['front','back'].includes(r?.side)?r.side:null,area:code(r?.area),alternatives:list(r?.alternatives).slice(0,3).map(safeIdentityText).filter(Boolean)}));
 return {id:code(value?.id),cardId:code(value?.cardId),cohortId:code(value?.cohortId),attemptIndex:Number.isInteger(value?.attemptIndex)&&value.attemptIndex>0?value.attemptIndex:null,
  evidenceKind:['live_scan','owner_reported_summary','synthetic'].includes(value?.evidenceKind)?value.evidenceKind:'unknown',
  evidenceDigest:hash(value?.evidenceDigest),deploymentCommit:commit(value?.deploymentCommit),contextCommit:commit(value?.contextCommit),scanId:code(value?.scanId),sources:references(value?.sources),
  photoHashes:{front:hash(value?.photoHashes?.front),back:hash(value?.photoHashes?.back)},
  photoLinkage:{method:code(value?.photoLinkage?.method),preparedHashes:{front:hash(value?.photoLinkage?.preparedHashes?.front),back:hash(value?.photoLinkage?.preparedHashes?.back)},backRequired:bool(value?.photoLinkage?.backRequired)},
  technical:{validCompletedResponse:bool(value?.technical?.validCompletedResponse),httpStatus:Number.isInteger(value?.technical?.httpStatus)&&value.technical.httpStatus>=100&&value.technical.httpStatus<=599?value.technical.httpStatus:null,failureCode:code(value?.technical?.failureCode),phase:code(value?.technical?.phase),rule:code(value?.technical?.rule),stopReason:code(value?.technical?.stopReason)},
  originalAI:identity(value?.originalAI),modelConfidence:number(value?.modelConfidence)<=100?number(value?.modelConfidence):null,
  reportedPrintedFacts:list(value?.reportedPrintedFacts).slice(0,12).map(r=>({field:code(r?.field),value:safeIdentityText(r?.value),certainty:['clear','uncertain','unreadable'].includes(r?.certainty)?r.certainty:null,literalTranscriptionRetained:r?.literalTranscriptionRetained===true})),printedReadings:readings,missingProposalFields:CORE_FIELDS.filter(k=>value?.originalAI?.[k]==null),canonical:identity(value?.canonical),
  catalog:{outcome:code(value?.catalog?.outcome),reasonCodes:list(value?.catalog?.reasonCodes).slice(0,30).map(code).filter(Boolean),conflicts:list(value?.catalog?.conflicts).slice(0,30).map(code).filter(Boolean),
   candidatesRetained:bool(value?.catalog?.candidatesRetained)===true?list(value?.catalog?.candidates).length<=20:bool(value?.catalog?.candidatesRetained),candidates:list(value?.catalog?.candidates).slice(0,20).map(c=>({provider:code(c?.provider),id:code(c?.id),identity:identity(c?.identity),sources:references(c?.sources)})),
   provenance:{provider:code(value?.catalog?.provenance?.provider),revision:commit(value?.catalog?.provenance?.revision),cardBlob:commit(value?.catalog?.provenance?.cardBlob),setBlob:commit(value?.catalog?.provenance?.setBlob)},
   selectedReference:value?.catalog?.selectedReference?{provider:code(value.catalog.selectedReference.provider),id:code(value.catalog.selectedReference.id)}:null},
  dimensions:Object.fromEntries(['coreCatalog','photo','variant','artwork','physicalPrinting','catalogPrinting'].map(k=>[k,code(value?.dimensions?.[k])])),
  claims:{catalogVerified:bool(value?.claims?.catalogVerified),photoVerified:bool(value?.claims?.photoVerified),printingVerified:bool(value?.claims?.printingVerified)},
  unresolvedReasons:list(value?.unresolvedReasons).slice(0,30).map(code).filter(Boolean),
  usage:Object.fromEntries(['inputTokens','outputTokens','cacheReadTokens','cacheCreationTokens'].map(k=>[k,number(value?.usage?.[k])])),
  cost:{actualUsd:number(value?.cost?.actualUsd),basis:code(value?.cost?.basis)},latencyMs:number(value?.latencyMs),
  annotations:{possibleConflation:bool(value?.annotations?.possibleConflation),distinctMarkingsUnrepresentable:bool(value?.annotations?.distinctMarkingsUnrepresentable)}};
}
export function validateManifest(manifest){
 if(!commit(manifest?.baselineCommit)||!code(manifest?.cohortId))throw Error('benchmark_cohort_metadata_invalid');
 const plan=manifest?.categoryPlan||CATEGORY_COUNTS;
 if(!Object.entries(plan).length||Object.entries(plan).some(([k,v])=>!code(k)||!Number.isInteger(v)||v<1||v>100))throw Error('benchmark_category_plan_invalid');
 if(manifest?.version!==1||!Array.isArray(manifest.cards)||manifest.cards.length!==Object.values(plan).reduce((a,b)=>a+b,0))throw Error('benchmark_manifest_slot_count_invalid');
 const ids=new Set(),physical=new Set(),photos=new Set();
 for(const c of manifest.cards){
  if(!code(c.id)||ids.has(c.id)||!Object.hasOwn(plan,c.category))throw Error('benchmark_duplicate_or_invalid_card');ids.add(c.id);
  if(c.physicalCardId){if(physical.has(c.physicalCardId))throw Error('benchmark_duplicate_physical_card');physical.add(c.physicalCardId);}
  const front=hash(c.photos?.front?.sha256);if(front){if(photos.has(front))throw Error('benchmark_duplicate_front_photo');photos.add(front);}
  if(!list(c.requiredExactFields).length||c.requiredExactFields.some(k=>!IDENTITY_FIELDS.includes(k)))throw Error('benchmark_exact_fields_required');
 }
 for(const [category,count] of Object.entries(plan))if(manifest.cards.filter(c=>c.category===category).length!==count)throw Error('benchmark_category_mix_invalid');
 return manifest;
}
const known=(truth,key)=>truth?.fields?.[key]?.status==='known'&&truth.fields[key].value!=null&&truth.fields[key].value!=='';
const independent=(truth,key)=>list(truth?.sources).some(s=>['independent_catalog','manufacturer_checklist'].includes(s.kind)&&url(s.url)&&list(s.supports).includes(key));
const normalized=value=>Array.isArray(value)?JSON.stringify(value.map(normalized).sort()):typeof value==='boolean'?String(value):String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
function truthReady(truth,fields){return truth?.status==='independently_reviewed'&&!!safeIdentityText(truth.reviewer)&&/^\d{4}-\d{2}-\d{2}$/.test(truth.reviewedAt||'')&&fields.every(k=>known(truth,k)&&independent(truth,k)||truth.fields?.[k]?.status==='not_applicable'&&independent(truth,k));}
function compare(truth,canonical,fields){
 const results=Object.fromEntries(fields.map(k=>{
  if(truth.fields?.[k]?.status==='not_applicable'){const value=canonical?.[k];return [k,value==null||value===false||value===''||Array.isArray(value)&&!value.length||['none','not applicable'].includes(normalized(value))?'not_applicable':'incorrect'];}
  if(!known(truth,k)||!independent(truth,k))return [k,'ground_truth_missing'];
  if(canonical?.[k]==null||canonical[k]===''||Array.isArray(canonical[k])&&!canonical[k].length&&list(truth.fields[k].value).length)return [k,'output_missing'];
  const acceptable=[truth.fields[k].value,...list(truth.fields[k].approvedAliases)];
  return [k,acceptable.some(v=>normalized(v)===normalized(canonical[k]))?'correct':'incorrect'];
 }));
 return {status:Object.values(results).includes('ground_truth_missing')?'unassessable':Object.values(results).includes('incorrect')?'incorrect':Object.values(results).includes('output_missing')?'incomplete':'correct',fields:results};
}
const metric=(numerator,denominator)=>({numerator,denominator,rate:denominator?numerator/denominator:null});
export function evaluateBenchmark(manifest,rawObservations){
 validateManifest(manifest);
 const observations=list(rawObservations).map(sanitizeObservation),ids=new Set();
 for(const o of observations){if(!o.id||ids.has(o.id)||!manifest.cards.some(c=>c.id===o.cardId))throw Error('benchmark_observation_reference_invalid');ids.add(o.id);}
 const rows=manifest.cards.map(card=>{
  const all=observations.filter(o=>o.cardId===card.id),attempts=all.filter(o=>o.evidenceKind==='live_scan'&&o.cohortId===manifest.cohortId);
  if(attempts.some(o=>o.attemptIndex==null)||new Set(attempts.map(o=>o.attemptIndex)).size!==attempts.length)throw Error('benchmark_attempt_order_required');
  attempts.sort((a,b)=>a.attemptIndex-b.attemptIndex);if(attempts.some((o,i)=>o.attemptIndex!==i+1))throw Error('benchmark_attempt_order_required');const first=attempts[0]||null,truth=card.groundTruth;
  const photoReady=card.photos?.front?.status==='retained_and_reviewed'&&!!hash(card.photos.front.sha256)&&!!card.physicalCardId;
  const linked=first?.photoLinkage?.method==='diagnostic_prepared_sha256'&&!!first.photoHashes.front&&first.photoLinkage.preparedHashes.front===first.photoHashes.front&&(!first.photoLinkage.backRequired||!!first.photoHashes.back&&first.photoLinkage.preparedHashes.back===first.photoHashes.back)&&(!first.photoHashes.back||first.photoLinkage.preparedHashes.back===first.photoHashes.back);
  const photoMatches=linked&&first&&photoReady&&first.photoHashes.front===card.photos.front.sha256&&(!first.photoHashes.back||card.photos?.back?.status==='retained_and_reviewed'&&first.photoHashes.back===card.photos.back.sha256);
  const coreEligible=!!photoMatches&&truthReady(truth,CORE_FIELDS),exactEligible=coreEligible&&truthReady(truth,card.requiredExactFields);
  const core=first&&coreEligible?compare(truth,first.canonical,CORE_FIELDS):{status:'unassessable',fields:{}},exact=first&&exactEligible?compare(truth,first.canonical,[...CORE_FIELDS,...card.requiredExactFields]):{status:'unassessable',fields:{}};
  const valid=first?.technical.validCompletedResponse===true;
  const recall=coreEligible&&truth.catalogId&&first?.catalog.candidatesRetained===true?first.catalog.candidates.some(c=>c.id===truth.catalogId&&c.provider===truth.catalogProvider):null;
  const verifiedIdentity=first&&coreEligible?compare(truth,first.canonical,[...CORE_FIELDS,'language']):{status:'unassessable'};
  const claimResults=first?Object.entries(first.claims).filter(([,v])=>v===true).map(([dimension])=>({dimension,result:dimension==='printingVerified'?exact.status:verifiedIdentity.status})):[];
  const incorrectClaim=claimResults.some(c=>c.result==='incorrect');
  const checklistCorroborated=card.category.startsWith('sports')&&coreEligible&&CORE_FIELDS.every(k=>list(truth.sources).some(s=>s.kind==='manufacturer_checklist'&&list(s.supports).includes(k)));
  const unsupportedSportsClaim=card.category.startsWith('sports')&&claimResults.length>0;
  let sportsStatus=null;
  if(card.category.startsWith('sports'))sportsStatus=!first?'not_scanned':core.status==='incorrect'?'incorrect_core_identity':core.status==='correct'?exact.status==='correct'&&checklistCorroborated?'manufacturer_checklist_corroborated':'ai_correct_no_independent_runtime_catalog':['not_found','unavailable'].includes(first.catalog.outcome)?'catalog_candidate_unavailable':'unresolved';
  return {cardId:card.id,category:card.category,selection:code(card.selection),displayName:safeIdentityText(card.displayName),physicalCardId:code(card.physicalCardId),
   historicalObservationIds:all.filter(o=>o.evidenceKind==='owner_reported_summary').map(o=>o.id),selectedObservationId:first?.id||null,repeatCount:Math.max(0,attempts.length-1),
   photoReady,photoMatches:!!photoMatches,coreEligible,exactEligible,technicalSuccess:first?valid:null,core,exact,candidateRecall:recall,claimResults,falseVerification:incorrectClaim,unsupportedSportsClaim,sportsStatus,
   checklistCorroborated,sportsStatuses:card.category.startsWith('sports')?[...(!first?['not_scanned']:['no_independent_runtime_catalog']),...(checklistCorroborated?['manufacturer_checklist_corroborated']:[]),...(exact.status!=='correct'?['exact_parallel_unresolved']:[]),...Object.entries({...core.fields,...exact.fields}).filter(([,v])=>v==='incorrect').map(([k])=>'incorrect_'+k)]:[],
   exactParallelUnresolved:card.category.startsWith('sports')&&exact.status!=='correct',
   gaps:[...list(card.gaps).map(code).filter(Boolean),...(!photoReady?['reviewed_photo_unavailable']:[]),...(!truthReady(truth,CORE_FIELDS)?['reviewed_core_label_unavailable']:[]),...(!first?['no_cohort_scan']:[]),...(first&&!photoMatches?['photo_pair_not_bound_to_scan']:[])],
   failure:first?.technical.failureCode||null,unresolvedReasons:first?.unresolvedReasons||[]};
 });
 const selected=rows.filter(r=>r.selectedObservationId),scored=selected.filter(r=>r.coreEligible),exact=selected.filter(r=>r.exactEligible),claims=rows.flatMap(r=>r.claimResults),adjudicable=claims.filter(c=>['correct','incorrect'].includes(c.result)),recall=rows.filter(r=>r.candidateRecall!==null);
 const live=observations.filter(o=>o.evidenceKind==='live_scan'&&o.cohortId===manifest.cohortId),history=observations.filter(o=>o.evidenceKind==='owner_reported_summary');
 const costs=live.filter(o=>o.cost.actualUsd!==null),latencies=live.filter(o=>o.latencyMs!==null);
 const repeatComparisons=[];
 for(const card of manifest.cards){
  const runs=live.filter(o=>o.cardId===card.id).sort((a,b)=>a.attemptIndex-b.attemptIndex),first=runs[0];
  for(const o of runs.slice(1)){
   const samePhotos=!!first.photoHashes.front&&first.photoHashes.front===o.photoHashes.front&&first.photoHashes.back===o.photoHashes.back;
   const comparable=samePhotos&&first.technical.validCompletedResponse===true&&o.technical.validCompletedResponse===true&&CORE_FIELDS.every(k=>first.canonical[k]!=null&&o.canonical[k]!=null);
   repeatComparisons.push({cardId:card.id,first:first.id,repeat:o.id,samePhotos,comparable,canonicalSame:comparable?IDENTITY_FIELDS.every(k=>normalized(first.canonical[k])===normalized(o.canonical[k])):null});
  }
 }

 return {version:1,baselineCommit:manifest.baselineCommit,cohortId:manifest.cohortId,cardSlots:rows.length,selectedCards:manifest.cards.filter(c=>c.physicalCardId).length,completedAccuracyTests:scored.filter(r=>r.technicalSuccess).length,
  metrics:{technicalSuccess:metric(selected.filter(r=>r.technicalSuccess).length,selected.length),coreAccuracy:metric(scored.filter(r=>r.core.status==='correct'&&r.technicalSuccess).length,scored.length),exactPrintingAccuracy:metric(exact.filter(r=>r.exact.status==='correct'&&r.technicalSuccess).length,exact.length),candidateRecall:metric(recall.filter(r=>r.candidateRecall).length,recall.length),verificationPrecision:metric(adjudicable.filter(c=>c.result==='correct').length,adjudicable.length),verificationCoverage:metric(scored.filter(r=>r.claimResults.length>0).length,scored.length),falseVerificationCount:rows.filter(r=>r.falseVerification).length,unassessableVerificationClaims:claims.length-adjudicable.length,unsupportedSportsVerificationClaims:rows.filter(r=>r.unsupportedSportsClaim).length},
  categories:Object.fromEntries(Object.keys(manifest.categoryPlan||CATEGORY_COUNTS).map(k=>[k,{slots:rows.filter(r=>r.category===k).length,attempted:selected.filter(r=>r.category===k).length,coreEligible:scored.filter(r=>r.category===k).length,exactEligible:exact.filter(r=>r.category===k).length}])),
  historical:{observations:history.length,physicalCards:new Set(history.map(o=>o.cardId)).size,technicalSuccessReported:history.filter(o=>o.technical.validCompletedResponse===true).length,failuresReported:history.filter(o=>o.technical.validCompletedResponse===false).length,accuracyEligible:0,warning:'Owner summaries are not retained response payloads, reviewed photo labels or independent accuracy trials.'},
  cost:{requestsRecorded:live.length,actualCostKnown:costs.length,actualUsd:costs.length?costs.reduce((n,o)=>n+o.cost.actualUsd,0):null,unknownCosts:live.length-costs.length},
  latency:{known:latencies.length,meanMs:latencies.length?latencies.reduce((n,o)=>n+o.latencyMs,0)/latencies.length:null},
  printedEvidenceAudit:{possibleConflations:observations.filter(o=>o.annotations.possibleConflation).map(o=>o.id),unrepresentableMarkings:observations.filter(o=>o.annotations.distinctMarkingsUnrepresentable).map(o=>o.id)},
  failureClasses:Object.fromEntries([...new Set(live.map(o=>o.technical.validCompletedResponse===false?o.technical.failureCode||'failure_unclassified':o.technical.validCompletedResponse===true?'response_completed':'technical_result_unknown'))].map(k=>[k,live.filter(o=>(o.technical.validCompletedResponse===false?o.technical.failureCode||'failure_unclassified':o.technical.validCompletedResponse===true?'response_completed':'technical_result_unknown')===k).length])),
  rows,observations,repeatComparisons,limitations:['Twelve cards do not establish statistical accuracy.','Historical summaries and synthetic fixtures never enter measured cohort accuracy.','Other TCGs are not represented in the requested initial 12-card mix.','An unassessable verification claim is not a proven false verification.']};
}
const cell=value=>String(value??'unknown').replace(/[|\r\n<>]/g,' ');
export function benchmarkMarkdown(result){
 const rate=m=>`${m.numerator}/${m.denominator}${m.rate===null?' (not measurable)':''}`;
 const table=(headers,rows)=>['| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.map(cell).join(' | ')+' |')].join('\n');
 const history=result.observations.filter(o=>o.evidenceKind==='owner_reported_summary');
 return ['# GemPredict identification benchmark',`Baseline: ${result.baselineCommit}`,`Cohort: ${result.cohortId}`,
  `Completed accuracy tests: ${result.completedAccuracyTests}. Historical observations: ${result.historical.observations} across ${result.historical.physicalCards} cards (excluded from accuracy). No zero-denominator result is an accuracy estimate.`,
  table(['Metric','Result'],Object.entries(result.metrics).map(([k,v])=>[k,typeof v==='object'?rate(v):v])),
  '## Per-card cohort outcomes',table(['Card','Category','Attempt','Core','Exact printing','Gaps'],result.rows.map(r=>[r.cardId+': '+(r.displayName||'Selection pending'),r.category,r.selectedObservationId||'none',r.core.status,r.exact.status,r.gaps.join(', ')])),
  '## Historical observations — not accuracy trials',
  table(['Observation','Card','Context commit / deployment commit','Technical result','Original proposal','Catalog outcome','Usage / latency / actual cost'],history.map(o=>[o.id,o.cardId,(o.contextCommit||'unknown')+' / '+(o.deploymentCommit||'unknown'),(o.technical.validCompletedResponse===true?'reported complete':o.technical.validCompletedResponse===false?'reported failure':'unknown')+' '+(o.technical.failureCode||''),[o.originalAI.subject,o.originalAI.year,o.originalAI.set,o.originalAI.cardNumber].filter(Boolean).join(' '),o.catalog.outcome||'unknown',`output tokens ${o.usage.outputTokens??'unknown'}; latency ${o.latencyMs??'unknown'}; cost ${o.cost.actualUsd??'unknown'}`])),
  ...history.map(o=>`- ${o.id}: model confidence ${o.modelConfidence??'unknown'}; original parallel ${o.originalAI.parallel||'unknown'}; printed readings ${o.printedReadings.map(r=>[r.field,r.text,r.certainty].filter(Boolean).join(': ')).join('; ')||'not retained'}; conflicts ${o.catalog.conflicts.join(', ')||'not reported / empty'}; unresolved reasons ${o.unresolvedReasons.join(', ')||'not retained'}.`),
  '## Category coverage',table(['Category','Slots','Attempted','Core eligible','Exact eligible'],Object.entries(result.categories).map(([k,v])=>[k,v.slots,v.attempted,v.coreEligible,v.exactEligible])),
  '## Failure classifications',Object.keys(result.failureClasses).length?table(['Classification','Cohort attempts'],Object.entries(result.failureClasses)):'No new cohort attempts. Historical failures are listed separately.',
  `Actual costs known for ${result.cost.actualCostKnown}/${result.cost.requestsRecorded} cohort attempts; actual total USD: ${result.cost.actualUsd??'unknown'}. Latency known for ${result.latency.known} attempts.`,
  '## Limits',...result.limitations.map(s=>'- '+s),''].join('\n\n');
}
