// Pure report/restore comparison. Reviewed facts never grant a gate or rewrite hosted data.
import registry from './reviewedCatalogRegistry.json' with {type:'json'};
import {catalogNameKey,catalogLanguageKey} from './catalogNormalization.mjs';
const equal=(a,b)=>catalogNameKey(a)===catalogNameKey(b);
export function rarityClaim(value){
 const text=catalogNameKey(value);
 if(/\b(special illustration rare|sir)\b/.test(text))return 'Special illustration rare';
 if(/\billustration rare\b/.test(text))return 'Illustration rare';
 return null;
}
export function sourceCatalogEvidence(report){
 const c=report.identityVerification?.catalog,card=report.canonicalCard,h=c?.candidate?.hostedEvidence,receipt=c?.candidate?.reviewedSource;
 const r=registry.find(r=>r.id===c?.referenceId);
 const verified=h?.id===c?.referenceId&&h?.provider==='tcgdex'&&report.coreCatalogIdentity?.supported===true&&c?.source==='tcgdex'&&c?.candidate?.provider==='tcgdex'&&r&&h.setId===r.setId&&h.language===r.language&&c.candidate.setId===r.setId&&receipt&&['repository','revision','cardBlob','setBlob'].every(k=>receipt[k]===r[k])&&equal(card?.subject,r.subject)&&card?.cardNumber===r.cardNumber&&card?.year===r.year&&equal(card?.brandSet,r.setName)&&catalogLanguageKey(card?.language)===r.language;
 if(!verified)return {status:'unavailable',reason:'reviewed_source_unavailable_or_identity_mismatch',requiresReview:!!r&&report.coreCatalogIdentity?.supported===true,photoVerified:false};
 const original=report.originalIdentityObservation||{},claims=[...new Set([rarityClaim(original.identifiedRarity),rarityClaim(original.identifiedParallel)].filter(Boolean))],claimed=claims[0]||null;
 const sourceFinishes=[...new Set(r.printings.map(v=>v.finish))];
 const hostedKnown=['normal','holo','reverse'].filter(k=>typeof h?.variants?.[k]==='boolean');
 const differences=hostedKnown.filter(k=>h.variants[k]!==sourceFinishes.includes(k));
 if(h?.rarity&&!equal(h.rarity,r.rarity))differences.push('rarity');
 if(h?.regulationMark&&h.regulationMark!==r.regulationMark)differences.push('regulationMark');
 if(h?.detailedPresent&&Array.isArray(h.printings)){
  if(h.printings?.some(v=>!v||!sourceFinishes.includes(v.finish)))differences.push('detailed_finish');
  if(h.printings?.some(v=>Array.isArray(v?.stamps)&&!r.printings.some(p=>p.finish===v.finish&&JSON.stringify([...p.stamps].sort())===JSON.stringify([...v.stamps].sort()))))differences.push('stamp');
 }
 const legacyCorrection=c?.candidate?.printingProvenance;
 const preservedCorrection=!!legacyCorrection&&c.candidate.variants?.holo===true&&sourceFinishes.length===1&&sourceFinishes[0]==='holo'&&r.priorPrintingReview&&['repository','revision','cardBlob','setBlob','snapshotDigest','correctionRevision','previousRevision'].every(k=>legacyCorrection[k]===r.priorPrintingReview[k])&&h?.variants?.normal===true&&h?.variants?.holo===false&&h?.variants?.reverse===false&&Date.parse(h.updated)>=Date.parse(r.priorPrintingReview.previousAt)&&Date.parse(h.updated)<Date.parse(r.priorPrintingReview.correctedAt)&&h.printings?.length===1&&h.printings[0]?.variantId==='generated'&&h.printings[0]?.finish==='normal';
 const status=differences.length?'disagreement':hostedKnown.length===3&&(!h?.detailedPresent||h.detailedComplete)?'consistent':'incomplete';
 const markings=(Array.isArray(original.identityReadings)?original.identityReadings:[]).slice(0,12).filter(v=>v?.field==='setCode').map(v=>({text:v.text,certainty:v.certainty,side:v.side,
  interpretation:new RegExp('^\\s*'+r.regulationMark+'\\s+'+r.setCode+'\\s*EN\\s*$','i').test(v.text||'')?'possible_regulation_set_language':null,
  promotedToClear:false}));
 return {status,reason:status==='disagreement'?'hosted_upstream_disagreement':status==='incomplete'?'hosted_capabilities_incomplete':'catalog_representations_agree',
  source:{repository:r.repository,revision:r.revision,cardPath:r.cardPath,cardBlob:r.cardBlob,setPath:r.setPath,setBlob:r.setBlob},
  hosted:h?structuredClone(h):null,differences,
  rarity:{status:'source_supported',value:r.rarity,proposed:claimed,proposals:claims,proposalStatus:claims.length?claims.every(v=>equal(v,r.rarity))?'agrees':'conflict':'unresolved'},
  artwork:{status:'unresolved',reason:'no_independent_artwork_comparison'},
  finish:{status:'source_supported',values:sourceFinishes,photoVerified:false},
  printings:{status:'source_supported',values:structuredClone(r.printings),photoVerified:false},
  regulationMark:{status:'source_supported',value:r.regulationMark,photoVerified:false},
  printedMarkings:markings,photoVerified:false,mayAuthorizeIdentity:false,mayAuthorizeValuation:false,
  existingPrintingCorrectionRetained:preservedCorrection,agreementScope:'available_hosted_fields_only',disposition:status==='disagreement'?'retain_both_unresolved':status==='incomplete'?'source_facts_only':'source_and_hosted_agree'};
}
