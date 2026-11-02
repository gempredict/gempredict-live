// Conservative deterministic filter for reported sold-card transactions.
// Does not claim that a provider result is independently verified.
const clean=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const numberTokens=s=>[...String(s||"").matchAll(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/g)].map(m=>m[1]+"/"+m[2]);
const money=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
const grade=t=>{
 const m=t.match(/\b(psa|cgc|bgs|sgc)\s*(?:gem\s*mint\s*)?(10|9(?:\.5)?|[1-8](?:\.5)?)\b/i);
 return m?{company:m[1].toUpperCase(),value:Number(m[2])}:null;
};
const lot=t=>/\b(lot|bundle|pair|playset)\b|\b\d+\s*(?:card|cards|copies|pcs)\b|\b(?:x[2-9]|[2-9]x)\b|\+\s*\d+\s*\w*\s*cards?\b/i.test(t);
function reject(title,card,kind) {
 const t=clean(title),subject=clean(card.subject),set=clean(card.set);
 if(!subject||!set||!card.number)return "missing_identity";
 if(!t.includes(subject))return "wrong_subject";
 const expected=String(card.number).replace(/\s/g,"");
 const found=numberTokens(title);
 if(found.length!==1||found[0]!==expected)return "number_missing_or_conflicting";
 const setNorm=set;
 const aliases=[setNorm,...(card.setAliases||[]).map(clean)].filter(Boolean);
 if(!aliases.some(x=>t.includes(x)))return "set_not_confirmed";
 if(lot(title))return "lot_or_multiple_cards";
 if(/\b(proxy|custom|reprint|fake|digital|code card|damaged lot)\b/i.test(title))return "nonstandard_product";
 const g=grade(title);
 if(kind==="raw"&& (g||/\bgraded\b|\bslabbed\b/i.test(title)))return "graded_not_raw";
 if(kind.startsWith("psa")){
   if(!g||g.company!=="PSA"||g.value!==Number(kind.slice(3)))return "wrong_grader_or_grade";
 }
 return null;
}
export function filterSoldComps(items,card,{kind="raw",minCount=3}={}){
 if(!["raw","psa9","psa10"].includes(kind))throw Error("Invalid grade group");
 const accepted=[],rejected=[],seen=new Set();
 for(const x of items||[]){
   let reason=reject(x.title||"",card,kind);
   if(!reason&&!x.valuationEligible)reason="price_not_confirmed";
   if(!reason&&money(x.price)===null)reason="price_missing";
   if(!reason&&!x.soldAt)reason="date_missing";
   const match=String(x.url||"").match(/ebay\.[a-z.]+\/itm\/(\d+)/i);
   if(!reason&&!match)reason="transaction_link_missing";
   const key=match?.[1];
   if(!reason&&seen.has(key))reason="duplicate_transaction";
   if(reason)rejected.push({title:x.title,reason});
   else{seen.add(key);accepted.push({...x,gradeGroup:kind,identityVerified:false});}
 }
 const prices=accepted.map(x=>Number(x.price)).sort((a,b)=>a-b);
 const median=prices.length?(prices.length%2?prices[(prices.length-1)/2]:(prices[prices.length/2-1]+prices[prices.length/2])/2):null;
 return {status:accepted.length>=minCount?"candidate_sample":"insufficient_sample",
  gradeGroup:kind,priceBasis:"provider_reported_sold_unverified",
  accepted,rejected,acceptedCount:accepted.length,rejectedCount:rejected.length,
  medianCandidate:median,usedForValuation:false};
}
