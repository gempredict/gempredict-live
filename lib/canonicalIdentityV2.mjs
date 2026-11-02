// Versioned cross-category identity contract. Diagnostic only until validated.
// Explicit unknowns are preferable to fabricated sports-card catalog matches.
const str=x=>typeof x==="string"&&x.trim()?x.trim():null;
export function canonicalIdentityV2({category,vision={},catalog=null,review=null}={}){
 const type=category==="pokemon"?"pokemon":category==="sports"?"sports":"unknown";
 const verifiedCatalog=catalog?.status==="catalog_fields_agree"&&catalog?.provider==="TCGdex"&&!catalog?.conflicts?.length;
 const subject=verifiedCatalog?str(catalog.catalogName):str(vision.identifiedSubject);
 const set=verifiedCatalog?str(catalog.catalogSet):str(vision.identifiedBrandSet);
 const number=str(vision.identifiedCardNumber);
 const year=str(vision.identifiedYear);
 const parallel=str(vision.identifiedParallel);
 const sport=str(vision.identifiedSport);
 const team=str(vision.identifiedTeam);
 const manufacturer=str(vision.identifiedManufacturer);
 const player=type==="sports"?subject:null;
 const title=[type==="sports"?year:null,set,subject,parallel,number?"#"+number:null].filter(Boolean).join(" ")||"Unidentified card";
 const materialConflict=Boolean(catalog?.conflicts?.length);
 const status=review?.status==="catalog_reviewed"&&!materialConflict?"user_reviewed":verifiedCatalog?"catalog_candidate":materialConflict?"conflicting":"unverified";
 return {
  schemaVersion:2,category:type,subject,player,sport,team,manufacturer,
  year,set,collectorNumber:number,parallel,autograph:str(vision.identifiedAutoOrRelic),
  catalog:type==="pokemon"&&verifiedCatalog?{provider:"TCGdex",id:catalog.catalogId}:null,
  identityStatus:status,identityVerified:false,printingVerified:false,
  title,priceLookupEligible:false,
  evidence:{visionPresent:Boolean(subject),catalogAligned:verifiedCatalog,materialConflict,
    userReviewed:status==="user_reviewed"}
 };
}
export function emptyGraderScenarios(){
 return ["PSA","BGS","TAG","CGC","SGC"].map(company=>({
  company,serviceTier:null,gradingFee:null,shippingCost:null,insuranceCost:null,
  turnaroundDays:null,declaredValueLimit:null,gradeDistribution:null,
  soldPriceByGrade:null,expectedNet:null,status:"not_evaluated"
 }));
}
