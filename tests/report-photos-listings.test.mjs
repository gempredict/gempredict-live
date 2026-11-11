import test from 'node:test';import assert from 'node:assert/strict';
import {attachReportPhotos,reportPhotos} from '../lib/reportPhotos.mjs';
import {reportListings} from '../lib/reportListings.mjs';
import {protectFinancialReport} from '../lib/financialSafety.mjs';
import {photoInteraction,renderReports} from './helpers/renderReports.mjs';
const title='2024 Bowman Chrome Prospects Konnor Griffin BCP-86 Mojo Refractor';
const item=(n=0,t=title)=>({itemId:'v1|'+(123456789012+n)+'|0',itemWebUrl:'https://www.ebay.com/itm/'+(123456789012+n),title:t,image:'https://i.ebayimg.com/images/test.jpg',price:{value:'42.50',currency:'USD'},condition:'Ungraded',accepted:true,rejectionReasons:[]});
const report=items=>protectFinancialReport({cardTitle:title,identityV2:{category:'sports',subject:'Konnor Griffin',year:'2024',set:'Bowman Chrome Prospects',collectorNumber:'BCP-86',parallel:'Mojo Refractor'},marketData:{success:true,count:items.length,items,rawComparableItems:[],marketSummary:{}}});
test('photos are associated with submitted buffers only and never serialized or borrowed by another report',()=>{
 const r={},other={},front=new Blob(['front'],{type:'image/jpeg'}),back=new Blob(['back'],{type:'image/jpeg'});attachReportPhotos(r,{front,back});assert.equal(reportPhotos(r).front,front);assert.equal(reportPhotos(r).back,back);assert.equal(reportPhotos(other),null);assert.equal(reportPhotos(JSON.parse(JSON.stringify(r))),null);assert.equal(JSON.stringify(r),'{}');
});
test('front/back viewer switches actual session blob references, preserves proportions and revokes both references',()=>{
 let n=0;const removed=[];const photos={front:new Blob(['front'],{type:'image/jpeg'}),back:new Blob(['back'],{type:'image/jpeg'})};const ui=photoInteraction(photos,{Blob,URL:{createObjectURL(){return 'blob:session-'+(++n);},revokeObjectURL:v=>removed.push(v)}});ui.render();const cleanup=ui.effect();let tree=ui.render();assert.equal(ui.nodes(tree,n=>n.type==='img')[0].props.src,'blob:session-1');assert.equal(ui.nodes(tree,n=>n.type==='img')[0].props.style.objectFit,'contain');ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Back')[0].props.onClick();tree=ui.render();assert.equal(ui.nodes(tree,n=>n.type==='img')[0].props.src,'blob:session-2');cleanup();assert.deepEqual(removed,['blob:session-1','blob:session-2']);
});
test('front-only, missing, rejected photo types and restored reports have explicit safe fallbacks',()=>{
 for(const photos of [null,{front:new Blob(['x'],{type:'image/jpeg'})},{front:'https://private.example/photo'},{front:new Blob(['x'],{type:'image/png'})}]){const ui=photoInteraction(photos,{Blob,URL:{createObjectURL(){return 'blob:local';},revokeObjectURL(){}}});ui.render();ui.effect();let tree=ui.render();const back=ui.nodes(tree,n=>n.type==='button'&&n.props.children==='Back')[0];if(back)back.props.onClick();else assert.equal(photos,null);tree=ui.render();assert.equal(ui.nodes(tree,n=>n.type==='img').length,0);}
 assert.match(renderReports({cardTitle:'Restored report'}).upper,/not retained in saved or restored reports/);
});
test('screened active listings retain actual title, price, currency, condition and validated source URL without exact claims',()=>{
 const r=report([item()]),view=reportListings(r);assert.equal(view.candidates.length,1);assert.equal(view.qualified.length,0);assert.equal(view.candidates[0].amount,42.5);assert.equal(view.candidates[0].currency,'USD');assert.equal(view.candidates[0].url,'https://www.ebay.com/itm/123456789012');const html=renderReports(r).upper;assert.match(html,/USD 42.50/);assert.match(html,/Possible matches/);assert.match(html,/active listing/);assert.ok(html.indexOf('Available on eBay')<html.indexOf('Market snapshot'));
});
test('wrong years, numbers, parallels, serials, products and explicitly rejected records never become possible matches',()=>{
 for(const t of [title.replace('2024','2022'),title.replace('BCP-86','BCP-87'),title.replace('Mojo','Purple'),title+' /250',title+' Bowman Sterling'])assert.equal(reportListings(report([item(0,t)])).candidates.length,0,t);
 assert.equal(reportListings(report([{...item(),accepted:false}])).candidates.length,0);assert.equal(reportListings(report([{...item(),itemWebUrl:'https://evil.example/itm/123456789012'}])).candidates.length,0);
 const r=report([item()]);r.identityV2.printingVerified=true;r.identityV2.identityVerified=true;r.physicalPrintingStatus={verified:true};r.variantVerification={status:'verified'};assert.equal(reportListings(r).qualified.length,0);
});
test('duplicate listing records, malformed data, missing prices and unsafe images are handled conservatively',()=>{
 assert.equal(reportListings(report([item(),item()])).candidates.length,1);const x={...item(),price:null,image:'javascript:alert(1)'};const row=reportListings(report([x])).candidates[0];assert.equal(row.amount,null);assert.equal(row.image,null);assert.deepEqual(reportListings({marketData:{success:true,items:{bad:true}}}).candidates,[]);
});
