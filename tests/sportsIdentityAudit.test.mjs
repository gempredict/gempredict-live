import assert from "node:assert/strict";
import test from "node:test";
import {auditSportsIdentity} from "../lib/sportsIdentityAudit.mjs";
const basic={identifiedSubject:"Sample Player",identifiedYear:"2025",identifiedManufacturer:"Topps",identifiedBrandSet:"Chrome",identifiedCardNumber:"101",identifiedAutoOrRelic:"none"};
test("base rookie with required fields remains unverified rather than catalog-confirmed",()=>{
 const r=auditSportsIdentity(basic,"base");assert.equal(r.status,"complete_unverified");assert.equal(r.photoVerified,false);assert.equal(r.soldLookupEligible,false);
});
test("numbered parallel needs distinct parallel and stamped serial evidence",()=>{
 const no=auditSportsIdentity({...basic,identifiedParallel:"Gold"},"numbered_parallel");
 assert.ok(no.issues.includes("parallel_or_serial_not_evidenced"));
 const yes=auditSportsIdentity({...basic,identifiedParallel:"Gold",identifiedSerialNumber:"12/50"},"numbered_parallel");
 assert.equal(yes.status,"complete_unverified");
});
test("printed signature must not count as authenticated autograph",()=>{
 const r=auditSportsIdentity({...basic,identifiedAutoOrRelic:"none"},"autograph");
 assert.ok(r.issues.includes("autograph_not_evidenced"));
});
test("relic benchmark requires relic observation",()=>{
 const r=auditSportsIdentity({...basic,identifiedAutoOrRelic:"none"},"relic");
 assert.ok(r.issues.includes("relic_not_evidenced"));
});
test("unreadable maker and product block any sports price lookup",()=>{
 const r=auditSportsIdentity({...basic,identifiedManufacturer:null,identifiedBrandSet:null},"base");
 assert.ok(r.missing.includes("manufacturer"));assert.ok(r.missing.includes("product"));
});
test("speculative set text is flagged",()=>{
 const r=auditSportsIdentity({...basic,identifiedBrandSet:"Chrome or similar"},"unspecified");
 assert.ok(r.issues.includes("speculative_identity"));
});
