// Server-only. Reviewed literals are parsed as data, never executed.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseCatalogLiteral} from './tcgdexSnapshot.mjs';
import registry from './reviewedCatalogRegistry.json' with {type:'json'};
const DIGEST='f03332a085c123446a4884dc0e829e2d579affd87accc2d6f193edbcfdee1f10';
export function validateReviewedSource(asset){
 const fail=()=>{throw Error('reviewed_source_integrity_invalid');};
 if(createHash('sha256').update(JSON.stringify(asset)).digest('hex')!==DIGEST)fail();
 if(asset.repository!=='tcgdex/cards-database'||asset.revision!==registry[0].revision)fail();
 for(const f of asset.files){if(createHash('sha1').update(`blob ${Buffer.byteLength(f.content)}\0`).update(f.content).digest('hex')!==f.blob)fail();parseCatalogLiteral(f.content);}
 for(const r of registry){
  const card=asset.files.find(f=>f.path===r.cardPath&&f.blob===r.cardBlob),set=asset.files.find(f=>f.path===r.setPath&&f.blob===r.setBlob);
  if(!card||!set)fail();const c=parseCatalogLiteral(card.content).data,s=parseCatalogLiteral(set.content).data;
  if(c.name.en!==r.subject||c.rarity!==r.rarity||c.regulationMark!==r.regulationMark||s.id!==r.setId||s.name.en!==r.setName||s.releaseDate!==r.releaseDate||s.abbreviations.official!==r.setCode||r.cardNumber!==path.posix.basename(card.path,'.ts')+'/'+s.cardCount.official||JSON.stringify(c.variants.map(v=>({finish:v.type,stamps:v.stamp||[]})))!==JSON.stringify(r.printings))fail();
 }
 return true;
}
let ready=false;
try{const asset=JSON.parse(readFileSync(path.join(process.cwd(),'data/tcgdex/reviewed-source.json'),'utf8'));validateReviewedSource(asset);ready=readFileSync(path.join(process.cwd(),'data/tcgdex/LICENSE'),'utf8').includes('MIT License');}catch{}
const string=value=>typeof value==='string'&&value.length<=80?value:null;
export function hostedCatalogEvidence(card,{language=null,set=null}={}){
 const detailed=card?.variants_detailed;
 return {provider:'tcgdex',id:string(card?.id),language,setId:string(card?.set?.id),setUpdated:string(set?.updated),retrievedAt:new Date().toISOString(),updated:string(card?.updated),revision:null,
  variants:Object.fromEntries(['normal','holo','reverse'].map(k=>[k,typeof card?.variants?.[k]==='boolean'?card.variants[k]:null])),
  rarity:string(card?.rarity),regulationMark:string(card?.regulationMark),extraVariantFlags:Object.fromEntries(Object.entries(card?.variants&&typeof card.variants==='object'?card.variants:{}).filter(([key])=>!['normal','holo','reverse'].includes(key)).slice(0,16).map(([key,value])=>[key.slice(0,40),typeof value==='boolean'?value:null])),
  detailedPresent:Array.isArray(detailed),detailedComplete:Array.isArray(detailed)&&detailed.length<=16,
  printings:Array.isArray(detailed)?detailed.slice(0,16).map(v=>({finish:string(v?.type),stamps:Array.isArray(v?.stamp)?v.stamp.slice(0,12).map(string):typeof v?.stamp==='string'?[string(v.stamp)]:null,variantId:string(v?.variantId),size:string(v?.size),foil:string(v?.foil)})):[]};
}
export function reviewedSourceReceipt(id){
 const record=registry.find(r=>r.id===id);
 return ready&&record?{repository:record.repository,revision:record.revision,cardBlob:record.cardBlob,setBlob:record.setBlob}:null;
}
