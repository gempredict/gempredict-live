import assert from "node:assert/strict";
import test from "node:test";
import { assessSoldIdentityGate } from "../lib/soldIdentityGate.mjs";
const crossCheck={provider:"TCGdex",candidateCount:1,catalogId:"30th-149",status:"catalog_fields_agree",agreements:["subject","collectorNumber","set"],conflicts:[]};
const identity={subject:"Pikachu ex",number:"149/128",set:"30th Celebration",printingConfirmed:true};
const artwork={status:"visual_pattern_similar"};
const good={cardType:"pokemon",crossCheck,photoIdentity:identity,artwork};
test("blocks missing catalog match",()=>assert.equal(assessSoldIdentityGate({cardType:"pokemon"}).allowed,false));
test("blocks wrong set despite subject and number agreement",()=>{
 const r=assessSoldIdentityGate({...good,crossCheck:{...crossCheck,status:"conflicting",conflicts:["set"],agreements:["subject","collectorNumber"]}});
 assert.equal(r.allowed,false);assert.equal(r.reason,"identity_conflict");
});
test("blocks unknown artwork",()=>assert.equal(assessSoldIdentityGate({...good,artwork:{status:"inconclusive"}}).reason,"artwork_not_confirmed"));
test("blocks unconfirmed printing even if artwork appears similar",()=>{
 const r=assessSoldIdentityGate({...good,photoIdentity:{...identity,printingConfirmed:false}});
 assert.equal(r.allowed,false);assert.equal(r.reason,"printing_requires_confirmation");
});
test("blocks multiple catalog candidates",()=>assert.equal(assessSoldIdentityGate({...good,crossCheck:{...crossCheck,candidateCount:2}}).allowed,false));
test("explicit reviewed identity and aligned evidence can pass gate",()=>{
 const r=assessSoldIdentityGate(good);assert.equal(r.allowed,true);assert.equal(r.identity.catalogId,"30th-149");
});
