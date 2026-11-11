import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {demoAccess,demoApi,demoExample,demoPageProps} from '../lib/demoReportServer.mjs';
import {authorizeDiagnosticOwner} from '../lib/scanDiagnosticsAuth.mjs';
import {qualifyCompletedSales} from '../lib/completedSales.mjs';
import {FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderReports,unifiedReportInteraction,renderDemoAction} from './helpers/renderReports.mjs';
const origin='https://gempredict-live-demo-unit.vercel.app',now=Date.parse('2026-11-10T12:00:00Z');
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:new URL(origin).host,VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'5d86b9896d4a943d027c5de762923f046e73f10d',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
const request=(cookie='',patch={})=>({method:'GET',headers:{host:new URL(origin).host,cookie},query:{},...patch});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
const cookie=()=>authorizeDiagnosticOwner({...request(),method:'POST',headers:{...request().headers,origin}},env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env,now).split(';')[0];
const endpoint=(req,environment=env,at=now)=>{const res=response();demoApi(req,res,environment,at);return res;};
test('demo backend owner authorization reuses secure session; unauthorized visitors cannot retrieve fixtures',()=>{
 const status=endpoint(request());assert.deepEqual(status.body,{enabled:true,authorized:false,expiresAt:null});
 const blocked=endpoint(request('',{query:{example:'pokemon'}}));assert.equal(blocked.code,403);assert.equal(blocked.body.report,undefined);
 const req={...request(),method:'POST',headers:{...request().headers,origin},body:{action:'authorize',key:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}};
 const authorized=endpoint(req);assert.equal(authorized.code,200);assert.match(authorized.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.doesNotMatch(JSON.stringify(authorized.body),/abababab|cdcdcd/);
 assert.equal(endpoint({...req,body:{action:'authorize',key:'bad'}}).code,401);
 assert.equal(endpoint(request(cookie(),{query:{example:'sports'}})).body.example,'sports');
 assert.equal(endpoint(request(cookie(),{query:{example:['sports','pokemon']}})).code,400);
 assert.equal(endpoint(request(cookie(),{method:'DELETE',headers:{...request().headers,origin,cookie:cookie()}})).code,405);
});
test('Production, development, missing keys, mismatched branch/repository/project/origin all reject page and backend',()=>{
 const c=cookie();for(const patch of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL:'0'},{GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'false'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_PROJECT_ID:'other'},{VERCEL_GIT_REPO_OWNER:'other'},{VERCEL_GIT_REPO_SLUG:'other'},{GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:''},{GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:''},{VERCEL_URL:'gempredict-live.vercel.app'}]){
  const config={...env,...patch};assert.equal(endpoint(request(c,{query:{example:'pokemon'}}),config).code,404);assert.deepEqual(demoPageProps({req:request(c),res:response(),query:{}},config,now),{notFound:true});
 }
 assert.equal(demoAccess(request(c,{headers:{host:'evil.invalid',cookie:c}}),env,now),null);
 assert.equal(endpoint(request(c,{method:'POST',headers:{host:new URL(origin).host,origin:'https://evil.invalid',cookie:c},body:{action:'authorize',key:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY}})).code,404);
 assert.equal(endpoint(request(c,{query:{example:'sports'}}),env,now+901000).code,403);
 assert.equal(endpoint(request(c,{query:{example:'sports'}}),{...env,VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)}).code,403);
});
test('server page checks authorization before serializing either example and marks private no-store/noindex',()=>{
 const res=response();assert.deepEqual(demoPageProps({req:request(),res,query:{}},env,now),{notFound:true});
 for(const example of ['pokemon','sports']){const r=response();const out=demoPageProps({req:request(cookie()),res:r,query:{example}},env,now);assert.equal(out.props.synthetic,true);assert.equal(out.props.example,example);assert.match(r.headers['Cache-Control'],/private, no-store/);assert.match(r.headers['Vary'],/Cookie/);assert.match(r.headers['X-Robots-Tag'],/noindex/);assert.equal(out.props.report.financialDecision.allowed,false);}
 assert.equal(demoPageProps({req:request(cookie()),res:response(),query:{example:'unknown'}},env,now).notFound,true);
});
test('both actual report categories visibly label synthetic evidence and withhold all money/recommendations',()=>{
 for(const id of ['pokemon','sports']){
  const d=demoExample(id),e=qualifyCompletedSales([],{now:d.asOf,policies:[],mappings:[]}),html=renderReports(d.report,e,{demo:true}).upper;
  assert.equal((html.match(/DEMO — SYNTHETIC DATA/g)||[]).length>=6,true);assert.match(html,/Your card/);assert.match(html,/Photo condition/);assert.match(html,/Available on eBay/);assert.match(html,/Market value/);assert.match(html,/PSA grading/);assert.match(html,/Insufficient qualified sales data/);assert.match(html,/recommendations are withheld/);assert.match(html,/not retained in saved or restored reports/);
  assert.doesNotMatch(html,/Save Report|Copy Summary|Review or correct identification|href="https:\/\/www.ebay.com|<img /);assert.match(html,id==='pokemon'?/Unified Minds Fraxure/:/Bowman Chrome Prospects Konnor Griffin/);
  for(const f of FINANCIAL_FIELDS)assert.equal(d.report[f],null);assert.equal(d.report.financialDecision.allowed,false);assert.equal(d.report.identityReviewToken,undefined);assert.equal(e.qualified.length,0);assert.equal(e.automaticEconomicsAllowed,false);
  const ui=unifiedReportInteraction(d.report);const tree=ui.render({demo:true,completedSalesEvidence:e});assert.equal(ui.nodes(tree,n=>n.type==='button'&&['Save Report','Copy Summary','Share'].includes(n.props.children)).length,0);
 }
 const sportsHtml=renderReports(demoExample('sports').report,null,{demo:true}).upper;assert.match(sportsHtml,/Synthetic asking amount: .*USD 42.50/);assert.match(sportsHtml,/Synthetic listing; no live link/);
});
test('demo fixture reports are isolated clones and cannot alter future fixtures or real scan history',()=>{
 const a=demoExample('sports');a.report.cardTitle='changed';assert.notEqual(demoExample('sports').report.cardTitle,'changed');assert.equal(demoExample('__proto__'),null);
 const route=fs.readFileSync('pages/demo-report.jsx','utf8');assert.doesNotMatch(route,/localStorage|sessionStorage|saveReport|\/api\/predict|\/api\/ebay/);assert.match(route,/<ResultCard/);assert.match(route,/qualifyCompletedSales\(\[\]/);
 const source=fs.readFileSync('lib/demoReportServer.mjs','utf8');assert.doesNotMatch(source,/fetch\(|Anthropic|ebay-search|readLiveCompletedSales/);
});
test('owner action is absent when unavailable and only exposes View Demo Report after owner authorization',()=>{
 assert.equal(renderDemoAction(null),'');assert.equal(renderDemoAction({enabled:false}),'');
 const unauthorized=renderDemoAction({enabled:true,authorized:false});assert.match(unauthorized,/Authorize owner demo access/);assert.doesNotMatch(unauthorized,/href="\/demo-report"/);
 const authorized=renderDemoAction({enabled:true,authorized:true,expiresAt:now+900000});assert.match(authorized,/View Demo Report/);assert.match(authorized,/href="\/demo-report"/);
});
test('actual API route delegates exclusively to owner-gated handler and limits request bodies',()=>{
 const s=fs.readFileSync('pages/api/demo-report.js','utf8').replace(/^import.*;$/gm,'').replace('export const config','const config').replace('export default function handler','function handler');
 let calls=0;const h=vm.runInNewContext(s+';handler',{demoApi:(req,res)=>{calls++;return demoApi(req,res,env,now);}});const r=response();h(request(cookie(),{query:{example:'sports'}}),r);assert.equal(calls,1);assert.equal(r.body.synthetic,true);assert.ok(s.includes("sizeLimit:'2kb'"));
});
