import {identitySearchGate} from './catalogIdentity.mjs';
// Server-only local OCR orchestration; model output and browser metadata cannot
// supply catalog facts. Independent artwork references are currently unavailable.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {internalMarketContext} from './internalMarketAuth.mjs';
let cached;
export function hybridCatalog(){
 if(!cached){const root=process.cwd(),bytes=fs.readFileSync(path.join(root,'data/hybrid/catalog.json')),pins=JSON.parse(fs.readFileSync(path.join(root,'data/hybrid/manifest.json')));
 if(createHash('sha256').update(bytes).digest('hex')!==pins.catalogSha256)throw Error('hybrid_catalog_integrity');
 const data=JSON.parse(bytes);if(data.records.length!==pins.records||createHash('sha256').update(JSON.stringify(data.records)).digest('hex')!==data.recordsDigest)throw Error('hybrid_catalog_integrity');
 cached={records:data.records,pins};}return cached;
}
const blank=reason=>({status:'unavailable',reason,candidates:[],catalogIdentitySupported:false,printingVerified:false});
export function localCatalogRecord(r){
 const special=['special illustration rare','special art'].includes(String(r.rarity||'').toLowerCase());
 const variants=Object.fromEntries(['holo','normal','reverse'].map(type=>[type,r.printings.includes(type)]));
 return {...r,provider:'tcgdex',language:r.language==='en'?'English':r.language,parallel:special?'Special Art':null,variants};
}
export function acceptHybridResult(raw,{records,pins}=hybridCatalog()){
 if(!raw||raw.catalogSha256!==pins.catalogSha256||!Array.isArray(raw.candidates)||raw.candidates.length>5)return blank('invalid_local_catalog_response');
 const byId=new Map(records.map(r=>[r.id,r]));
 const candidates=raw.candidates.map(r=>({id:r?.id,identity:byId.has(r?.id)?localCatalogRecord(byId.get(r.id)):null,score:r?.score,evidence:r?.evidence}));
 if(candidates.some(r=>!r.identity||!Number.isFinite(r.score)||r.score<0||r.score>1))return blank('unknown_local_catalog_candidate');
 const top=candidates[0],e=top?.evidence;
 const nameKey=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const numbers=e?.collectorNumber?.readings?.filter(r=>r.passes>=2&&r.confidence>=45)||[];
 const names=e?.name?.exactReadings?.filter(r=>r.confidence>=70&&nameKey(r.text)===nameKey(top?.identity?.subject))||[];
 const marks=new Map();
 for(const reading of e?.setCode?.readings||[]){
  if(typeof reading.code!=='string'||typeof reading.language!=='string'||typeof reading.pass!=='string')continue;
  const key=reading.code.toUpperCase()+':'+reading.language.toLowerCase();
  if(!marks.has(key))marks.set(key,new Set());marks.get(key).add(reading.pass);
 }
 const consistentMarks=[...marks].filter(([,passes])=>passes.size>=2);
 // Uniqueness is checked against the full pinned subset, not just the returned
 // top five. Shared printed identifiers cannot resolve multiple catalog variants.
 const matches=top?records.filter(r=>r.cardNumber===top.identity.cardNumber&&r.setCode===top.identity.setCode&&r.language==='en'&&nameKey(r.subject)===nameKey(top.identity.subject)):[];
 const supported=raw.catalogIdentitySupported===true&&raw.status==='identity_candidate'&&['detected','frame_fallback'].includes(raw.detection?.status)
  &&e?.collectorNumber?.supported===true&&numbers.length===1&&numbers[0].value===top.identity.cardNumber
  &&!e.collectorNumber.readings.some(r=>r.confidence>=70&&r.value!==top.identity.cardNumber)
  &&e?.name?.supported===true&&e.name.score>=.8&&names.length>0
  &&e?.setCode?.supported===true&&e.setCode.value===top.identity.setCode
  &&e?.language?.supported===true&&e.language.value==='en'
  &&marks.size===1&&consistentMarks.length===1&&consistentMarks[0][0]===top.identity.setCode.toUpperCase()+':en'
  &&matches.length===1&&matches[0].id===top.id
  &&(e.artwork?.status==='reference_unavailable'||e.artwork?.status==='supported')
  &&(!candidates[1]||top.score-candidates[1].score>=.12);
 return {status:supported?'identity_candidate':candidates.length?'ambiguous':'retake',catalogIdentitySupported:!!supported,candidates,printingVerified:false,artwork:{status:'reference_unavailable'},elapsedMs:raw.elapsedMs,catalogRevision:pins.sourceRevision,receiptId:randomUUID()};
}
export async function identifyUploadedCard(front,{env=process.env,requestHeaders={},fetchImpl=globalThis.fetch}={}){
 if(env.VERCEL_ENV!=='preview')return blank('local_ocr_not_enabled_in_this_environment');
 const ctx=internalMarketContext(env.NEXT_PUBLIC_SITE_URL,env,requestHeaders);if(!ctx.ok)return blank(ctx.reason);
 try{const response=await fetchImpl(`${ctx.baseUrl}/api/hybrid-ocr`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(100000),headers:{...ctx.headers,'Content-Type':'application/json'},body:JSON.stringify({front:front.toString('base64')})});
 if(!response.ok)return blank(`local_ocr_http_${response.status}`);
 const text=await response.text();if(text.length>150000)return blank('local_ocr_response_size');return acceptHybridResult(JSON.parse(text));
 }catch{return blank('local_ocr_failed');}
}
export function hybridLookup(result){
 return async()=>({complete:result.catalogIdentitySupported===true,records:result.catalogIdentitySupported?result.candidates.map(c=>c.identity):[],status:'ambiguous',reason:'Local printed identity requires confirmation',diagnostics:[]});
}
export function hybridSeed(result){const top=result?.candidates?.[0],card=top?.identity;if(!card||result.status==='retake'||!top.evidence?.collectorNumber?.supported||!top.evidence?.name?.supported)return null;return {...card,displayName:[card.year,card.brandSet,card.subject,card.parallel,`#${card.cardNumber}`].filter(Boolean).join(' ')};}
export function identityOnlyReport(result){
 result=result||blank('local_ocr_unavailable');
 const canonicalCard=hybridSeed(result),catalog=result.catalogIdentitySupported?'verified':'ambiguous';
 const identityVerification={year:{status:result.catalogIdentitySupported?'verified':'insufficient_evidence'},set:{status:result.catalogIdentitySupported?'verified':'insufficient_evidence'},catalog:{source:'tcgdex',status:catalog,referenceId:canonicalCard?.id,candidate:canonicalCard,requiresConfirmation:!result.catalogIdentitySupported}};
 const valuationIdentityGate=identitySearchGate(identityVerification,canonicalCard);
 return {success:true,hybridIdentification:result,canonicalCard,identityVerification,
 variantVerification:{status:'needs_confirmation',explanation:'Catalog printing metadata is shown separately. Physical printing is unverified; valuation and grading remain withheld.'},valuationIdentityGate,valuationVerification:{status:'untrusted'},atlas:null,imageAnalysis:null,
 prediction:{cardTitle:canonicalCard?.displayName||'Card identity unresolved',rawValue:null,psa9Value:null,psa10Value:null},marketData:null,
 receipt:{id:result.receiptId,codeRevision:process.env.VERCEL_GIT_COMMIT_SHA||null,deploymentId:process.env.VERCEL_DEPLOYMENT_ID||null,mode:'local_identity_only',paidProviderCalls:0,catalogRevision:result.catalogRevision,identitySupported:result.catalogIdentitySupported,printedIdentityVerified:valuationIdentityGate.allowed,marketEligible:false,printingVerified:false,identityGate:valuationIdentityGate,variantStatus:'needs_confirmation',artworkReferenceRequired:false}};
}
