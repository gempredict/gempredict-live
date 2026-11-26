// Server transport. The operation surface comes from the owner-supplied
// official contract. A reviewed response parser is a separate requirement.
const base='https://www.thecardapi.com/api/v1/catalog';
const idPattern=/^[a-z0-9][a-z0-9_-]{0,127}$/i;
const stringFilters=new Set(['q','set_name','card_number','sport']);
const identifierFilters=new Set(['set_id','player_id','release_id','card_family_id']);

export function cardApiCatalogUrl(operation,{id,filters}={}) {
 if(!['search','detail','sets','family'].includes(operation))throw new TypeError('Unsupported catalog operation');
 const needsId=operation==='detail'||operation==='family';
 if(needsId?(typeof id!=='string'||!idPattern.test(id)):id!==undefined)throw new TypeError('Invalid catalog identifier');
 if(operation!=='search'&&filters!==undefined)throw new TypeError('Undocumented catalog filters');
 const path=operation==='detail'?'/'+encodeURIComponent(id):operation==='family'?'/card-families/'+encodeURIComponent(id):
  operation==='sets'?'/sets':'';
 const url=new URL(base+path);
 if(operation!=='search')return url;
 if(!filters||typeof filters!=='object'||Array.isArray(filters))throw new TypeError('Catalog filters required');
 for(const [field,value] of Object.entries(filters)){
  const valid=stringFilters.has(field)?typeof value==='string'&&value.trim()&&value.length<=120&&!/[\x00-\x1f\x7f]/.test(value):
   identifierFilters.has(field)?typeof value==='string'&&idPattern.test(value):
   field==='year'?Number.isInteger(value)&&value>=1900&&value<=2099:
   field==='limit'?Number.isInteger(value)&&value>=1&&value<=20:
   field==='page'?value===1:false;
  if(!valid)throw new TypeError('Invalid catalog filter');
  url.searchParams.set(field,String(value));
 }
 if(!url.searchParams.has('limit'))url.searchParams.set('limit','20');
 if(!url.searchParams.has('page'))url.searchParams.set('page','1');
 return url;
}

export function reviewedCatalogFilters(identity,maxRecords=20) {
 if(!Array.isArray(identity?.subjects)||!identity.subjects.length||!identity.set||!identity.number||!identity.year)
  throw new TypeError('Reviewed catalog identity incomplete');
 return {q:identity.subjects.join(' '),set_name:identity.set,card_number:identity.number,
  year:Number(identity.year),limit:maxRecords};
}

export function requestCardApiCatalog(operation,parameters,{key,signal,fetchImpl=fetch}={}) {
 const url=cardApiCatalogUrl(operation,parameters);
 if(typeof key!=='string'||!key.trim()||key.length>512||/[\r\n]/.test(key))throw new TypeError('Catalog credential unavailable');
 const deadline=AbortSignal.timeout(5000);
 return fetchImpl(url,{method:'GET',headers:{Accept:'application/json','x-api-key':key},
  signal:signal?AbortSignal.any([signal,deadline]):deadline,redirect:'error',cache:'no-store'});
}

// Candidate transport for registration together with an independently reviewed
// parser, typed identifier mapping and entitlement validator.
export function searchCardApiCatalog({identity,maxRecords,key,signal,fetchImpl}) {
 return requestCardApiCatalog('search',{filters:reviewedCatalogFilters(identity,maxRecords)},{key,signal,fetchImpl});
}
