import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCatalogLiteral, reconcileHostedPrinting} from '../lib/tcgdexSnapshot.mjs';
import {catalogVariantKey, catalogVariantParts} from '../lib/catalogNormalization.mjs';
import {scan} from './helpers/zapdosLiveFixture.mjs';
const source=JSON.parse(readFileSync(new URL('./fixtures/zapdos-finish-upstream-source.json',import.meta.url)));
test('retrieved upstream Zapdos source distinguishes rarity, foil, stamp and set metadata',()=>{
 const card=parseCatalogLiteral(source.card).data,set=parseCatalogLiteral(source.set).data;
 assert.equal(card.name.en,'Zapdos');assert.equal(card.rarity,'Illustration rare');
 assert.equal(card.regulationMark,'J');assert.equal(set.id,'30th');assert.equal(set.abbreviations.official,'30C');
 assert.equal(set.cardCount.official,128);assert.equal(set.releaseDate,'2026-09-16');
 assert.equal(card.variants.length,1);assert.equal(card.variants[0].type,'holo');
 assert.deepEqual(card.variants[0].stamp,['30th-anniversary']);
 assert.notEqual(catalogVariantKey(card.rarity),catalogVariantKey('Special Illustration Rare'));
 assert.deepEqual(catalogVariantParts('Illustration rare').finishes,[]);
});
test('document current separation gap: composite SIR wording is not normalized like bare SIR',()=>{
 assert.equal(catalogVariantParts('Special Illustration Rare').artwork,'special art');
 assert.equal(catalogVariantParts('Special Illustration Rare (full-art holo)').artwork,'special illustration rare full art');
 assert.deepEqual(catalogVariantParts('Special Illustration Rare (full-art holo)').finishes,['holo']);
});
test('reported normal-only flags plus original SIR proposal reproduce finish and parallel blockers',async()=>{
 const r=await scan({model:{identifiedParallel:'Special Illustration Rare (full-art holo)'},catalog:{normalOnly:true}}),p=r.payload;
 assert.equal(r.status,200);assert.equal(p.coreCatalogIdentity.supported,true);
 assert.deepEqual(p.catalogComparison.finalConflicts,['finish','parallel']);
 assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(p.financialDecision.allowed,false);
 assert.equal(p.originalIdentityObservation.identifiedParallel,'Special Illustration Rare (full-art holo)');
});
test('hypothetical explicit holo catalog support does not approve SIR or uncertain photograph',async()=>{
 const r=await scan({model:{identifiedParallel:'Special Illustration Rare (full-art holo)'}}),p=r.payload;
 assert.equal(p.coreCatalogIdentity.supported,true);assert.deepEqual(p.catalogComparison.finalConflicts,['parallel']);
 assert.equal(p.variantVerification.status,'needs_confirmation');assert.equal(p.photoIdentityStatus.photoSupported,false);
 assert.equal(p.financialDecision.allowed,false);assert.equal(p.canonicalCard.rarity,'Illustration rare');
});
test('Zapdos cannot inherit the narrow Pikachu/Greninja snapshot override',()=>{
 const record={id:'30th-133',variants:{normal:true,holo:false,reverse:false}};
 const diagnostics=[];assert.strictEqual(reconcileHostedPrinting(record,{},diagnostics),record);assert.deepEqual(diagnostics,[]);
});
test('adversarial reverse, number, denominator and language proposals stay blocked',async()=>{
 for(const model of [{identifiedParallel:'Reverse Holo'},{identifiedCardNumber:'134/128'},{identifiedCardNumber:'133/129'},{identifiedLanguage:'Japanese'}]){
  const p=(await scan({model})).payload;
  assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(p.financialDecision.allowed,false);
 }
});
