// Structural owner-confirmation binding, never automatic card recognition.
export const CONTROLLED_CATEGORIES=Object.freeze({pokemon:'Pokémon',sports:'Sports Card',mtg:'Other — Magic: The Gathering',yugioh:'Other — Yu-Gi-Oh!',dragonball:'Other — Dragon Ball',onepiece:'Other — One Piece',tcg:'Other'});
export const validControlledCategory=value=>typeof value==='string'&&Object.hasOwn(CONTROLLED_CATEGORIES,value);
export function controlledCategorySubmission(prepared,selected){
 try{const m=JSON.parse(prepared?.manifest);return validControlledCategory(selected)&&prepared.category===selected&&prepared.confirmedCategory===selected&&m.category===selected&&prepared.confirmationAttemptId===m.attemptId;}catch{return false;}
}
