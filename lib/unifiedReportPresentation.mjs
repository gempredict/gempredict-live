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
