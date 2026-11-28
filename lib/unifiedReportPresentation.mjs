// Presentation only. Takes an already protected report; never grants evidence trust.
const categoryNames={pokemon:'Pokémon',sports:'Sports card',mtg:'Magic: The Gathering',yugioh:'Yu-Gi-Oh!',dragonball:'Dragon Ball',onepiece:'One Piece',tcg:'Trading card'};
const text=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,180):typeof v==='number'&&Number.isFinite(v)?String(v):null;
export function unifiedReportPresentation(report={}){
 const identity=report.identityV2||{},card=report.canonicalCard||{};
 const selected=categoryNames[report.cardType]?report.cardType:null;
 const category=categoryNames[identity.category]?identity.category:selected;
 const conflict=!!selected&&!!category&&selected!==category;
 // Sport/team metadata is deliberately not copied into a Pokémon identity panel.
 const fields=[['Set / product',text(card.brandSet)||text(identity.set)],['Collector number',text(card.cardNumber)||text(identity.collectorNumber)],['Release year',text(card.year)||text(identity.year)],['Language',text(card.language)||text(identity.language)],['Rarity',report.sourceCatalogEvidence?.rarity?.proposalStatus==='conflict'?'Unresolved — conflicting rarity evidence':identity.category==='pokemon'&&report.identityVerification?.catalog?.source==='tcgdex'&&report.rarityVerification?.verified===true?text(card.rarity):(text(card.rarity)||text(identity.rarity))?'Proposed: '+(text(card.rarity)||text(identity.rarity))+' — unverified':null],['Printing / parallel',(text(card.parallel)||text(identity.parallel))?'Proposed: '+(text(card.parallel)||text(identity.parallel))+' — unverified':null]];
 const supported=category==='pokemon'&&identity.category==='pokemon'&&report.identityVerification?.catalog?.source==='tcgdex'&&!conflict&&!report.userIdentityConflicts?.length&&(report.coreCatalogIdentity?.supported===true||report.pokemonIdentityStatus?.catalogVerified===true);
 const count=report.marketData?.count;
 return {category:conflict?'Category needs review':categoryNames[category]||'Category unresolved',categoryConflict:conflict,fields:fields.map(([label,value])=>({label,value:value||'Unresolved'})),identityLabel:conflict?'Identity needs review':supported?'Core catalog support':'Identification proposal',
  discovery:{status:report.marketData?.success===true?'Active listings only':report.marketData?'Discovery unavailable':'Not requested',returnedCount:Number.isInteger(count)&&count>=0?count:null},
  // No qualified bridge is installed. Unknown counts/history are not zero sales.
  sales:['Raw','PSA 8','PSA 9','PSA 10'].map(group=>({group,status:'Not available',sample:'No qualified feed connected',amount:null})),
  financialStatus:'Withheld',printingStatus:'Exact printing is not independently verified. Listing candidates cannot establish comparable value.'};
}

// Presentation only: complete identifiers and original evidence are never rewritten.
export function reportHero(report={}){
 const c=report.canonicalCard||{},i=report.identityV2||{};
 const subject=text(c.subject)||text(i.subject),number=text(c.cardNumber)||text(i.collectorNumber);
 return {title:subject?subject+(number?' #'+number:''):text(report.cardTitle)||'Card identity unresolved',subtitle:[text(c.year)||text(i.year),text(c.brandSet)||text(i.set)].filter(Boolean).join(' · ')||'Year / set unresolved',printing:text(c.parallel)||text(i.parallel)||null};
}
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):typeof value==='string'?value.trim().replace(/\s+/g,' '):value;
export function distinctConditionRows(rows=[]){
 const seen=new Set();return rows.filter(row=>{const key=JSON.stringify(stable(row));if(seen.has(key))return false;seen.add(key);return true;});
}
// Collector copy over already validated findings. Never alters certainty or evidence.
function collectorFindingText(o){
 if(o.certainty==='unassessable')return o.observationStatus==='tentative_visible_area_observation'?'No obvious defect reported in visible regions (tentative).':'Unable to assess reliably.';
 if(o.code==='no_defect_observed')return 'No visible defect in inspected regions.';
 return (o.certainty==='suspected'?'Suspected ':'Visible ')+String(o.code||'condition finding').replace(/_/g,' ')+'.';
}
export function conditionSnapshot(overview=[]){
 return overview.map(a=>{
  const observations=distinctConditionRows(a.observations||[]),groups=new Map();
  for(const o of observations){const {region,...facts}=o;const key=JSON.stringify(stable(facts));const g=groups.get(key)||{...o,collectorText:collectorFindingText(o),locations:[]};if(o.region)g.locations.push(o.region);groups.set(key,g);}
  const values=[...groups.values()];
  const rank=side=>values.some(o=>o.side===side&&(o.certainty!=='unassessable'||o.observationStatus==='tentative_visible_area_observation'))?0:values.some(o=>o.side===side)?1:2;
  const brief=['front','back'].sort((a,b)=>rank(a)-rank(b)).flatMap(side=>{
   const rows=values.filter(o=>o.side===side);if(!rows.length)return a.providedSides?.includes(side)&&!values.some(o=>!o.side&&o.reportedSide===side)?[(side==='front'?'Front':'Back')+' '+(a.name||a.key||'condition').toLowerCase()+': not assessed.']:[];
   const clean=rows.filter(o=>o.code==='no_defect_observed'&&o.certainty==='confirmed'),tentative=rows.some(o=>o.observationStatus==='tentative_visible_area_observation');
   const damage=[...new Set(rows.filter(o=>o.code!=='no_defect_observed'&&o.certainty!=='unassessable').map(o=>(o.certainty==='suspected'?'suspected ':'visible ')+o.code.replace(/_/g,' ')))];
   const damageRegions=rows.filter(o=>o.code!=='no_defect_observed'&&o.certainty!=='unassessable').reduce((n,o)=>n+o.locations.length,0);
   const phrases=damage.map(v=>v+(damage.length===1&&damageRegions>1?' ('+damageRegions+' regions)':''));
   if(clean.length){const count=clean.reduce((n,o)=>n+o.locations.length,0);phrases.push('no visible defect in inspected regions'+(count>1?' ('+count+' regions)':''));}
   if(tentative)phrases.push('no obvious defect reported (tentative)');
   if(rows.some(o=>o.certainty==='unassessable'&&o.observationStatus!=='tentative_visible_area_observation'))phrases.push(phrases.length?'other regions unassessable':'unable to assess reliably');
   return [(side==='front'?'Front':'Back')+' '+(a.name||a.key||'condition').toLowerCase()+': '+phrases.join('; ')+'.'];
  });
  const unknown=values.filter(o=>!o.side);
  for(const side of [...new Set(unknown.map(o=>o.reportedSide||null))])brief.push(side?'Reported '+side+' (side unverified): unable to assess reliably.':'Photo side unknown: unable to assess reliably.');
  return {...a,observations,groups:values,brief:brief.join(' ')||'No supported observation available.'};
 });
}

