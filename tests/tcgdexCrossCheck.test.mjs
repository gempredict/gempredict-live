import assert from "node:assert/strict";
import test from "node:test";
import { crossCheckIdentity } from "../lib/tcgdexCrossCheck.mjs";
const card={id:"30th-149",name:"Pikachu ex",localId:"149",set:{name:"30th Celebration"},rarity:"Special illustration rare",image:"https://example.invalid/card"};
test("subject, local number, set match still does not claim artwork verified",()=>{
 const r=crossCheckIdentity({identifiedSubject:"Pikachu ex",identifiedCardNumber:"149/128",identifiedBrandSet:"30th Celebration"},card);
 assert.equal(r.status,"catalog_fields_agree");
 assert.equal(r.verified,false);
 assert.ok(r.unverified.includes("artwork comparison"));
});
test("same collector number but wrong set is conflicting",()=>{
 const r=crossCheckIdentity({identifiedSubject:"Pikachu ex",identifiedCardNumber:"149/128",identifiedBrandSet:"Different Set"},card);
 assert.equal(r.status,"conflicting");
 assert.ok(r.conflicts.includes("set"));
});
test("incorrect character is conflicting",()=>{
 const r=crossCheckIdentity({identifiedSubject:"Charizard ex",identifiedCardNumber:"149/128",identifiedBrandSet:"30th Celebration"},card);
 assert.equal(r.status,"conflicting");
 assert.ok(r.conflicts.includes("subject"));
});
test("missing set cannot count as catalog match",()=>{
 const r=crossCheckIdentity({identifiedSubject:"Pikachu ex",identifiedCardNumber:"149/128"},card);
 assert.equal(r.status,"insufficient_evidence");
});
