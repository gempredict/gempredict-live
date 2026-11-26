import { salesIntelligenceBranch } from './salesIntelligence.mjs';
import { createCardApiCatalogSearchContract } from './cardApiCatalogSearchContract.mjs';
import { catalogCrosswalkAuthorized } from './catalogSalesCrosswalk.mjs';
// Provider configuration is server-side and scoped to the owner Preview.
export const liveCatalogBranch='feature/live-catalog-integration-phase5n';

export const catalogRestBranch='feature/catalog-rest-adapter-phase5o';
export const catalogResponseBranch='fix/catalog-response-contract-phase5o1';
export const catalogPreviewBranches=Object.freeze([liveCatalogBranch,catalogRestBranch,catalogResponseBranch,salesIntelligenceBranch]);
const searchContract=createCardApiCatalogSearchContract();
export function registeredCatalogContract(env) {
 return [catalogResponseBranch,salesIntelligenceBranch].includes(env.VERCEL_GIT_COMMIT_REF)?searchContract:null;
}

export function catalogConfiguration(env=process.env,contract=registeredCatalogContract(env),now=Date.now()) {
 if(env.GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED!=='true')return {status:'catalog_provider_not_configured'};
 const key=env.THE_CARD_API_CATALOG_KEY;
 if(typeof key!=='string'||!key.trim()||key.length>512||/[\r\n]/.test(key)||key.trim()===env.THE_CARD_API_KEY?.trim())
  return {status:'catalog_credentials_missing_or_not_separate'};
 const reference=env.GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE;
 if(typeof reference!=='string'||!/^[a-z0-9][a-z0-9_.:-]{0,99}$/i.test(reference))
  return {status:'catalog_entitlement_unverified'};
 if(!contract?.crosswalkAdapter||typeof contract.search!=='function'||typeof contract.parse!=='function'||
    typeof contract.authorizeEntitlement!=='function')return {status:'catalog_contract_unverified'};
 const entitlement=contract.requiresDatedApproval?{
  reference,tier:env.GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_TIER,
  expiresAt:env.GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_VERIFIED_UNTIL,checkedAt:now,
 }:reference;
 try {
  if(contract.authorizeEntitlement(entitlement,now)!==true||!catalogCrosswalkAuthorized(contract.crosswalkAdapter,entitlement))return {status:'catalog_entitlement_unverified'};
 }catch{return {status:'catalog_entitlement_unverified'};}
 return {status:'ready',key,entitlement};
}
