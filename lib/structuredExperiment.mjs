// Server-only, no provider requests. This is not a provider-side billing cap.
import crypto from 'node:crypto';
import {diagnosticSession,issueFullPreflight,readFullPreflight} from './scanDiagnosticsAuth.mjs';
import {fullAnalysisStructuredEnabled,FULL_ANALYSIS_SCHEMA_VERSION} from './fullAnalysisSchema.mjs';
import {VISION_MODEL,visionOutputBudget} from './visionResponsePolicy.mjs';
export const EXPERIMENT_SPEND_APPROVAL='estimate_not_hard_cap_0.50_usd';
// Fail closed if Vercel routes submission to another worker or restarts it.
// This is a per-permit guard, not a durable experiment-wide billing ledger.
const permits=new Map();
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const binding=fields=>digest(JSON.stringify({manifest:JSON.parse(fields.validationManifest),mechanism:'json_schema',schemaVersion:FULL_ANALYSIS_SCHEMA_VERSION,model:VISION_MODEL,maxOutputTokens:visionOutputBudget(true),category:fields.cardType}));
export function structuredExperimentPreflight(req,fields,controlled,env=process.env){
 const session=diagnosticSession(req,env);
 if(!session||!controlled||fields.cardType!=='sports'||fields.validationMechanism!=='json_schema')throw Error('structured_preflight_unavailable');
 const enabled=fullAnalysisStructuredEnabled(req,controlled,fields.cardType,env);
 const capability=enabled?issueFullPreflight(session,binding(fields)):null;
 for(const [key,value]of permits)if(value.expiresAt<=Date.now()||value.binding===binding(fields))permits.delete(key);
 if(capability){if(permits.size>=100)throw Error('preflight_capacity');permits.set(capability.ticket,{expiresAt:capability.expiresAt,binding:binding(fields)});}
 return {version:1,ready:enabled,flagEnabled:enabled,blocker:enabled?null:'Structured-output flag is disabled. Stop for owner activation approval.',
  deployment:session.deployment.origin,revision:session.deployment.commit,category:'sports',mechanism:'json_schema',schemaVersion:1,model:VISION_MODEL,maxOutputTokens:visionOutputBudget(true),
  preparedPairVerified:true,diagnostics:{available:true,successAndFailure:true,expiresAfterResponseMs:300000,ownerExpiresAt:session.exp},
  cost:{currency:'USD',proposedCeiling:0.50,planningInputTokens:100000,maximumOutputTokens:4800,inputUsdPerMillion:3,outputUsdPerMillion:15,planningSubtotal:0.372,guaranteedMaximum:false,actualInputTokens:null,actualCost:null,pricingChecked:'2026-11-13',source:'https://platform.claude.com/docs/en/about-claude/pricing',warning:'$0.50 is a proposed planning ceiling, not a guaranteed bill cap. Input/schema/image token usage is unmeasured. Separate owner approval of this uncertainty is required.'},
  policy:{providerRequestsPerSubmission:1,automaticRetries:0,promptJsonFallback:false,oneUsePermit:true,workerChangeFailsClosed:true,marketplaceRequests:0,financialOutput:'withheld',durableReplayLedger:false},
  ticket:capability?.ticket||null,expiresAt:capability?.expiresAt||null};
}
export function requireStructuredExperiment(req,fields,controlled,env=process.env){
 if(!fullAnalysisStructuredEnabled(req,controlled,fields.cardType,env)||fields.cardType!=='sports'||fields.validationMechanism!=='json_schema'||fields.validationSpendApproval!==EXPERIMENT_SPEND_APPROVAL||fields.cardName?.trim()||fields.cardSet?.trim()||fields.email?.trim())throw Error('structured_experiment_preflight_required');
 const permit=permits.get(fields.validationPreflightTicket);
 if(!permit||permit.expiresAt<=Date.now()||permit.binding!==binding(fields)||readFullPreflight(req,fields.validationPreflightTicket,env)!==binding(fields))throw Error('structured_experiment_preflight_required');
 permits.delete(fields.validationPreflightTicket); // Claim synchronously, before provider I/O.
 return true;
}
