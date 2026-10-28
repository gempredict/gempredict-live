// Request/response adapter only. No default network transport: an owner-approved
// free-trial transport must be supplied explicitly. Never falls back to paid x402.
export function specialistReadiness({key,photoSharingConsent=false,freeTrial,now=Date.now()}={}) {
 const blockers=[];
 if(!key)blockers.push('specialist_credential_unavailable');
 if(photoSharingConsent!==true)blockers.push('specialist_photo_sharing_not_authorized');
 if(freeTrial?.verified!==true||freeTrial?.purchasedCreditsPresent!==false||!Number.isInteger(freeTrial?.remaining)||freeTrial.remaining<1||freeTrial.remaining>25||!Number.isFinite(Date.parse(freeTrial?.observedAt))||now-Date.parse(freeTrial.observedAt)>300000||now<Date.parse(freeTrial.observedAt))blockers.push('unverified_or_expired_free_trial_balance');
 return {status:blockers.length?'BLOCKED':'READY_FOR_EXPLICIT_FREE_EVALUATION',blockers};
}
export function normalizeSpecialist(body) {
 const data=body?.data;
 if(!data||!['matched','ambiguous','retake','not_found','unsupported'].includes(data.status)||!Array.isArray(data.candidates))throw Error('invalid_specialist_response');
 const text=v=>typeof v==='string'?v.slice(0,160):null;
 return {source:'tcgapi.dev',providerStatus:data.status,independentlyVerified:false,productionTrustGranted:false,
  candidates:data.candidates.slice(0,10).map(c=>({id:c.card_id,name:text(c.name),cardNumber:text(c.number),rarity:text(c.rarity),set:text(c.set?.name),printings:Array.isArray(c.printings)?c.printings.filter(v=>typeof v==='string').slice(0,10):[],suggestedPrinting:text(c.suggested_printing)}))};
}
export async function evaluateSpecialist({image,key,photoSharingConsent,freeTrial,transport,now}={}) {
 const readiness=specialistReadiness({key,photoSharingConsent,freeTrial,now});
 if(readiness.status==='BLOCKED')return readiness;
 if(typeof transport!=='function')return {status:'BLOCKED',blockers:['approved_zero_cost_transport_unavailable']};
 if(!Buffer.isBuffer(image)||!image.length||image.length>8*1024*1024)throw Error('invalid_specialist_image');
 // No include=prices, paid fallback, retries or automatic account creation.
 const response=await transport({url:'https://api.tcgapi.dev/v1/identify',method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json'},body:JSON.stringify({image:image.toString('base64')}),timeoutMs:15000,redirect:'error'});
 return normalizeSpecialist(response);
}
