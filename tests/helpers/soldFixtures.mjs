// SYNTHETIC ONLY. These are not marketplace observations, live prices, real
// commercial rights or a deployed supplier. Never import this module at runtime.
export function syntheticSales(card, { raw=40, psa9=120, psa10=200, count=3, date='2026-10-20T12:00:00Z' } = {}) {
  const records=[];
  for (const [group,amount] of [['Raw',raw],['PSA 9',psa9],['PSA 10',psa10]]) for(let i=0;i<count;i++) {
    const id=`synthetic-${group.replace(' ','-')}-${i}`;
    records.push({ evidenceType:'verified_completed_auction', transactionStatus:'completed', amountBasis:'actual_transaction', amount, currency:'USD', soldAt:date, identity: structuredClone(card),
      grading: group==='Raw' ? {status:'raw',company:null,grade:null} : {status:'graded',company:'PSA',grade:group.split(' ')[1]},
      title:[card.year,card.brandSet,card.subject,card.cardNumber,card.parallel,card.language === 'en' ? 'English' : card.language,group==='Raw' ? '' : group].filter(Boolean).join(' '), condition:group==='Raw'?'Ungraded':'Graded',
      provenance:{providerId:'synthetic-test-supplier',rightsReference:'synthetic-test-license-not-real',marketplace:'ebay',sourceItemId:id,transactionId:id,observedAt:date,delivery:'licensed_api'} });
  }
  return {status:'available',providerId:'synthetic-test-supplier',rights:{reference:'synthetic-test-license-not-real',commercialDisplay:true,transactionRecords:true},records};
}
export const syntheticProbability = card => ({kind:'calibrated_model',status:'validated',reference:'synthetic-calibration-not-a-live-model',observedAt:'2026-10-20T12:00:00Z',identity:structuredClone(card),valuePercent:30,lowerPercent:25,upperPercent:35});
