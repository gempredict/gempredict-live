const n=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const has=(title,value)=>!!value&&(' '+n(title)+' ').includes(' '+n(value)+' ');
const number=x=>String(x||'').trim().replace(/^#\s*/,'').replace(/\s/g,'').toUpperCase();
const escape=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const variants=/\b(?:purple|gold|silver|green|blue|red|orange|pink|black|white|yellow|aqua|teal|bronze|refractor|prizm|wave|shimmer|cracked ice|disco|mojo|holo|reverse|atomic|sapphire|superfractor|xfractor|speckle|sparkle)\b/g;
export function identityComplete(id={}){
 return !!((id.player||id.cardName)&&/^\d{4}(?:-\d{2,4})?$/.test(id.year||'')&&(id.set||id.brandSet)&&number(id.cardNumber)&&id.parallel);
}
export function matchListing(title,identity={},condition=''){
 const reasons=[],reject=[],expectedNumber=number(identity.cardNumber),set=identity.set||identity.brandSet;
 if(!identityComplete(identity))reject.push('identity_incomplete');
 if((identity.player||identity.cardName)&&!has(title,identity.player||identity.cardName))reject.push('wrong_player');
 const years=String(title).match(/\b(?:19|20)\d{2}\b/g)||[];
 if(identity.year&&(!has(title,identity.year)||years.some(y=>!String(identity.year).split('-').includes(y))))reject.push('wrong_year');
 if(set&&!has(title,set))reject.push('wrong_product');
 // A conflicting product cannot be hidden alongside the requested set name.
 const products=['bowman sterling','bowman chrome prospects','bowman draft','topps chrome','prizm','optic'];
 if(products.some(p=>has(title,p)&&!has(set,p)))reject.push('conflicting_product');
 if(expectedNumber){
  const re=new RegExp('(^|[^A-Z0-9-])#?'+escape(expectedNumber)+'(?![A-Z0-9/-])','i');
  if(!re.test(title))reject.push('wrong_or_missing_card_number');
  // Reject additional explicit collector identifiers, but not serial stamps.
  const found=[...String(title).matchAll(/(?:#\s*|\b)([A-Z]{1,6}-\d+[A-Z]?)(?![A-Z0-9])/gi)].map(m=>number(m[1]));
  if(found.some(v=>v!==expectedNumber))reject.push('conflicting_card_number');
  const explicit=[...String(title).matchAll(/#\s*([A-Z0-9]+(?:-[A-Z0-9]+)*(?:\s*\/\s*\d+)?)/gi)].map(m=>number(m[1]));
  if(explicit.some(v=>v!==expectedNumber))reject.push('conflicting_card_number');
 }
 if(identity.parallel&&!/^(base|normal|none)$/i.test(identity.parallel)&&!has(title,identity.parallel))reject.push('parallel_not_matched');
 const expected=new Set(n(identity.parallel).match(variants)||[]),actual=new Set(n(title).match(variants)||[]);
 if(has(set,'prizm'))expected.add('prizm');
 if([...actual].some(v=>!expected.has(v)))reject.push('conflicting_parallel');
 const fractions=[...String(title).matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map(m=>({full:m[1]+'/'+m[2],run:m[2]}));
 const collectorFraction=expectedNumber.includes('/')?expectedNumber:null;
 const serials=fractions.filter(v=>v.full!==collectorFraction);
 const bareRuns=[...String(title).matchAll(/(?:^|\s)\/\s*(\d+)\b/g)].map(m=>m[1]);
 const runs=[...serials.map(v=>v.run),...bareRuns];
 const expectedRun=identity.printRun==null||identity.printRun===''?null:String(identity.printRun);
 if(expectedRun?(!runs.length||runs.some(v=>v!==expectedRun)):runs.length)reject.push('serial_number_not_matched');
 const graded=/\b(?:psa|bgs|beckett|cgc|sgc|tag|graded|slabbed)\b/i.test(title)||(/^graded$/i.test(condition));
 const lot=/\b(?:lot|bundle|pair|playset|box|pack|break|proxy|reprint|custom)\b|\b(?:x[2-9]|[2-9]x)\b/i.test(title);
 const extra=/\b(?:autograph|auto|signed|signature|patch|relic|jersey|memorabilia)\b/i.test(title);
 if(graded)reject.push('graded_not_raw');if(lot)reject.push('multiple_card_lot');
 if(extra&&!/auto|relic/i.test(identity.autoOrRelic||''))reject.push('unmatched_auto_or_relic');
 const rejectionReasons=[...new Set(reject)];if(!rejectionReasons.length)reasons.push('identity_fields_match');
 return {matchScore:rejectionReasons.length?0:100,matchReasons:reasons,rejectionReasons,listingType:lot||extra?'excluded':graded?'graded':'raw',accepted:rejectionReasons.length===0};
}
