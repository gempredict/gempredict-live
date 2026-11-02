// Temporary controlled validation endpoint. Delete after a single test.
// No scanner integration, no secrets in response, and no ROI calculations.
import { fetchCompSniperSold } from "../../../lib/compsniperSold.mjs";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({error:"method"});
  if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="develop/opulent-disco")
    return res.status(404).json({error:"not_available"});
  if(req.query.check!=="pikachu-149-128")return res.status(404).json({error:"not_available"});
  const result=await fetchCompSniperSold("Pikachu ex 149/128",{count:20});
  const clean=result.items||[];
  return res.status(200).json({
    status:result.status,provider:result.provider,priceBasis:result.priceBasis||null,
    count:clean.length,eligibleBeforeIdentityCheck:clean.filter(x=>x.valuationEligible).length,
    bestOfferUnknown:clean.filter(x=>x.bestOffer&&!x.exactBestOfferKnown).length,
    items:clean.map(x=>({title:x.title,price:x.price,soldAt:x.soldAt,
      url:x.url,bestOffer:x.bestOffer,exactBestOfferKnown:x.exactBestOfferKnown,
      eligibleForPrice:x.valuationEligible,identityVerified:x.identityVerified}))
  });
}
