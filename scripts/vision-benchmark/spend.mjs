// Conservative admission controls for this benchmark only, not a billing API.
// Full reservation is retained on errors. No retry/refund can reopen capacity.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {buildVisionPrompt} from '../../lib/visionPrompt.mjs';
export const REVIEWED_AT='2026-10-28';
export const REVIEWED_RATES=Object.freeze({anthropic:{inputPerMillion:3,outputPerMillion:15},openai:{inputPerMillion:2,outputPerMillion:8},google:{inputPerMillion:2,outputPerMillion:12}});
export const PROFILES=Object.freeze({smoke:{fixtures:1,repeats:1,requests:3,maxUSD:.75},full:{fixtures:2,repeats:3,requests:18,maxUSD:4.25}});
const MODELS={anthropic:'claude-sonnet-4-6',openai:'gpt-4.1-2025-04-14',google:'gemini-3.1-pro-preview'};
export async function createSpendGuard(manifest,prepared,{now=Date.now()}={}) {
 const policy=manifest.spendPolicy,profile=PROFILES[policy?.profile];
 if(policy?.version!==1||!profile||policy.ratesReviewedAt!==REVIEWED_AT||manifest.ratesAsOf!==REVIEWED_AT||now<Date.parse(REVIEWED_AT)||now-Date.parse(REVIEWED_AT)>7*86400000)throw Error('spend_policy_missing_or_stale');
 if(manifest.fixtures.length!==profile.fixtures||manifest.repeats!==profile.repeats||manifest.maxRequests!==profile.requests||manifest.maxEstimatedCostUSD!==profile.maxUSD)throw Error('spend_profile_mismatch');
 if(JSON.stringify(manifest.rates)!==JSON.stringify(REVIEWED_RATES))throw Error('spend_rates_not_reviewed');
 const inputBounds=new Map();
 for(const fixture of manifest.fixtures){
  const images=prepared.get(fixture.id);
  if(!Array.isArray(images)||images.length!==2)throw Error('spend_requires_front_and_back');
  let bound=2048;
  for(const image of images){
   if(image.mime!=='image/jpeg'||!Buffer.isBuffer(image.buffer)||image.buffer.length>1600*1024)throw Error('spend_invalid_image');
   const meta=await sharp(image.buffer,{limitInputPixels:40000000}).metadata();
   if(meta.format!=='jpeg'||meta.pages>1||!Number.isInteger(meta.width)||!Number.isInteger(meta.height)||Math.min(meta.width,meta.height)<512||Math.max(meta.width,meta.height)>2560||meta.width/meta.height<.5||meta.width/meta.height>2)throw Error('spend_image_dimensions');
   // Deliberately dominates documented 28px patches, 32px patches, 512px
   // OpenAI tiles and Gemini image tiles at these dimensions. No upscaling.
   bound+=Math.max(4*Math.ceil(meta.width/28)*Math.ceil(meta.height/28),Math.ceil(meta.width*meta.height/750),85+170*Math.ceil(meta.width/512)*Math.ceil(meta.height/512),258*Math.ceil(meta.width/768)*Math.ceil(meta.height/768))+1024;
  }
  const prompt=buildVisionPrompt({cardName:'Unknown card from image',typeLabel:fixture.category==='sports'?'Sports Card':'Pokemon',hasBack:true});
  if(bound+4*Buffer.byteLength(prompt,'utf8')>64000)throw Error('spend_input_bound');
  inputBounds.set(fixture.id,bound);
 }
 const journal=process.env.VISION_BENCH_JOURNAL;
 if(policy.requireJournal&&(!journal||!fs.existsSync(path.dirname(journal))||fs.existsSync(journal)))throw Error('spend_journal_required');
 let attempts=0,reserved=0,stopped=false;
 const providerAttempts={anthropic:0,openai:0,google:0};
 // Conservative plan reserves a 64k input / 2k total output envelope per call,
 // with 25% surcharge/tax/rounding headroom. Actual admission is checked below.
 const charge=id=>Math.ceil((64000*REVIEWED_RATES[id].inputPerMillion+2000*REVIEWED_RATES[id].outputPerMillion)*1.25);
 const planned=Object.keys(MODELS).reduce((n,id)=>n+charge(id)*profile.fixtures*profile.repeats,0);
 if(planned>Math.floor(profile.maxUSD*1e6))throw Error('spend_plan_exceeds_budget');
 const report=()=>({kind:'conservative_pre_request_reservation_not_provider_billing_cap',plannedMaximumUSD:planned/1e6,reservedMaximumUSD:reserved/1e6,requestLimit:profile.requests,attemptedRequests:attempts,providerAttempts:{...providerAttempts},rateReview:REVIEWED_AT,stopped});
 const persist=()=>{if(journal){fs.writeFileSync(journal,JSON.stringify(report()),{mode:0o600});fs.chmodSync(journal,0o600);}};
 persist();
 return {
  reserve(id,fixture,payload,prompt){
   if(stopped||!MODELS[id]||attempts>=profile.requests||providerAttempts[id]>=profile.fixtures*profile.repeats)throw Error('spend_request_limit');
   const cap=id==='google'?payload.generationConfig?.maxOutputTokens:payload.max_tokens??payload.max_output_tokens;
   if((id!=='google'&&payload.model!==MODELS[id])||cap!==2000||payload.tools||payload.service_tier||payload.thinking||payload.generationConfig?.candidateCount>1||payload.generationConfig?.tools)throw Error('spend_payload_not_approved');
   const inputBound=inputBounds.get(fixture.id)+4*Buffer.byteLength(prompt,'utf8');
   if(!Number.isFinite(inputBound)||inputBound>64000)throw Error('spend_input_bound');
   const amount=charge(id);if(reserved+amount>Math.floor(profile.maxUSD*1e6))throw Error('spend_dollar_limit');
   // Reservation precedes transport, including failures with missing usage.
   attempts++;providerAttempts[id]++;reserved+=amount;persist();
   return {inputBound,amount};
  },
  observe(reservation,usage,returnedModel,id){
   if(!Number.isSafeInteger(usage?.input)||!Number.isSafeInteger(usage?.output)||usage.input<0||usage.output<0||usage.input>reservation.inputBound||usage.output>2000){stopped=true;throw Error('spend_usage_missing_or_outside_bound');}
   if((id==='google'?!/^gemini-3\.1-pro-preview(?:-[0-9-]{1,24})?$/.test(returnedModel||''):returnedModel!==MODELS[id])){stopped=true;throw Error('spend_response_model_mismatch');}
  },
  stop(){stopped=true;persist();},
  report
 };
}
