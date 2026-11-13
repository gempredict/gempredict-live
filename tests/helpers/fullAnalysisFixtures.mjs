// SYNTHETIC compatibility examples, never complete historical model responses,
// independent card references, physical observations or marketplace records.
import {IDENTITY_STRING_FIELDS} from '../../lib/identityValidation.mjs';
export function fullObservation(category='pokemon'){
 return {schemaVersion:1,...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identityConfidence:null,identityReadings:[],visualObservations:[],inspectionCoverage:[],imageLimitations:[],photoNotes:[],...(category==='sports'?{identifiedSport:null,identifiedTeam:null,identifiedSerialNumber:null}:{})};
}
const reading=(field,text,side='front',area='name')=>({field,text,side,area,certainty:'clear',alternatives:[]});
function sports(names,extra={}){
 return {...fullObservation('sports'),identifiedSubject:names.join(' / '),identityReadings:names.map(n=>reading('subject',n)),sportsIdentity:{version:1,subjects:names.map((name,i)=>({name,certainty:'clear',readingIndices:[i]}))},...extra};
}
export const compatibilityExamples=[
 {name:'Fraxure — proposed Reverse Holo',category:'pokemon',raw:{...fullObservation(),identifiedSubject:'Fraxure',identifiedYear:'2019',identifiedBrandSet:'Unified Minds',identifiedCardNumber:'155/236',identifiedParallel:'Reverse Holo',identityReadings:[reading('subject','Fraxure'),reading('cardNumber','155/236','back','collector_line')]}},
 {name:'Konnor Griffin — proposed Mojo',category:'sports',raw:sports(['Konnor Griffin'],{identifiedYear:'2024',identifiedManufacturer:'Bowman',identifiedBrandSet:'Bowman Chrome Prospects',identifiedCardNumber:'BCP-86',identifiedParallel:'Mojo Refractor'})},
 {name:'Mets — proposed Celebration Confetti',category:'sports',raw:sports(['Francisco Lindor','Juan Soto'],{identifiedYear:'2026',identifiedManufacturer:'Topps',identifiedBrandSet:'Topps Series 1',identifiedCardNumber:'52',identifiedSport:'Baseball',identifiedTeam:'Mets',identifiedParallel:'Celebration Confetti'})},
 {name:'Standard nonparallel sports hypothesis',category:'sports',raw:sports(['Synthetic Player'],{identifiedParallel:'Base'})},
 {name:'Unreadable physical printing',category:'pokemon',raw:{...fullObservation(),identityNotes:'Printing unreadable; no physical finish confirmation.',imageLimitations:['glare']}},
 {name:'Mixed-side surface states',category:'pokemon',raw:{...fullObservation(),visualObservations:[{attribute:'surface',code:'scratches',certainty:'suspected',evidence:{side:'back',region:[.2,.2,.1,.1],cue:'surface_line',confidence:.6}},{attribute:'surface',code:'scratches',certainty:'unassessable'}],inspectionCoverage:[{attribute:'surface',side:'front',regions:[{region:[0,0,1,1],status:'unassessable'}],limitations:[{code:'glare'}]}],photoNotes:[{attribute:'surface',side:'front',text:'Glare prevents reliable surface inspection.'},{attribute:'surface',side:'back',text:'Possible scratches; physical inspection needed.'}]}}
];
compatibilityExamples[2].raw.sportsIdentity={...compatibilityExamples[2].raw.sportsIdentity,subset:'It Takes Two',printedTitle:'It Takes Two',foilTreatment:'confetti-like foil'};
export const fullMessage=raw=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(raw)}]});
