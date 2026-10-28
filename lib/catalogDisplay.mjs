// Display-only terminology. Never normalize catalog evidence or infer a finish.
import {catalogVariantParts} from './catalogNormalization.mjs';
export function displayCatalogRarity(value) {
 return typeof value==='string' && /^special illustration rare(?:\s*\(sir\))?$/i.test(value.trim())
  ? 'Special Illustration Rare (SIR)' : value || 'unavailable';
}
export function catalogDisplayFacts(card = {}) {
 const artwork=catalogVariantParts(card.parallel).artwork;
 const types=Array.isArray(card.printings)?card.printings:['holo','normal','reverse'].filter(type=>card.variants?.[type]===true);
 const names={holo:'Holo',normal:'Non-holo',reverse:'Reverse Holo'};
 return {rarity:displayCatalogRarity(card.rarity),artwork:artwork==='special art'?'Special Art':artwork || 'unverified',printing:types.map(type=>names[type]||type).join(', ')||'unverified'};
}
