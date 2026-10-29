// Rendered contract regressions with mocked vision/catalog/market transports.
// These assertions do not prove physical-card or model accuracy.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import {setTimeout as delay} from 'node:timers/promises';
import {runPipeline} from './helpers/phase1Pipeline.mjs';import {liveReportScenario} from './helpers/liveReportFixture.mjs';import {askingFixture} from './helpers/scanAcceptance.mjs';import {supportedObservation} from './helpers/visionEvidence.mjs';
import {readFileSync} from 'node:fs';
import {acceptHybridResult,hybridCatalog,identityOnlyReport} from '../lib/hybridIdentification.mjs';
import {reportFromPrediction} from '../lib/valuationProtection.mjs';
import {hash} from '../scripts/vision-benchmark/core.mjs';
import {prepareRealPhotos} from '../scripts/vision-benchmark/prepare.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3100','--hostname','127.0.0.1'],{stdio:'ignore'});let browser;
const readings=[{field:'cardNumber',text:'149/128',certainty:'clear',side:'front',area:'collector_line',alternatives:[]},{field:'setCode',text:'30C',certainty:'clear',side:'front',area:'set_mark',alternatives:[]}];
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3100')).ok)break;}catch{}await delay(250);}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const mode of ['unsupported','supported','candidate']){
  const base=liveReportScenario();const result=await runPipeline({...base,proposal:{...base.proposal,cardNumber:'149/165',brandSet:'Scarlet & Violet 151'},vision:{...base.vision,identifiedBrandSet:'Scarlet & Violet 151',identifiedYear:'2023',identifiedCardNumber:'149/165',identityReadings:mode==='candidate'?[]:readings,imageLimitations:mode==='unsupported'?['glare','sleeve']:[],visualObservations:mode==='supported'?[supportedObservation('surface','scratches')]:[supportedObservation('surface','scratches'),{attribute:'corners',code:'softening'}]},market:[askingFixture()],model:{psa9Value:75,psa10Value:180,psa10Probability:30}});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:3100')?r.continue():r.abort());
  await page.addInitScript(report=>{localStorage.setItem('gp_saved_reports',JSON.stringify([report]));Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}},configurable:true});},result.report);
  await page.goto('http://127.0.0.1:3100',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Load',exact:true}).click();
  const body=await page.locator('body').innerText();
  assert.equal(await page.getByTestId('card-display-title').innerText(),'Pikachu ex — Special Illustration Rare (SIR)');
  assert.equal(await page.getByTestId('card-display-subtitle').innerText(),'2026 Pokémon 30th Celebration · #149/128 · English');
  assert.doesNotMatch(body,/Scarlet & Violet 151|149\/165|PSA 8[–-]9/);
  if(mode==='candidate'){
   assert.match(await page.getByTestId('catalog-candidate').innerText(),/2026.*30th Celebration.*149\/128/);
   assert.match(body,/Valuation and grading ROI withheld/);assert.equal(result.report.rawValue,null);
   await page.getByRole('button',{name:'Copy Summary',exact:true}).click();const copied=await page.evaluate(()=>window.__copied);assert.match(copied,/Unverified card/);assert.doesNotMatch(copied,/151|149\/165/);
   await page.getByRole('button',{name:'Verify Variant',exact:true}).click();assert.equal(await page.getByLabel('Card number',{exact:true}).inputValue(),'149/128');
  }else{
   assert.match(await page.getByTestId('catalog-rarity').innerText(),/Catalog rarity: Special Illustration Rare \(SIR\).*Artwork: Special Art.*Catalog printing: Holo/);
   assert.match(body,/\$56.99/);assert.match(body,/30%.*uncalibrated/);assert.equal(result.report.atlas,null);
   if(mode==='unsupported'){assert.doesNotMatch(body,/Visible surface scratches|Visible corner softening/);assert.match(body,/Possible surface scratches.*unconfirmed/);assert.match(body,/Suspected — unconfirmed/i);}
   else {assert.match(body,/Visible surface scratches/);assert.equal(result.report.imageAnalysis.surface,'fair');}
   assert.equal(result.report.psa10Probability,30);assert.equal(result.report.financialDecision.probability.visionDefectsUsed,false);
  }
  await page.getByTestId('photo-initial-identity').locator('summary').click();assert.match(await page.getByTestId('photo-initial-identity').innerText(),/149\/165/);
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS vision reliability browser: ${mode}; catalog rarity, printing and observation certainty remain separate.`);
 }
 // Clearly mocked OCR boundary: real-photo OCR is validated separately/private.
 for(const supported of [true,false]){
  const {pins}=hybridCatalog();
  const raw={catalogSha256:pins.catalogSha256,status:supported?'identity_candidate':'ambiguous',catalogIdentitySupported:supported,detection:{status:'detected'},candidates:[{id:'30th-149',score:supported?.85:.7,evidence:{collectorNumber:{supported:true,readings:[{value:'149/128',passes:3,confidence:85}]},name:{supported:true,score:1,exactReadings:[{text:'Pikachuex',confidence:95}]},setCode:{supported,value:supported?'30C':null,readings:supported?[{code:'30C',language:'en',pass:'footer:color'},{code:'30C',language:'en',pass:'footer:gray'}]:[]},language:{supported,value:supported?'en':null},artwork:{status:'reference_unavailable'}}}]};
  const report=reportFromPrediction(identityOnlyReport(acceptHybridResult(raw)));
  const page=await browser.newPage();
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:3100')?r.continue():r.abort());
  await page.addInitScript(report=>localStorage.setItem('gp_saved_reports',JSON.stringify([report])),report);
  await page.goto('http://127.0.0.1:3100',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Load',exact:true}).click();
  assert.equal(await page.getByTestId('card-display-title').innerText(),'Pikachu ex — Special Illustration Rare (SIR)');
  assert.equal(await page.getByTestId('card-display-subtitle').innerText(),'2026 Pokémon 30th Celebration · #149/128 · English');
  const body=await page.locator('body').innerText();
  assert.match(body,supported?/Verified printed-card identity/:/Identity unverified/);
  if(!supported)assert.match(await page.getByTestId('local-identity-evidence').innerText(),/set code and language are not reliably readable/);
  assert.match(body,/Physical printing.*unverified/);assert.match(body,/Valuation and grading ROI withheld/);
  assert.doesNotMatch(body,/Grade It|Skip It/);await page.close();
  console.log('PASS mocked local-identity rendered report: '+(supported?'verified printed identity':'specific set/language confirmation'));
 }
 const codecFile='tests/fixtures/mobile/example.heic';
 const spec={path:codecFile,sha256:hash(readFileSync(codecFile))};
 const prepared=await prepareRealPhotos({fixtures:[{id:'public-codec-only-not-card-accuracy',front:spec,back:spec}]},process.cwd());
 const images=prepared.get('public-codec-only-not-card-accuracy');
 assert.equal(images.length,2);assert.ok(images.every(image=>image.mime==='image/jpeg'&&image.buffer.length>0));
 assert.equal(hash(images[0].buffer),hash(images[1].buffer));
 console.log('PASS benchmark photo preparation: actual HEIF front/back normalization; public codec fixture, no card/model accuracy claim or provider call.');
}finally{await browser?.close();server.kill('SIGTERM');}
