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

// Complete SYNTHETIC Mets recovery response. These defects/coordinates are test
// hypotheses, not observations of the owner's card or a historical model replay.
export function metsFullAnalysisObservation(){
 const raw=structuredClone(compatibilityExamples[2].raw);delete raw.schemaVersion;
 const read=(field,text,side='front',area='body_text',certainty='clear')=>({field,text,side,area,certainty,alternatives:[]});
 raw.identityReadings=[read('subject','Francisco Lindor','front','name'),read('subject','Juan Soto','front','name'),read('subject','Francisco Lindor','back','name'),read('subject','Juan Soto','back','name'),read('cardNumber','52','back','collector_line'),read('subset','It Takes Two'),read('printedTitle','It Takes Two'),read('foilMark','Confetti-like foil','front','body_text','uncertain')];
 raw.sportsIdentity={...raw.sportsIdentity,subjects:[{name:'Francisco Lindor',certainty:'clear',readingIndices:[0,2]},{name:'Juan Soto',certainty:'clear',readingIndices:[1,3]}],serialNumber:null,serialReadingIndex:null};
 raw.identityNotes='Synthetic fixture: exact printing is proposed, not independently confirmed.';
 raw.identityConfidence=null;raw.identifiedLanguage=null;raw.identifiedAutoOrRelic=null;
 raw.visualObservations=[
  {attribute:'centering',code:'off_center',certainty:'suspected',evidence:{side:'back',region:[0,0,1,1],cue:'border_width_difference',confidence:.6,measurement:{axis:'horizontal',ratio:[60,40]}}},
  {attribute:'corners',code:'whitening',certainty:'suspected',evidence:{side:'front',region:[.01,.01,.08,.08],cue:'localized_color_loss',confidence:.6}},
  {attribute:'edges',code:'wear',certainty:'suspected',evidence:{side:'front',region:[.01,.1,.04,.2],cue:'localized_color_loss',confidence:.6}},
  {attribute:'edges',code:'wear',certainty:'suspected',evidence:{side:'back',region:[.93,.2,.04,.2],cue:'localized_color_loss',confidence:.6}},
  {attribute:'surface',code:'scratches',certainty:'suspected',evidence:{side:'back',region:[.2,.2,.1,.1],cue:'surface_line',confidence:.6}}
 ];
 raw.inspectionCoverage=['front','back'].flatMap(side=>['centering','corners','edges','surface'].map(attribute=>({side,attribute,regions:[{region:[0,0,1,1],status:side==='front'&&['surface','centering'].includes(attribute)||side==='back'&&attribute==='corners'?'unassessable':'partial'}],limitations:side==='front'&&attribute==='surface'?[{code:'glare',region:null}]:[]})));
 raw.imageLimitations=['glare','perspective'];
 raw.photoNotes=[{attribute:'surface',side:'front',text:'Glare prevents reliable surface inspection.'},{attribute:'surface',side:'back',text:'Possible scratches require physical inspection.'},{attribute:'centering',side:'front',text:'Perspective limits centering inspection; not independently measured.'},{attribute:'corners',side:'back',text:'Back corners cannot be inspected reliably.'}];
 return raw;
}
