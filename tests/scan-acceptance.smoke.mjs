// Complete offline wiring, actual browser codec + server parser + handler + UI.
// SDK/network replies are explicit fixtures, never a real-card/live-model claim.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { execFileSync,spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
import { parseBrowserUpload,askingFixture,digest } from './helpers/scanAcceptance.mjs';
const {chromium,devices}=createRequire(import.meta.url)('playwright');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3100','--hostname','127.0.0.1'],{stdio:'ignore'});
const runs=[],failures=[],checks=[];let browser;
const check=(name,fn)=>{try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',evidence:e.message});failures.push(name);}};
const output=process.env.SCAN_ACCEPTANCE_OUTPUT||'/tmp/gp-scan-acceptance.json';
try {
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3100')).ok)break;}catch{}await delay(250);}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({...devices['iPhone 13']});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const heic=readFileSync(new URL('./fixtures/mobile/example.heic',import.meta.url));
 const padded=Buffer.concat([heic,Buffer.alloc(Math.ceil(2.1*1024*1024)-heic.length)]);
 const back=await sharp({create:{width:180,height:120,channels:3,background:'#345678'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 let calls=0, preparedFront=null;
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url==='https://www.ebay.com/itm/123456789012') return route.fulfill({status:200,contentType:'text/html',body:'SYNTHETIC ONLY: original listing 123456789012'});
  if(url.endsWith('/api/predict')){
   calls++;const body=route.request().postDataBuffer();const type=route.request().headers()['content-type'];
   const parsed=type.includes('multipart')?await parseBrowserUpload(body,type):{fields:JSON.parse(body.toString()),imageBuffer:null,imageMimeType:null,backImageBuffer:null,backImageMimeType:null};
   const s=liveReportScenario();const listing=askingFixture();
   const result=await runPipeline({...s,parsedRequest:parsed,textOnly:!parsed.imageBuffer,market:[listing,structuredClone(listing)],model:{psa9Value:75,psa10Value:180,psa10Probability:30}});
   assert.equal(result.httpStatus,200);
   if(parsed.imageBuffer){
    preparedFront ||= parsed.imageBuffer;
    const meta=await sharp(parsed.imageBuffer).metadata();assert.equal(meta.format,'jpeg');assert.ok(Math.max(meta.width,meta.height)<=2560);
    assert.equal(result.metrics.modelRequests[0].imageFingerprints[0],digest(parsed.imageBuffer));
    assert.equal(result.metrics.modelRequests[0].imageFingerprints.length,2);
    assert.equal(result.metrics.modelRequests[0].imageFingerprints[1],digest(parsed.backImageBuffer));
    const b=await sharp(parsed.backImageBuffer).metadata();assert.equal(b.width,120);assert.equal(b.height,180);assert.equal(b.orientation,undefined);
   }
   runs.push({kind:parsed.imageBuffer?'image':'revaluation',identity:[result.report.canonicalCard.year,result.report.canonicalCard.brandSet,result.report.canonicalCard.subject,result.report.canonicalCard.cardNumber,result.report.canonicalCard.parallel,result.report.canonicalCard.language],
    financial:[result.report.rawValue,result.report.psa9Value,result.report.psa10Value,result.report.psa10Probability,result.report.expectedNetValue,result.report.verdict],marketCount:result.report.marketData.marketSummary.rawUsedCount,
    modelRequests:result.metrics.modelRequests,marketFingerprint:digest(result.payload.marketData.rawComparableItems),catalogRevision:result.payload.identityVerification.catalog.candidate.printingProvenance?.revision});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result.payload)});
  }
  if(url.startsWith('http://127.0.0.1:3100'))return route.continue();
  return route.abort(); // No provider, listing or telemetry traffic.
 });
 await page.goto('http://127.0.0.1:3100',{waitUntil:'domcontentloaded'});
 await page.locator('input[type=file]').nth(0).setInputFiles({name:'synthetic.HEIF',mimeType:'',buffer:padded});
 await page.locator('img[alt="Card preview"]').waitFor({timeout:60000});
 await page.locator('input[type=file]').nth(1).setInputFiles({name:'rotated-back.jpg',mimeType:'image/jpeg',buffer:back});
 await page.locator('img[alt="Back preview"]').waitFor();
 for(let i=0;i<5;i++){
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/predict')),page.getByRole('button',{name:'Analyze My Card',exact:true}).click()]);
  await page.getByTestId('financial-report').first().waitFor();
 }
 const variants=[
  ['rotated.jpg',await sharp(preparedFront).rotate(90).jpeg().toBuffer()],
  ['lower-resolution.jpg',await sharp(preparedFront).resize({width:640}).jpeg().toBuffer()],
  ['dim-light.jpg',await sharp(preparedFront).modulate({brightness:0.65}).jpeg().toBuffer()]
 ];
 for(const [name,buffer] of variants){
  await page.locator('input[type=file]').nth(0).setInputFiles({name,mimeType:'image/jpeg',buffer});
  await page.locator('img[alt="Card preview"]').waitFor();
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/predict')),page.getByRole('button',{name:'Analyze My Card',exact:true}).click()]);
 }
 check('real upload -> codec -> multipart parser -> actual vision request bytes' ,()=>assert.equal(runs.filter(r=>r.kind==='image').length,8));
 check('identical-image deterministic identity and financials',()=>{
  assert.equal(new Set(runs.map(r=>JSON.stringify(r.identity))).size,1);assert.equal(new Set(runs.map(r=>JSON.stringify(r.financial))).size,1);
  assert.deepEqual(runs[0].financial,[56.99,75,180,30,-30.49,'provisional']);
  assert.equal(new Set(runs.slice(0,5).map(r=>JSON.stringify(r.modelRequests))).size,1);
  assert.equal(new Set(runs.map(r=>r.marketFingerprint)).size,1);
 });
 check('one unique source is counted once',()=>assert.ok(runs.every(r=>r.marketCount===1)));
 const card=page.getByTestId('financial-report').first();
 check('canonical answer and provisional source labels',()=>assert.ok(runs.every(r=>r.identity[1]==='30th Celebration')));
 const links=await card.locator('a[href="https://www.ebay.com/itm/123456789012"]').count();
 check('comparable links available in provisional report',()=>assert.equal(links,1));
 if(links){const [popup]=await Promise.all([page.waitForEvent('popup'),card.getByRole('link',{name:'View eBay listing'}).click()]);
  await popup.waitForLoadState('domcontentloaded');check('source navigation matches original listing (mock only)',()=>assert.equal(popup.url(),'https://www.ebay.com/itm/123456789012'));await popup.close();}
 const methodOpen=await card.getByTestId('financial-methodology').getAttribute('open');
 const aiOpen=await page.getByTestId('photo-initial-identity').first().getAttribute('open');
 check('methodology and rejected AI interpretation are secondary',()=>{assert.equal(methodOpen,null);assert.equal(aiOpen,null);});
 const photoStatus=await page.getByTestId('photo-final-identity').first().innerText();
 check('photo and financial sections agree on provisional pricing',()=>assert.match(photoStatus,/Pricing is provisional/));
 const text=await card.innerText();check('no false recommendation or rejected identity in financial answer',()=>assert.doesNotMatch(text,/Grade It|Skip It|Paldea|PSA 8|Obsidian|Stellar/));
 await card.getByRole('button',{name:'Save Report',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Load',exact:true}).click();
 const saved=await page.getByTestId('financial-report').innerText();check('save/refresh/reopen keeps provisional math',()=>assert.match(saved,/\$-30.49/));
 await page.getByRole('button',{name:'Verify Variant',exact:true}).click();
 await page.getByRole('button',{name:'Confirm and revalue',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Fresh check completed.'}).waitFor();
 check('revaluation cannot promote asking prices',()=>assert.equal(runs.at(-1).financial.at(-1),'provisional'));
 check('no browser exceptions',()=>assert.deepEqual(errors,[]));
}finally{
 await browser?.close();server.kill('SIGTERM');
 const passed=name=>checks.some(c=>c.name===name&&c.status==='PASS');
 const evidence=[
  ['Upload/conversion/orientation','BLOCKED','Original 2.1 MB Pikachu HEIF and physical iPhone unavailable. Real browser codec/server parser passed on libheif and generated back fixtures.'],
  ['Claude interpretation','BLOCKED','SDK replies are mocked; actual proposal accuracy/variance has not been measured on this revision.'],
  ['Independent canonical identification','BLOCKED','Pinned printing data validated, catalog REST schema mocked. Current live delivery and the actual photo are untested.'],
  ['Exact identity/language/printing verification','BLOCKED','Controlled known-card fixtures pass; current physical card and live provider responses not available.'],
  ['Visual observations','BLOCKED','Structured observation handoff is tested; accuracy of observations on the original card is untested.'],
  ['Active eBay/source URLs','BLOCKED','Mock Browse matching/deduplication/navigation tested. No current eBay response or actual listing reachability verified.'],
  ['Completed sales','BLOCKED','No configured authorized supplier or proof of account-specific Marketplace Insights entitlement.'],
  ['Raw/PSA9/PSA10 values','BLOCKED','Historical asking/model inputs only; no verified realized grade-specific prices.'],
  ['Grade probability/population','BLOCKED','No approved population data or calibrated physical-card probability source.'],
  ['Conditional financial arithmetic',passed('identical-image deterministic identity and financials')?'PASS':'FAIL','Historical fixture math: $106.50 expected proceeds minus $56.99 and $80 = -$30.49. Conditional, not FMV.'],
  ['Recommendations/Atlas','BLOCKED','Safe provisional withholding tested; definitive Grade/Sell/Hold decisions lack qualified sales and calibration. No Sell/Hold engine is claimed.'],
  ['Save/reopen/refresh/revalue',checks.filter(c=>/save|revaluation/.test(c.name)&&c.status==='PASS').length===2?'PASS':'FAIL','Actual built UI and server handler with external transports mocked.'],
  ['Physical-card repeatability','BLOCKED','Five identical sample-image runs, three transformed sample runs and separate wrong-proposal replays do not establish real-iPhone/live-model consistency.']
 ];
 const components=evidence.map(([name,status,evidence],index)=>({component:index+1,name,status,evidence}));
 const componentChecks={1:['real upload -> codec -> multipart parser -> actual vision request bytes'],6:['one unique source is counted once','comparable links available in provisional report','source navigation matches original listing (mock only)'],10:['identical-image deterministic identity and financials'],11:['no false recommendation or rejected identity in financial answer','photo and financial sections agree on provisional pricing'],12:['save/refresh/reopen keeps provisional math','revaluation cannot promote asking prices','no browser exceptions'],13:['identical-image deterministic identity and financials']};
 for(const component of components){
  const failed=checks.filter(c=>componentChecks[component.component]?.includes(c.name)&&c.status==='FAIL');
  if(failed.length){component.status='FAIL';component.evidence=failed.map(c=>c.name+': '+c.evidence).join('; ');}
 }
 writeFileSync(output,JSON.stringify({scope:'OFFLINE_ONLY_NOT_LAUNCH_READY',codeRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFingerprint:digest(['pages/api/predict.js','pages/api/ebay-search.js','src/App.jsx','lib/modelConfiguration.mjs','lib/ebayListingProvenance.mjs'].map(f=>[f,readFileSync(f,'utf8')])),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),originalPhotoAvailable:false,fixture:'libheif sample; not Pikachu',inputFingerprint:digest(readFileSync(new URL('./fixtures/mobile/example.heic',import.meta.url))),controls:{identicalImageRuns:5,transformedImageRuns:3,financialInputs:[56.99,75,180,30],market:'fixed synthetic one-source asking snapshot; duplicates deliberately injected',model:'mocked SDK replies, actual production prompt/config capture',providerCalls:'none'},runs,checks,components},null,2));
}
assert.deepEqual(failures,[]);console.log(`PASS integrated scan acceptance: ${runs.length} controlled requests, report ${output}; live capabilities remain BLOCKED.`);
