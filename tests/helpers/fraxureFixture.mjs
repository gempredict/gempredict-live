// Synthetic provider schema fixtures. Owner supplies core identity; hosted finish
// flags and original diagnostic are NOT retained. No fixture is a live replay.
import {runScan} from './reconciliationPipeline.mjs';
export const fraxureModel={identifiedSubject:'Fraxure',identifiedYear:'2019',identifiedManufacturer:'Pokemon',identifiedBrandSet:'Cosmic Eclipse',identifiedCardNumber:'155/236',identifiedParallel:'Reverse Holo',identifiedLanguage:'English',identityConfidence:88,identityReadings:[{field:'subject',text:'Fraxure',side:'front',area:'name',certainty:'clear',alternatives:[]},{field:'cardNumber',text:'155/236',side:'front',area:'collector_line',certainty:'clear',alternatives:[]}]};
export async function fraxureScan({ambiguous=false,variants,fields={},model={}}={}){
 const set={id:'sm11',name:'Unified Minds',releaseDate:'2019-08-02',cardCount:{official:236}},card={id:'sm11-155',name:'Fraxure',localId:'155',rarity:'Uncommon',set,...(variants===undefined?{}:{variants})};
 const fetchCatalog=async url=>{const p=new URL(url).pathname;return {ok:true,json:async()=>structuredClone(p.endsWith('/cards')?[{id:card.id,name:card.name,localId:card.localId},...(ambiguous?[{id:'synthetic-155',name:card.name,localId:card.localId}]:[])]:p.includes('/cards/')?p.endsWith('/synthetic-155')?{...card,id:'synthetic-155',set:{...set,id:'synthetic',name:'Synthetic other set'}}:card:p.endsWith('/sets/synthetic')?{...set,id:'synthetic',name:'Synthetic other set'}:set)};};
 return runScan({fields:{cardType:'pokemon',...fields},vision:{...fraxureModel,...model},catalogFetch:fetchCatalog,items:[],neutral:[]});
}
