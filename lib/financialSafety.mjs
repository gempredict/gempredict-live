import {verificationSummary} from './reportVerification.mjs';
import {conditionPresentation} from './visualEvidence.mjs';
import {reconcileReportIdentity,identitySummary} from './pokemonReportIdentity.mjs';
// No independent sports catalog or qualified completed-sales bridge is connected
// on this branch. Neither model output, browser flags nor user review can grant
// financial trust. Preserve observations while withholding financial assertions.
export const FINANCIAL_FIELDS = Object.freeze(['rawValue','psa9Value','psa10Value','psa10Probability','psa9Probability','gradingUpside','expectedGradedValue','expectedNetValue','decisionConfidence','gemPredictScore','psa9Pop','psa10Pop','populationInsight']);
export const WITHHELD_MESSAGE = 'Valuation and grading recommendations are withheld. Exact identity, physical printing and qualified completed-sale evidence have not been independently verified.';
export function financialEligibility(identity) {
 const reasons=[];
 if(identity?.identityVerified!==true)reasons.push('independent_identity_unverified');
 if(identity?.printingVerified!==true)reasons.push('physical_printing_unverified');
 // There is deliberately no client/model flag that bypasses this contract.
 reasons.push('qualified_completed_sales_bridge_unavailable');
 return {version:1,status:'withheld',allowed:false,actionable:false,reasons};
}
export function protectFinancialReport(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))input={};
 input=reconcileReportIdentity(input);
 const nested=!!input.prediction;
 const financialDecision=financialEligibility(input.identityV2);
 const prediction={...(nested?input.prediction:input)};
 for(const key of FINANCIAL_FIELDS)prediction[key]=null;
 Object.assign(prediction,{verdict:'withheld',action:WITHHELD_MESSAGE,analysis:WITHHELD_MESSAGE,financialBasis:null,recommendation:null});
 let imageAnalysis=input.imageAnalysis?{...input.imageAnalysis,worthGrading:null,worthGradingReason:WITHHELD_MESSAGE}:null;
 if(imageAnalysis)imageAnalysis={...imageAnalysis,...conditionPresentation(imageAnalysis,{card:input.canonicalCard,identityVerified:input.pokemonIdentityStatus?.catalogVerified,trusted:false}),identityObservationOnly:true};
 if(imageAnalysis){
  for(const [key,value] of Object.entries(imageAnalysis))if(typeof value==='string'&&key!=='worthGradingReason'&&!key.startsWith('identified')&&key!=='identityNotes'){
   imageAnalysis[key]=value.split(/(?<=[.!?])\s+|\n/).filter(s=>!/(?:[$€£]|\b(?:profit|roi|worth grading|grade it|submit (?:it|now)|recommend.*(?:grad|submi)))\b/i.test(s)).join(' ');
  }
 }
 let marketData=input.marketData?{...input.marketData,discoveryOnly:true,identityVerified:false,valuationTrusted:false,marketSummary:{...input.marketData.marketSummary,fairMarketValue:null,valuationTrusted:false,priceBasis:'active_asking_listings'}}:null;
 if(marketData&&(!input.identityV2&&!input.identityVerification||input.identityVerification&&!input.pokemonIdentityStatus?.catalogVerified))marketData={...marketData,marketSummary:{...marketData.marketSummary,rawMedian:null,rawUsedCount:0,marketConfidence:0}};
 const verification={status:'untrusted',reason:financialDecision.reasons[0],explanation:WITHHELD_MESSAGE};
 const metadata={financialDecision,valuationVerification:verification,identityV2:input.identityV2||null,identityEvidence:input.identityEvidence||null,sportsIdentityAudit:input.sportsIdentityAudit||null,atlas:null,imageAnalysis,marketData};
 return nested?{...input,...metadata,prediction}:{...prediction,...metadata};
}
export function reportFromResponse(payload) {
 const safe=protectFinancialReport(payload);
 return protectFinancialReport({...safe,...safe.prediction,prediction:undefined});
}
export function protectedCopySummary(report) {
 const r=protectFinancialReport(report);
 const parts=[`GemPredict Report — ${r.canonicalCard?.displayName||r.cardTitle||'Unidentified card'}`,identitySummary(r),verificationSummary(r),WITHHELD_MESSAGE];
 if(r.imageAnalysis){
  const a=r.imageAnalysis;
  parts.push('Photo observations: '+Object.entries(a.conditionAssessments||{}).map(([attribute,assessment])=>attribute+': '+assessment.observations.map(o=>
   (o.side||'unknown photo')+' '+o.text+' ('+o.certainty+(o.cue?'; cue '+o.cue:'')+')'+(o.region?' [model-proposed image region '+o.region.join(', ')+']':'')
  ).join('; ')).join(' | '));
  parts.push('Inspection coverage: '+(a.inspectionCoverage||[]).map(c=>
   c.side+' '+c.attribute+' '+c.status+' ('+c.reason+')'+(c.regions.length?' reported regions: '+c.regions.map(r=>(r.effectiveStatus||r.status)+' ['+r.region.join(', ')+']').join(', '):'')+
   (c.limitations.length?' limitations: '+c.limitations.map(l=>l.code+(l.region?' at '+l.region.join(', '):' across side')).join(', '):'')
  ).join('; '));
  if(a.conditionEvidenceLimits?.observationsExceeded||a.conditionEvidenceLimits?.coverageExceeded)parts.push('Evidence format limit exceeded; retained findings unassessable.');
  if(a.imageLimitations?.length)parts.push('Photo limitations: '+a.imageLimitations.map(code=>code.replace(/_/g,' ')).join('; '));
  parts.push('Centering geometry: not independently established; clean observations apply only to reported areas.');
 }
 return parts.join(' | ');
}
