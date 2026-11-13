import {safeEbayListingUrl,deduplicateBrowseListings} from './ebayListingProvenance.mjs';
import {matchListing} from './ebayIdentityMatch.mjs';
import {scoreListing} from './pokemonListingMatch.mjs';
import {expandVariantAliases,matchesVariantValuation} from './variantVerification.mjs';
const imageUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.endsWith('.ebayimg.com')?u.href:null;}catch{return null;}};
export function reportListings(report={}){
 const m=report.marketData;if(m?.success!==true)return {qualified:[],candidates:[],rejectedCount:0,reason:'discovery_unavailable'};
 const c=report.canonicalCard||{},i=report.identityV2||{},identity={player:c.subject||i.subject,year:c.year||i.year,set:c.brandSet||i.set,cardNumber:c.cardNumber||i.collectorNumber,parallel:c.parallel||i.parallel,language:c.language||i.language,autoOrRelic:c.autoOrRelic||i.autograph,printRun:c.printRun};
 const all=[m.items,m.rawComparableItems,m.rejectedItems].flatMap(v=>Array.isArray(v)?v:[]).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).slice(0,200);
 const dedup=deduplicateBrowseListings(all),qualified=[],candidates=[];let rejectedCount=dedup.conflictingDuplicateCount;
 for(const item of dedup.items){
  const url=safeEbayListingUrl(item);if(!url||typeof item.title!=='string'||item.title.length>500||item.accepted===false||item.rejectionReasons?.length){rejectedCount++;continue;}
  if(!identity.player||!identity.year||!identity.set||!identity.cardNumber||!identity.parallel){rejectedCount++;continue;}
  const title=expandVariantAliases(item.title);
  const local=i.category==='pokemon'?scoreListing(title,'',identity,item).comparable:i.category==='sports'?matchListing(item.title,identity,item.condition).accepted:false;
  if(!local||!matchesVariantValuation({...item,title}, {subject:identity.player,year:identity.year,brandSet:identity.set,cardNumber:identity.cardNumber,parallel:identity.parallel,language:identity.language,autoOrRelic:identity.autoOrRelic,printRun:identity.printRun,...(c.variant?{variant:c.variant}:{})})){rejectedCount++;continue;}
  const price=item.price;const amount=price&&/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(String(price.value))&&Number(price.value)>0?Number(price.value):null;
  const currency=typeof price?.currency==='string'&&/^[A-Z]{3}$/.test(price.currency)?price.currency:null;
  const row={title:item.title,url,image:imageUrl(item.image),amount:currency?amount:null,currency,condition:typeof item.condition==='string'?item.condition.slice(0,120):null,status:'unverified_candidate'};
  // Current protected reports never establish physical printing. No score or
  // accepted flag can upgrade a row to an exact-printing match.
  const exact=false; // No reviewed physical-printing verifier exists on this branch.
  if(exact){row.status='exact_printing_match';qualified.push(row);}else candidates.push(row);
 }
 return {qualified,candidates,rejectedCount,reason:candidates.length?'printing_unverified':'no_safely_classifiable_candidates'};
}
