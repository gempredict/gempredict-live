import assert from "node:assert/strict";
import test from "node:test";
import {issueIdentityReviewToken,verifyIdentityReviewToken} from "../lib/identityReviewToken.mjs";
const original=process.env.IDENTITY_REVIEW_SIGNING_KEY;
process.env.IDENTITY_REVIEW_SIGNING_KEY="test-review-key-strong-not-production";
const scan={catalogId:"30th-149",subject:"Pikachu ex",number:"149/128",set:"30th Celebration",conflicts:[],imageAnalyzed:true};
test("signed photo scan proof can be verified",()=>{
 const t=issueIdentityReviewToken(scan);const d=verifyIdentityReviewToken(t);
 assert.equal(d.catalogId,"30th-149");assert.equal(d.number,"149/128");
});
test("tampered proof is rejected",()=>{
 const t=issueIdentityReviewToken(scan);assert.equal(verifyIdentityReviewToken(t.slice(0,-2)+"zz"),null);
});
test("unsigned or non-photo evidence cannot be issued as usable review",()=>{
 const t=issueIdentityReviewToken({...scan,imageAnalyzed:false});assert.equal(verifyIdentityReviewToken(t),null);
});
test("expired proof is rejected",()=>{
 const token=issueIdentityReviewToken(scan);const [p]=token.split(".");
 const d=JSON.parse(Buffer.from(p,"base64url").toString());d.t-=16*60*1000;
 const altered=Buffer.from(JSON.stringify(d)).toString("base64url")+"."+token.split(".")[1];
 assert.equal(verifyIdentityReviewToken(altered),null);
});
process.env.IDENTITY_REVIEW_SIGNING_KEY=original;
