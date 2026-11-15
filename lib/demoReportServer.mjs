// Server-only gate. Uses the existing owner session; no new key, caller flag or provider request.
import {diagnosticDeployment,diagnosticSession,authorizeDiagnosticOwner} from './scanDiagnosticsAuth.mjs';
import fixtures from '../data/demo/reports.json' with {type:'json'};
import {protectFinancialReport} from './financialSafety.mjs';
export const DEMO_EXAMPLES=Object.freeze([{id:'pokemon',label:'Pokémon — Fraxure / Unified Minds'},{id:'sports',label:'Sports — Konnor Griffin / Bowman Chrome'}]);
export function demoHeaders(res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie, Origin');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');
}
export function demoAccess(req,env=process.env,now=Date.now()){
 const deployment=diagnosticDeployment(req,env);if(!deployment)return null;
 const session=diagnosticSession(req,env,now);
 return {enabled:true,authorized:!!session,expiresAt:session?.exp||null};
}
export function demoExample(id){
 if(!DEMO_EXAMPLES.some(e=>e.id===id))return null;
 // Return only protected synthetic fixture values, never caller-provided reports or photos.
 return {synthetic:true,fixtureRevision:fixtures.demoFixtureBundleMarker,asOf:fixtures.asOf,example:id,examples:DEMO_EXAMPLES,report:protectFinancialReport(structuredClone(fixtures.examples[id]))};
}
export function demoPageProps({req,res,query={}},env=process.env,now=Date.now()){
 demoHeaders(res);const access=demoAccess(req,env,now);
 if(!access?.authorized)return {notFound:true};
 const example=demoExample(query.example===undefined?'pokemon':query.example);
 return example?{props:{...example,expiresAt:access.expiresAt}}:{notFound:true};
}
export function demoApi(req,res,env=process.env,now=Date.now()){
 demoHeaders(res);const access=demoAccess(req,env,now);
 if(!access)return res.status(404).json({error:'unavailable'});
 if(req.method==='POST'){
  if(req.body?.action!=='authorize')return res.status(400).json({error:'invalid_request'});
  const cookie=authorizeDiagnosticOwner(req,req.body.key,env,now);
  if(!cookie)return res.status(401).json({error:'unauthorized'});
  res.setHeader('Set-Cookie',cookie);return res.status(200).json({enabled:true,authorized:true,expiresAt:now+900000});
 }
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(req.query?.example!==undefined){
  if(!access.authorized)return res.status(403).json({error:'unauthorized'});
  const example=demoExample(req.query.example);
  return example?res.status(200).json(example):res.status(400).json({error:'invalid_example'});
 }
 return res.status(200).json(access);
}
