// Genuine photos and real HTTP only. No mocked provider/catalog responses.
// Use only the protected immutable Preview and its no-paid identity-only mode.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const origin=new URL(process.env.GEMPREDICT_PREVIEW_URL||'');
assert.equal(origin.protocol,'https:');assert.match(origin.hostname,/^[a-z0-9-]+\.vercel\.app$/);assert.doesNotMatch(origin.hostname,/-git-|^gempredict-live\.vercel\.app$/);
const photos=process.env.GEMPREDICT_REAL_PHOTOS_DIR;assert.ok(path.isAbsolute(photos||''));
const output=process.env.GEMPREDICT_RECEIPTS_FILE;assert.ok(path.isAbsolute(output||''));assert.ok(!path.resolve(output).startsWith(process.cwd()+path.sep));
const access=process.env.GEMPREDICT_PREVIEW_ACCESS_FILE?JSON.parse(fs.readFileSync(process.env.GEMPREDICT_PREVIEW_ACCESS_FILE)).url:null;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const receipts=[];
try{
 const context=await browser.newContext();if(access){assert.equal(new URL(access).origin,origin.origin);await (await context.newPage()).goto(access);}
 for(const pair of ['original','improved']){
  const page=await context.newPage();let attempted=0;
  await page.route('**/api/predict',route=>{
   const req=route.request();if(req.method()==='POST'){
    const body=req.postData()||'';assert.ok(body.includes('name="identityOnly"\r\n\r\ntrue'));attempted++;
   }return route.continue();
  });
  await page.goto(origin.origin+'/?identityOnly=1');
  await page.locator('input[type=file]').nth(0).setInputFiles(path.join(photos,pair+'_front.jpeg'));
  await page.locator('img[alt="Card preview"]').waitFor({timeout:60000});
  await page.locator('input[type=file]').nth(1).setInputFiles(path.join(photos,pair+'_back.jpeg'));
  await page.locator('img[alt="Back preview"]').waitFor({timeout:60000});
  const responsePromise=page.waitForResponse(r=>r.url().startsWith(origin.origin+'/api/predict')&&r.request().method()==='POST',{timeout:120000});
  await page.getByRole('button',{name:'Analyze My Card',exact:true}).click();
  const response=await responsePromise;const data=await response.json();
  assert.equal(response.status(),200);assert.equal(attempted,1);assert.equal(data.receipt?.mode,'local_identity_only');assert.equal(data.receipt.paidProviderCalls,0);
  assert.equal(data.canonicalCard?.id,'30th-149');assert.equal(data.canonicalCard.year,'2026');assert.equal(data.canonicalCard.cardNumber,'149/128');assert.equal(data.canonicalCard.brandSet,'30th Celebration');assert.equal(data.canonicalCard.subject,'Pikachu ex');
  assert.equal(data.variantVerification.status,'needs_confirmation');assert.equal(data.atlas,null);assert.equal(data.prediction.rawValue,null);
  await page.getByTestId('local-identity-evidence').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/2023 Scarlet & Violet 151/);
  receipts.push({pair,...data.receipt,canonicalCard:data.canonicalCard,localStatus:data.hybridIdentification.status,variantStatus:data.variantVerification.status});await page.close();
 }
 fs.writeFileSync(output,JSON.stringify(receipts,null,2),{mode:0o600});console.log('PASS two genuine browser uploads; receipts stored privately, no paid calls.');
}finally{await browser.close();}
