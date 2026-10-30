import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidCatalogIdentityFields, validCatalogReference } from '../lib/catalogIdentityValidation.mjs';
import { calculateGradingEconomics, consistentFinancialReport, PSA_FEE } from '../lib/gradingEconomics.mjs';

// Synthetic module-contract tests, NOT results of running the photo scanner.
const identity = {subject:'Pikachu ex',year:'2026',brandSet:'ME: 30th Celebration',cardNumber:'149/128',provider:'tcgdex'};
const market={rawValue:40,psa9Value:50,psa10Value:180,psa10Probability:30};

test('known full-number identity passes the catalog shape gate',()=>{
 assert.deepEqual(invalidCatalogIdentityFields(identity),[]);
 assert.equal(validCatalogReference({source:'tcgdex',referenceId:'sample-reference'}),true);
});
test('missing and placeholder identities fail closed',()=>{
 for(const replacement of ['unknown','',null]) assert.ok(invalidCatalogIdentityFields({...identity,subject:replacement}).includes('subject'));
 assert.ok(invalidCatalogIdentityFields({...identity,cardNumber:'149'}).includes('cardNumber'));
 assert.ok(invalidCatalogIdentityFields({...identity,cardNumber:'149/000'}).includes('cardNumber'));
 assert.equal(validCatalogReference({source:'tcgdex',referenceId:''}),false);
});
test('catalog shape validation alone does not establish a variant match',()=>{
 assert.deepEqual(invalidCatalogIdentityFields({...identity,cardNumber:'150/128'}),[]);
 assert.deepEqual(invalidCatalogIdentityFields({...identity,brandSet:'Surging Sparks'}),[]);
});
test('replaying identical financial inputs is deterministic',()=>{
 const results=Array.from({length:3},()=>calculateGradingEconomics({...market}));
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
test('synthetic grading economics expose fee and downside',()=>{
 const result=calculateGradingEconomics(market);
 const expectedGraded=180*0.30+50*0.70;
 assert.equal(result.psaFee,PSA_FEE);
 assert.equal(result.expectedGradedValue,expectedGraded);
 assert.equal(result.expectedNetValue,expectedGraded-40-PSA_FEE);
 assert.equal(result.verdict,'skip');
});
test('modeled upside is not an unconditional recommendation',()=>{
 const result=calculateGradingEconomics({rawValue:10,psa9Value:130,psa10Value:400,psa10Probability:70});
 assert.equal(result.verdict,'maybe');
 assert.match(result.action,/Verify graded-sale estimates/i);
 assert.match(result.analysis,/not verified sales or guaranteed returns/i);
});
test('without documented market provenance the report fails closed',()=>{
 const prediction=calculateGradingEconomics(market);
 assert.equal(consistentFinancialReport({prediction,marketData:{marketSummary:{rawUsedCount:0,rawMedian:40}}}),false);
 assert.equal(consistentFinancialReport({prediction,marketData:{marketSummary:{rawUsedCount:3,rawMedian:40}}}),false);
});