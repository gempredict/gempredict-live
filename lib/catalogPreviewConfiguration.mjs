import { catalogCrosswalkAuthorized } from './catalogSalesCrosswalk.mjs';
// Branch-scoped prospective bindings. No reviewed Card API transport has been
// registered, so setting environment variables alone cannot enable requests.
export const liveCatalogBranch='feature/live-catalog-integration-phase5n';

export const catalogRestBranch='feature/catalog-rest-adapter-phase5o';
export const catalogPreviewBranches=Object.freeze([liveCatalogBranch,catalogRestBranch]);
export const reviewedCatalogContract=null;

export function catalogConfiguration(env=process.env,contract=reviewedCatalogContract) {
 if(env.GEMPREDICT_CARD_API_CATALOG_PREVIEW_ENABLED!=='true')return {status:'catalog_provider_not_configured'};
 const key=env.THE_CARD_API_CATALOG_KEY;
 if(typeof key!=='string'||!key.trim()||key.length>512||/[\r\n]/.test(key)||key.trim()===env.THE_CARD_API_KEY?.trim())
  return {status:'catalog_credentials_missing_or_not_separate'};
 const entitlement=env.GEMPREDICT_CARD_API_CATALOG_ENTITLEMENT_REFERENCE;
 if(typeof entitlement!=='string'||!/^[a-z0-9][a-z0-9_.:-]{0,99}$/i.test(entitlement))
  return {status:'catalog_entitlement_unverified'};
 if(!contract?.crosswalkAdapter||typeof contract.search!=='function'||typeof contract.parse!=='function'||
    typeof contract.authorizeEntitlement!=='function')return {status:'catalog_contract_unverified'};
 try {
  if(contract.authorizeEntitlement(entitlement)!==true||!catalogCrosswalkAuthorized(contract.crosswalkAdapter,entitlement))return {status:'catalog_entitlement_unverified'};
 }catch{return {status:'catalog_entitlement_unverified'};}
 return {status:'ready',key,entitlement};
}
