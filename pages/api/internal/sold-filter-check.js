import { fetchFilteredCompSniperSold } from "../../../lib/compsniperSold.mjs";
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"||process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="develop/opulent-disco"||req.query.check!=="pika-filter-2026")
  return res.status(404).json({error:"not_available"});
 const identity={subject:"Pikachu ex",number:"149/128",set:"30th Celebration",setAliases:["30th Anniversary Celebration","30C","30th Celebrations","30th Pokemon"]};
 const result=await fetchFilteredCompSniperSold("Pikachu ex 149/128",identity,{count:20,kind:"raw"});
 return res.status(200).json({provider:result.provider,status:result.status,returned:result.items?.length||0,filtered:result.filtered?{
 acceptedCount:result.filtered.acceptedCount,rejectedCount:result.filtered.rejectedCount,medianCandidate:result.filtered.medianCandidate,status:result.filtered.status,
 accepted:result.filtered.accepted.map(x=>({title:x.title,price:x.price,soldAt:x.soldAt,url:x.url})),
 rejected:result.filtered.rejected
 }:null,usedForValuation:false});
}