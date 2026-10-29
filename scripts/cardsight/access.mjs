// Isolated read-only audit. Not imported by the scanner; no SDK retries or AI.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const APPROVAL='AUTHORIZE_CARDSIGHT_TWO_FREE_REQUESTS';
const origin='https://api.cardsight.ai';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const norm=v=>typeof v==='string'?v.toLowerCase().replace(/[^a-z0-9]/g,''):'';
const release=v=>norm(v).replace(/^2026/,'').replace(/^pokemon/,'');
export function approvedContext(env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REPOSITORY!=='gempredict/gempredict-live'||env.GITHUB_REF!=='refs/heads/restore/phase1-identity-market-matching'||env.GITHUB_RUN_ATTEMPT!=='1'||env.CARDSIGHT_MODE!=='dry-run'||env.CARDSIGHT_APPROVAL!==APPROVAL||!/^\d+$/.test(env.CARDSIGHT_OWNER_ID||'')||env.GITHUB_ACTOR_ID!==env.CARDSIGHT_OWNER_ID||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('context_not_authorized');
}
export function selectCard(body){
 if(!body||!Array.isArray(body.cards)||body.cards.length>100||!Number.isInteger(body.total_count)||body.total_count<body.cards.length)return {status:'catalog_schema_unrecognized',candidates:[]};
 const candidates=body.cards.map(card=>{
  const fields=Array.isArray(card?.fields)?card.fields:[];
  const values=keys=>fields.filter(f=>keys.includes(f?.key)).map(f=>norm(f.value));
  const languages=values(['CARD_LANGUAGE','LANGUAGE']),rarities=values(['RARITY']);
  const missing=[];
  if(!uuid(card?.id))missing.push('valid_id');
  if(norm(card?.name)!=='pikachuex')missing.push('subject');
  if(!['149','149/128'].includes(card?.number))missing.push('collector_number');
  if(card?.releaseYear!=='2026')missing.push('release_year');
  if(![card?.releaseName,card?.setName].some(v=>release(v)==='30thcelebration'))missing.push('set');
  if(!languages.length||languages.some(v=>!['en','english'].includes(v)))missing.push('english_language');
  if(!rarities.length||rarities.some(v=>!['specialillustrationrare','specialillustrationraresir','sir'].includes(v)))missing.push('sir_rarity');
  return {id:uuid(card?.id)?card.id:null,missing,numberForm:card?.number==='149/128'?'full_fraction':card?.number==='149'?'local_number_only':'different_or_missing',parallelCount:Array.isArray(card?.parallels)?card.parallels.length:0};
 });
 const matches=candidates.filter(c=>!c.missing.length);
 const truncated=body.total_count>body.cards.length;
 return {status:truncated?'catalog_search_incomplete':matches.length===1?'exact_catalog_match':matches.length?'catalog_ambiguous':'exact_catalog_match_not_established',returned:body.cards.length,total:body.total_count,truncated,candidates,cardId:!truncated&&matches.length===1?matches[0].id:null};
}
function sourceUrl(value){
 try{
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
  if(/^(?:www\.)?ebay\.(?:com|co\.uk|ca|com\.au|de)$/.test(u.hostname)){
   const id=u.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/)?.[1];return id?`https://${u.hostname}/itm/${id}`:null;
  }
  if(!['fanaticscollect.com','www.fanaticscollect.com','sales-history.fanaticscollect.com','comc.com','www.comc.com'].includes(u.hostname)||u.pathname.length>250||!/^[a-zA-Z0-9/_.,()-]+$/.test(u.pathname))return null;
  return u.origin+u.pathname;
 }catch{return null;}
}
export function summarizePricing(body,cardId,now=Date.now()){
 if(body?.card?.card_id!==cardId||norm(body.card.name)!=='pikachuex'||!['149','149/128'].includes(body.card.number)||body.card.set?.year!=='2026'||![body.card.set?.release,body.card.set?.name].some(v=>release(v)==='30thcelebration')||!Array.isArray(body.graded)||!Array.isArray(body.raw?.records))return {status:'pricing_identity_or_schema_unverified'};
 const groups={raw:{reportedCount:body.raw.count,records:body.raw.records},'PSA 9':{reportedCount:0,records:[]},'PSA 10':{reportedCount:0,records:[]}};
 let otherGradeRecords=0;
 for(const company of body.graded){
  if(!Array.isArray(company?.grades))return {status:'pricing_schema_unrecognized'};
  for(const grade of company.grades){
   if(!Array.isArray(grade?.records))return {status:'pricing_schema_unrecognized'};
   const key=norm(company.company_name)==='psa'&&['9','10'].includes(grade.grade_value)?`PSA ${grade.grade_value}`:null;
   if(key){groups[key].records.push(...grade.records);groups[key].reportedCount+=Number.isInteger(grade.count)?grade.count:0;}else otherGradeRecords+=grade.records.length;
  }
 }
 if(Object.values(groups).reduce((n,g)=>n+g.records.length,otherGradeRecords)>500)return {status:'pricing_record_bound_exceeded'};
 const counts={};
 for(const [name,group] of Object.entries(groups)){
  const samples=[];let auctions=0,asking=0,unknown=0,usableFields=0;
  for(const record of group.records){
   const kind=record?.listing_type==='auction'?'provider_reported_completed_auction':record?.listing_type==='fixed'?'asking_price':'unclassified';
   if(kind==='provider_reported_completed_auction')auctions++;else if(kind==='asking_price')asking++;else unknown++;
   const price=typeof record?.price==='number'&&Number.isFinite(record.price)&&record.price>0&&record.price<1e9?record.price:null;
   const date=typeof record?.date==='string'&&/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(record.date)&&record.date.length<=50&&Number.isFinite(Date.parse(record.date))&&Number.isFinite(Date.parse(record.date.slice(0,10)+'T00:00:00Z'))&&new Date(record.date.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===record.date.slice(0,10)&&Date.parse(record.date)<=now?record.date:null;
   const url=sourceUrl(record?.url);
   if(kind==='provider_reported_completed_auction'&&price!==null&&date&&url)usableFields++;
   if(samples.length<5)samples.push({kind,priceUSD:price,date,sourceUrl:url,fullCollectorNumberInTitle:/\b149\s*\/\s*128\b/.test(record?.title||''),setInTitle:/\b30th\s+celebration\b/i.test(record?.title||''),parallelLabelPresent:typeof record?.parallel_name==='string'&&!!record.parallel_name.trim(),parallelIdPresent:uuid(record?.parallel_id)});
  }
  counts[name]={reportedCount:Number.isInteger(group.reportedCount)?group.reportedCount:null,returned:group.records.length,providerReportedCompletedAuctions:auctions,askingPrices:asking,unclassified:unknown,auctionRowsWithPriceDateAndAllowedSourceUrl:usableFields,countMismatch:group.reportedCount!==group.records.length,samples};
 }
 return {status:'pricing_response_observed',groups:counts,otherGradeRecords,providerAdvisoriesPresent:Array.isArray(body.messages)&&body.messages.length>0,printingVariantMatchingVerified:false,settlementIndependentlyVerified:false,acceptedForValuation:0,limitations:['Provider classifies auctions as completed sales; fixed records are asks, not completed transactions.','No Best Offer final consideration or physical printing is inferred.','Pricing is unfiltered across parallels; exact row identity/finish and completeness require review before an adapter.','At most five sanitized example records per grade are shown; raw responses and seller details are not published.']};
}
// One HTTPS request, no redirect following, retries, SDK, health or quota calls.
export function requestOnce(url,key){
 return new Promise(resolve=>{
  let finished=false,request;
  const done=result=>{if(finished)return;finished=true;clearTimeout(timer);resolve(result);};
  const timer=setTimeout(()=>{request?.destroy();done({error:'request_timeout'});},20000);
  request=https.request(url,{method:'GET',agent:false,headers:{'X-API-Key':key,Accept:'application/json'}},response=>{
   const status=response.statusCode;
   if(status!==200){response.destroy();done({status,error:status>=300&&status<400?'redirect_rejected':'http_error'});return;}
   if(!String(response.headers['content-type']||'').includes('application/json')){response.destroy();done({status,error:'non_json_response'});return;}
   let bytes=0;const chunks=[];
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){response.destroy();done({status,error:'response_size_limit'});}else chunks.push(chunk);});
   response.on('error',()=>done({status,error:'response_stream_failed'}));
   response.on('end',()=>{if(finished)return;try{done({status,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{done({status,error:'malformed_json'});}});
  });
  request.on('error',()=>done({error:'network_or_tls_failed'}));request.end();
 });
}
export async function executeAccessTest(key,{request=requestOnce}={}){
 const receipt={scope:'cardsight_read_only_access_test_not_a_valuation',requests:[],maximumRequests:2,credential:key?'PRESENT':'MISSING'};
 if(!key)return {...receipt,status:'credential_missing'};
 const catalogUrl=new URL('/v1/catalog/cards',origin);
 catalogUrl.search=new URLSearchParams({name:'Pikachu ex',year:'2026',releaseName:'30th Celebration',take:'100'}).toString();
 const call=async(url,stage)=>{
  if(receipt.requests.length>=2)throw Error('request_limit');
  const entry={stage,method:'GET',path:url.pathname};receipt.requests.push(entry);
  let result;try{result=await request(url,key);}catch{result={error:'transport_failed'};}
  entry.httpStatus=result.status??null;entry.outcome=result.error?'failed':'response_received';
  if(result.error)entry.failure=['network_or_tls_failed','request_timeout','response_size_limit','malformed_json','non_json_response','redirect_rejected','http_error','response_stream_failed','transport_failed'].includes(result.error)?result.error:'unclassified_failure';
  return result;
 };
 const first=await call(catalogUrl,'catalog');if(first.error)return {...receipt,status:'catalog_request_failed'};
 receipt.catalog=selectCard(first.body);if(!receipt.catalog.cardId)return {...receipt,status:receipt.catalog.status};
 const pricingUrl=new URL(`/v1/pricing/${receipt.catalog.cardId}`,origin);pricingUrl.search=new URLSearchParams({period:'90d',listing_type:'both'}).toString();
 const second=await call(pricingUrl,'pricing');if(second.error)return {...receipt,status:'pricing_request_failed'};
 receipt.pricing=summarizePricing(second.body,receipt.catalog.cardId);
 return {...receipt,status:receipt.pricing.status};
}
async function main(){
 const mode=process.argv[2];
 if(mode==='dry-run'){console.log(JSON.stringify({status:'DRY_RUN_NO_REQUESTS',maximumLiveRequests:2,authentication:'X-API-Key header',catalog:'/v1/catalog/cards',pricing:'/v1/pricing/{card_id}?period=90d&listing_type=both'}));return;}
 if(mode!=='live')throw Error('invalid_mode');
 approvedContext(process.env);
 if(!process.env.RUNNER_TEMP)throw Error('runner_temp_missing');
 // Refuse a second invocation in this run, even if the first was interrupted.
 const sentinel=path.join(process.env.RUNNER_TEMP,`cardsight-${process.env.GITHUB_RUN_ID}.attempted`);
 fs.closeSync(fs.openSync(sentinel,'wx',0o600));
 const key=process.env.CARDSIGHT_API_KEY;
 const result=await executeAccessTest(key);
 let output=JSON.stringify({...result,revision:process.env.GITHUB_SHA},null,2);
 if(key)for(const value of new Set([key,encodeURIComponent(key)]))output=output.split(value).join('[REDACTED]');
 console.log(output);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'CardSight read-only access test (not a valuation)\n\n```json\n'+output+'\n```\n');
 if(result.status!=='pricing_response_observed')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('CardSight test stopped safely; no raw response, credentials or exception details were logged.');process.exitCode=1;});
