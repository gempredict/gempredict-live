import assert from 'node:assert/strict';
import test from 'node:test';
import { createSavedSnapshot } from '../lib/savedReportSnapshot.mjs';
import { protectedCopySummary } from '../lib/financialSafety.mjs';
import { marketDashboardInteraction, mountLibrary, renderReports } from './helpers/renderReports.mjs';

const reportId='b99139ef-45cd-4094-9e89-25edde061049';
const token='synthetic-library-token';
const report={
 success:true,stage:'full',cardTitle:'Shohei Ohtani',prediction:{cardTitle:'Shohei Ohtani'},financialDecision:{allowed:false},
 canonicalCard:{subject:'Shohei Ohtani',cardNumber:'700',year:'2018',brandSet:'Topps Series 2',parallel:'Base'},
 identityV2:{category:'sports'},imageAnalysis:{inspectedSides:['front']},
};
const props={report,reportId,token,today:'2026-11-23',name:'Shohei Ohtani #700'};
function nodes(tree,predicate) {
 if(!tree || typeof tree!=='object') return [];
 if(Array.isArray(tree)) return tree.flatMap(node=>nodes(node,predicate));
 return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
const find=(tree,kind)=>nodes(tree,node=>node.type===kind);
function expand(dashboard,index,open=true) {
 find(dashboard.render(),'details')[index].props.onToggle({currentTarget:{open}});
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('live and historical report placements render collapsed sections without a request or synthetic counts',()=>{
 for(const historical of [false,true]) {
  const {upper}=renderReports(historical?createSavedSnapshot(report):report,null,{historical,marketContext:{reportId,token,today:props.today}});
  assert.match(upper,/Market Intelligence Dashboard/);
  assert.match(upper,/Active Listings — eBay/);
  assert.match(upper,/Recent Sales — The Card API/);
  assert.equal((upper.match(/Ready to request/g)||[]).length,2);
  assert.doesNotMatch(upper,/Request eBay listings|Request recent sales|Authorize Preview owner|synthetic-library-token/);
  assert.match(upper,/Grading economics requires independently qualified evidence/);
  assert.match(upper,/Photo Condition Analysis/);
  assert.match(upper,/Shohei Ohtani #700/);
  assert.match(upper,/2018 · Topps Series 2/);
  assert.match(upper,/<textarea[^>]*name="subjects"[^>]*>Shohei Ohtani<\/textarea>/);
  assert.match(upper,/name="number"[^>]*value="700"/);
  assert.match(upper,/printing not verified/);
  assert.match(upper,/Grading break-even/);
  assert.doesNotMatch(upper,/Card name or description|PSA 10 Odds|Accuracy Lab/);
 }
 assert.doesNotMatch(renderReports(report).upper,/Market Intelligence Dashboard/);
});

test('opening My Card Library supplies the owner report ID and payload without sending a market request',async()=>{
 const paths=[], opened=[];
 const auth={onAuthStateChange(listener){
  listener('INITIAL_SESSION',{access_token:token,user:{id:'synthetic-owner'}});
  return {data:{subscription:{unsubscribe(){}}}};
 },async stopAutoRefresh(){}};
 const mount=mountLibrary({href:'https://example.invalid/',auth,onSession(){},
  renderReport:(payload,id)=>{
   opened.push(id);
   return renderReports(payload,null,{historical:true,marketContext:{reportId:id,token,today:props.today}}).upper;
  },
  fetch:async(path,options)=>{
   paths.push(path);
   if(path==='/api/saved-reports?config=1') return Response.json({url:'https://fake.supabase.co',publishableKey:'fake'});
   assert.equal(options.headers.Authorization,'Bearer '+token);
   if(path.startsWith('/api/saved-reports?search=')) return Response.json({reports:[{
    id:reportId,card_name:'Shohei Ohtani #700',created_at:'2026-11-23T00:00:00Z',
   }],hasMore:false});
   return Response.json({report:{id:reportId,payload:createSavedSnapshot(report)}});
  }});
 try {
  await flush();
  mount.loadList();
  await flush();
  await find(mount.render(),'button').find(button=>button.props.children==='Open saved report').props.onClick();
  mount.render();
  assert.deepEqual(opened,[reportId]);
  assert.deepEqual(paths,['/api/saved-reports?config=1','/api/saved-reports?search=&sort=newest&page=0',
   '/api/saved-reports?id='+reportId]);
 } finally { mount.close(); }
});

test('expanding and collapsing stays local; owner-authorized requests are independent and results stay out of report data',async()=>{
 const calls=[];
 const dash=marketDashboardInteraction(props,async(path,options)=>{
  calls.push([path,options]);
  if(path==='/api/scan-diagnostics') return Response.json({authorized:true,expiresAt:Date.now()+60000});
  if(path==='/api/active-market-pilot') return Response.json({cohort:'Raw',rows:[]});
  return Response.json({error:'provider_quota'},{status:429});
 });
 expand(dash,0);
 assert.deepEqual(calls,[]);
 let tree=dash.render();
 assert.match(dash.html(tree),/Authorize Preview owner/);
 assert.doesNotMatch(dash.html(tree),/Request recent sales/);
 const auth=find(tree,'button').find(node=>node.props.children==='Authorize Preview owner');
 await auth.props.onClick();
 const currentTarget={subjects:'Shohei Ohtani',year:'2018',set:'Topps Series 2',number:'700',cohort:'Raw',confirmed:'on'};
 const submit=source=>find(dash.render(),'form')[0].props.onSubmit({currentTarget,nativeEvent:{submitter:{value:source}},preventDefault(){}});
 await submit('active');
 assert.deepEqual(calls.map(call=>call[0]),['/api/scan-diagnostics','/api/active-market-pilot']);
 assert.match(dash.html(dash.render()),/No active records returned/);
 expand(dash,0,false);
 assert.match(dash.html(dash.render()),/0 listings · 0 possible · 0 mismatches/);
 assert.doesNotMatch(dash.html(dash.render()),/No active records returned/);
 expand(dash,1);
 await submit('sales');
 assert.match(dash.html(dash.render()),/rate or row limit was reached/);
 assert.equal(calls[2][1].cache,'no-store');
 assert.equal(calls[2][1].headers.Authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(calls[2][1].body),{reportId,cohort:'Raw',confirmed:true,
  reviewedIdentity:{year:'2018',set:'Topps Series 2',number:'700',subjects:['Shohei Ohtani']},dateFrom:'2026-11-21',dateTo:'2026-11-23'});
 assert.ok(createSavedSnapshot(report));
 assert.doesNotMatch(JSON.stringify(createSavedSnapshot(report)),/No active records|provider_quota|synthetic-library-token|b99139ef/);
 assert.doesNotMatch(protectedCopySummary(report),/No active records|provider_quota|synthetic-library-token|b99139ef/);
});

test('lookback dashboard loads older windows only on an explicit action and clears them on review changes',async()=>{
 const calls=[];
 const windows=[{dateFrom:'2026-11-21',dateTo:'2026-11-23',status:'empty'}];
 const dash=marketDashboardInteraction({...props,lookback:true},async(path,options)=>{
  calls.push([path,options]);
  if(path==='/api/scan-diagnostics')return Response.json({authorized:true,expiresAt:Date.now()+60000});
  const request=JSON.parse(options.body);
  return Response.json({cohort:'Raw',candidates:[],rejected:[],qualifiedCount:0,
   comparableEvidence:{version:1,rows:[],counts:{qualified:0},coverage:{lookbackDays:30},readiness:{blockers:[]}},
   lookback:{earliestChecked:'2026-11-21',latestChecked:'2026-11-23',recordsRetrieved:0,requestsAttempted:1,windows,
    stopped:request.continuation?'provider_quota':null,complete:false,expiresAt:Date.now()+60000},
   continuation:request.continuation?null:'synthetic-cursor',
  });
 });
 expand(dash,1);
 assert.deepEqual(calls,[]);
 await find(dash.render(),'button').find(node=>node.props.children==='Authorize Preview owner').props.onClick();
 const currentTarget={subjects:'Shohei Ohtani',year:'2018',set:'Topps Series 2',number:'700',cohort:'Raw',confirmed:'on'};
 const submit=value=>find(dash.render(),'form')[0].props.onSubmit({currentTarget,nativeEvent:{submitter:{value}},preventDefault(){}});
 await submit('sales');
 assert.match(dash.html(dash.render()),/Load older sales/);
 assert.match(dash.html(dash.render()),/Checked 2026-11-21 through 2026-11-23/);
 assert.equal(calls.length,2);
 await submit('older');
 assert.equal(JSON.parse(calls[2][1].body).continuation,'synthetic-cursor');
 assert.match(dash.html(dash.render()),/Partial requested coverage/);
 assert.doesNotMatch(dash.html(dash.render()),/Load older sales/);
 find(dash.render(),'form')[0].props.onChange();
 assert.doesNotMatch(dash.html(dash.render()),/Partial requested coverage|synthetic-cursor/);
});

test('unconfigured Phase 5N catalog shows its status without requesting anything',()=>{
 const dash=marketDashboardInteraction({...props,catalogStatus:'catalog_provider_not_configured'},()=>{
  throw Error('unexpected request');
 });
 const html=dash.html(dash.render());
 assert.match(html,/Catalog provider not configured/);
 assert.match(html,/Active Listings — eBay/);
 assert.match(html,/Recent Sales — The Card API/);
 assert.doesNotMatch(html,/Request catalog candidates/);
});
