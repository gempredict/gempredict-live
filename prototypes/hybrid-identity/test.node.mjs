// Synthetic contract tests, not image/model accuracy claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildCatalog,bundledCatalog} from './catalog.mjs';
import {writePrivate,scoreResult} from './run.mjs';
import {specialistReadiness,evaluateSpecialist,normalizeSpecialist} from './specialist.mjs';
test('bundled catalog is validated independent data with explicit printing provenance',()=>{
 const records=bundledCatalog();assert.ok(records.length>=2);
 for(const row of records){assert.equal(row.source.repository,'tcgdex/cards-database');assert.match(row.source.revision,/^[a-f0-9]{40}$/);assert.ok(row.source.snapshotDigest);assert.ok(row.cardNumber.includes('/'));}
 assert.equal(buildCatalog().coverage.complete,false);
});
test('private result output refuses repository paths and symlinks',()=>{
 assert.throws(()=>writePrivate(path.resolve('prototypes/hybrid-identity/must-not-write.json'),{}),/outside_repository/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gp-private-test-'));
 try{writePrivate(path.join(dir,'report.json'),{});assert.equal(fs.statSync(path.join(dir,'report.json')).mode&0o777,0o600);fs.symlinkSync(path.join(dir,'report.json'),path.join(dir,'link'));assert.throws(()=>writePrivate(path.join(dir,'link'),{}),/symlink/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('retrieval scoring is separate from supported identity and physical printing',()=>{
 const expected={subject:'Synthetic ex',year:'2026',brandSet:'Test',cardNumber:'11/22',language:'en',rarity:'Test rarity',printing:'holo'};
 const result={rankedCandidates:[{identity:{...expected,printings:['holo']}}],catalogIdentitySupported:false,exactPrintingVerified:false};
 const score=scoreResult(result,expected);assert.equal(score.top1,true);assert.equal(score.supportedCorrect,false);assert.equal(score.physicalPrintingVerified,false);assert.equal(score.catalogPrintingMatch,true);
});
test('specialist never invokes transport without its own sharing consent and fresh free-only evidence',async()=>{
 let calls=0;const transport=async()=>{calls++;return {};};
 const result=await evaluateSpecialist({image:Buffer.from('not-a-real-photo'),key:'synthetic-test-only',transport});
 assert.equal(result.status,'BLOCKED');assert.equal(calls,0);
 assert.ok(specialistReadiness({}).blockers.includes('specialist_credential_unavailable'));
 const freeTrial={verified:true,purchasedCreditsPresent:false,remaining:25,observedAt:new Date().toISOString()};
 assert.equal(specialistReadiness({key:'synthetic',photoSharingConsent:true,freeTrial}).status,'READY_FOR_EXPLICIT_FREE_EVALUATION');
 for(const changed of [{...freeTrial,remaining:0},{...freeTrial,purchasedCreditsPresent:true},{...freeTrial,observedAt:'2020-01-01'}])assert.equal(specialistReadiness({key:'synthetic',photoSharingConsent:true,freeTrial:changed}).status,'BLOCKED');
});
test('specialist normalization cannot promote provider scores or prices into independent trust',()=>{
 const result=normalizeSpecialist({data:{status:'matched',candidates:[{card_id:1,name:'Synthetic',number:'11/22',prices:[{market_price:999}],score:100,printings:['Holofoil']} ]}});
 assert.equal(result.productionTrustGranted,false);assert.equal(result.independentlyVerified,false);assert.doesNotMatch(JSON.stringify(result),/999|market_price/);
 assert.throws(()=>normalizeSpecialist({data:{status:'matched',candidates:null}}),/invalid/);
});
