// Allowlist numeric metrics. Never carry model prose, labels, paths or image hashes.
const ids=['anthropic','openai','google'];
const models={anthropic:'claude-sonnet-4-6',openai:'gpt-4.1-2025-04-14',google:'gemini-3.1-pro-preview'};
const fields=['subject','year','brandSet','cardNumber','language','parallel','rarity'];
const count=(v,max=100000)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
const number=(v,max=1000000)=>Number.isFinite(v)&&v>=0&&v<=max?v:null;
const ratio=v=>number(v,1);
const sum=(rows,field)=>rows.every(r=>count(r[field])!==null)?count(rows.reduce((n,r)=>n+r[field],0)):null;
export function sanitizedMetrics(report,journal,{mode,revision}) {
 if(!['smoke','full'].includes(mode)||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('invalid_metric_context');
 const rows=Array.isArray(report?.rows)?report.rows:[];
 const status=['COMPLETE_NOT_AUTOMATIC_APPROVAL','STOPPED_SAFETY_FAILURE','BLOCKED_SPEND_POLICY','INCOMPLETE','BLOCKED','BLOCKED_USAGE_UNAVAILABLE'].includes(report?.status)?report.status:'FAILED_OR_UNKNOWN';
 return {version:1,scope:mode==='smoke'?'connectivity_smoke_not_accuracy':'independently_labeled_photo_comparison_not_production_approval',mode,revision,status,
  attemptedRequests:count(journal?.attemptedRequests??report?.providerRequestsAttempted,18),reservedMaximumUSD:number(journal?.reservedMaximumUSD,5),billingCapClaimed:false,
  providers:Object.fromEntries(ids.map(id=>{
   const all=rows.filter(row=>row?.provider===id&&row.requestAttempted!==false),valid=all.filter(row=>!row.error),summary=report?.summaries?.[id];
   return [id,{requestedModel:models[id],requests:count(journal?.providerAttempts?.[id]??(all.length?all.length:report?.providerRequestsAttempted===0?0:null),6),validResponses:count(valid.length,6),exactIdentityCorrect:valid.length?count(valid.filter(row=>row.exactIdentity===true).length,6):null,identityAccuracy:Object.fromEntries(fields.map(field=>[field,ratio(summary?.identityAccuracy?.[field])])),
    falsePositiveDefects:valid.length?sum(valid,'falsePositiveDefects'):null,falseNegativeDefects:valid.length?sum(valid,'falseNegativeDefects'):null,unsupportedConfirmedClaims:valid.length?sum(valid,'unsupportedConfirmedClaims'):null,
    highConfidenceWrong:count(summary?.highConfidenceWrong,6),identityBrierScore:ratio(summary?.identityBrierScore),identityAbstentions:count(summary?.identityAbstentions,42),latencyP50Ms:number(summary?.latencyP50Ms),latencyP95Ms:number(summary?.latencyP95Ms),estimatedCostUSD:number(summary?.estimatedCostUSD,5),
    repeatedIdentityStable:mode==='full'&&Array.isArray(summary?.perImageStability)&&summary.perImageStability.length===2?summary.perImageStability.every(r=>r.identityVersions===1):null,
    repeatedConditionStable:mode==='full'&&Array.isArray(summary?.perImageStability)&&summary.perImageStability.length===2?summary.perImageStability.every(r=>r.conditionVersions===1):null}];
  }))};
}
