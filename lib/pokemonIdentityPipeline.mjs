import {safeCatalogReasons} from './catalogResolution.mjs';
import {describeCatalogComparison} from './catalogComparison.mjs';
import {printedIdentityEvidence} from './visionIdentityEvidence.mjs';
import {catalogLanguageKey,catalogNameKey} from './catalogNormalization.mjs';
// Adapter over the October evidence pipeline. Never handles sports identities.
import {createTcgDexCatalog} from './pokemonCatalog.mjs';
import {resolveMarketIdentity} from './reconcileMarketIdentity.mjs';
import {reconcileVariant} from './variantVerification.mjs';
import {buildCanonicalCardFromImageAnalysis} from './pokemonCardIdentifier.mjs';
import {getUserIdentityProtection} from './userIdentityProtection.mjs';
import {verifyRuntimeCatalogAssets} from './runtimeCatalogAssets.mjs';
import {identitySearchGate} from './catalogIdentity.mjs';
export async function resolvePokemonIdentity(analysis,fields={},options={}){
 const originalIdentityObservation=structuredClone(Object.fromEntries(Object.entries(analysis||{}).filter(([key])=>key.startsWith('identified')||['identityNotes','identityReadings','identityConfidence'].includes(key))));
 const originalCanonicalCard=buildCanonicalCardFromImageAnalysis(analysis,fields.cardName,fields.cardSet);
 const assets=verifyRuntimeCatalogAssets();
 const configured=assets.snapshot&&assets.license?createTcgDexCatalog({fetchImpl:options.fetchImpl}):{catalogSource:'tcgdex',catalogLookup:async()=>({complete:false,records:[],status:'unavailable',outcome:'unavailable',reasonCode:'runtime_catalog_assets_unavailable',reason:'runtime_catalog_assets_unavailable'}),allowCatalogCorrection:true};
 const protection=getUserIdentityProtection({cardName:fields.cardName,cardSet:fields.cardSet,year:fields.year,set:fields.set,confirmedIdentity:fields.confirmedIdentity});
 const identity=await resolveMarketIdentity(originalCanonicalCard,{...configured,...options,cardType:'pokemon',...protection,visionReadings:analysis?.identityReadings||[],allowCollectorDiscovery:!!analysis,collectorNumberProtected:/\d+\s*\/\s*\d+/.test([fields.cardName,fields.cardSet].filter(Boolean).join(' '))});
 identity.identityVerification.printed=printedIdentityEvidence(analysis);
 const catalog=identity.identityVerification?.catalog;
 const coreBeforeVariant=describeCatalogComparison(identity.identityVerification,identity.canonicalCard).core;
 const variant=reconcileVariant(catalog?.source==='tcgdex'&&['verified','corrected'].includes(catalog.status)?identity.canonicalCard:originalCanonicalCard,identity.canonicalCard,{identityEvidenceItems:identity.identityEvidenceItems,search:identity.search});
 if(catalog?.requiresConfirmation||!['verified','corrected'].includes(catalog?.status))variant.variantVerification={...variant.variantVerification,status:'needs_confirmation',explanation:'Catalog identity is conflicting, incomplete or unconfirmed; physical printing and financial analysis remain unverified.'};
 let canonicalCard=variant.canonicalCard;
 // Marketplace consensus is diagnostic until an independent catalog agrees.
 if(!['verified','corrected'].includes(catalog?.status)&&!coreBeforeVariant.supported){
  canonicalCard={...originalCanonicalCard,year:protection.userIdentity.year||originalCanonicalCard?.year,brandSet:protection.userIdentity.brandSet||originalCanonicalCard?.brandSet};
  canonicalCard.displayName=[canonicalCard.year,canonicalCard.brandSet,canonicalCard.subject,canonicalCard.parallel,canonicalCard.cardNumber&&'#'+canonicalCard.cardNumber].filter(Boolean).join(' ');
 }

 let confirmation=fields.confirmedIdentity;
 if(typeof confirmation==='string'){try{confirmation=JSON.parse(confirmation);}catch{confirmation=null;}}
 const userIdentityConflicts=[];
 for(const field of ['subject','cardNumber','language','parallel']){
  const supplied=fields[field]??confirmation?.[field];
  if(typeof supplied!=='string'||!supplied.trim())continue;
  const normalize=field==='language'?catalogLanguageKey:catalogNameKey;
  if(normalize(supplied)!==normalize(canonicalCard?.[field]))userIdentityConflicts.push({field,supplied,canonical:canonicalCard?.[field]||null});
 }
 if(userIdentityConflicts.length){catalog.requiresConfirmation=true;variant.variantVerification={...variant.variantVerification,status:'needs_confirmation',explanation:'Explicit user identity conflicts with the catalog candidate. Review the supplied and canonical values; no automatic confirmation is applied.'};}

 const finalComparison=describeCatalogComparison(identity.identityVerification,canonicalCard,userIdentityConflicts);
 if(options.skipMarketplace&&finalComparison.candidateCompared){
  if(finalComparison.finalConflicts.length){catalog.status='conflict';catalog.reasonCode='catalog_candidate_conflict';catalog.requiresConfirmation=true;variant.variantVerification={...variant.variantVerification,status:'needs_confirmation',explanation:'The final catalog comparison has an unresolved identity or printing disagreement. Core catalog facts do not verify the physical finish or artwork.'};}
  else if(catalog.status==='conflict'&&finalComparison.postCorrectionConflicts.length)catalog.reasonCode='catalog_prior_conflict_requires_review';
  catalog.reasonCodes=safeCatalogReasons({...catalog,reasonCodes:[]});
  if(finalComparison.core.supported&&finalComparison.printing.status!=='not_verified')canonicalCard.displayName=[canonicalCard.year,canonicalCard.brandSet,canonicalCard.subject,canonicalCard.cardNumber&&'#'+canonicalCard.cardNumber].filter(Boolean).join(' ');
 }
 if(finalComparison.core.supported&&finalComparison.printing.status!=='not_verified')canonicalCard.displayName=[canonicalCard.year,canonicalCard.brandSet,canonicalCard.subject,canonicalCard.cardNumber&&'#'+canonicalCard.cardNumber].filter(Boolean).join(' ');
 const valuationIdentityGate=identitySearchGate(identity.identityVerification,canonicalCard);
 return {...identity,...variant,canonicalCard,originalCanonicalCard,originalIdentityObservation,valuationIdentityGate,userIdentityConflicts,
  artworkStatus:{status:'not_verified',verified:false},physicalPrintingStatus:{status:'unverified',verified:false},runtimeCatalogAssets:assets,
  catalogCrossCheck:{provider:'TCGdex',status:valuationIdentityGate.allowed?'catalog_fields_agree':catalog?.status==='unavailable'?'catalog_unavailable':catalog?.status||'catalog_unavailable',verified:false,catalogId:catalog?.referenceId||null,catalogName:catalog?.candidate?.subject||null,catalogSet:catalog?.candidate?.brandSet||null,catalogRarity:catalog?.candidate?.rarity||null,conflicts:catalog?.conflicts||[],agreements:valuationIdentityGate.allowed?['subject','collectorNumber','set']:[],candidateCount:catalog?.candidate?1:0,artwork:{status:'not_verified',verified:false},note:'Catalog evidence and original AI observations are separate. Physical printing is not verified.'}};
}
