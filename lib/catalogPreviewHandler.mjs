import { catalogConfiguration,liveCatalogBranch,reviewedCatalogContract } from './catalogPreviewConfiguration.mjs';
import { diagnosticDeployment,diagnosticSession } from './scanDiagnosticsAuth.mjs';
import { loadSavedForSales } from './cardApiSalesPilot.mjs';
import { evaluateCatalogSalesCrosswalk } from './catalogSalesCrosswalk.mjs';
import { prepareScanSalesQuery } from './scanToSalesIdentity.mjs';

const maxBytes=131072;
const maxRecords=20;
const timeoutMs=5000;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function boundedCatalogBody(response) {
 if(!response.body||Number(response.headers.get('content-length'))>maxBytes)throw Error('catalog_schema_invalid');
 const reader=response.body.getReader();
 const chunks=[];
 let size=0;
 try {
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();throw Error('catalog_schema_invalid');}
   chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks,size);
 }finally{reader.releaseLock();}
}

// search/parse are installed from a reviewed server contract only. A transport
// must use one documented operation, the separate credential and the supplied
// signal. No URL, headers, contract or search fields come directly from a client.
export function createCatalogPreviewHandler({env=process.env,contract=reviewedCatalogContract,loadSaved=loadSavedForSales,clock=Date.now}={}) {
 let busy=false,lastRequest=-Infinity;
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Cookie, Origin, Authorization');
  res.setHeader('X-Content-Type-Options','nosniff');
  const now=clock();
  if(env.VERCEL_GIT_COMMIT_REF!==liveCatalogBranch||!diagnosticDeployment(req,env))return res.status(404).json({error:'pilot_unavailable'});
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  const session=diagnosticSession(req,env,now);
  if(!session)return res.status(403).json({error:'owner_authorization_required'});
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input)||!uuid.test(typeof input.reportId==='string'?input.reportId:'')||
     Object.keys(input).some(field=>!['reportId','confirmed','reviewedIdentity'].includes(field)))
   return res.status(400).json({error:'invalid_query'});
  const configuration=catalogConfiguration(env,contract);
  if(configuration.status!=='ready')return res.status(503).json({error:configuration.status});
  if(busy||now-lastRequest<10000)return res.status(429).json({error:'catalog_rate_limit'});
  busy=true;
  try{
   const owned=await loadSaved(req,input.reportId,env);
   if(!owned.report)return res.status(owned.status).json({error:owned.error});
   const prepared=prepareScanSalesQuery(owned.report.payload,input.reviewedIdentity,input.confirmed);
   if(prepared.error)return res.status(400).json({error:prepared.error});
   const current=clock();
   if(current>=session.exp)return res.status(403).json({error:'owner_authorization_required'});
   lastRequest=current;
   const controller=new AbortController();
   let timeout;
   const elapsed=new Promise((_,reject)=>{
    timeout=setTimeout(()=>{controller.abort();reject(Error('catalog_timeout'));},Math.min(timeoutMs,session.exp-current));
   });
   let retrieval;
   try {
    retrieval=await Promise.race([elapsed,(async()=>{
     const response=await contract.search({identity:prepared.identity,key:configuration.key,signal:controller.signal,maxRecords});
     if(!response.ok){
      await response.body?.cancel();
      return {providerStatus:response.status};
     }
     return {body:await boundedCatalogBody(response)};
    })()]);
   }finally{clearTimeout(timeout);}
   if(clock()>=session.exp)return res.status(403).json({error:'owner_authorization_required'});
   if(retrieval.providerStatus){
    const status=retrieval.providerStatus;
    return res.status(status===429?429:502).json({error:status===429?'catalog_quota':
     status===401||status===403?'catalog_provider_access_denied':'catalog_unavailable'});
   }
   try {
    const records=contract.parse(retrieval.body);
    if(!Array.isArray(records)||records.length>maxRecords)throw Error();
    const result=evaluateCatalogSalesCrosswalk({adapter:contract.crosswalkAdapter,configuration:configuration.entitlement,
     proposal:prepared.identity,priorConflicts:[...prepared.identityEvidence.priorConflicts,...prepared.identityEvidence.conflicts],catalogRecords:records});
    const serialized=JSON.stringify(result);
    if(result.status==='catalog_provider_not_configured'||result.candidates.length!==records.length||
       Buffer.byteLength(serialized)>maxBytes||serialized.includes(configuration.key)||
       (env.THE_CARD_API_KEY&&serialized.includes(env.THE_CARD_API_KEY)))throw Error();
    return res.status(200).json({result});
   }catch{return res.status(502).json({error:'catalog_schema_invalid'});}
  }catch(error){
   const deadline=error?.message==='catalog_timeout';
   return res.status(deadline?504:502).json({error:deadline?'catalog_timeout':
    error?.message==='catalog_schema_invalid'?'catalog_schema_invalid':'catalog_unavailable'});
  }finally{busy=false;}
 };
}
