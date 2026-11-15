// Provider facts only. A legacy generated list does not prove an explicit source exclusion.
const finishes=['normal','holo','reverse'];
const flags=v=>Object.fromEntries(finishes.map(k=>[k,typeof v?.[k]==='boolean'?v[k]:null]));
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]{8,25}$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
export function catalogVariantProvenance(record){
 const h=record?.hostedEvidence,rows=Array.isArray(h?.printings)?h.printings:[],known=rows.filter(p=>finishes.includes(p?.finish));
 const attributed=record?.provider==='tcgdex'&&h?.provider==='tcgdex'&&h.id===record.id;
 const complete=attributed&&h?.detailedPresent===true&&h.detailedComplete===true&&rows.length>0&&rows.length<=16&&known.length===rows.length;
 const generated=complete&&known.every(p=>p.variantId==='generated');
 return {provider:record?.provider==='tcgdex'?'tcgdex':null,referenceId:typeof record?.id==='string'&&/^[a-z0-9.-]{1,40}$/i.test(record.id)?record.id:null,
  kind:generated?'generated_legacy':complete?'provider_detailed':h?.detailedPresent?'incomplete_detailed':finishes.some(k=>typeof record?.variants?.[k]==='boolean')?'flags_only':'missing',
  reportedFlags:flags(h?.variants??record?.variants),comparisonFlags:flags(record?.variants),sourceRevision:null,hostedUpdated:date(h?.updated),retrievedAt:date(h?.retrievedAt),
  detailedPresent:h?.detailedPresent===true,detailedComplete:complete,entryCount:rows.length,entriesTruncated:rows.length>4,
  entries:known.slice(0,4).map(p=>({finish:p.finish,variantId:typeof p.variantId==='string'&&/^[a-z0-9_-]{1,80}$/i.test(p.variantId)?p.variantId:null})),
  negativeBasis:generated?'legacy_source_omission_or_explicit_flag_indistinguishable':complete?'provider_detailed_and_flags':finishes.some(k=>typeof record?.variants?.[k]==='boolean')?'provider_flags_without_source_provenance':'not_established',physicalPrintingVerified:false};
}
