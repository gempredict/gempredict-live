import { crossCheckIdentity, fetchFullTcgdexCard } from "../../lib/tcgdexCrossCheck.mjs";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const id=typeof req.query.id==="string"?req.query.id:"";
 if(!/^[a-z0-9-]{2,65}$/i.test(id))return res.status(400).json({error:"Invalid catalog ID"});
 const observed={
  identifiedSubject:typeof req.query.subject==="string"?req.query.subject.slice(0,90):"",
  identifiedCardNumber:typeof req.query.number==="string"?req.query.number.slice(0,25):"",
  identifiedBrandSet:typeof req.query.set==="string"?req.query.set.slice(0,90):"",
 };
 res.setHeader("Cache-Control","no-store");
 const card=await fetchFullTcgdexCard(id);
 return res.status(200).json({provider:"TCGdex",...crossCheckIdentity(observed,card)});
}
