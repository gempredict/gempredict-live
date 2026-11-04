import {beginScanDiagnostics} from '../../lib/scanDiagnostics.mjs';
import {conditionPresentation} from '../../lib/visualEvidence.mjs';
import {buildVisionPrompt} from '../../lib/pokemonVisionPrompt.mjs';
import {expandVariantAliases,matchesVariantValuation} from '../../lib/variantVerification.mjs';
import {resolvePokemonIdentity} from '../../lib/pokemonIdentityPipeline.mjs';
import {readIdentityReadings} from '../../lib/visionIdentityEvidence.mjs';
import {scoreListing as scorePokemonListing,getListingType as pokemonListingType,readMarketIdentity as readPokemonIdentity} from '../../lib/pokemonListingMatch.mjs';
// Actual route source, real multipart parser/byte validation; only external
// services are mocked. Synthetic images/amounts are not real observations.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {Readable} from 'node:stream';
import formidable from 'formidable';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {validateAnalysisImage} from '../../lib/uploadValidation.mjs';
import {MAX_IMAGE_BYTES} from '../../lib/mobileImages.mjs';
import {matchListing,identityComplete} from '../../lib/ebayIdentityMatch.mjs';
import {internalMarketContext} from '../../lib/internalMarketAuth.mjs';
import {financialEligibility,protectFinancialReport} from '../../lib/financialSafety.mjs';
import {canonicalIdentityV2,emptyGraderScenarios} from '../../lib/canonicalIdentityV2.mjs';
import {auditSportsIdentity} from '../../lib/sportsIdentityAudit.mjs';
import {assessSoldIdentityGate} from '../../lib/soldIdentityGate.mjs';
import {assessIdentityEvidence} from '../../lib/identityEvidence.js';
import {buildCanonicalCardFromImageAnalysis,buildMarketQueryFromCanonicalCard} from '../../lib/cardIdentifier.js';
import calculateIdentityConfidence from '../../lib/calculateIdentityConfidence.js';
import buildSearchCandidates from '../../lib/buildSearchCandidates.js';
const source=file=>fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\s*$/gm,'').replace(/export default async function handler/,'async function handler').replace(/export const config/,'const config');
export const confirmed={identifiedSubject:'Konnor Griffin',identifiedYear:'2024',identifiedManufacturer:'Bowman',identifiedBrandSet:'Bowman Chrome Prospects',identifiedCardNumber:'BCP-86',identifiedParallel:'Mojo Refractor',identifiedLanguage:'English',identifiedAutoOrRelic:'none',identityConfidence:98};
export const exactTitle='2024 Bowman Chrome Prospects Konnor Griffin Mojo Refractor #BCP-86';
export const syntheticListing=(title=exactTitle,id='synthetic')=>({title,itemId:id,condition:'Ungraded',price:{value:'40',currency:'USD'}});
export async function runScan({vision={},items=[syntheticListing()],env={},headers={},back=true,badBack=false,fields={},textOnly=false,marketStatus=200,previewStatus=null,neutral=[],catalogOptions={},catalogFetch=null}={}){
 const metrics={vision:0,valuation:0,internal:[],upstream:0,catalog:0,images:0};
 const environment={CLAUDE_API_KEY:'mock',EBAY_PROD_CLIENT_ID:'mock',EBAY_PROD_CLIENT_SECRET:'mock',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',...env};
 const image=await sharp({create:{width:30,height:40,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
 let req;
 if(textOnly){const bytes=Buffer.from(JSON.stringify({cardName:'Konnor Griffin',cardType:'sports',...fields}));req=Readable.from([bytes]);req.headers={'content-type':'application/json'};}
 else{
  const form=new FormData();for(const [k,v] of Object.entries({cardName:'',cardType:'sports',...fields}))form.append(k,typeof v==='object'?JSON.stringify(v):v);
  form.append('image',new File([image],'front.heic',{type:'application/octet-stream'}));
  if(back)form.append('backImage',new File([badBack?Buffer.from('invalid'):image],'back.jpg',{type:'image/jpeg'}));
  const r=new Request('http://offline/api/predict',{method:'POST',body:form});const bytes=Buffer.from(await r.arrayBuffer());req=Readable.from([bytes]);req.headers={'content-type':r.headers.get('content-type'),'content-length':String(bytes.length)};
 }
 Object.assign(req.headers,{'x-vercel-oidc-token':'mock.preview.signature',...headers});req.method='POST';req.socket={remoteAddress:'offline'};
 const response=()=>({code:null,body:null,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(b){this.body=JSON.parse(JSON.stringify(b));return this;}});
 const market=vm.runInNewContext(source('pages/api/ebay-search.js')+'\nhandler',{expandVariantAliases,matchesVariantValuation,scorePokemonListing,pokemonListingType,readPokemonIdentity,matchListing,identityComplete,process:{env:environment},Buffer,URLSearchParams,fetch:async url=>{metrics.upstream++;assert.match(String(url),/^https:\/\/api\.ebay\.com\//);return {ok:true,status:200,json:async()=>String(url).includes('oauth2/token')?{access_token:'mock'}:{itemSummaries:items,total:items.length}};}});
 class Anthropic {constructor(){this.messages={create:async request=>{
  if(Array.isArray(request.messages[0].content)){metrics.vision++;metrics.visionPrompt=request.messages[0].content.filter(v=>v.type==='text').map(v=>v.text).join('');metrics.images=request.messages[0].content.filter(v=>v.type==='image').length;return {content:[{type:'text',text:JSON.stringify({...confirmed,centering:'good',corners:'good',edges:'good',surface:'good',imageSummary:'Synthetic condition observation.',worthGrading:true,worthGradingReason:'Grade it now for profit.',...vision})}]};}
  metrics.valuation++;throw Error('Financial model must not be called for unverified identity/sales');
 }};}}
 const unavailable=async()=>{metrics.catalog++;throw Error('Offline catalog unavailable');};
 const ctx={beginScanDiagnostics:(req,res)=>beginScanDiagnostics(req,res,{env:environment}),conditionPresentation,buildVisionPrompt,readIdentityReadings,resolvePokemonIdentity:async(a,f,o)=>resolvePokemonIdentity(a,f,{...o,...catalogOptions}),Buffer,URLSearchParams,AbortSignal,fs,path,formidable,validateAnalysisImage,MAX_IMAGE_BYTES,Anthropic,supabase:null,process:{env:environment},console:{log(){},error(){}},financialEligibility,protectFinancialReport,internalMarketContext,identityComplete,canonicalIdentityV2,emptyGraderScenarios,auditSportsIdentity,assessSoldIdentityGate,assessIdentityEvidence,buildCanonicalCardFromImageAnalysis,buildMarketQueryFromCanonicalCard,calculateIdentityConfidence,buildSearchCandidates,issueIdentityReviewToken:scan=>{metrics.reviewIdentity=scan;return null;},findTcgdexCandidates:unavailable,fetchFullTcgdexCard:unavailable,crossCheckIdentity:()=>({status:'not_checked'}),assessArtworkSimilarity:unavailable,atlasOrchestrator:()=>{throw Error('Unverified finance must not reach Atlas');},fetch:async(url,options)=>{
  const parsed=new URL(url);
  if(parsed.hostname==='api.tcgdex.net'){metrics.catalog++;if(catalogFetch)return catalogFetch(url,options);throw Error('Offline catalog unavailable');}
  if(parsed.hostname==='api.ebay.com'){return {ok:true,json:async()=>parsed.pathname.includes('oauth2/token')?{access_token:'mock'}:{itemSummaries:neutral,total:neutral.length}};}
  assert.equal(parsed.origin,'https://'+environment.VERCEL_URL);assert.equal(parsed.pathname,'/api/ebay-search');assert.equal(options.redirect,'manual');assert.equal(options.headers['x-vercel-trusted-oidc-idp-token'],'mock.preview.signature');metrics.internal.push(Object.fromEntries(parsed.searchParams));
  if(previewStatus)return {ok:false,status:previewStatus,json:async()=>({})};
  const r=response();await market({query:Object.fromEntries(parsed.searchParams)},r);return {ok:marketStatus===200&&r.code===200,status:marketStatus,json:async()=>r.body};
 }};
 const handler=vm.runInNewContext(source('pages/api/predict.js')+'\nhandler',ctx);const res=response();await handler(req,res);return {status:res.code,payload:res.body,metrics,responseHeaders:res.headers};
}
export async function runMarketRequest(query,items=[syntheticListing()]){
 let calls=0;
 const handler=vm.runInNewContext(source('pages/api/ebay-search.js')+'\nhandler',{expandVariantAliases,matchesVariantValuation,scorePokemonListing,pokemonListingType,readPokemonIdentity,matchListing,identityComplete,Buffer,URLSearchParams,process:{env:{EBAY_PROD_CLIENT_ID:'mock',EBAY_PROD_CLIENT_SECRET:'mock'}},fetch:async url=>{calls++;return {ok:true,status:200,json:async()=>String(url).includes('oauth2/token')?{access_token:'mock'}:{itemSummaries:items,total:items.length}};}});
 let status,payload;await handler({query},{status(n){status=n;return this;},json(b){payload=JSON.parse(JSON.stringify(b));return this;}});return {status,payload,calls};
}
