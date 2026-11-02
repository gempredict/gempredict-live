const n=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const has=(title,value)=>!value||(" "+n(title)+" ").includes(" "+n(value)+" ");
const number=x=>String(x||"").replace(/^#/,"").trim().split("/")[0];
export function matchListing(title,identity={},condition=""){
 const t=n(title), reasons=[],reject=[];
 const player=identity.player||identity.cardName, set=identity.set||identity.brand;
 if(player&&!has(title,player))reject.push("wrong_player");
 if(identity.year&&!has(title,identity.year))reject.push("wrong_year");
 if(set&&!has(title,set))reject.push("wrong_product");
 const num=number(identity.cardNumber);
 if(num&&!new RegExp("(^|[^0-9])#?"+num+"([^0-9]|$)").test(title))reject.push("wrong_or_missing_card_number");
 if(identity.parallel&&!has(title,identity.parallel))reject.push("parallel_not_matched");
 // Avoid false confidence when variants are not identified; flag ambiguous extras.
 if(!identity.parallel&&/\b(gold|silver|purple|green|blue|red|orange|pink|refractor|prizm|wave|shimmer|cracked ice|disco|mojo|holo)\b/i.test(title))reject.push("potential_unmatched_parallel");
 const graded=/\b(psa|bgs|beckett|cgc|sgc|tag)\s*(?:[0-9]|pristine|black label)/i.test(title)||condition==="Graded";
 const lot=/\b(lot of|lot|bundle|x[2-9]|[2-9]x)\b/i.test(title);
 const extra=/\b(autograph|auto|signed|signature|patch|relic|jersey|memorabilia)\b/i.test(title);
 if(graded)reject.push("graded_not_raw");
 if(lot)reject.push("multiple_card_lot");
 if(extra&&!/auto|relic/i.test(identity.autoOrRelic||""))reject.push("unmatched_auto_or_relic");
 if(!reject.length)reasons.push("identity_fields_match");
 return {matchScore:reject.length?0:100,matchReasons:reasons,rejectionReasons:reject,listingType:lot||extra?"excluded":graded?"graded":"raw",accepted:reject.length===0};
}
