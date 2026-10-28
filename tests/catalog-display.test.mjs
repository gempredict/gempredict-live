import test from 'node:test';import assert from 'node:assert/strict';
import {displayCatalogRarity,catalogDisplayFacts} from '../lib/catalogDisplay.mjs';
test('SIR display keeps rarity, artwork and independently sourced printing separate without changing identity',()=>{
 const card={subject:'Pikachu ex',year:'2026',brandSet:'30th Celebration',cardNumber:'149/128',language:'English',rarity:'Special illustration rare',parallel:'Special Art',printings:['holo'],physicalPrintingVerified:false};
 const snapshot=structuredClone(card);
 assert.deepEqual(catalogDisplayFacts(card),{rarity:'Special Illustration Rare (SIR)',artwork:'Special Art',printing:'Holo'});
 assert.deepEqual(card,snapshot);assert.equal(card.physicalPrintingVerified,false);
 assert.equal(catalogDisplayFacts({...card,printings:[]}).printing,'unverified');
 assert.equal(catalogDisplayFacts({...card,printings:['reverse']}).printing,'Reverse Holo');
 assert.equal(displayCatalogRarity('Special Art'),'Special Art');
 assert.equal(catalogDisplayFacts({...card,parallel:'Holo Special Art',printings:[]}).printing,'unverified');
});
