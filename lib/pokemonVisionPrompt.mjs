import {conditionOutputContract,identityOutputFields} from './visionPromptContract.mjs';
// Shared active/benchmark prompt. Never seed benchmark ground-truth labels.
export function buildVisionPrompt({cardName='Unknown card from image',typeLabel='Card',hasBack=false,verifiedIdentity=null}={}){
 const context=verifiedIdentity?'Independently verified printed-card identity (catalog facts only): '+JSON.stringify(Object.fromEntries(['subject','cardNumber','year','brandSet','language','rarity'].filter(k=>verifiedIdentity[k]!=null).map(k=>[k,verifiedIdentity[k]])))+'. Do not re-identify from memory; transcribe contradictions for review. This does not establish artwork, physical printing, authenticity or condition.':'';
 return `${context}
Inspect ${typeLabel} photographs. Supplied name (unverified unless catalog context above): ${JSON.stringify(verifiedIdentity?.subject||cardName||null)}.
Identity proposals and condition findings are independent observations, not verified facts. Familiar artwork cannot establish a set/year. Transcribe full collector denominator, language, set code and rarity mark when legible. Do not invent unreadable identifiers. Rarity does not establish finish or Special Illustration Rare printing.
Prioritize the actually visible year or supported printed product identifiers. A visible copyright year may be a cautious proposal with its basis in identityNotes; it is not a verified release year. Never override printed evidence with remembered set dates. If conflicting or uncertain, return identifiedYear:null and explain briefly.
${identityOutputFields}
Also return identifiedRarity from a visible marking, otherwise null. Never derive a physical printing from rarity alone.
${conditionOutputContract(hasBack)}
Return only identity fields, identityReadings, visualObservations, inspectionCoverage, imageLimitations and photoNotes. Do not output category ratings, numeric grades, PSA forecasts, repeated summaries or null placeholders for suppressed financial/grade fields. Application explanations are generated from validated evidence.
`;
}
