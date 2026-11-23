export function providerFinalPrice(row) {
  return row.listingType && row.amountReportedConfirmed && Number.isFinite(row.price) &&
    row.price >= 0 && row.currency ? row.price : null;
}

export function summarizeRecentSales({candidates,rejected}) {
  const rows=[...candidates,...rejected];
  const knownFinalPrices=rows.filter(row=>providerFinalPrice(row)!==null).length;
  return {
    recordsRetrieved:rows.length,
    plausibleMatches:candidates.filter(row=>['plausible_unverified','exact_listing_evidence'].includes(row.identityMatch?.status)).length,
    identityMismatches:rows.filter(row=>row.identityMatch?.status==='mismatch').length,
    knownFinalPrices, unknownFinalPrices:rows.length-knownFinalPrices,
    qualificationBlockers:[...new Set(rows.flatMap(row=>row.qualificationReasons||[]))],
  };
}
