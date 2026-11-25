import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_API_CATALOG_ID_TYPES, createReviewedCrosswalkAdapter, evaluateCatalogSalesCrosswalk, readCardApiSaleType } from '../lib/catalogSalesCrosswalk.mjs';
import { compareScanSale } from '../lib/scanToSalesIdentity.mjs';
import { gradingEconomicsReadiness } from '../lib/gradingEconomics.mjs';

const target={category:'sports',subjects:['Shohei Ohtani'],year:'2018',set:'Topps Series 2',number:'700',
 parallel:'Base',photoPose:'pitching',autograph:'no',relic:'no'};
const identifiers=id=>[{type:'UCID',value:'synthetic-card'},{type:'USID',value:'synthetic-set'},
 {type:'URID',value:id},{type:'CFID',value:'synthetic-family'}];
const record=(id,claims={})=>({recordId:id,revision:'synthetic-review-1',identifiers:identifiers(id),
 exactVariantType:'URID',requiredVariantFields:['parallel','photoPose','autograph','relic'],claims:{...target,...claims}});
const base=record('synthetic-base');
const factory=record('synthetic-factory',{parallel:'Factory Complete Set Variation',photoPose:'batting'});
const authorized=Object.freeze({});
const adapter=createReviewedCrosswalkAdapter({
 namespace:'the_card_api',types:CARD_API_CATALOG_ID_TYPES,
 source:{id:'synthetic-catalog',provenance:'Synthetic reviewed fixture only'},
 authorize:config=>config===authorized,
 projectCatalog:row=>row,
 // The link originates from a separate approved adapter, never from a title or
 // opportunistic identifiers returned in an undocumented sales payload.
 projectSale:row=>row.id==='synthetic-linked'?{saleId:row.id,identifiers:identifiers('synthetic-base'),
  exactVariantType:'URID',sourceReference:'synthetic-licensed-link'}:
  row.id==='synthetic-factory-sale'?{saleId:row.id,identifiers:identifiers('synthetic-factory'),
   exactVariantType:'URID',sourceReference:'synthetic-factory-link'}:null,
});
const title='2018 Topps Series 2 Shohei Ohtani #700 Base Pitching Photo';
const sale=(id,saleTitle=title)=>({id,identityMatch:compareScanSale(target,{title:saleTitle},'Raw',{strictTitle:true})});
const evaluate=overrides=>evaluateCatalogSalesCrosswalk({adapter,configuration:authorized,proposal:target,catalogRecords:[base,factory],...overrides});

test('synthetic crosswalk uses a reviewed variant and sale link without verifying the physical copy',()=>{
 const result=evaluate({sales:[sale('synthetic-linked'),sale('synthetic-title-only'),sale('synthetic-factory-sale')]});
 assert.equal(result.status,'exact_catalog_variant_supported');
 assert.equal(result.physicalPrintingVerified,false);
 assert.equal(result.authorizesValuation,false);
 assert.deepEqual(result.candidates[0].identifiers.map(id=>id.type),CARD_API_CATALOG_ID_TYPES);
 assert.deepEqual(result.rows.map(row=>row.status),['sale_linked_to_exact_catalog_variant','plausible_title_association','identity_conflict']);
 assert.ok(result.rows[0].unresolvedFields.includes('grading_cohort'));
 assert.ok(result.rows[2].contradictions.includes('catalog_variant'));
 assert.equal(gradingEconomicsReadiness({identityEvidence:result,comparables:result}).automaticEconomicsAllowed,false);
});

test('wrong year or set, photo variants, and grade contradictions remain explicit',()=>{
 for(const [field,value] of [['year','2019'],['set','Topps Update'],['photoPose','batting']]){
  const result=evaluate({catalogRecords:[record('synthetic-conflict',{[field]:value})]});
  assert.equal(result.status,'identity_conflict');
  assert.ok(result.contradictions.includes(field));
 }
 const result=evaluate({sales:[sale('synthetic-linked',title+' PSA 9'),sale('synthetic-factory-sale','2018 Topps Series 2 Shohei Ohtani #700 Batting Photo')]});
 assert.ok(result.rows[0].contradictions.includes('grade'));
 assert.ok(result.rows[1].contradictions.includes('photo_variation'));
});

test('unresolved variant, independent record not found and unauthorized adapters fail closed',()=>{
 const {parallel,photoPose,...unknown}=target;
 assert.equal(evaluate({proposal:unknown}).status,'ambiguous_catalog_variants');
 const sparse=record('synthetic-sparse',{photoPose:null});
 assert.equal(evaluate({catalogRecords:[sparse]}).status,'catalog_record_found');
 const missing=evaluate({catalogRecords:[]});
 assert.equal(missing.status,'catalog_record_missing');
 const unavailable=evaluate({configuration:{rights:true,key:'synthetic'},sales:[sale('synthetic-linked')]});
 assert.equal(unavailable.status,'catalog_provider_not_configured');
 assert.equal(unavailable.candidates.length,0);
 assert.equal(unavailable.rows[0].link,null);
 assert.equal(evaluateCatalogSalesCrosswalk({}).status,'catalog_provider_not_configured');
});

test('explicit transaction outcomes do not borrow the listing type, and unknown contracts are withheld',()=>{
 assert.deepEqual(readCardApiSaleType('fixed_price',{sale_type:'accepted_offer'}),{
  transactionType:'accepted_offer',saleTypeBasis:'provider_sale_type',usable:true});
 assert.equal(readCardApiSaleType('fixed_price',{sale_type:'fixed_price'}).transactionType,'fixed_price');
 assert.equal(readCardApiSaleType('fixed_price',{}).saleTypeBasis,'listing_type_only');
 for(const value of [null,0,'best_offer','unsupported',['accepted_offer']]){
  assert.equal(readCardApiSaleType('fixed_price',{sale_type:value}).usable,false);
 }
 assert.equal(readCardApiSaleType('auction',{sale_type:'accepted_offer'}).usable,false);
});
