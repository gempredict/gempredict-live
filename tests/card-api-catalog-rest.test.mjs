import assert from 'node:assert/strict';
import test from 'node:test';
import { cardApiCatalogUrl,requestCardApiCatalog,searchCardApiCatalog } from '../lib/cardApiCatalogRest.mjs';

const origin='https://www.thecardapi.com';
test('documented Catalog operations use fixed paths and safe opaque identifier segments',()=>{
 for(const [operation,params,path] of [
  ['search',{filters:{q:'Shohei Ohtani',year:2018,card_number:'700'}},'/api/v1/catalog'],
  ['detail',{id:'synthetic-UCID-001'},'/api/v1/catalog/synthetic-UCID-001'],
  ['sets',undefined,'/api/v1/catalog/sets'],
  ['family',{id:'synthetic-CFID-001'},'/api/v1/catalog/card-families/synthetic-CFID-001'],
 ]){
  const url=cardApiCatalogUrl(operation,params);
  assert.equal(url.origin,origin);
  assert.equal(url.pathname,path);
 }
 for(const id of ['../sets','x/y','a%2fb','https://example.invalid','a?foo=bar','']) {
  assert.throws(()=>cardApiCatalogUrl('detail',{id}));
  assert.throws(()=>cardApiCatalogUrl('family',{id}));
 }
});
test('reviewed search uses supported, bounded filters and a separate authentication header',async()=>{
 const controller=new AbortController();
 const response=await searchCardApiCatalog({identity:{subjects:['Shohei Ohtani'],year:'2018',set:'Topps Series 2',number:'700'},
  maxRecords:15,key:'synthetic-catalog-only',signal:controller.signal,fetchImpl:async(url,options)=>{
   assert.equal(url.origin,origin);
   assert.deepEqual(Object.fromEntries(url.searchParams),{q:'Shohei Ohtani',set_name:'Topps Series 2',
    card_number:'700',year:'2018',limit:'15',page:'1'});
   assert.deepEqual(options.headers,{Accept:'application/json','x-api-key':'synthetic-catalog-only'});
   assert.equal(options.method,'GET');
   assert.equal(options.redirect,'error');
   assert.equal(options.cache,'no-store');
   controller.abort();
   assert.equal(options.signal.aborted,true);
   return new Response(null,{status:429});
  }});
 assert.equal(response.status,429);
 for(const filters of [{ucid:'any'},{q:'a\nb'},{limit:21},{page:2},{year:'2018'},{set_id:'../../sales'},{player_id:['foo']}]) {
  assert.throws(()=>cardApiCatalogUrl('search',{filters}));
 }
 assert.throws(()=>requestCardApiCatalog('sets',undefined,{key:'synthetic\nheader'}));
 assert.throws(()=>cardApiCatalogUrl('sets',{filters:{page:1}}));
 const encoded=cardApiCatalogUrl('search',{filters:{q:'value&limit=100'}});
 assert.equal(encoded.searchParams.get('q'),'value&limit=100');
 assert.equal(encoded.searchParams.get('limit'),'20');
});
