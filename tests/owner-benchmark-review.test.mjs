import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ownerBenchmarkBranch, buildOwnerReviewPacket, ownerSlots, redactedReviewScorecard } from '../lib/ownerBenchmarkReview.mjs';
import { blindBenchmarkInput } from '../lib/benchmarkCalibration.mjs';
import { handleOwnerBenchmark } from '../lib/ownerBenchmarkRoute.mjs';
import { authorizeDiagnosticOwner } from '../lib/scanDiagnosticsAuth.mjs';

const baseline = JSON.parse(readFileSync(new URL('../benchmarks/identity/manifest.json',import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = {front:sha('synthetic prepared front bytes'),back:sha('synthetic prepared back bytes')};
const receipt = {reviewer:'synthetic-reviewer',reference:'synthetic-reference',date:'2026-11-26'};
const reviewed = {
 id:'GP-OWNER-12345678-1234-4321-1234-123456789abc',name:'Synthetic Card',category:'sports_owner',mode:'reviewed',hashes,
 core:{...receipt,kind:'manufacturer_checklist',url:'https://example.test/card',fields:{subject:'Synthetic',year:'2026',set:'Synthetic Set',cardNumber:'A-1'}},
 printing:{...receipt,kind:'independent_catalog',url:'https://example.test/variant',fields:{manufacturer:'Synthetic Manufacturer',subset:'N/A',parallel:'Regular base',finish:'Matte',serialNumber:'N/A',autoOrRelic:'N/A'}},
 photo:{...receipt,cardOnlyPixels:true,metadataStripped:true,identityAssessable:true},
 condition:{...receipt,observations:[{side:'back',attribute:'corners',location:'top-left',state:'defect',limitations:['glare']}]},
 grading:{...receipt,grade:7},
};
const origin = 'https://gempredict-live-unit123.vercel.app';
const env = {VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:new URL(origin).host,VERCEL_GIT_COMMIT_REF:ownerBenchmarkBranch,
 VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',
 VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',
 GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
const now = 1800000000000;
const headers = {host:new URL(origin).host,origin};
const cookie = authorizeDiagnosticOwner({method:'POST',headers},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];

function call({method='POST',requestHeaders={...headers,cookie},body={action:'review',drafts:[reviewed]},environment=env,time=now} = {}) {
 const res = {headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.code=code;return this;},json(body){this.body=body;}};
 handleOwnerBenchmark({method,headers:requestHeaders,body},res,baseline,environment,time);
 return res;
}

test('existing twelve slots show actual review coverage and retain historical records',()=>{
 const slots=ownerSlots(baseline);
 assert.equal(slots.length,12);
 assert.deepEqual(slots.filter(slot=>slot.coreReviewed).map(slot=>slot.id),['GP-ID-008']);
 assert.ok(slots.every(slot=>!slot.photosReviewed));
 const result=buildOwnerReviewPacket(baseline,[reviewed]);
 assert.deepEqual(result.manifest.cards.slice(0,12),baseline.cards);
 assert.equal(result.manifest.cards.length,13);
});

test('owner authorization is enforced for every read and export, including expiration and branch isolation',()=>{
 assert.equal(call({method:'GET',requestHeaders:headers}).code,403);
 assert.equal(call({requestHeaders:headers}).code,403);
 assert.equal(call({requestHeaders:{...headers,cookie,origin:'https://other.example'}}).code,404);
 assert.equal(call({requestHeaders:{host:headers.host,cookie}}).code,404);
 assert.equal(call({time:now+900001}).code,403);
 assert.equal(call({environment:{...env,VERCEL_ENV:'production'}}).code,404);
 assert.equal(call({environment:{...env,VERCEL_GIT_COMMIT_REF:'feature/identification-grading-calibration-phase5q'}}).code,404);
 assert.equal(call({method:'GET'}).body.slots.length,12);
 const res=call();
 assert.equal(res.code,200);
 assert.match(res.headers['Cache-Control'],/no-store/);
});

test('prepared-byte digests bind the blind export and omit all identity and grade labels',()=>{
 const packet=buildOwnerReviewPacket(baseline,[reviewed]);
 const card=packet.manifest.cards.at(-1);
 const labels=packet.labels[card.id];
 assert.equal(packet.statuses[card.id],'independently_reviewed');
 assert.equal(labels.gradingOutcome.grade,7);
 assert.deepEqual(labels.conditionReview.regions,reviewed.condition.observations);
 assert.deepEqual(packet.blindInputs[card.id],blindBenchmarkInput(card,labels.blindReview,hashes));
 assert.throws(()=>blindBenchmarkInput(card,labels.blindReview,{...hashes,front:sha('original photo')}),/unverified/);
 assert.deepEqual(packet.blindInputs[card.id],{version:1,images:[{side:'front',sha256:hashes.front},{side:'back',sha256:hashes.back}]});
});

test('owner assertions, missing references and unconfirmed metadata cannot make benchmark labels eligible',()=>{
 const owner=buildOwnerReviewPacket(baseline,[{...reviewed,mode:'owner_reported'}]);
 assert.equal(owner.statuses[reviewed.id],'owner_reported');
 assert.equal(owner.manifest.cards.at(-1).groundTruth.status,'unreviewed');
 assert.deepEqual(owner.labels[reviewed.id],{});
 const incomplete=buildOwnerReviewPacket(baseline,[{...reviewed,core:{...reviewed.core,url:''},photo:{...reviewed.photo,metadataStripped:false}}]);
 assert.equal(incomplete.statuses[reviewed.id],'incomplete');
 assert.deepEqual(incomplete.blindInputs,{});
 assert.equal(incomplete.labels[reviewed.id].gradingOutcome,undefined);
 assert.equal(incomplete.labels[reviewed.id].printingReview,undefined);
 assert.ok(incomplete.pending[reviewed.id].reasons.length >= 3);
 assert.throws(()=>buildOwnerReviewPacket(baseline,[{...reviewed,id:'GP-ID-008'}]),/baseline_truth_conflict/);
});

test('redacted export reports coverage only and a professional grade never creates condition labels',()=>{
 const draft={...reviewed,condition:undefined,rawResponse:'PRIVATE_MARKETPLACE',apiKey:'PRIVATE_KEY',photoBytes:'PRIVATE_BYTES'};
 const packet=buildOwnerReviewPacket(baseline,[draft]);
 assert.equal(packet.labels[reviewed.id].conditionReview,undefined);
 assert.equal(packet.labels[reviewed.id].gradingOutcome.grade,7);
 assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_MARKETPLACE|PRIVATE_KEY|PRIVATE_BYTES/);
 const out=call({body:{action:'scorecard',drafts:[draft]}});
 assert.equal(out.code,200);
 assert.deepEqual(out.body,redactedReviewScorecard(packet));
 assert.equal(out.body.coverage.acceptedTrials,0);
 assert.equal(out.body.coverage.reviewedPSA,1);
 assert.doesNotMatch(JSON.stringify(out.body),/example\.test|Synthetic Card|GP-ID|synthetic-reference|gradingOutcome|sha256/);
});

test('Phase 5Q CLI reads the private review packet and checks the downloaded bytes again',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'gp-owner-review-'));
 const args=['--review-packet','packet.json'];
 const script=fileURLToPath(new URL('../scripts/identity-benchmark.mjs',import.meta.url));
 const run=(command,...extra)=>spawnSync(process.execPath,[script,command,...args,...extra],{cwd,encoding:'utf8'});
 try {
  const packet=buildOwnerReviewPacket(baseline,[reviewed]);
  writeFileSync(join(cwd,'packet.json'),JSON.stringify(packet));
  writeFileSync(join(cwd,'observations.json'),'[]');
  writeFileSync(join(cwd,'front.jpg'),'synthetic prepared front bytes');
  writeFileSync(join(cwd,'back.jpg'),'synthetic prepared back bytes');
  const blindArgs=['--card',reviewed.id,'--front-file','front.jpg','--back-file','back.jpg'];
  const trial='benchmarks/identity/private/trial';
  const input=run('blind-input',...blindArgs,'--output',trial);
  assert.equal(input.status,0,input.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(cwd,trial,'input.json'))),packet.blindInputs[reviewed.id]);
  assert.equal(readFileSync(join(cwd,trial,'back.image'),'utf8'),'synthetic prepared back bytes');
  writeFileSync(join(cwd,'back.jpg'),'wrong bytes');
  const wrong=run('blind-input',...blindArgs,'--output','benchmarks/identity/private/wrong');
  assert.notEqual(wrong.status,0);
  assert.match(wrong.stderr,/No input contents were logged/);
  const output='benchmarks/identity/private/accuracy';
  const result=run('accuracy','--observations','observations.json','--output',output);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(readFileSync(join(cwd,output,'accuracy.json'))).coverage.acceptedTrials,0);
 } finally {rmSync(cwd,{recursive:true,force:true});}
});
