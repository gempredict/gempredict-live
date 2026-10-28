#!/usr/bin/env node
// Standalone local prototype. Never imported by Next.js or the production API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCatalog,sha256} from './catalog.mjs';
import {catalogLanguageKey} from '../../lib/catalogNormalization.mjs';
import {prepareRealPhotos} from '../../scripts/vision-benchmark/prepare.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=path.join(root,'prototypes/hybrid-identity/engine.py');
const key=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function writePrivate(file,value) {
 const target=path.resolve(file),parent=path.dirname(target);
 let ancestor=parent;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
 const actualAncestor=fs.realpathSync(ancestor);
 if(actualAncestor===root||actualAncestor.startsWith(root+path.sep))throw Error('output_must_be_outside_repository_and_not_symlink');
 fs.mkdirSync(parent,{recursive:true,mode:0o700});
 const actualParent=fs.realpathSync(parent);
 if(actualParent===root||actualParent.startsWith(root+path.sep)||fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('output_must_be_outside_repository_and_not_symlink');
 fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.chmodSync(target,0o600);
}
export function scoreResult(result, expected) {
 const exact=c=>['subject','year','brandSet','cardNumber','language','rarity'].every(f=>f==='language'?catalogLanguageKey(c?.identity?.[f])===catalogLanguageKey(expected?.[f]):key(c?.identity?.[f])===key(expected?.[f]));
 const top=result.rankedCandidates[0];
 return {top1:!!top&&exact(top),top5:result.rankedCandidates.some(exact),supportedCorrect:result.catalogIdentitySupported===true&&!!top&&exact(top),
         catalogPrintingMatch:!!top&&top.identity.printings.length===1&&key(top.identity.printings[0])===key(expected.printing),physicalPrintingVerified:result.exactPrintingVerified===true,
         incorrectSupportedIdentity:result.catalogIdentitySupported===true&&!exact(top)};
}
export async function runLocal(fixtures,{catalogPath,referencesPath,python=process.env.HYBRID_PYTHON||'python3',repeats=1}={}) {
 if(!Number.isInteger(repeats)||repeats<1||repeats>5||!fixtures.length||fixtures.length>20)throw Error('bounded_fixture_or_repeat_count');
 const bytes=fs.readFileSync(catalogPath),catalog=JSON.parse(bytes);
 if(catalog.recordsDigest!==sha256(JSON.stringify(catalog.records)))throw Error('catalog_digest_mismatch');
 const prepared=await prepareRealPhotos({fixtures},root);
 const excluded=[...fixtures.flatMap(f=>[f.front?.sha256,f.back?.sha256]).filter(Boolean),...[...prepared.values()].flatMap(images=>images.map(i=>sha256(i.buffer)))];
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gp-hybrid-'));fs.chmodSync(temp,0o700);
 try{
  const rows=[];
  for(let i=0;i<fixtures.length;i++){
   const fixture=fixtures[i],images=prepared.get(fixture.id);
   const front=path.join(temp,`${i}-front.jpg`),back=images[1]?path.join(temp,`${i}-back.jpg`):null;
   fs.writeFileSync(front,images[0].buffer,{mode:0o600});if(back)fs.writeFileSync(back,images[1].buffer,{mode:0o600});
   for(let repeat=0;repeat<repeats;repeat++){
    const args=[engine,'--front',front,'--catalog',path.resolve(catalogPath),'--excluded-hashes',JSON.stringify(excluded),...(back?['--back',back]:[]),...(referencesPath?['--references',path.resolve(referencesPath)]:[])];
    // Only image files, catalog and reference data cross this process boundary.
    // Ground truth stays in this evaluator and is never an identifier argument.
    const raw=execFileSync(python,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
    const result=JSON.parse(raw);
    rows.push({fixtureId:fixture.id,repeat,result,preparedImageHashes:images.map(i=>sha256(i.buffer)),...(fixture.expected?{score:scoreResult(result,fixture.expected)}:{})});
   }
  }
  const scores=rows.filter(r=>r.score),times=rows.map(r=>r.result.elapsedMs).sort((a,b)=>a-b);
  return {scope:'REAL_PHOTO_LOCAL_PROTOTYPE_NOT_PRODUCTION_VALIDATION',externalIdentificationCalls:0,newSpendingUSD:0,catalogFileSha256:sha256(bytes),catalogCoverage:catalog.coverage,
   rows,summary:{evaluations:rows.length,uniquePhotoPairs:fixtures.length,top1RetrievalAccuracy:scores.length?scores.filter(r=>r.score.top1).length/scores.length:null,top5RetrievalAccuracy:scores.length?scores.filter(r=>r.score.top5).length/scores.length:null,
    supportedCorrect:scores.filter(r=>r.score.supportedCorrect).length,incorrectSupportedIdentities:scores.filter(r=>r.score.incorrectSupportedIdentity).length,
    physicalPrintingVerified:scores.filter(r=>r.score.physicalPrintingVerified).length,catalogPrintingMatches:scores.filter(r=>r.score.catalogPrintingMatch).length,
    medianProcessingMs:times[Math.floor(times.length/2)],maxProcessingMs:times.at(-1),
    perFixture:fixtures.map(f=>({id:f.id,statuses:[...new Set(rows.filter(r=>r.fixtureId===f.id).map(r=>r.result.status))],identityVersions:new Set(rows.filter(r=>r.fixtureId===f.id).map(r=>r.result.rankedCandidates[0]?.id||null)).size}))},
   limitations:['Catalog subset is incomplete; rank scores are not calibrated probabilities.','Missing catalog artwork cannot be counted as artwork agreement.','Catalog printing metadata is distinct from physically verified foil/finish.','No grading, pricing, authenticity or production trust is granted.']};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
async function main(){
 const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:null,output=arg('--output');
 if(!output)throw Error('private_output_required');
 if(args.includes('--build-catalog')){
  const catalog=buildCatalog({source:arg('--source'),revision:arg('--revision'),root});writePrivate(output,catalog);
  console.log(JSON.stringify({catalogRecords:catalog.records.length,sha256:sha256(fs.readFileSync(output)),coverage:catalog.coverage}));return;
 }
 const catalogPath=arg('--catalog');if(!catalogPath)throw Error('local_catalog_required');
 let fixtures,repeats=1;
 if(arg('--benchmark')){
  const manifestPath=path.resolve(arg('--benchmark')),manifest=JSON.parse(fs.readFileSync(manifestPath));repeats=manifest.repeats||1;
  if(manifest.catalogSha256!==sha256(fs.readFileSync(catalogPath)))throw Error('benchmark_catalog_hash_mismatch');
  fixtures=manifest.fixtures.map(f=>({...f,front:{...f.front,path:path.resolve(path.dirname(manifestPath),f.front.path)},...(f.back?.path?{back:{...f.back,path:path.resolve(path.dirname(manifestPath),f.back.path)}}:{})}));
 }else{
  const spec=file=>({path:path.resolve(file),sha256:sha256(fs.readFileSync(file))});
  if(!arg('--front'))throw Error('front_required');
  fixtures=[{id:'unlabeled-local-photo',front:spec(arg('--front')),...(arg('--back')?{back:spec(arg('--back'))}:{})}];
 }
 const report=await runLocal(fixtures,{catalogPath,referencesPath:arg('--references'),python:arg('--python')||undefined,repeats});
 report.codeRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 report.sourceFingerprint=sha256(['engine.py','run.mjs','catalog.mjs','specialist.mjs'].map(name=>fs.readFileSync(path.join(root,'prototypes/hybrid-identity',name))).join('\n'));
 report.workingTreeDirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
 writePrivate(output,report);console.log(JSON.stringify({output,summary:report.summary,externalCalls:0,newSpendingUSD:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Hybrid prototype failed: check local dependencies, image/catalog hashes and private output paths. No external identification call was made.');process.exitCode=1;});
