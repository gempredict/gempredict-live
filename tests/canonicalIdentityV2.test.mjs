import assert from "node:assert/strict";
import test from "node:test";
import {canonicalIdentityV2,emptyGraderScenarios} from "../lib/canonicalIdentityV2.mjs";
test("catalog-backed Pokemon canonical identity is consistent but provisional",()=>{
 const x=canonicalIdentityV2({category:"pokemon",vision:{identifiedSubject:"Pikachu ex",identifiedCardNumber:"149/128",identifiedBrandSet:"Wrong set"},catalog:{provider:"TCGdex",status:"catalog_fields_agree",catalogId:"30th-149",catalogName:"Pikachu ex",catalogSet:"30th Celebration",conflicts:[]}});
 assert.equal(x.title,"30th Celebration Pikachu ex #149/128");assert.equal(x.identityVerified,false);
 assert.equal(x.priceLookupEligible,false);assert.equal(x.catalog.id,"30th-149");
});
test("sports card preserves year player team set parallel and refuses fake verification",()=>{
 const x=canonicalIdentityV2({category:"sports",vision:{identifiedYear:"2024",identifiedSubject:"Example Player",identifiedTeam:"Example Team",identifiedSport:"football",identifiedBrandSet:"Example Chrome",identifiedParallel:"Silver",identifiedCardNumber:"112"}});
 assert.equal(x.player,"Example Player");assert.equal(x.team,"Example Team");
 assert.equal(x.title,"2024 Example Chrome Example Player Silver #112");assert.equal(x.identityStatus,"unverified");
 assert.equal(x.priceLookupEligible,false);
});
test("catalog conflict must never silently verify title",()=>{
 const x=canonicalIdentityV2({category:"pokemon",vision:{identifiedSubject:"Pikachu ex",identifiedBrandSet:"Surging Sparks"},catalog:{provider:"TCGdex",status:"conflicting",conflicts:["set"],catalogSet:"30th Celebration"}});
 assert.equal(x.identityStatus,"conflicting");assert.equal(x.identityVerified,false);
});
test("each grader starts without invented fees or values",()=>{
 const s=emptyGraderScenarios();assert.deepEqual(s.map(x=>x.company),["PSA","BGS","TAG","CGC","SGC"]);assert.ok(s.every(x=>x.gradingFee===null&&x.expectedNet===null));
});
