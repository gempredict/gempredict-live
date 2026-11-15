import {publishedFeeInput,feeComparison} from './gradingFeeReference.mjs';
// Manual arithmetic only. Never reads card reports, market listings or model output.
export const GRADING_PROVIDERS=Object.freeze(['PSA','BGS','CGC','SGC','TAG']);
export const SCENARIO_CURRENCIES=Object.freeze(['USD','EUR','GBP','CAD','AUD']); // Two-decimal units only; no FX conversion.
export const SHARED_EXPENSES=Object.freeze(['outboundShipping','returnShipping','insurance','handling']);
export const EXTRA_COSTS=Object.freeze(['declaredValueSurcharge',...SHARED_EXPENSES,'sellingFixedFee','otherSellingExpenses']);
export const MAX_CENTS=9999999999;
const value=x=>x&&typeof x==='object'?x.value:x;
export const displayScenarioInput=x=>value(x)??'';
function provenance(x){return x&&typeof x==='object'?x.basis||'user_supplied':'user_supplied';}
// Exact decimal parsing; missing is never silently zero. Schedules need a future
// independently reviewed adapter: client labels cannot mint verified cost data.
function decimal(x,percent=false){
 const v=value(x);if(v==null||v==='')return {status:'missing',amount:null};
 if(!['user_supplied','assumed'].includes(provenance(x)))return {status:'unsupported_provenance',amount:null};
 const text=String(v).trim();if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(text))return {status:'invalid',amount:null};
 const [whole,fraction='']=text.split('.'),amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(amount)||amount>(percent?10000:MAX_CENTS))return {status:'out_of_range',amount:null};
 return {status:'provided',amount,basis:provenance(x)};
}
export function allocateBatchCents(cents,count,index){
 if(!Number.isSafeInteger(cents)||cents<0||!Number.isInteger(count)||count<1||count>10000||!Number.isInteger(index)||index<1||index>count)throw Error('invalid_shipping_allocation');
 return Math.floor(cents/count)+(index<=cents%count?1:0);
}
const roundSellingFee=(gross,bps)=>Number((BigInt(gross)*BigInt(bps)+5000n)/10000n);
function netAt(gross,bps,fixed,other){return gross-roundSellingFee(gross,bps)-fixed-other;}
// Find the lowest whole-cent price using the SAME rounded sale-fee arithmetic,
// avoiding algebraic rounding errors and impossible 100% retained-fee cases.
function breakEven(target,bps,fixed,other){
 if(target==null||bps==null||fixed==null||other==null)return null;
 if(netAt(0,bps,fixed,other)>=target)return 0;
 if(netAt(MAX_CENTS,bps,fixed,other)<target)return null;
 let low=0,high=MAX_CENTS;while(low<high){const mid=Math.floor((low+high)/2);if(netAt(mid,bps,fixed,other)>=target)high=mid;else low=mid+1;}return low;
}
export function calculateGradingScenario(common={},scenario={},now=new Date()){
 const issues=[],inputs={};
 const read=(key,x,p=false)=>{const verified=key==='gradingFee'&&x?.basis==='published_reference'?publishedFeeInput(common,scenario,now):null;
  const matches=verified&&x.referenceId===verified.referenceId&&x.revision===verified.revision&&x.value===verified.value;
  const r=matches?{...decimal({value:x.value,basis:'user_supplied'},p),basis:'published_reference',referenceId:verified.referenceId,checkedOn:verified.checkedOn,revision:verified.revision}:decimal(x,p);inputs[key]=r;if(r.status!=='provided')issues.push({field:key,reason:r.status});return r.amount;};
 const acquisition=read('acquisitionCost',common.acquisitionCost),rawPrice=read('rawSalePrice',common.rawSalePrice),rawBps=read('rawSellingPercent',common.rawSellingPercent,true),rawFixed=read('rawSellingFixedFee',common.rawSellingFixedFee),rawOther=read('rawOtherSellingExpenses',common.rawOtherSellingExpenses);
 const rawNet=[rawPrice,rawBps,rawFixed,rawOther].every(x=>x!=null)?netAt(rawPrice,rawBps,rawFixed,rawOther):null;
 const costs=scenario.costs||{},fee=read('gradingFee',costs.gradingFee),surcharge=read('declaredValueSurcharge',costs.declaredValueSurcharge);
 const count=Number(scenario.batchCount),index=Number(scenario.cardIndex),allocationValid=/^[1-9]\d*$/.test(String(scenario.batchCount??''))&&/^[1-9]\d*$/.test(String(scenario.cardIndex??''))&&Number.isInteger(count)&&count<=10000&&index>=1&&index<=count;
 if(!allocationValid)issues.push({field:'allocation',reason:'positive_integer_count_and_index_required'});
 const allocation={};for(const key of SHARED_EXPENSES){const total=read(key,costs[key]);allocation[key]=total!=null&&allocationValid?allocateBatchCents(total,count,index):null;}
 const gradeCosts=[fee,surcharge,...Object.values(allocation)];const gradingInvestment=gradeCosts.every(x=>x!=null)?gradeCosts.reduce((a,b)=>a+b,0):null;
 const sale=read('gradedSalePrice',scenario.gradedSalePrice),bps=read('sellingPercent',costs.sellingPercent,true),fixed=read('sellingFixedFee',costs.sellingFixedFee),other=read('otherSellingExpenses',costs.otherSellingExpenses);
 const saleInputs=[sale,bps,fixed,other].every(x=>x!=null),netSale=saleInputs?netAt(sale,bps,fixed,other):null;
 const upfrontInvestment=acquisition!=null&&gradingInvestment!=null?acquisition+gradingInvestment:null;
 const profit=netSale!=null&&upfrontInvestment!=null?netSale-upfrontInvestment:null;
 const incremental=netSale!=null&&gradingInvestment!=null&&rawNet!=null?netSale-gradingInvestment-rawNet:null;
 const lifetimeBreakEven=breakEven(upfrontInvestment,bps,fixed,other),incrementalBreakEven=breakEven(gradingInvestment!=null&&rawNet!=null?gradingInvestment+rawNet:null,bps,fixed,other);
 const sellingExpenses=saleInputs?roundSellingFee(sale,bps)+fixed+other:null;
 const totalInvestment=upfrontInvestment!=null&&sellingExpenses!=null?upfrontInvestment+sellingExpenses:null;
 const currency=SCENARIO_CURRENCIES.includes(common.currency)?common.currency:null,provider=GRADING_PROVIDERS.includes(scenario.provider)?scenario.provider:null;
 if(!currency)issues.push({field:'currency',reason:'unsupported_currency'});if(!provider)issues.push({field:'provider',reason:'unsupported_provider'});
 if(scenario.turnaroundDays!=null&&scenario.turnaroundDays!==''&&!/^\d{1,4}$/.test(String(scenario.turnaroundDays)))issues.push({field:'turnaroundDays',reason:'non_negative_integer_days_required'});
 const validContext=!!currency&&!!provider;
 const output={kind:'manual_hypothetical_grading_scenario',provider,currency,serviceTier:typeof scenario.serviceTier==='string'?scenario.serviceTier.slice(0,80):null,hypotheticalGrade:typeof scenario.grade==='string'?scenario.grade.slice(0,30):null,turnaroundDays:scenario.turnaroundDays===''||scenario.turnaroundDays==null?null:/^\d{1,4}$/.test(String(scenario.turnaroundDays))?Number(scenario.turnaroundDays):null,
  status:issues.length?'incomplete':'calculated',issues,inputs,feeReference:feeComparison(common,scenario,now),allocationCents:allocation,gradingInvestmentCents:gradingInvestment,upfrontInvestmentCents:upfrontInvestment,totalInvestmentCents:totalInvestment,netSaleProceedsCents:netSale,sellingPercentageFeeCents:saleInputs?roundSellingFee(sale,bps):null,rawAlternativeNetCents:rawNet,profitCents:profit,roiPercent:totalInvestment>0&&profit!=null?profit/totalInvestment*100:null,breakEvenSalePriceCents:lifetimeBreakEven,incrementalBenefitCents:incremental,incrementalBreakEvenSalePriceCents:incrementalBreakEven,
  roiBasis:'all_in_cost_including_selling_expenses',roiUnavailableReason:totalInvestment===0?'zero_investment':profit==null||totalInvestment==null?'missing_inputs':null,breakEvenUnavailableReason:lifetimeBreakEven!=null?null:upfrontInvestment==null||bps==null||fixed==null||other==null?'missing_inputs':bps===10000?'selling_fee_retains_no_proceeds':'exceeds_supported_price_range',
  expectedValue:null,expectedValueReason:'Grade probabilities are not supported here; no expected value is computed.',verifiedMarketValue:false,recommendation:null};
 if(!validContext)for(const key of Object.keys(output))if(key.endsWith('Cents')||key==='roiPercent')output[key]=null;
 return output;
}
export function syntheticScenarioExample(){
 const assumed=value=>({value:String(value),basis:'assumed'});
 const common={currency:'USD',acquisitionCost:assumed(100),rawSalePrice:assumed(120),rawSellingPercent:assumed(10),rawSellingFixedFee:assumed(1),rawOtherSellingExpenses:assumed(4)};
 const scenarios=GRADING_PROVIDERS.map(provider=>({provider,serviceTier:'Illustrative tier — not a real fee schedule',grade:'10 (hypothetical)',batchCount:'3',cardIndex:'1',turnaroundDays:'',gradedSalePrice:assumed(250),costs:Object.fromEntries(Object.entries({gradingFee:25,declaredValueSurcharge:0,outboundShipping:9,returnShipping:12,insurance:3,handling:6,sellingPercent:10,sellingFixedFee:1,otherSellingExpenses:4}).map(([k,v])=>[k,assumed(v)]))}));
 return {common,scenarios};
}
