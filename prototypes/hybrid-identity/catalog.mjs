// Local, read-only catalog materializer. Downloaded TypeScript is parsed as data,
// never imported/transpiled/executed. No network requests or production imports.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseCatalogLiteral,validateCatalogSnapshot} from '../../lib/tcgdexSnapshot.mjs';
export const sha256=data=>createHash('sha256').update(data).digest('hex');
const blob=data=>createHash('sha1').update(`blob ${Buffer.byteLength(data)}\0`).update(data).digest('hex');
export function bundledCatalog(root=process.cwd()) {
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/tcgdex/upstream-snapshot.json')));
 const sets=new Map(snapshot.sources.map(s=>parseCatalogLiteral(s.content).data).filter(data=>data.id&&data.cardCount).map(data=>[data.id,data]));
 return validateCatalogSnapshot(snapshot).map(r=>({id:r.id,subject:r.names.en,cardNumber:`${r.localId}/${r.officialCount}`,localId:r.localId,brandSet:r.setNames.en,setId:r.setId,setCode:sets.get(r.setId)?.abbreviations?.official||null,year:r.releaseDate.slice(0,4),releaseDate:r.releaseDate,officialCount:r.officialCount,language:'en',rarity:r.rarity,printings:[r.type],stamp:r.stamp,source:r.provenance}));
}
export function sourceCatalog(source,revision) {
 if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('source_revision_required');
 const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
 if(git('rev-parse','HEAD').trim()!==revision)throw Error('source_revision_mismatch');
 if(git('status','--porcelain','--untracked-files=no').trim())throw Error('source_modified');
 const indexed=new Map(git('ls-files','--stage','-z','data').split('\0').filter(Boolean).map(line=>{const [meta,file]=line.split('\t');return [file,meta.split(' ')[1]];}));
 const cache=new Map(),rejected={};
 const reject=reason=>{rejected[reason]=(rejected[reason]||0)+1;};
 function read(file){
  if(cache.has(file))return cache.get(file);
  const expected=indexed.get(file);if(!expected)throw Error('untracked_source');
  const bytes=fs.readFileSync(path.join(source,file));if(blob(bytes)!==expected)throw Error('source_blob_mismatch');
  const parsed=parseCatalogLiteral(bytes.toString());cache.set(file,parsed);return parsed;
 }
 const records=[];
 for(const file of indexed.keys()){
  if(!/^data\/.+\/\d+\.ts$/.test(file))continue;
  try{
   const c=read(file),card=c.data;
   const setPath=path.posix.normalize(path.posix.join(path.posix.dirname(file),c.imports[1].path))+'.ts';
   if(!setPath.startsWith('data/'))throw Error('invalid_set_path');
   const set=read(setPath).data,localId=path.posix.basename(file,'.ts');
   if(card.set?.reference!=='Set')throw Error('invalid_set_reference');
   if(card.category!=='Pokemon'||!card.name?.en||!set.name?.en||!set.id||!Number.isInteger(set.cardCount?.official)||set.cardCount.official<1||!/^\d{4}-\d{2}-\d{2}$/.test(set.releaseDate)||!Number.isFinite(Date.parse(set.releaseDate))||new Date(set.releaseDate).toISOString().slice(0,10)!==set.releaseDate)throw Error('unsupported_identity_schema');
   // No default printing, no inference from rarity. Explicit upstream types only.
   const variants=Array.isArray(card.variants)?card.variants:[];
   const printings=[...new Set(variants.map(v=>v?.type).filter(t=>['holo','normal','reverse'].includes(t)))];
   records.push({id:`${set.id}-${localId}`,subject:card.name.en,cardNumber:`${localId}/${set.cardCount.official}`,localId,brandSet:set.name.en,setId:set.id,setCode:set.abbreviations?.official||null,year:set.releaseDate.slice(0,4),releaseDate:set.releaseDate,officialCount:set.cardCount.official,language:'en',rarity:card.rarity||null,printings,stamp:variants.flatMap(v=>Array.isArray(v.stamp)?v.stamp:[]),source:{repository:'tcgdex/cards-database',revision,cardPath:file,cardBlob:indexed.get(file),setPath,setBlob:indexed.get(setPath)}});
  }catch(e){reject(/^source_|^unsupported_|^untracked_|^invalid_/.test(e.message)?e.message:'unsupported_literal');}
 }
 return {records,rejected,scannedNumericCards:[...indexed.keys()].filter(f=>/^data\/.+\/\d+\.ts$/.test(f)).length};
}
export function buildCatalog({source,revision,root=process.cwd()}={}) {
 const upstream=source?sourceCatalog(source,revision):{records:[],rejected:{},scannedNumericCards:0};
 const map=new Map(upstream.records.map(r=>[r.id,r]));
 // Existing validated source snapshot supplies explicit printing, including when
 // a newer generic source cannot be parsed. Keep this provenance distinguishable.
 for(const record of bundledCatalog(root))if(!map.has(record.id))map.set(record.id,record);
 const records=[...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
 return {schemaVersion:1,provider:'tcgdex',scope:'prototype_offline_english_numeric_pokemon_subset',coverage:{records:records.length,scannedNumericCards:upstream.scannedNumericCards,rejected:upstream.rejected,complete:false},records,recordsDigest:sha256(JSON.stringify(records))};
}
