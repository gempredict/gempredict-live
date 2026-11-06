import {catalogNameKey} from './catalogNormalization.mjs';
import {describeCatalogComparison} from './catalogComparison.mjs';
import {withPhotoIdentityStatus} from './photoIdentity.mjs';
import {catalogOutcome} from './catalogResolution.mjs';
import {scoreListing} from './pokemonListingMatch.mjs';
// Pure final-identity checks shared by server, display and saved-report restore.
import {identitySearchGate,catalogIdentityConflicts} from './catalogIdentity.mjs';
export function pokemonReportStatus(report={}){
 const verification=report.identityVerification;
 const gate=identitySearchGate(verification,report.canonicalCard);
 const comparison=describeCatalogComparison(verification,report.canonicalCard,report.userIdentityConflicts);
 if(report.userIdentityConflicts?.length){gate.allowed=false;gate.reason='user_identity_conflict';}
 return {comparison,coreCatalogIdentity:comparison.core,printingComparison:comparison.printing,catalogOutcome:gate.allowed?'supported':(gate.conflicts?.length||report.userIdentityConflicts?.length)&&verification?.catalog?.candidate?'conflict':catalogOutcome(verification?.catalog)==='supported'?'incomplete':catalogOutcome(verification?.catalog),catalogVerified:gate.allowed,physicalPrintingVerified:false,artworkVerified:false,gate,
  conflicts:[...new Set([...(verification?.catalog?.conflicts||[]),...catalogIdentityConflicts(report.canonicalCard,verification?.catalog?.candidate)])],
  source:verification?.catalog?.source||null,referenceId:verification?.catalog?.referenceId||null};
}
export function reconcileReportIdentity(input){
 if(input.identityV2?.category!=='pokemon'&&!input.identityVerification)return withPhotoIdentityStatus(input);
 const status=pokemonReportStatus(input),card=input.canonicalCard;
 const raritySupported=status.coreCatalogIdentity.supported&&!!card?.rarity&&!!input.identityVerification?.catalog?.candidate?.rarity&&catalogNameKey(card.rarity)===catalogNameKey(input.identityVerification.catalog.candidate.rarity);
 let marketData=input.marketData;
 if(marketData?.rawComparableItems){
  const canonical={player:card?.subject,year:card?.year,set:card?.brandSet,cardNumber:card?.cardNumber,parallel:card?.parallel,language:card?.language,autoOrRelic:card?.autoOrRelic,printRun:card?.printRun};
  const expanded=t=>String(t||'').replace(/\b(?:special illustration rare|sir)\b/gi,'Special Art').replace(/\b(?:alt(?:ernate)?\s*art(?:work)?|AA)\b/gi,'Alternate Art').replace(/\b(?:special\s*art(?:work)?|SP)\b/gi,'Special Art').replace(/\bnonholo\b/gi,'Non-Holo');
  const eligible=status.catalogVerified?marketData.rawComparableItems.filter(item=>scoreListing(expanded(item.title),'',canonical,item).comparable):[];
  if(eligible.length!==marketData.rawComparableItems.length)marketData={...marketData,rawComparableItems:eligible,marketSummary:{...marketData.marketSummary,rawMedian:null,rawLowest:null,rawHighest:null,rawUsedCount:0,marketConfidence:0}};
 }

 return withPhotoIdentityStatus({...input,marketData,pokemonIdentityStatus:status,coreCatalogIdentity:status.coreCatalogIdentity,catalogComparison:status.comparison,...(input.stage==='identity'?{rarityVerification:{status:raritySupported?'catalog_supported':'unverified',verified:raritySupported,source:raritySupported?'tcgdex':null}}:{}),valuationIdentityGate:status.gate,
  identityV2:{...input.identityV2,category:'pokemon',subject:card?.subject||null,year:card?.year||null,set:card?.brandSet||null,collectorNumber:card?.cardNumber||null,language:card?.language||null,parallel:card?.parallel||null,rarity:card?.rarity||null,title:card?.displayName||'Unidentified card',identityStatus:status.catalogVerified?'catalog_verified':'unresolved',identityVerified:status.catalogVerified,printingVerified:false,priceLookupEligible:false,catalog:status.referenceId?{provider:status.source,id:status.referenceId}:null}});
}
export function identitySummary(report){
 const status=report.pokemonIdentityStatus;
 if(!status)return 'Identity: unverified'+(report.photoIdentityStatus?' | Printed evidence: '+report.photoIdentityStatus.status+' | Printed conflicts: '+(report.photoIdentityStatus.conflicts.join(', ')||'none'):'');
 const original=report.originalIdentityObservation||{};
 return `${report.stage==='identity'?'Catalog record':'Catalog identity'}: ${status.catalogVerified?(report.stage==='identity'?'supported':'verified'):'unresolved'}${status.referenceId?' ('+status.source+':'+status.referenceId+')':''} | Core catalog identity: ${status.coreCatalogIdentity?.status||'unresolved'} | Printing comparison: ${status.printingComparison?.status||'not_verified'} | Initial conflicts: ${status.comparison.initialConflicts.join(', ')||'none'} | Final conflicts: ${status.comparison.finalConflicts.join(', ')||'none'} | Catalog result: ${status.catalogOutcome} | Language: ${report.canonicalCard?.language||'unresolved'} | Rarity: ${report.canonicalCard?.rarity||'unresolved'} | Rarity status: ${report.rarityVerification?.status||'not separately assessed'} | Original AI Observation — Unverified: ${[original.identifiedYear,original.identifiedBrandSet,original.identifiedSubject,original.identifiedCardNumber,original.identifiedLanguage,original.identifiedParallel].filter(Boolean).join(' ')||'unavailable'} | Conflicts: ${[...new Set([...status.conflicts,...(report.userIdentityConflicts||[]).map(c=>c.field)])].join(', ')||'none'} | Printed set marking: ${(report.identityVerification?.printed?.setMarkings||[]).map(r=>r.text).join(', ')||'unavailable'} | Copyright evidence: ${(report.identityVerification?.printed?.copyright||[]).map(r=>r.text).join(', ')||'unavailable'} (not release-year proof) | Proposed release year: ${original.identifiedYear||'unresolved'} | Printed evidence: ${report.photoIdentityStatus?.status||'not separately assessed'} | Missing clear readings: ${report.photoIdentityStatus?.missingReadings?.join(', ')||'none'} | Printed conflicts: ${report.photoIdentityStatus?.conflicts?.join(', ')||'none'} | Variant: ${report.variantVerification?.status||'unresolved'} | Artwork: ${report.artworkStatus?.status||'not_verified'} | Physical printing: unverified`;
}
