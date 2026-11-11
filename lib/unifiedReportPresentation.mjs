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
export function conditionSnapshot(overview=[]){
 return overview.map(a=>{
  const observations=distinctConditionRows(a.observations||[]),groups=new Map();
  for(const o of observations){const {region,...facts}=o;const key=JSON.stringify(stable(facts));const g=groups.get(key)||{...o,locations:[]};if(o.region)g.locations.push(o.region);groups.set(key,g);}
  const usable=[...groups.values()].filter(o=>o.certainty!=='unassessable');
  const brief=usable.length?usable.map(o=>(o.code==='no_defect_observed'?'No visible defect':o.code.replace(/_/g,' '))+' · '+(o.side==='front'?'Front':o.side==='back'?'Back':'Photo side unknown')+(o.locations.length>1?' · '+o.locations.length+' regions':'')).join('; '):'Insufficient photographic evidence';
  return {...a,observations,groups:[...groups.values()],brief};
 });
}
