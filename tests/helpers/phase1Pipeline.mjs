import {supportedObservation} from './visionEvidence.mjs';
// October scenarios adapted to the current complete handler, not a legacy route.
import {runScan} from './reconciliationPipeline.mjs';
import {reportFromResponse,protectedCopySummary} from '../../lib/financialSafety.mjs';
export async function runPipeline(s={}){
 const p=s.proposal||{},vision={visualObservations:[supportedObservation()],identifiedSubject:p.subject,identifiedYear:p.year,identifiedBrandSet:p.brandSet,identifiedCardNumber:p.cardNumber,identifiedParallel:p.parallel,identifiedLanguage:p.language||null,identifiedAutoOrRelic:p.autoOrRelic||'none',...s.vision};
 const r=await runScan({vision,back:false,fields:{cardType:s.type||'pokemon',...s.fields},neutral:s.neutral||[],items:s.market||[],catalogOptions:s.catalogOptions||{catalogLookup:async()=>{throw Error('unconfigured');},catalogSource:'mock-unconfigured'},env:s.routingEnv||{},headers:s.requestHeaders||{},textOnly:s.textOnly});
 const report=reportFromResponse(r.payload),metrics={...r.metrics,valuationBrowse:r.metrics.internal.length,claudePrediction:r.metrics.valuation,claudeVision:r.metrics.vision,valuationQueries:r.metrics.internal.map(q=>q.q)};
 return {...r,httpStatus:r.status,report,metrics,copied:protectedCopySummary(report),errors:[]};
}
