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

export function catalogDisplayTitle(card = {}) {
 return [card.subject, card.rarity ? displayCatalogRarity(card.rarity) : null].filter(Boolean).join(' — ');
}
export function catalogDisplaySubtitle(card = {}, catalogSource = null) {
 const language=card.language==='en'?'English':card.language;
 return [[card.year,card.category==='pokemon'||card.provider==='tcgdex'||catalogSource==='tcgdex'?'Pokémon':null,card.brandSet].filter(Boolean).join(' '),card.cardNumber?'#'+card.cardNumber:null,language].filter(Boolean).join(' · ');
}
