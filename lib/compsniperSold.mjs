import { assessSoldIdentityGate } from "./soldIdentityGate.mjs";
import { filterSoldComps } from "./soldCompsFilter.mjs";
// GemPredict sold-sales provider adapter. Server-side only; no network call on import.
// Do not treat a Best Offer listing as an exact sale unless the response proves it.
const API="https://api.compsniper.com/v1/scrape";
export function normalizeCompSniperSold(response) {
  const rows=Array.isArray(response?.items)?response.items:[];
  return rows.map(item=>{
    const title=String(item.title||"");
    const price=Number(item.soldPrice??item.sold_price??item.price??NaN);
    const date=item.endedAt??item.soldDate??item.sold_date??item.saleDate??null;
    const link=item.itemUrl??item.item_url??item.url??null;
    const offer=Boolean(item.bestOfferAccepted??item.best_offer_accepted);
    const exactOffer=item.acceptedOfferPrice??item.accepted_offer_price??null;
    const exact=item.acceptedOfferPriceStatus==="found"&&exactOffer!=null&&Number(exactOffer)>0;
    return {title,price:offer?(exact?Number(exactOffer):null):(Number.isFinite(price)&&price>0?price:null),soldAt:date,
      url:typeof link==="string"&&/^https:\/\/(www\.)?ebay\.[a-z.]+\//i.test(link)?link:null,
      bestOffer:offer,exactBestOfferKnown:exact,acceptedOfferPrice:exact?Number(exactOffer):null,
      valuationEligible:(!offer||exact)&&Number.isFinite(price)&&price>0&&item.soldCurrency==="USD",
      source:"CompSniper",identityVerified:false};
  });
}
export async function fetchCompSniperSold(keyword,{count=30}={}) {
  const key=process.env.COMPSNIPER_API_KEY;
  if(!key)return {status:"not_configured",items:[],provider:"CompSniper"};
  const text=String(keyword||"").trim();
  if(text.length<8||text.length>160)return {status:"invalid_keyword",items:[],provider:"CompSniper"};
  const q=new URL(API);
  q.searchParams.set("keyword",text);
  q.searchParams.set("count",String(Math.max(1,Math.min(40,count))));
  q.searchParams.set("ebaySite","ebay.com");
  q.searchParams.set("sold","true");
  q.searchParams.set("bestOfferPrice","true");
  q.searchParams.set("relevance","false");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(q.toString(),{signal:controller.signal,headers:{Authorization:"Bearer "+key,Accept:"application/json"},redirect:"error"});
    if(!r.ok)return {status:r.status===429?"quota_or_rate_limit":"upstream_error",upstreamStatus:r.status,items:[],provider:"CompSniper"};
    const data=await r.json();
    return {status:"retrieved_unverified",provider:"CompSniper",priceBasis:"reported_sold_transactions",
      remainingQuota:Number(r.headers.get("x-usage-remaining"))||null,
      items:normalizeCompSniperSold(data),usedForValuation:false};
  }catch{return {status:"unavailable",provider:"CompSniper",items:[]};}
  finally{clearTimeout(timer);}
}

// Explicit opt-in adapter for controlled validations; never invoked by normal scans.
export async function fetchFilteredCompSniperSold(keyword,identity,{count=30,kind="raw",gateInput=null}={}) {
  const gate=assessSoldIdentityGate(gateInput||{});
  if(!gate.allowed)return {status:"identity_blocked",gate,provider:"CompSniper",items:[],filtered:null,usedForValuation:false};
  const result=await fetchCompSniperSold(keyword,{count});
  if(result.status!=="retrieved_unverified")return {...result,filtered:null};
  return {...result,filtered:filterSoldComps(result.items,identity,{kind}),usedForValuation:false};
}
