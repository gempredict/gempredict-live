import {verifyIdentityReviewToken} from "../../lib/identityReviewToken.mjs";
import {fetchFullTcgdexCard} from "../../lib/tcgdexCrossCheck.mjs";
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const local=x=>String(x||"").split("/")[0].replace(/^0+(?=\d)/,"");
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const {token,action,catalogId,confirmedNumber}=req.body||{};
 const scan=verifyIdentityReviewToken(token);
 if(!scan)return res.status(403).json({status:"blocked",reason:"invalid_or_expired_scan",message:"Scan confirmation expired. Please rescan."});
 if(!["confirm","correct"].includes(action))return res.status(400).json({error:"Invalid review action"});
 if(action==="confirm"&&(scan.conflicts?.length||!scan.catalogId))return res.status(409).json({status:"blocked",reason:"catalog_conflict",message:"Choose a corrected catalog identity before confirming."});
 const id=action==="confirm"?scan.catalogId:catalogId;
 if(typeof id!=="string"||!/^[a-z0-9-]{2,65}$/i.test(id))return res.status(400).json({error:"A valid TCGdex catalog ID is required."});
 const card=await fetchFullTcgdexCard(id);
 if(!card?.id||!card?.name||!card?.set?.name||!card?.localId)return res.status(422).json({status:"blocked",reason:"catalog_unavailable"});
 // Re-evaluate scan identity server side; browser text is untrusted.
 if(action==="confirm"&&(norm(card.name)!==norm(scan.subject)||local(card.localId)!==local(scan.number)||norm(card.set.name)!==norm(scan.set)))
   return res.status(409).json({status:"blocked",reason:"scan_catalog_mismatch"});
 if(action==="correct"&&(typeof confirmedNumber!=="string"||!/^[0-9]{1,4}\/[0-9]{1,4}$/.test(confirmedNumber)||local(confirmedNumber)!==local(card.localId)))
   return res.status(422).json({status:"blocked",reason:"collector_number_mismatch",message:"Enter the full number printed on the card, matching the selected catalog record."});
 return res.status(200).json({
  status:"catalog_reviewed",reviewAction:action,provider:"TCGdex",
  identity:{catalogId:card.id,subject:card.name,set:card.set.name,number:action==="confirm"?scan.number:confirmedNumber,rarity:card.rarity||null},
  userConfirmed:true,photographicArtworkVerified:false,printingVerified:false,
  soldCompsAllowed:false,pricingUpdated:false,
  message:"Catalog identity checked and user-confirmed for this review. Artwork and exact printing remain unverified; sold-price retrieval is still blocked."
 });
}