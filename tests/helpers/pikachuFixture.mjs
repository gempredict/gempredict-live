// Existing October fixture. Synthetic photos/listings; never live scan data.
import {runScan} from './reconciliationPipeline.mjs';
export const set={id:'30th',name:'30th Celebration',releaseDate:'2026-09-16',cardCount:{official:128},tcgOnline:'30C'};
const hosted={id:'30th-149',localId:'149',name:'Pikachu ex',rarity:'Special illustration rare',set,updated:'2026-09-17T00:45:22+02:00',variants:{firstEdition:false,holo:false,normal:true,reverse:false,wPromo:false},variants_detailed:[{type:'normal',size:'standard',variantId:'generated'}]};
export const vision={identifiedSubject:'Pikachu ex',identifiedYear:'2023',identifiedManufacturer:'Pokemon',identifiedBrandSet:'Paldea Evolved',identifiedCardNumber:'149/128',identifiedParallel:'Holo Special Art',identifiedLanguage:'English',identifiedAutoOrRelic:'none'};
export const title='2026 Pokemon 30th Celebration Pikachu ex 149/128 English Holo Special Illustration Rare';
export const listing=(i,text=title)=>({itemId:'v1|'+(123456789012+i)+'|0',itemWebUrl:'https://www.ebay.com/itm/'+(123456789012+i),title:text,condition:'Ungraded',localizedAspects:[{name:'Language',value:'English'}],price:{value:'40',currency:'USD'}});
export const neutral=Array.from({length:3},(_,i)=>listing(i));
const catalogFetch=async url=>({ok:true,json:async()=>structuredClone(!new URL(url).pathname.includes('/en/')?[]:new URL(url).pathname.endsWith('/cards')?[{id:hosted.id,localId:'149',name:hosted.name}]:new URL(url).pathname.includes('/cards/')?hosted:set)});
export const scan=patch=>runScan({vision,fields:{cardType:'pokemon'},neutral,items:neutral,catalogFetch,...patch});
