import { scanSalesFields } from '../../lib/scanToSalesIdentity.mjs';
import { providerFinalPrice, summarizeRecentSales } from '../../lib/marketEvidenceSummary.mjs';

export const labels = {
  lookback_rate_limit:'Lookback request limit reached. Wait before submitting another request.',
  invalid_sales_continuation:'This lookback continuation is invalid or expired. Start a new search.',

  ebay_not_configured:'This Preview needs its server-side eBay Browse credentials.',
  ebay_busy:'An eBay search is already running.',
  ebay_quota:'eBay rate limit reached. No retry was attempted.',
  ebay_timeout:'The eBay search timed out.',
  ebay_invalid_response:'eBay returned a response outside the pilot limits.',
  ebay_unavailable:'eBay could not return active listings.',
  library_sign_in_required:'Sign in to My Card Library before using a saved card.',
  library_unavailable:'The Preview library is unavailable.',
  report_not_found:'This saved report is unavailable in your library.',
  unsupported_report_version:'This saved report version is unsupported.',
  owner_identity_review_required:'Review and confirm the saved identity before searching.',
  invalid_reviewed_identity:'Review the card identity. Supply subjects, a four-digit year, set and card number. Optional finish and treatment values must be supported.',
  identity_query_too_long:'The reviewed identity is too long for one bounded title query. Use accurate shorter set or parallel labels.',
  invalid_query:'Use a title query of at least four characters and a date range of up to three UTC calendar days within the last 30 days.',
  pilot_key_missing:'The branch Preview needs a server-side Card API key.',
  owner_authorization_required:'Owner authorization expired. Authorize again before running a query.',
  pilot_busy:'A sales query is already running.',
  provider_authentication:'The Card API rejected the configured key.',
  provider_entitlement:'The Card API denied access or requires another entitlement.',
  provider_validation:'The Card API rejected the query parameters.',
  provider_quota:'The Card API rate or row limit was reached. No retry was attempted.',
  provider_timeout:'The Card API query timed out.',
  provider_unavailable:'The Card API could not return a result.',
  response_too_large:'The Card API response exceeded the byte limit.',
  row_budget_exceeded:'The Card API returned more rows than this pilot allows.',
  schema_difference:'The provider response differs from the reviewed REST contract. The batch was withheld.',
};
export const fields = {display:'grid',gap:4,flex:'1 1 150px',minWidth:0, maxWidth:'100%'};
export const controls = {display:'flex',flexWrap:'wrap',alignItems:'end',gap:12};
function displayAmount(value,currency) {
  return value === null ? 'Unknown' : (currency ? currency+' ' : '') + String(value);
}
const evidenceLabels={
  year:'Release year',set:'Set',manufacturer:'Manufacturer',card_number:'Card number',subjects:'Player or subject',
  subset:'Subset',parallel:'Parallel',finish:'Finish',print_run:'Numbered printing',copy_serial:'Copy serial',
  factory_set:'Factory complete-set printing',photo_variation:'Photo variation',photo_pose:'Photo pose',
  exact_printing:'Exact printing',short_print:'Short print',grade:'Grade',unofficial_printing:'Unofficial printing',
  possible_lot:'Possible lot',autograph:'Autograph',relic:'Relic',ambiguous_variant_terms:'Ambiguous variation wording',
};
const conflictLabels={
  factory_set:'Different factory complete-set printing',
  photo_variation:'Different photo variation',
  short_print:'Different short-print version',
  parallel:'Different parallel',
  print_run:'Different numbered printing',
  card_number:'Different card number',
  year:'Different release year',
  set:'Different set',
};
const statusLabels={exact_listing_evidence:'Listing evidence aligns',plausible_unverified:'Possible match',mismatch:'Identity mismatch'};
function IdentityEvidence({evidence,cohort}) {
  if (!evidence) return null;
  const conflicts=evidence.mismatches.map(field=>{
    if(field!=='grade') return conflictLabels[field]||evidenceLabels[field]||field.replace(/_/g,' ');
    const label=evidence.gradeEvidence?.label;
    if (!label||label==='Conflicting grading evidence') return label||'Grade differs';
    if (/^[A-Z]+ \d/.test(label)) return `Graded ${label}, not ${cohort}`;
    return label==='Listed as Raw'?`Listed as Raw, not ${cohort}`:`Graded, not ${cohort}`;
  });
  return <>
    <p className="market-status"><strong>{statusLabels[evidence.status]}</strong>
      {evidence.gradeEvidence&&<span>{evidence.gradeEvidence.label}</span>}</p>
    {conflicts.length>0&&<p className="market-conflicts">{conflicts.join(' · ')}</p>}
    {evidence.unknown.includes('exact_printing')&&<p className="market-muted">Exact printing unconfirmed</p>}
    <details><summary>Identity evidence</summary>
      {Object.entries({matched:'Supports',unknown:'Unconfirmed',mismatches:'Conflicts'}).map(([key,label])=>evidence[key].length>0&&
        <p key={key}>{label}: {evidence[key].map(field=>evidenceLabels[field]||field.replace(/_/g,' ')).join(', ')}</p>)}
    </details>
  </>;
}
function Counters({values}) {
  return <dl className="market-counts">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
const rowStyle={padding:'12px 0',borderBottom:'1px solid #dfd8ca',overflowWrap:'anywhere'};
const transactionLabels={best_offer:'Best Offer',fixed_price:'Fixed-price',auction:'Auction'};
function Row({row,rejected,unified,cohort}) {
  const finalPrice=providerFinalPrice(row);
  return <li style={rowStyle}>
    <strong>{row.title || 'Listing title unavailable'}</strong>
    {row.suspectedDuplicate&&<p>Repeated provider record ID. Transaction identity is unverified.</p>}
    <p className="market-muted">{[row.platform,transactionLabels[row.listingType],row.sold].filter(Boolean).join(' · ') || 'Provenance incomplete'}</p>
    {unified?<p>{finalPrice===null?'Final price unknown.':[
      row.platform==='goldin'&&row.listingType==='auction'?'Provider-reported hammer price: ':'Provider-reported final price: ',
      displayAmount(finalPrice,row.currency),'. Settlement unverified.',
    ].join('')}</p>:<p>{row.platform==='goldin'?'Reported hammer price':'Reported price'}: {displayAmount(row.price,row.currency)}.
      Shipping: {displayAmount(row.shipping,row.currency)}. {row.amountReportedConfirmed?'Provider reports final amount known.':'Final amount unconfirmed.'}</p>}
    <IdentityEvidence evidence={row.identityMatch} cohort={cohort}/>
    <details><summary>{rejected?'Rejection and source details':'Qualification and source details'}</summary>
      <p>{[row.id,row.channel,row.condition].filter(Boolean).join(' · ')}</p>
      <ul>{[...new Set([...(row.reasons||[]),...(row.qualificationReasons||[])])].map(reason=><li key={reason}>{reason.replace(/_/g,' ')}</li>)}</ul>
    </details>
  </li>;
}
export function ActiveListings({result,pending,embedded=false}) {
  return <section className="market-section" aria-label="Active Listings — eBay">
    {!embedded&&<h2>Active Listings — eBay</h2>}
    <p>Current asking prices. Listing titles and seller claims are discovery evidence only.</p>
    {pending&&<p role="status">Searching eBay…</p>}
    {result?.error&&<p role="alert">{labels[result.error]||labels.ebay_unavailable}</p>}
    {result?.rows&&<>
      <Counters values={[[`Active · ${result.cohort}`,result.rows.length],
        ['Possible matches',result.rows.filter(row=>row.identityMatch.status!=='mismatch').length],
        ['Mismatches',result.rows.filter(row=>row.identityMatch.status==='mismatch').length]]}/>
      {result.rows.length===0&&<p>No active records returned.</p>}
      {!!(result.duplicateCount||result.conflictingDuplicateCount)&&<p>Duplicate rows removed: {result.duplicateCount}.
        Conflicting duplicate rows withheld: {result.conflictingDuplicateCount}.</p>}
      <ul>{result.rows.map((row,index)=><li key={index} style={rowStyle}>
        <strong>{row.title}</strong>
        <p>{row.ask?`Asking price: ${row.ask.currency} ${row.ask.amount}`:'Fixed asking price unavailable'}</p>
        <IdentityEvidence evidence={row.identityMatch} cohort={result.cohort}/>
        {row.exclusions.length>0&&<p>{row.exclusions.join(', ')}</p>}
        {row.link&&<p><a href={row.link} target="_blank" rel="noopener noreferrer">Open eBay listing</a></p>}
      </li>)}</ul>
    </>}
  </section>;
}
function SalesSummary({result}) {
  const summary=summarizeRecentSales(result);
  return <>
    <Counters values={[[`Recent · ${result.cohort}`,summary.recordsRetrieved],['Possible matches',summary.plausibleMatches],
      ['Mismatches',summary.identityMismatches],['Reported final price',summary.knownFinalPrices],
      ['Price unknown',summary.unknownFinalPrices]]}/>
    {summary.qualificationBlockers.length>0&&<details><summary>Why records cannot qualify</summary>
      <ul>{summary.qualificationBlockers.map(reason=><li key={reason}>{reason.replace(/_/g,' ')}</li>)}</ul>
    </details>}
  </>;
}
function ComparableQualification({evidence}) {
  if (evidence?.version!==1) return null;
  const captions={qualified:'Independently qualified',plausible:'Plausible, unverified',
    mismatch:'Identity or transaction mismatch',insufficient:'Insufficient evidence',restricted:'Commercially restricted'};
  const reasonLabels={target_physical_printing_unverified:'Exact physical printing unverified',
    independent_final_amount_missing:'Independent final price evidence missing',
    independent_settlement_missing:'Independent payment evidence missing',
    buyer_premium_treatment_unknown:'Buyer premium treatment unknown',
    commercial_use_not_authorized:'Commercial use not authorized',
    insufficient_compatible_cohort_samples:'Too few compatible qualified sales across grading cohorts',
    catalog_identity_or_printing_unresolved:'Catalog identity or exact printing unresolved',
    automatic_economics_not_enabled:'Automatic grading economics disabled'};
  const describe=reason=>reasonLabels[reason]||reason.replaceAll('_',' ');
  return <section aria-label="Comparable-sales qualification">
    <h3>Comparable-sales qualification</h3>
    <Counters values={Object.entries(captions).map(([key,label])=>[label,evidence.counts[key]])}/>
    <p>{evidence.rows.filter(row=>row.researchCandidate).length} research candidates · {evidence.rows.filter(row=>row.insufficientTransactionEvidence).length} records with incomplete transaction evidence</p>
    <details><summary>Qualification reasons and coverage</summary>
      <p>{evidence.coverage.received} records reviewed · {evidence.coverage.lookbackDays??'Unknown'}-day provider lookback · {evidence.coverage.complete===true?'Complete coverage':'Partial or unconfirmed coverage'}</p>
      <ul>{evidence.rows.map(row=><li key={row.index}>
        {row.providerRecordId||'Record '+(row.index+1)} · {captions[row.classification]} · {row.reasons.map(describe).join(' · ')}
      </li>)}</ul>
      <p>Grading economics withheld. {evidence.readiness.blockers.map(describe).join(' · ')}.</p>
    </details>
  </section>;
}
function LookbackCoverage({coverage,quotaDelta}) {
  if(!coverage)return null;
  return <section aria-label="Historical sales coverage">
    <h3>{coverage.complete?'Complete requested coverage':'Partial requested coverage'}</h3>
    <p>{coverage.earliestChecked?`Checked ${coverage.earliestChecked} through ${coverage.latestChecked} (UTC)`:'No dates checked successfully.'}
      {' · '}{coverage.recordsRetrieved} records · {coverage.requestsAttempted} provider requests attempted</p>
    {coverage.stopped&&<p role="status">Search stopped. {labels[coverage.stopped]||'Remaining windows were not requested.'}</p>}
    {quotaDelta!==null&&quotaDelta!==undefined&&<p>Observed quota decrease during this batch: {quotaDelta}.</p>}
    <details><summary>Date windows</summary>
      <p>Requested {coverage.requestedFrom} through {coverage.requestedTo} (UTC).</p>
      <ul>{coverage.windows.map(window=><li key={window.dateFrom}>
        {window.dateFrom} to {window.dateTo}: {window.status}{window.truncated?' · results may be truncated':''}
      </li>)}</ul>
    </details>
  </section>;
}
const economicsReasons={
  exact_catalog_identity_unresolved:'Exact catalog identity or printing is unresolved.',
  independent_physical_printing_unverified:'Independent physical-printing evidence is missing.',
  insufficient_independently_qualified_sales:'There are too few independently qualified raw and graded sales.',
  commercial_rights_unverified:'Commercial rights for the required sales are unverified.',
  verified_applicable_fee_schedule_required:'An applicable, verified grading fee schedule is required.',
  validated_grade_probability_source_required:'Grade probabilities need a validated source.',
  live_economics_disabled:'Live recommendations are disabled.',
};
export function RecentSales({result,message,unified,clear,embedded=false}) {
  return <section className="market-section" aria-label="Recent sales evidence">
      {unified&&!embedded&&<h2>Recent Sales — The Card API</h2>}
      {message&&<p role="alert">{message}</p>}
      {result?.differences&&<ul aria-label="Nonsecret schema differences">{result.differences.map(row=>
        <li key={row.field}>{row.field} expected {row.expected}, received {row.received}</li>)}</ul>}
      {result?.quota&&Object.values(result.quota).some(value=>value!==null)&&
        <p>Sales quota remaining: {result.quota.remaining??'unknown'} of {result.quota.limit??'unknown'}. Reset: {result.quota.reset??'unknown'}.</p>}
      {result?.candidates&&<>
        <LookbackCoverage coverage={result.lookback} quotaDelta={result.quotaDelta}/>
        {result.query&&<details><summary>Search details</summary><p>Title query: {result.query}. Each record is compared with the reviewed identity.</p></details>}
        {unified&&<SalesSummary result={result}/>}
        <ComparableQualification evidence={result.comparableEvidence}/>
        {result.economicsReadiness?.status==='withheld'&&<details><summary>Grading economics unavailable</summary>
          <ul>{result.economicsReadiness.blockers.map(reason=><li key={reason}>{economicsReasons[reason]||reason}</li>)}</ul>
        </details>}
        {unified?<h3>{result.cohort} provider candidates ({result.candidates.length})</h3>:<h2>{result.cohort} provider candidates ({result.candidates.length})</h2>}
        <p>One bounded page. Empty results do not establish that no market exists. Grade filters can omit unparsed records.</p>
        <p>Provider amounts do not independently verify payment or settlement. Best Offer amounts may be unknown.
          Shipping, tax and buyer-premium inclusion vary. Exact parallels, lots and distinct transactions are unverified.</p>
        <ul>{result.candidates.map(row=><Row key={row.index} row={row} unified={unified} cohort={result.cohort}/>)}</ul>
        <h3>Rejected matches ({result.rejected.length})</h3>
        <ul>{result.rejected.map(row=><Row key={row.index} row={row} unified={unified} cohort={result.cohort} rejected/>)}</ul>
        <h3>Independently qualified comparables ({result.qualifiedCount})</h3>
        <p>Free evaluation lacks the rights and independent evidence required for comparable sales and grading profitability.</p>
        {clear&&<button type="button" onClick={clear}>Clear results</button>}
      </>}
  </section>;
}
export function MarketIdentityFields({review,name}) {
  return <fieldset style={{...controls,flexBasis:'100%',minWidth:0}}>
          <legend>Review saved identity</legend><p style={{flexBasis:'100%'}}>{name} · {review.identity.category||'Unknown category'}</p>
          {review.conflicts.length>0&&<p style={{flexBasis:'100%'}}>Saved disagreements: {review.conflicts.join(', ')}</p>}
          {review.originalProposals.length>0&&<ul style={{flexBasis:'100%'}}>
           {review.originalProposals.map(row=><li key={row.field}>{row.field}: saved proposal {row.proposed} · current identity {row.chosen}</li>)}
          </ul>}
          {review.missing.length>0&&<p style={{flexBasis:'100%'}}>Missing fields: {review.missing.map(key=>scanSalesFields[key]||'Subjects').join(', ')}</p>}
          <label style={fields}>Subjects, one per line<textarea name="subjects" rows={3} maxLength={324}
            defaultValue={review.identity.subjects.join('\n')} required/></label>
          {Object.entries(scanSalesFields).filter(([key])=>key!=='photoPose').map(([key,label])=>
            <label key={key} style={fields}>{label}<input
              name={key} defaultValue={review.identity[key]||''} maxLength={key==='number'?40:80}
              required={['year','set','number'].includes(key)}/></label>)}
          <label style={fields}>Photo pose<select name="photoPose" defaultValue={review.identity.photoPose||''}>
            <option value="">Unknown</option><option value="pitching">Pitching</option><option value="batting">Batting</option>
          </select></label>
          <p style={{flexBasis:'100%'}}>Use holo, non-holo, or reverse-holo for finish, and yes or no for autograph and relic. Leave unknown fields empty.</p>
          <label style={{flexBasis:'100%'}}><input type="checkbox" name="confirmed"/>
            I reviewed this identity for comparison. My confirmation does not verify the catalog identity or physical printing.</label>
        </fieldset>;
}

export function MarketEvidenceStyles() {
  return     <style jsx global>{`
      .market-section { margin-block:1.5rem; border-top:1px solid #dfd8ca; }
      .market-section > ul { list-style:none; padding:0; }
      .market-section p { margin:.35rem 0; }
      .market-section summary,.market-section a { display:list-item; min-height:44px; padding-block:10px; box-sizing:border-box; }
      .market-section a { display:inline-block; }
      .market-counts { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,100px),1fr)); gap:.5rem; }
      .market-counts div { display:flex; flex-direction:column-reverse; padding:.45rem .6rem; border-radius:.45rem; background:#f3eee5; }
      .market-counts dt,.market-muted { font-size:.875rem; color:#534a3e; }
      .market-counts dd { margin:0; font-size:1.25rem; font-weight:700; }
      .market-status { display:flex; flex-wrap:wrap; gap:.25rem .6rem; }
      .market-conflicts { color:#842820; }
      .market-dashboard .market-dashboard-panel { margin:.65rem 0; border:1px solid #d9c6a7; border-radius:.65rem; background:#fffdf8; }
      .market-dashboard .market-dashboard-panel > summary { min-height:44px; padding:.7rem .8rem; cursor:pointer; overflow-wrap:anywhere; }
      .market-dashboard .market-dashboard-panel > summary small { display:block; margin:.25rem 0 0 1rem; color:#534a3e; }
      .market-dashboard .market-dashboard-body { padding:.25rem .8rem .8rem; min-width:0; overflow-wrap:anywhere; }
      .market-dashboard .market-dashboard-body button { min-height:44px; }
      .market-dashboard input,.market-dashboard select,.market-dashboard textarea { font-size:1rem; width:100%; min-width:0; }
      .market-dashboard input[type=checkbox] { width:auto; }
      .market-dashboard .market-section { margin-block:.75rem; }
    `}</style>;
}
