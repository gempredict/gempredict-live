import {scoreListing} from './pokemonListingMatch.mjs';
// Pure final-identity checks shared by server, display and saved-report restore.
import {identitySearchGate,catalogIdentityConflicts} from './catalogIdentity.mjs';
export function pokemonReportStatus(report={}){
 const verification=report.identityVerification;
 const gate=identitySearchGate(verification,report.canonicalCard);
 if(report.userIdentityConflicts?.length){gate.allowed=false;gate.reason='user_identity_conflict';}
 return {catalogVerified:gate.allowed,physicalPrintingVerified:false,artworkVerified:false,gate,
  conflicts:[...(verification?.catalog?.conflicts||[]),...catalogIdentityConflicts(report.canonicalCard,verification?.catalog?.candidate)],
  source:verification?.catalog?.source||null,referenceId:verification?.catalog?.referenceId||null};
}
export function reconcileReportIdentity(input){
 if(input.identityV2?.category!=='pokemon'&&!input.identityVerification)return input;
 const status=pokemonReportStatus(input),card=input.canonicalCard;
 let marketData=input.marketData;
 if(marketData?.rawComparableItems){
  const canonical={player:card?.subject,year:card?.year,set:card?.brandSet,cardNumber:card?.cardNumber,parallel:card?.parallel,language:card?.language,autoOrRelic:card?.autoOrRelic,printRun:card?.printRun};
  const expanded=t=>String(t||'').replace(/\b(?:special illustration rare|sir)\b/gi,'Special Art').replace(/\b(?:alt(?:ernate)?\s*art(?:work)?|AA)\b/gi,'Alternate Art').replace(/\b(?:special\s*art(?:work)?|SP)\b/gi,'Special Art').replace(/\bnonholo\b/gi,'Non-Holo');
  const eligible=status.catalogVerified?marketData.rawComparableItems.filter(item=>scoreListing(expanded(item.title),'',canonical,item).comparable):[];
  if(eligible.length!==marketData.rawComparableItems.length)marketData={...marketData,rawComparableItems:eligible,marketSummary:{...marketData.marketSummary,rawMedian:null,rawLowest:null,rawHighest:null,rawUsedCount:0,marketConfidence:0}};
 }

 return {...input,marketData,pokemonIdentityStatus:status,valuationIdentityGate:status.gate,
  identityV2:{...input.identityV2,category:'pokemon',subject:card?.subject||null,year:card?.year||null,set:card?.brandSet||null,collectorNumber:card?.cardNumber||null,language:card?.language||null,parallel:card?.parallel||null,rarity:card?.rarity||null,title:card?.displayName||'Unidentified card',identityStatus:status.catalogVerified?'catalog_verified':'unresolved',identityVerified:status.catalogVerified,printingVerified:false,priceLookupEligible:false,catalog:status.referenceId?{provider:status.source,id:status.referenceId}:null}};
}
export function identitySummary(report){
 const status=report.pokemonIdentityStatus;
 if(!status)return 'Identity: unverified';
 const original=report.originalIdentityObservation||{};
 return `Catalog identity: ${status.catalogVerified?'verified':'unresolved'}${status.referenceId?' ('+status.source+':'+status.referenceId+')':''} | Language: ${report.canonicalCard?.language||'unresolved'} | Rarity: ${report.canonicalCard?.rarity||'unresolved'} | AI observation: ${[original.identifiedYear,original.identifiedBrandSet,original.identifiedSubject,original.identifiedCardNumber,original.identifiedLanguage,original.identifiedParallel].filter(Boolean).join(' ')||'unavailable'} | Conflicts: ${[...new Set([...status.conflicts,...(report.userIdentityConflicts||[]).map(c=>c.field)])].join(', ')||'none'} | Variant: ${report.variantVerification?.status||'unresolved'} | Artwork: ${report.artworkStatus?.status||'not_verified'} | Physical printing: unverified`;
}
