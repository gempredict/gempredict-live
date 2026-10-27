import test from 'node:test';import assert from 'node:assert/strict';
import {safeEbayListingUrl,deduplicateBrowseListings} from '../lib/ebayListingProvenance.mjs';
import {predictionPricingReceipt} from '../lib/pricingDiagnostics.mjs';
const listing={itemId:'v1|123456789012|0',itemWebUrl:'https://www.ebay.com/itm/Card/123456789012?tracking=private',title:'Card',price:{value:'10',currency:'USD'}};
test('source URLs require HTTPS, eBay host and the exact original listing ID',()=>{
 assert.equal(safeEbayListingUrl(listing),'https://www.ebay.com/itm/123456789012');
 for(const url of ['javascript:alert(1)','https://ebay.com.attacker.invalid/itm/123456789012','https://www.ebay.com/itm/123456789099','http://www.ebay.com/itm/123456789012','https://private@www.ebay.com/itm/123456789012','https://www.ebay.com/itm/123456789012/redirect','https://www.ebay.com:444/itm/123456789012'])assert.equal(safeEbayListingUrl({...listing,itemWebUrl:url}),null);
});
test('variation IDs and tracking links do not inflate source counts; contradictory copies quarantine both',()=>{
 const r=deduplicateBrowseListings([listing,{...listing,itemId:'v1|123456789012|1'}]);assert.equal(r.items.length,1);assert.equal(r.duplicateCount,1);
 const bad=deduplicateBrowseListings([listing,{...listing,price:{value:'99',currency:'USD'}}]);assert.equal(bad.items.length,0);assert.equal(bad.conflictingDuplicateCount,2);
 const distinct=deduplicateBrowseListings([listing,{...listing,itemId:'v1|123456789013|0',itemWebUrl:'https://www.ebay.com/itm/123456789013'}]);assert.equal(distinct.items.length,2);
});
test('evidence fingerprints separate model input changes from market changes without logging either',()=>{
 const base={canonicalCard:{},prediction:{rawValue:10,psa9Value:75,psa10Value:180,psa10Probability:30},marketData:{rawComparableItems:[listing]}};
 const receipt=value=>predictionPricingReceipt(value,{privatePreview:true,codeRevision:'342df370fd7af9323b0624c8d7f7363e2f77ce17'}).financialEvidence.evidenceVersions;
 const a=receipt(base),b=receipt({...base,prediction:{...base.prediction,psa10Probability:31}});
 assert.equal(a.market,b.market);assert.notEqual(a.financialInputs,b.financialInputs);assert.equal(a.modelConfiguration,b.modelConfiguration);
 assert.doesNotMatch(JSON.stringify(a),/private|123456789012|tracking|Card/);
 assert.equal(receipt(base).codeRevision,'342df370fd7af9323b0624c8d7f7363e2f77ce17');
});
