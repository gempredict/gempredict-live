import {catalogNameKey} from './catalogNormalization.mjs';
export const SPORTS_READING_FIELDS=['serialNumber','subset','printedTitle','foilMark'];
export const SPORTS_DETAIL_KEYS=['version','subjects','subset','printedTitle','serialNumber','serialReadingIndex','foilTreatment'];
const key=value=>catalogNameKey(value);
const serial=value=>typeof value==='string'&&/^\d{1,6}\/\d{1,6}$/.test(value.trim());
const list=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'&&value.length<=80?value:null;
// Observation consistency only. Never catalog, physical-printing or financial verification.
export function sportsIdentityEvidence(observation={},canonical={}){
 const detail=observation.sportsIdentity;
 if(!detail||detail.version!==1||!Array.isArray(detail.subjects))return {version:1,available:false,subjectStatus:'legacy_unstructured',verified:false};
 const raw=list(observation.identityReadings),entries=detail.subjects.slice(0,4),names=entries.map(s=>text(s?.name)).filter(Boolean),nameKeys=names.map(key);
 const clearSubjects=raw.flatMap((r,index)=>r?.field==='subject'&&r.certainty==='clear'?[{r,index}]:[]);
 const members=entries.map((s,index)=>{
  const refs=list(s?.readingIndices),supported=!!text(s?.name)&&s?.certainty==='clear'&&refs.length>0&&refs.every(i=>Number.isInteger(i)&&raw[i]?.field==='subject'&&raw[i]?.certainty==='clear'&&raw[i]?.area==='name'&&key(raw[i]?.text)===key(s.name));
  return {index,name:text(s?.name),certainty:['clear','uncertain','unreadable'].includes(s?.certainty)?s.certainty:'uncertain',readingIndices:refs.filter(i=>Number.isInteger(i)&&i>=0&&i<12),supported};
 });
 const conflicts=[],unresolved=[];
 if(detail.subjects.length>4)unresolved.push('subject_group_exceeds_limit');
 if(new Set(nameKeys).size!==entries.length||entries.length===0)unresolved.push('subject_group_missing_or_duplicate');
 const declared=String(canonical.subject||observation.identifiedSubject||'').split(/\s*\/\s*|\s+&\s+|\s+and\s+/i).map(key).filter(Boolean).sort();
 if(names.length&&JSON.stringify(declared)!==JSON.stringify([...nameKeys].sort()))conflicts.push('subject_group_proposal_mismatch');
 const unmatched=clearSubjects.filter(({r,index})=>!members.some(s=>s.supported&&s.readingIndices.includes(index)&&key(s.name)===key(r.text))).map(v=>v.index);
 if(unmatched.length)conflicts.push('unattributed_clear_subject_reading');
 if(members.some(s=>!s.supported))unresolved.push('subject_member_evidence_incomplete');
 const row=raw[detail.serialReadingIndex],copy=text(detail.serialNumber);
 const formatValid=!!copy&&serial(copy)&&Number(copy.split('/')[0])>0&&Number(copy.split('/')[0])<=Number(copy.split('/')[1]);
 const serialSupported=formatValid&&row?.field==='serialNumber'&&row.certainty==='clear'&&row.text===copy;
 const serialStatus=copy?serialSupported?'observed_not_authenticated':'unresolved':'unavailable';
 const rarityIssue=serial(observation.identifiedRarity)?'serial_like_rarity_proposal':null;
 return {version:1,available:true,subjects:members,subjectStatus:conflicts.length?'conflict':unresolved.length?'unresolved':'supported_observations',conflicts,unresolved,unmatchedReadingIndices:unmatched,
  subset:{value:text(detail.subset),status:'unverified_proposal'},printedTitle:{value:text(detail.printedTitle),status:'unverified_proposal'},
  serial:{value:copy,readingIndex:Number.isInteger(detail.serialReadingIndex)?detail.serialReadingIndex:null,formatValid,status:serialStatus},
  rarity:{original:text(observation.identifiedRarity),issue:rarityIssue,status:rarityIssue?'unresolved':'unverified_proposal'},
  foil:{value:text(detail.foilTreatment),status:'unverified_visual_proposal'},exactParallel:{value:text(observation.identifiedParallel),status:'unverified',inferredFromSerial:false},verified:false};
}
export function sportsIdentitySummary(e){
 if(!e?.available)return '';
 return ` | Sports subjects: ${e.subjects.map(s=>s.name).filter(Boolean).join(' / ')||'unresolved'} (${e.subjectStatus}) | Subset proposal: ${e.subset.value||'unresolved'} | Printed title proposal: ${e.printedTitle.value||'unresolved'} | Copy serial observation: ${e.serial.value||'unavailable'} (${e.serial.status}) | Original rarity observation: ${e.rarity.original||'unavailable'} | Rarity issue: ${e.rarity.issue||'none established'} | Foil observation: ${e.foil.value||'unresolved'} | Exact parallel proposal: ${e.exactParallel.value||'unresolved'} (unverified; never inferred from serial)`;
}
