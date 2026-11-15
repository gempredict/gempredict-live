import {catalogVariantProvenance} from './catalogVariantProvenance.mjs';
import {catalogVariantParts} from './catalogNormalization.mjs';
import {catalogIdentityConflicts} from './catalogIdentity.mjs';
import {invalidCatalogIdentityFields,validCatalogReference} from './catalogIdentityValidation.mjs';
export const catalogConflictFields=['subject','cardNumber','year','brandSet','language','parallel','finish'];
const coreFields=['subject','cardNumber','year','brandSet','language'];
const cleanFields=values=>[...new Set((Array.isArray(values)?values:[]).filter(f=>catalogConflictFields.includes(f)))];
// Core catalog facts and exact printing agreement are separate dimensions.
// This never grants pricing, photo verification or physical authentication.
export function describeCatalogComparison(verification,card,userConflicts=[]){
 const c=verification?.catalog,record=c?.candidate;
 const candidateCompared=!!record&&invalidCatalogIdentityFields(record).length===0;
 const finalConflicts=candidateCompared?cleanFields(catalogIdentityConflicts(card,record)):[];
 const retained=cleanFields(c?.conflicts),initial=cleanFields(c?.originalConflicts??c?.initialConflicts??c?.conflicts);
 const explicit=cleanFields((Array.isArray(userConflicts)?userConflicts:[]).map(v=>v?.field));
 const missing=[...new Set([...invalidCatalogIdentityFields(card),...(!card?.language?['language']:[])])];
 const candidateMissingFields=[...new Set([...invalidCatalogIdentityFields(record),...(!record?.language?['language']:[])])];
 const coreConflicts=cleanFields([...finalConflicts,...explicit]).filter(f=>coreFields.includes(f));
 const blockers=[];
 if(!candidateCompared||candidateMissingFields.length)blockers.push('catalog_candidate_missing_or_incomplete');
 if(!validCatalogReference(c)||c?.source!=='tcgdex'||record?.provider!=='tcgdex')blockers.push('catalog_provenance_missing');
 if(!['verified','corrected','conflict'].includes(c?.status))blockers.push('catalog_identity_not_established');
 if(missing.length)blockers.push('core_identity_incomplete');
 if(c?.requiresLanguageConfirmation)blockers.push('language_unconfirmed');
 if(c?.requiresNumberConfirmation)blockers.push('collector_number_unconfirmed');
 if(['year','set'].some(f=>verification?.[f]?.userValues?.length>1))blockers.push('protected_identity_ambiguous');
 if(coreConflicts.length)blockers.push('core_identity_conflict');
 if(retained.some(f=>coreFields.includes(f))&&!coreConflicts.length)blockers.push('prior_core_conflict_unresolved');
 const coreSupported=!blockers.length;
 const printingConflicts=cleanFields([...finalConflicts,...explicit]).filter(f=>['parallel','finish'].includes(f));
 const proposedParts=catalogVariantParts(card?.parallel),sourceParts=catalogVariantParts(record?.parallel);
 const proposedFinishes=[...new Set([...proposedParts.finishes,...catalogVariantParts(card?.variant?.finish).finishes])];
 const catalogFinishFlags=Object.fromEntries(['normal','holo','reverse'].map(f=>[f,typeof record?.variants?.[f]==='boolean'?record.variants[f]:null]));
 const providerEvidence=catalogVariantProvenance(record);
 const positivePrintingConflict=explicit.includes('parallel')||proposedFinishes.length===1&&proposedFinishes.some(f=>catalogFinishFlags[f]===false&&providerEvidence.kind!=='generated_legacy'||sourceParts.finishes.length===1&&sourceParts.finishes[0]!==f)||printingConflicts.includes('parallel')&&!!proposedParts.artwork&&!!sourceParts.artwork&&proposedParts.artwork!==sourceParts.artwork;
 const retainedPrinting=retained.filter(f=>['parallel','finish'].includes(f));
 return {candidateCompared,initialConflicts:initial,postCorrectionConflicts:retained,finalConflicts,
  initialMissingFields:cleanFields(c?.initialMissingFields),finalMissingFields:missing,candidateMissingFields,
  core:{status:coreSupported?'supported':coreConflicts.length?'conflict':'unresolved',supported:coreSupported,conflicts:coreConflicts,missingFields:[...new Set([...missing,...candidateMissingFields])],blockers},
  printing:{providerEvidence,status:printingConflicts.length&&positivePrintingConflict?'conflict':printingConflicts.length||retainedPrinting.length?'unresolved':'not_verified',reason:printingConflicts.length?positivePrintingConflict?'catalog_printing_disagreement':'printing_evidence_incomplete':retainedPrinting.length?'prior_printing_comparison_unresolved':'physical_printing_not_verified',conflicts:printingConflicts,retainedConflicts:retainedPrinting,initialProposedFinishes:[...new Set((Array.isArray(c?.initialProposedFinishes)?c.initialProposedFinishes:[]).filter(f=>['normal','holo','reverse'].includes(f)))],proposedFinishes,catalogFinishFlags,verified:false},
  requiresConfirmation:c?.requiresConfirmation===true,confirmationReasons:(Array.isArray(c?.confirmationReasons)?c.confirmationReasons:[]).filter(v=>['protected_identity_conflict','collector_number_unconfirmed','language_unconfirmed','catalog_field_conflict'].includes(v))};
}
