import { searchCardApiCatalog } from './cardApiCatalogRest.mjs';
import { CARD_API_CATALOG_ID_TYPES,createReviewedCrosswalkAdapter } from './catalogSalesCrosswalk.mjs';

const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const identifier=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value);
const label=value=>typeof value==='string'&&value.trim()&&value.length<=120&&
 !/[\x00-\x1f\x7f<>@]/.test(value)&&!/(?:https?:|(?:sk-|tca_|AIza)[a-z0-9_-]{12,})/i.test(value);
const limits=Object.freeze({builder_catalog:500,pro:2000});

function validateRows(data,clock) {
 const ids=new Set();
 return data.map(row=>{
  if(!plain(row)||!identifier(row.ucid)||ids.has(row.ucid))throw Error('catalog_schema_invalid');
  ids.add(row.ucid);
  for(const field of ['slug','set_name','parent_set_name','subject','card_number']){
   if(row[field]!=null&&!label(row[field]))throw Error('catalog_schema_invalid');
  }
  if(row.set_usid!=null&&!identifier(row.set_usid))throw Error('catalog_schema_invalid');
  for(const field of ['is_rookie','is_auto']){
   if(row[field]!=null&&typeof row[field]!=='boolean')throw Error('catalog_schema_invalid');
  }
  if(row.print_run!=null&&(!integer(row.print_run)||row.print_run<1||row.print_run>9999999))
   throw Error('catalog_schema_invalid');
  const identifiers=[{type:'UCID',value:row.ucid}];
  if(row.set_usid!=null)identifiers.push({type:'USID',value:row.set_usid});
  // The published search example does not establish wire fields for URID,
  // CFID or UPID. Set/product facts never supply release or printing facts.
  return {recordId:row.ucid,retrievedAt:new Date(clock).toISOString(),identifiers,exactVariantType:'UCID',
   requiredVariantFields:['parallel'],claims:{set:row.set_name,subjects:row.subject?[row.subject]:[],
    number:row.card_number,rookie:row.is_rookie,autograph:row.is_auto,printRun:row.print_run},
   providerFields:{slug:row.slug??null,parentSetName:row.parent_set_name??null}};
 });
}

export function parseCardApiCatalogSearch(bytes,{headers,now,maxRecords=20,entitlement}={}) {
 if(!/^application\/json(?:;|$)/i.test(headers?.get('content-type')||'')||!Number.isFinite(now))throw Error('catalog_schema_invalid');
 const body=JSON.parse(bytes.toString('utf8'));
 const page=body?.pagination;
 if(!plain(body)||!Array.isArray(body.data)||!plain(page)||!['total','page','limit','pages'].every(key=>integer(page[key]))||
    page.page!==1||page.limit<1||page.limit>maxRecords||body.data.length>page.limit||body.data.length>page.total||
    (page.pages!==Math.ceil(page.total/page.limit)&&!(page.total===0&&page.pages===1)))throw Error('catalog_schema_invalid');
 const readQuota=header=>{
  const value=headers.get(header);
  if(value===null)return null;
  if(!/^\d{1,9}$/.test(value))throw Error('catalog_schema_invalid');
  return Number(value);
 };
 const limit=readQuota('X-RateLimit-Limit'),remaining=readQuota('X-RateLimit-Remaining');
 if(limit!==null&&remaining!==null&&remaining>limit)throw Error('catalog_schema_invalid');
 return {records:validateRows(body.data,now),pagination:{total:page.total,page:page.page,limit:page.limit,pages:page.pages,
   incomplete:page.pages>1||body.data.length<page.total},
  quota:{scope:'catalog',limit,remaining,documentedDailyLimit:limits[entitlement?.tier]??null}};
}

function authorized(approval,now) {
 return approval&&typeof approval.reference==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,99}$/i.test(approval.reference)&&
  Object.hasOwn(limits,approval.tier)&&typeof approval.expiresAt==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(approval.expiresAt)&&
  Number.isFinite(now)&&Date.parse(approval.expiresAt)>now;
}
const adapter=createReviewedCrosswalkAdapter({namespace:'the_card_api',types:[...CARD_API_CATALOG_ID_TYPES,'UPID'],
 allowEmptyClaims:true,source:{id:'the_card_api_catalog',provenance:'The Card API Catalog search'},
 authorize:approval=>authorized(approval,approval?.checkedAt),projectCatalog:row=>row,projectSale:()=>null});

export function createCardApiCatalogSearchContract({fetchImpl}={}) {
 return Object.freeze({crosswalkAdapter:adapter,
  authorizeEntitlement:(approval,now)=>authorized(approval,now),
  search:options=>searchCardApiCatalog({...options,fetchImpl}),
  parse:parseCardApiCatalogSearch,requiresDatedApproval:true});
}
