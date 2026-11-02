import assert from "node:assert/strict";
import test from "node:test";
import {filterSoldComps} from "../lib/soldCompsFilter.mjs";
const card={subject:"Pikachu ex",number:"149/128",set:"30th Celebration",setAliases:["30th Anniversary Celebration","30C"]};
const base={price:40,soldAt:"2026-11-01",valuationEligible:true,url:"https://www.ebay.com/itm/12345678901"};
const tx=(title,id="12345678901",fields={})=>({...base,title,url:"https://www.ebay.com/itm/"+id,...fields});
test("accept exact raw card and reject graded, bundles, and mismatched sets",()=>{
 const list=[tx("Pikachu ex 149/128 30th Celebration SIR"),
 tx("CGC 9 Pikachu ex 149/128 30th Celebration", "12345678902"),
 tx("Pikachu ex 149/128 30th Celebration + 21 Pikachu cards","12345678903"),
 tx("Pikachu ex 149/128 SV 151 Secret Rare","12345678904"),
 tx("Pikachu ex 149/128 30th Celebration SIR","12345678901")];
 const out=filterSoldComps(list,card);
 assert.equal(out.acceptedCount,1);
 assert.deepEqual(out.rejected.map(x=>x.reason),["graded_not_raw","lot_or_multiple_cards","set_not_confirmed","duplicate_transaction"]);
 assert.equal(out.medianCandidate,40);
 assert.equal(out.usedForValuation,false);
});
test("unknown Best Offer excluded despite other valid fields",()=>{
 const x=tx("Pikachu ex 149/128 30th Celebration",{toString:()=>"12345678905"},{price:null,valuationEligible:false});
 const out=filterSoldComps([x],card);
 assert.equal(out.acceptedCount,0);
});
test("PSA grade must match exactly; BGS and CGC never count as PSA",()=>{
 const list=[tx("PSA 10 Pikachu ex 149/128 30th Celebration","12345678911",{price:145}),
 tx("PSA 9 Pikachu ex 149/128 30th Celebration","12345678912",{price:75}),
 tx("BGS 9.5 Pikachu ex 149/128 30th Celebration","12345678913",{price:110})];
 assert.equal(filterSoldComps(list,card,{kind:"psa10"}).acceptedCount,1);
 assert.equal(filterSoldComps(list,card,{kind:"psa9"}).acceptedCount,1);
});
test("fewer than three qualifying comps remains insufficient",()=>{
 const out=filterSoldComps([tx("Pikachu ex 149/128 30th Celebration")],card);
 assert.equal(out.status,"insufficient_sample");
});
