import fs from 'node:fs';
import {runScan} from './reconciliationPipeline.mjs';
import {IDENTITY_STRING_FIELDS} from '../../lib/identityValidation.mjs';
export const evidence=JSON.parse(fs.readFileSync(new URL('../fixtures/zapdos-live-identity-evidence.json',import.meta.url),'utf8'));
const {facts}=JSON.parse(fs.readFileSync(new URL('../fixtures/zapdos-catalog-facts.json',import.meta.url),'utf8'));
const observed=evidence.observed;
const reading=(field,text,certainty='clear')=>({field,text,certainty,side:'front',area:field==='subject'?'name':field==='cardNumber'?'collector_line':'set_mark',alternatives:[]});
export const vision={...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:observed.subject,identifiedCardNumber:observed.collectorNumber,identifiedLanguage:observed.language,identifiedYear:null,identifiedBrandSet:null,identityConfidence:observed.confidence,identityReadings:[reading('subject',observed.subject),reading('cardNumber',observed.collectorNumber),reading('language',observed.language),reading('setCode',observed.printedSet.text,'uncertain'),reading('copyrightYear','2026','uncertain')]};
export function transport({normalOnly=false,missing=false,ambiguous=false,cardPatch={},setPatch={}}={}){
 const calls=[];const set={id:facts.setId,name:facts.setName,releaseDate:facts.releaseDate,cardCount:{official:facts.officialCount},tcgOnline:facts.setCode,...setPatch};
 const card={id:observed.catalogReference,name:facts.subject,localId:facts.localId,rarity:facts.rarity,set,variants:{holo:!normalOnly,normal:normalOnly,reverse:false},...cardPatch};
 return {calls,fetch:async url=>{calls.push(String(url));const p=new URL(url).pathname;return {ok:true,status:200,json:async()=>structuredClone(p.endsWith('/cards')?missing?[]:[{id:card.id,name:card.name,localId:card.localId},...(ambiguous?[{id:'synthetic-alt-133',name:card.name,localId:card.localId}]:[])]:p.endsWith('/cards/synthetic-alt-133')?{...card,id:'synthetic-alt-133',rarity:'Special illustration rare'}:p.includes('/cards/')?card:set)};}};
}
export async function scan({model={},catalog={},fields={},...patch}={}){
 const t=transport(catalog),raw={...vision,...model};
 const body={type:'message',role:'assistant',id:'msg_offline_zapdos',model:'claude-sonnet-4-6',stop_reason:observed.stopReason,content:[{type:'text',text:JSON.stringify(raw)}],usage:{output_tokens:observed.outputTokens}};
 let requests=0;const r=await runScan({fields:{mode:'identity',cardType:'pokemon',...fields},back:false,catalogFetch:t.fetch,...patch,actualSdkFetch:async()=>{requests++;return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});}});
 return {...r,requests,catalogCalls:t.calls};
}
