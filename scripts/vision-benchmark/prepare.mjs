import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';import {setTimeout as delay} from 'node:timers/promises';
import {hash} from './core.mjs';import {validateAnalysisImage} from '../../lib/uploadValidation.mjs';
// Use the actual client normalizer for HEIF, rotation, resizing and quality floor.
// This is local-only preparation. /api and every non-local request are blocked.
export async function prepareRealPhotos(manifest,root) {
 const {chromium}=createRequire(import.meta.url)('playwright');
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3102','--hostname','127.0.0.1'],{stdio:'ignore'});let browser;
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3102')).ok){ready=true;break;}}catch{}await delay(250);}if(!ready)throw Error('benchmark_local_build_unavailable');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const prepared=new Map();
  for(const fixture of manifest.fixtures){
   const page=await browser.newPage();
   await page.route('**/*',route=>{const url=new URL(route.request().url());return url.origin==='http://127.0.0.1:3102'&&!url.pathname.startsWith('/api/')?route.continue():route.abort();});
   await page.goto('http://127.0.0.1:3102',{waitUntil:'domcontentloaded'});const images=[];
   for(const [index,side] of ['front','back'].entries()){
    const spec=fixture[side];if(side==='back'&&!spec?.path)continue;const file=path.resolve(root,spec.path);const original=fs.readFileSync(file);
    if(hash(original)!==spec.sha256)throw Error('benchmark_original_image_hash_mismatch');
    await page.locator('input[type=file]').nth(index).setInputFiles(file);
    const image=page.locator(`img[alt="${side==='front'?'Card preview':'Back preview'}"]`);await image.waitFor({timeout:60000});
    const data=await image.evaluate(async img=>{const blob=await(await fetch(img.src)).blob();const buffer=await blob.arrayBuffer();return {mime:blob.type,bytes:Array.from(new Uint8Array(buffer))};});
    const buffer=Buffer.from(data.bytes),mime=await validateAnalysisImage(buffer);
    images.push({buffer,mime,originalHash:hash(original)});
   }
   prepared.set(fixture.id,images);await page.close();
  }
  return prepared;
 }finally{await browser?.close();server.kill('SIGTERM');}
}
