// Fixed user-facing classifications only. Never echo provider exceptions.
const failures={
 UPLOAD_PROCESSING_FAILED:[400,'upload_processing','The server could not process the upload. Use valid prepared front/back photos within the upload limits.'],
 ANALYSIS_PROVIDER_UNAVAILABLE:[503,'analysis_provider','The photo-analysis provider is unavailable or not configured. Your photos uploaded; no valuation was generated.'],
 ANALYSIS_PROVIDER_AUTH_FAILED:[503,'analysis_provider','The photo-analysis service could not authenticate with its provider. This is a service configuration issue, not a photo upload failure.'],
 ANALYSIS_PROVIDER_RATE_LIMITED:[503,'analysis_provider','The photo-analysis provider is temporarily rate limited. Your photos uploaded, but analysis could not finish.'],
 ANALYSIS_PROVIDER_TIMEOUT:[504,'analysis_provider','The photo-analysis provider did not respond in time. Your photos uploaded, but analysis could not finish.'],
 ANALYSIS_PROVIDER_FAILED:[502,'analysis_provider','The photo-analysis provider request failed. Your photos uploaded; no usable analysis or valuation was generated.'],
 ANALYSIS_PROVIDER_REQUEST_REJECTED:[503,'analysis_provider','The provider rejected the structured identification request. This is a service request issue; no identity was accepted.'],
 ANALYSIS_PROVIDER_REFUSED:[422,'analysis_provider','The identification provider declined this request. No identity or financial recommendation was accepted.'],
 ANALYSIS_TRANSPORT_INVALID:[502,'analysis_provider','The provider returned an invalid transport response. This is not an upload failure. No identity was accepted.'],
 ANALYSIS_RESPONSE_INCOMPLETE:[502,'analysis_provider','The analysis response reached its output limit before a complete result was available. This is not an upload failure. No valuation was generated.'],
 ANALYSIS_EMPTY_RESPONSE:[502,'analysis_provider','The analysis provider returned no usable text. Your photos uploaded; no valuation was generated.'],
 ANALYSIS_RESPONSE_INVALID:[502,'analysis_provider','The analysis provider returned an unreadable result. Your photos uploaded; no valuation was generated.'],
 ANALYSIS_NORMALIZATION_FAILED:[502,'verification_runtime','The analysis result could not be validated or normalized. No identity or valuation was accepted.'],
 VERIFICATION_RUNTIME_FAILED:[503,'verification_runtime','Analysis completed, but identity verification could not finish because of a runtime failure. Financial recommendations remain withheld.'],
 UNEXPECTED_SCAN_ERROR:[500,'internal','An unexpected internal error prevented the report from completing. No financial recommendation was generated.'],
 MARKETPLACE_UNAVAILABLE:[200,'marketplace_valuation','Marketplace discovery is unavailable. Photo observations remain available; valuation and grading recommendations are withheld.'],
 VERIFICATION_UNRESOLVED:[200,'verification_runtime','Independent identity or runtime verification remains unresolved. Review the separate verification statuses; financial recommendations are withheld.'],
};
export function scanFailure(code){
 const key=Object.hasOwn(failures,code)?code:'UNEXPECTED_SCAN_ERROR';const [status,category,error]=failures[key];return {status,payload:{error,code:key,failureCategory:category}};
}
export function providerFailure(error){
 if(['ANALYSIS_PROVIDER_REQUEST_REJECTED','ANALYSIS_PROVIDER_REFUSED','ANALYSIS_TRANSPORT_INVALID','ANALYSIS_RESPONSE_INCOMPLETE','ANALYSIS_EMPTY_RESPONSE','ANALYSIS_RESPONSE_INVALID','ANALYSIS_NORMALIZATION_FAILED'].includes(error?.message))return scanFailure(error.message);
 if(error?.message==='NO_API_KEY')return scanFailure('ANALYSIS_PROVIDER_UNAVAILABLE');
 if([401,403].includes(error?.status))return scanFailure('ANALYSIS_PROVIDER_AUTH_FAILED');
 if(error?.status===429)return scanFailure('ANALYSIS_PROVIDER_RATE_LIMITED');
 if([408,504].includes(error?.status)||['APIConnectionTimeoutError','AbortError','TimeoutError'].includes(error?.name))return scanFailure('ANALYSIS_PROVIDER_TIMEOUT');
 return scanFailure('ANALYSIS_PROVIDER_FAILED');
}
export const safeScanFailure=payload=>Object.hasOwn(failures,payload?.code)?scanFailure(payload.code).payload:null;
