// Compares observed image identity to a full TCGdex catalog record.
// Does not claim artwork match without independent image comparison.
const norm=x=>String(x||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
const local=x=>String(x||"").trim().split("/")[0].replace(/^0+(?=\d)/,"");
export function crossCheckIdentity(observed={},card=null) {
 if(!card) return {status:"catalog_unavailable",verified:false,conflicts:[],agreements:[],unverified:["catalog record"]};
 const pairs=[
  ["subject",observed.identifiedSubject,card.name,norm],
  ["collectorNumber",observed.identifiedCardNumber,card.localId,local],
  ["set",observed.identifiedBrandSet,card.set?.name,norm]
 ];
 const conflicts=[],agreements=[],unverified=[];
 for(const [field,a,b,normalizer] of pairs) {
   if(!a||!b){unverified.push(field);continue;}
   if(normalizer(a)===normalizer(b))agreements.push(field);
   else conflicts.push(field);
 }
 // Catalog card number is only local to a set. An absent set is not a verified match.
 const coreAgree=["subject","collectorNumber","set"].every(k=>agreements.includes(k));
 return {
  status:conflicts.length?"conflicting":coreAgree?"catalog_fields_agree":"insufficient_evidence",
  verified:false,
  agreements,conflicts,unverified:[...unverified,"artwork comparison","printing variation"],
  catalogId:card.id||null,
  catalogName:card.name||null,
  catalogSet:card.set?.name||null,
  catalogRarity:card.rarity||null,
  artworkReferenceAvailable:Boolean(card.image),
  note:conflicts.length?"Catalog and photo descriptions disagree. Do not trust the generated card title.":
    coreAgree?"Subject, number, and set agree, but artwork and printing remain unverified.":
    "Insufficient independent evidence to confirm the full card identity."
 };
}
export async function fetchFullTcgdexCard(id) {
 if(!/^[a-z0-9-]{2,65}$/i.test(String(id||"")))return null;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetch("https://api.tcgdex.net/v2/en/cards/"+encodeURIComponent(id),{signal:controller.signal,headers:{Accept:"application/json"}});
  return response.ok?await response.json():null;
 }catch{return null;}finally{clearTimeout(timer);}
}
