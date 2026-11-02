// Sports-photo identity audit. No sports catalog has been independently checked.
// Differentiates observation completeness from verified identification.
const val=x=>typeof x==="string"&&x.trim()?x.trim():null;
const auto=x=>/\b(auto|autograph|signed)\b/i.test(x||"");
const relic=x=>/\b(relic|patch|jersey|memorabilia|swatch)\b/i.test(x||"");
export function auditSportsIdentity(v={},expectedType="base"){
 const fields={player:val(v.identifiedSubject),year:val(v.identifiedYear),
  manufacturer:val(v.identifiedManufacturer),product:val(v.identifiedBrandSet),
  cardNumber:val(v.identifiedCardNumber),parallel:val(v.identifiedParallel),
  team:val(v.identifiedTeam),sport:val(v.identifiedSport),
  serialNumber:val(v.identifiedSerialNumber),autoOrRelic:val(v.identifiedAutoOrRelic)};
 const missing=["player","year","manufacturer","product","cardNumber"].filter(k=>!fields[k]);
 const issues=[];
 if(!["base","numbered_parallel","autograph","relic"].includes(expectedType))issues.push("unknown_benchmark_type");
 if(expectedType==="numbered_parallel"&&(!fields.parallel||!/^\s*\d+\s*\/\s*\d+\s*$/.test(fields.serialNumber||"")))issues.push("parallel_or_serial_not_evidenced");
 if(expectedType==="autograph"&&!auto(fields.autoOrRelic))issues.push("autograph_not_evidenced");
 if(expectedType==="relic"&&!relic(fields.autoOrRelic))issues.push("relic_not_evidenced");
 if(expectedType==="base"&&(auto(fields.autoOrRelic)||relic(fields.autoOrRelic)||fields.serialNumber))issues.push("base_variant_conflict");
 const notes=val(v.identityNotes)||"";
 if(/\b(or similar|maybe|possibly|uncertain|guess)\b/i.test([fields.product,fields.parallel,notes].join(" ")))issues.push("speculative_identity");
 return {category:"sports",benchmarkType:expectedType,fields,missing,issues,
  status:missing.length||issues.length?"needs_review":"complete_unverified",
  catalogVerified:false,photoVerified:false,soldLookupEligible:false};
}
