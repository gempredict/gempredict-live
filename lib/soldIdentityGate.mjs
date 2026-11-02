// Fail-closed eligibility gate for sold-comps searches.
// A catalog candidate alone does not establish the photo's exact printing.
export function assessSoldIdentityGate({cardType,crossCheck,photoIdentity,artwork}={}) {
 const deny=(reason)=>({status:"blocked",allowed:false,reason,identity:null});
 if(cardType!=="pokemon")return deny("unsupported_catalog");
 if(!crossCheck||crossCheck.provider!=="TCGdex"||crossCheck.candidateCount!==1||!crossCheck.catalogId)
   return deny("unique_catalog_record_missing");
 if(crossCheck.conflicts?.length)return deny("identity_conflict");
 const fields=crossCheck.agreements||[];
 if(!["subject","collectorNumber","set"].every(x=>fields.includes(x)))
   return deny("catalog_fields_unconfirmed");
 if(crossCheck.status!=="catalog_fields_agree")return deny("catalog_mismatch");
 if(artwork?.status!=="visual_pattern_similar")return deny("artwork_not_confirmed");
 // Similarity is not definitive variation authentication. Require explicit review
 // before any automatic sold-data retrieval is permitted.
 if(photoIdentity?.printingConfirmed!==true)return deny("printing_requires_confirmation");
 if(!photoIdentity?.subject||!photoIdentity?.number||!photoIdentity?.set)
   return deny("identity_incomplete");
 return {status:"eligible_after_review",allowed:true,reason:null,
   identity:{subject:photoIdentity.subject,number:photoIdentity.number,set:photoIdentity.set,
     catalogId:crossCheck.catalogId}};
}
