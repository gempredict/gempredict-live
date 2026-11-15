// Server-only retrieval metadata. Never provides a card record or verifies a printing.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCatalogLiteral} from './tcgdexSnapshot.mjs';
const DIGEST='34b0bb30cda7a85f4adf8fd7e2c62223c936e6238ff80b4b8284f700b7e64190';
export function validateReviewedSets(asset){
 const fail=()=>{throw Error('reviewed_set_source_invalid');};
 if(createHash('sha256').update(JSON.stringify(asset)).digest('hex')!==DIGEST||asset.repository!=='tcgdex/cards-database'||asset.revision!=='a8fe5736aef9bd6be2436e3be730109030f4c6e2')fail();
 return asset.sources.map(f=>{
  const {data,imports}=parseCatalogLiteral(f.content);
  if(!/^data\/[^.]+\.ts$/.test(f.path)||imports[0].symbol!=='{ Set }'||!data.id||!data.name?.en||!Number.isInteger(data.cardCount?.official)||data.cardCount.official<1||!/^\d{4}-\d{2}-\d{2}$/.test(data.releaseDate)||!data.abbreviations?.official)fail();
  return {id:data.id,names:data.name,officialCount:data.cardCount.official,releaseDate:data.releaseDate,
   codes:Object.fromEntries(Object.keys(data.name).map(lang=>[lang,data.abbreviations[lang]||data.abbreviations.official])),
   provenance:{repository:asset.repository,revision:asset.revision,path:f.path,blob:createHash('sha1').update(`blob ${Buffer.byteLength(f.content)}\0`).update(f.content).digest('hex'),digest:DIGEST}};
 });
}
let records=[],available=false;
try{records=validateReviewedSets(JSON.parse(readFileSync(path.join(process.cwd(),'data/tcgdex/reviewed-sets.json'),'utf8')));available=readFileSync(path.join(process.cwd(),'data/tcgdex/LICENSE'),'utf8').includes('MIT License');}catch{}
// Dependency-injectable for offline duplicate/coverage tests; never reads client-supplied mappings.
export function createReviewedSetResolver(entries,sourceAvailable=true){
 return (code,language)=>{
  if(!code)return {status:'not_requested',candidateCount:0};
  if(!sourceAvailable)return {status:'unavailable',candidateCount:0};
  const printed=String(code).trim().toUpperCase();
  const candidates=entries.filter(r=>r.codes?.[language]?.toUpperCase()===printed);
  if(candidates.length>1)return {status:'ambiguous',candidateCount:candidates.length};
  if(!candidates.length)return {status:entries.some(r=>Object.values(r.codes||{}).some(c=>String(c).toUpperCase()===printed))?'language_mismatch':'unknown',candidateCount:0};
  return {status:'resolved',candidateCount:1,set:structuredClone({...candidates[0],code:printed,language})};
 };
}
export const resolveReviewedSetCode=createReviewedSetResolver(records,available);
