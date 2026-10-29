// Isolated Milestone 1C diagnostic; never imported by application/scanner code.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const APPROVAL='AUTHORIZE_THE_CARD_API_MAX_2_GETS_50_ROWS';
export const REDIRECT_APPROVAL='AUTHORIZE_THE_CARD_API_ONE_GET_REDIRECT_HEADERS_ONLY';
export const ENDPOINT='https://thecardapi.com/api/v1/market/sales';
export const EXACT='2026 "Pikachu ex" "30th Celebration" "149/128" (SIR,"special illustration rare")';
export const BROAD='"Pikachu ex"';
export function approvedContext(e,approval=APPROVAL){
 if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||e.GITHUB_REPOSITORY!=='gempredict/gempredict-live'||e.GITHUB_REF!=='refs/heads/restore/phase1-identity-market-matching'||e.GITHUB_RUN_ATTEMPT!=='1'||e.CARD_MODE!=='dry-run'||e.CARD_APPROVAL!==approval||!/^\d+$/.test(e.CARD_OWNER_ID||'')||e.GITHUB_ACTOR_ID!==e.CARD_OWNER_ID||!/^\d+$/.test(e.GITHUB_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!e.RUNNER_TEMP||e.NODE_TLS_REJECT_UNAUTHORIZED==='0'||e.NODE_DEBUG||e.NODE_OPTIONS)throw Error('context_not_authorized');
}
const money=v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<1e9);
const date=(s,now)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&Date.parse(s)<=now;
const text=v=>typeof v==='string'&&v.length<=220?v.replace(/[\x00-\x1f\x7f`<>]/g,''):null;
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
function listingUrl(s){try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 // Search includes all platforms; publish only a canonical eBay listing URL.
 const id=u.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/)?.[1];
 return /^(www\.)?ebay\.(com|co\.uk|ca|com\.au|de)$/.test(u.hostname)&&id?`${u.origin}/itm/${id}`:null;
 }catch{return null;}}
export function exactCandidate(r){
 const t=r.title;
 if(!/\b2026\b/.test(t)||!/\bpikachu\s+ex\b/i.test(t)||!/\b30th\s+celebration\b/i.test(t)||!/\b149\s*\/\s*128\b/.test(t)||!/\b(?:sir|special\s+illustration\s+rare)\b/i.test(t))return false;
 if(/\b(?:japanese|jpn|korean|chinese|proxy|replica|reprint|custom|fake|jumbo|oversized|lot|bundle|metal|gold|rainbow|hyper|sar|regular|reverse|non.?holo)\b/i.test(t))return false;
 if(r.year!=null&&r.year!==2026)return false;
 if(r.card_number!=null&&!['149','149128'].includes(norm(r.card_number)))return false;
 if(r.card_set!=null&&norm(r.card_set).replace(/^2026/,'').replace(/^pokemon/,'')!=='30thcelebration')return false;
 return true;
}
export function summarize(body,now=Date.now()){
 const p=body?.pagination;
 if(!Array.isArray(body?.data)||body.data.length>25||!p||!Number.isInteger(p.total)||p.total<body.data.length||p.page!==1||p.limit!==25||typeof p.has_more!=='boolean'||!body.meta||typeof body.meta!=='object')throw Error('schema_unrecognized');
 const rows=body.data.map(r=>{
  if(!r||typeof r.id!=='string'||typeof r.platform!=='string'||typeof r.title!=='string'||r.title.length>2000||!['auction','fixed_price','best_offer'].includes(r.listing_type)||typeof r.price_confirmed!=='boolean'||!money(r.price)||!money(r.original_price)||! /^[A-Z]{3}$/.test(r.currency)||typeof r.sale_date!=='string'||typeof r.sold_at!=='string')throw Error('schema_unrecognized');
  const dated=date(r.sale_date,now)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(r.sold_at)&&Number.isFinite(Date.parse(r.sold_at))&&Date.parse(r.sold_at)<=now&&r.sold_at.slice(0,10)===r.sale_date;
  const confirmed=dated&&r.price_confirmed&&r.price!==null&&r.price>0;
  const kind=!dated?'unverified_completion':r.listing_type==='best_offer'?(confirmed?'accepted_offer_confirmed_amount':'accepted_offer_amount_unknown'):confirmed?'completed_sale_confirmed_amount':'completed_sale_amount_unconfirmed';
  return {id:text(r.id),platform:text(r.platform),title:text(r.title),identity:exactCandidate(r)?'exact_title_candidate':'unmatched_variant_or_insufficient_identity',kind,listingType:r.listing_type,saleDate:dated?r.sale_date:null,finalPrice:confirmed?r.price:null,originalAskingPrice:r.original_price,currency:r.currency,sourceUrl:listingUrl(r.listing_url)};
 });
 return {returned:rows.length,total:p.total,hasMore:p.has_more,exactResults:rows.filter(r=>r.identity==='exact_title_candidate'&&r.kind!=='unverified_completion').length,confirmedExactSales:rows.filter(r=>r.identity==='exact_title_candidate'&&r.finalPrice!==null).length,rows};
}
// Native HTTPS has no retry or redirect logic; bound each response and total time.
export function requestOnce(url,key,{headersOnly=false}={}){
 if(url.origin!==new URL(ENDPOINT).origin||url.pathname!==new URL(ENDPOINT).pathname)throw Error('endpoint_rejected');
 return new Promise(resolve=>{
  let req,finished=false;
  const done=v=>{if(finished)return;finished=true;clearTimeout(timer);resolve(v);};
  const timer=setTimeout(()=>{done({error:'timeout'});req?.destroy();},20000);
  try{req=https.request(url,{method:'GET',agent:false,headers:{'x-market-api-key':key,Accept:'application/json'}},res=>{
   if(headersOnly){done({httpStatus:res.statusCode??null,location:res.headers.location});res.destroy();return;}
   if(res.statusCode!==200){done({error:'http_failure',status:res.statusCode});res.destroy();return;}
   if(!String(res.headers['content-type']||'').includes('application/json')){done({error:'non_json'});res.destroy();return;}
   const chunks=[];let bytes=0;
   res.on('data',c=>{bytes+=c.length;if(bytes>1048576){done({error:'response_too_large'});res.destroy();}else chunks.push(c);});
   res.on('error',()=>done({error:'stream_failure'}));res.on('aborted',()=>done({error:'stream_failure'}));
   res.on('end',()=>{if(finished)return;try{done({status:200,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{done({error:'invalid_json'});}});
  });req.on('error',()=>done({error:'network_failure'}));req.end();}catch{done({error:'network_failure'});}
 });
}
export async function verify(key,{request=requestOnce,now=Date.now()}={}){
 const report={scope:'the_card_api_read_only_diagnostic',maximumRequests:2,maximumReturnedRows:50,requests:[],acceptedForValuation:0,settlementIndependentlyVerified:false};
 if(!key)return {...report,status:'credential_missing'};
 for(const [stage,q] of [['exact',EXACT],['broader',BROAD]]){
  const url=new URL(ENDPOINT);url.search=new URLSearchParams({q,limit:'25',page:'1',sort:'date_desc'}).toString();
  const entry={stage,method:'GET',query:q};report.requests.push(entry);
  let result;try{result=await request(url,key);}catch{result={error:'transport_failed'};}
  entry.httpStatus=Number.isInteger(result?.status)?result.status:null;
  if(result?.error||result?.status!==200)return {...report,status:'request_failed'};
  try{entry.result=summarize(result.body,now);}catch{return {...report,status:'schema_unrecognized'};}
  if(entry.result.exactResults>0)break;
 }
 return {...report,status:'sales_response_observed',limitations:['Provider-reported completed observations; title candidates require owner review of variant, language and source listing.','Accepted offers without confirmed final amounts retain asks separately; asks never become sale prices.','One page per query; plan lookback and pagination limit coverage. No exact match is not proof of no sales.','No price aggregation, scanner integration, AI calls, purchases, upgrades or subscription changes.']};
}
export function claimRun(e,approval=APPROVAL){approvedContext(e,approval);fs.closeSync(fs.openSync(path.join(e.RUNNER_TEMP,`the-card-api-${e.GITHUB_RUN_ID}.attempted`),'wx',0o600));}
// Report known public route/query values only; never echo unknown URL components.
export function sanitizeLocation(value,base){
 if(typeof value!=='string'||value.length>4096||/[\x00-\x20\x7f]/.test(value))return null;
 try{
  const u=new URL(value,base);
  if(!['https:','http:'].includes(u.protocol))return null;
  const route=u.pathname==='/api/v1/market/sales'?u.pathname:'/[REDACTED_PATH]';
  const safe=new URLSearchParams();let hidden=false;
  const expected=new URL(base).searchParams;
  for(const [k,v] of u.searchParams){
   if(['q','limit','page','sort'].includes(k)&&expected.has(k)&&v===expected.get(k))safe.append(k,v);
   else hidden=true;
  }
  if(hidden)safe.append('_redacted','1');
  return u.origin+route+(safe.size?'?'+safe:'');
 }catch{return null;}
}
export async function inspectRedirect(key,{request=requestOnce}={}){
 if(!key)return {httpStatus:null,location:null};
 const url=new URL(ENDPOINT);url.search=new URLSearchParams({q:EXACT,limit:'1',page:'1',sort:'date_desc'}).toString();
 try{
  const result=await request(url,key,{headersOnly:true});
  return {httpStatus:Number.isInteger(result?.httpStatus)?result.httpStatus:null,location:sanitizeLocation(result?.location,url)};
 }catch{return {httpStatus:null,location:null};}
}
export function redact(output,key){if(key)for(const value of new Set([key,encodeURIComponent(key)]))output=output.split(value).join('[REDACTED]');return output;}
async function main(){
 if(process.argv[2]==='dry-run'){console.log(JSON.stringify({status:'DRY_RUN_NO_REQUESTS',endpoint:ENDPOINT,authentication:'x-market-api-key header',queries:[EXACT,BROAD],maximumRequests:2,maximumReturnedRows:50}));return;}
 if(process.argv[2]==='inspect-redirect'){
  claimRun(process.env,REDIRECT_APPROVAL);
  const key=process.env.THE_CARD_API_KEY;
  const result=await inspectRedirect(key);
  console.log(redact(JSON.stringify(result),key));
  if(result.httpStatus===null)process.exitCode=1;
  return;
 }
 if(process.argv[2]!=='live')throw Error('invalid_mode');
 claimRun(process.env);
 const key=process.env.THE_CARD_API_KEY;
 const result=await verify(key);
 const output=redact(JSON.stringify({...result,revision:process.env.GITHUB_SHA},null,2),key);
 console.log(output);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'The Card API — read-only sales diagnostic\n\n```json\n'+output+'\n```\n');
 if(result.status!=='sales_response_observed')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('The Card API test stopped safely. No credentials, raw responses or exception details logged.');process.exitCode=1;});