// Compact Gemini observations carry a certainty label and prose, not a
// structured defect verdict. Only explicitly worded findings get a label.
export function compactFindingLabel(row) {
 if(row.status==='not_assessable')return 'Not assessable';
 if(row.status==='possible')return 'Possible defect or limitation';
 const text=String(row.text||'');
 const finding=text.slice(text.indexOf(':')+1).trim();
 if(/^(?:no (?:obvious |visible |apparent )?(?:defects?|damage|wear|whitening|chipping|scratches?|creases?|dents?)\b|(?:appears |looks )clean\b)/i.test(finding)&&
    !/\b(?:but|except|however|although|possible|suspected)\b/i.test(finding))return 'No obvious defect';
 if(/\b(?:possible|suspected|may be|could be)\b/i.test(finding))return 'Possible defect or limitation';
 if(!/\b(?:no|not|without|glare|reflection|sleeve|holder|artwork|ink|printing|unclear)\b/i.test(finding)&&
    /\b(?:damage|wear|whitening|chipping|scratch(?:es|ed)?|crease[ds]?|dents?|fraying|off[- ]center(?:ed)?)\b/i.test(finding))return 'Reported visible defect';
 return 'Photo observation';
}

export function collectorGradingAssessment(analysis) {
 if(!analysis)return {heading:'Start with a Full Analysis',next:'Add front and back photos to assess condition before considering grading.'};
 const concerns=new Set(), strengths=new Set();
 const assessments=analysis.conditionAssessments||{};
 for(const attribute of ['centering','corners','edges','surface']){
  for(const row of assessments[attribute]?.observations||[]){
   if(row.code==='no_defect_observed'&&(row.certainty==='confirmed'||row.observationStatus==='tentative_visible_area_observation'))strengths.add(attribute);
   if(row.code!=='no_defect_observed'&&['confirmed','suspected'].includes(row.certainty))concerns.add(attribute);
  }
 }
 for(const row of analysis.compactPhotoObservations||[]){
  const label=compactFindingLabel(row);
  if(label==='No obvious defect')strengths.add(row.attribute);
  if(label==='Reported visible defect'||label==='Possible defect or limitation')concerns.add(row.attribute);
 }
 const retake=!analysis.inspectedSides?.includes('back')||analysis.photoSideUncertain?.length||
  analysis.imageLimitations?.some(value=>['glare','blur','cropped','occluded','limited_resolution','sleeve','perspective'].includes(value));
 return {
  heading:concerns.size?'Inspect the flagged areas before deciding':strengths.size?'Check the card in hand before deciding':'Get a clearer view before deciding',
  strengths:[...strengths],concerns:[...concerns],
  next:retake||(!strengths.size&&!concerns.size)?
   'Use sharp, straight-on photos of both sides with the full border visible. Add angled light for surface marks if needed.':
   'Inspect edges, corners and surface under angled light and verify the proposed printing before paying submission fees.',
 };
}
