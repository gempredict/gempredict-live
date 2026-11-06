import {readIdentityReadings,parsePrintedSetMark} from './visionIdentityEvidence.mjs';
import {catalogNameKey,catalogLanguageKey} from './catalogNormalization.mjs';
// Photo readings are model observations, not a second OCR system or proof of
// authenticity. This status only describes their agreement with catalog facts.
export const collectorReadingKey=v=>String(v||'').trim().replace(/^#\s*/,'').replace(/\s*([/-])\s*/g,'$1').toUpperCase().split(/([/-])/).map(p=>/^\d+$/.test(p)?String(Number(p)):p).join('');
export function photoIdentityStatus(report){
 const original=report.originalIdentityObservation||{},raw=Array.isArray(original.identityReadings)?original.identityReadings:[];
 const readings=readIdentityReadings(raw),clear=readings.filter(r=>r.certainty==='clear');
 const card=report.canonicalCard||{},candidate=report.identityVerification?.catalog?.candidate;
 const catalogAgrees=report.pokemonIdentityStatus?.catalogVerified===true;
 const conflicts=new Set(),missing=new Set();
 for(const field of ['subject','cardNumber','language']){
  const values=clear.filter(r=>r.field===field).map(r=>r.text);
  if(field==='language')values.push(...clear.filter(r=>r.field==='setCode').map(r=>parsePrintedSetMark(r.text).language).filter(Boolean));
  const normalize=field==='subject'?catalogNameKey:field==='language'?catalogLanguageKey:collectorReadingKey;
  const keys=[...new Set(values.map(normalize).filter(Boolean))];
  if(!keys.length)missing.add(field);
  if(keys.length>1||keys.length===1&&card[field]&&normalize(card[field])!==keys[0])conflicts.add(field);
 }
 const marks=clear.filter(r=>r.field==='setCode').map(r=>parsePrintedSetMark(r.text).code);
 const setKeys=[...new Set(marks.map(catalogNameKey))];
 if(setKeys.length>1)conflicts.add('setCode');
 if(!setKeys.length)missing.add('setCode');
 else if(catalogAgrees&&!setKeys.every(k=>[candidate?.setCode,candidate?.setId,candidate?.brandSet].filter(Boolean).some(v=>catalogNameKey(v)===k)))conflicts.add('setCode');
 // User choices and catalog conflicts also prevent a photo-supported claim.
 for(const c of Array.isArray(report.userIdentityConflicts)?report.userIdentityConflicts:[])if(['subject','cardNumber','language','parallel'].includes(c.field))conflicts.add(c.field);
 const status=conflicts.size?'conflict':catalogAgrees&&!missing.size?'supported':'unresolved';
 return {status,catalogAgrees,photoSupported:status==='supported',physicalPrintingVerified:false,
  missingReadings:[...missing],conflicts:[...conflicts],reason:conflicts.size?'printed_identity_conflict':!catalogAgrees?'catalog_not_supported':missing.size?'clear_printed_evidence_missing':'catalog_and_printed_evidence_agree',
  readingDisposition:raw.slice(0,12).map((r,index)=>({index,field:['subject','cardNumber','setCode','language','rarityMark','copyrightYear'].includes(r?.field)?r.field:'unknown',disposition:readIdentityReadings([r]).length?'retained':'unsupported_or_invalid'}))};
}
export function withPhotoIdentityStatus(report){
 if(report.stage!=='identity')return report;
 const photo=photoIdentityStatus(report);
 return {...report,photoIdentityStatus:photo,identityV2:{...report.identityV2,identityVerified:photo.photoSupported,identityStatus:photo.photoSupported?'catalog_and_printed_evidence_agree':photo.catalogAgrees?'catalog_supported_photo_unresolved':'unresolved',printingVerified:false,priceLookupEligible:false}};
}
