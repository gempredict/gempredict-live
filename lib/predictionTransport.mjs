import {identityValidationMessage} from './identityValidation.mjs';
import {safeScanFailure} from './scanFailures.mjs';
const failedResponses=new WeakMap();
export const predictionFailureResponse=error=>error&&failedResponses.get(error)||null;
import { UploadError } from './mobileImages.mjs';
export async function requestPrediction(options, fetchImpl = globalThis.fetch) {
  let response;
  try { response = await fetchImpl('/api/predict', { ...options, credentials: 'same-origin', redirect: 'manual' }); }
  catch { throw new UploadError('network', 'Connection failed before a response was received. Check your connection and try again.'); }
  if (response.type === 'opaqueredirect' || response.status === 0 || response.status >= 300 && response.status < 400 || [401, 403].includes(response.status)) {
    throw new UploadError('authentication', 'Preview authentication is required or has expired. Sign in to this Preview again, then retry.');
  }
  if (response.status === 413) throw new UploadError('http', 'The server rejected the upload as too large. Choose smaller photos.');
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw new UploadError(response.status>=500?'internal':'response_format',response.status>=500?`The Preview server could not complete the scan (HTTP ${response.status}). No financial recommendation was generated.`:`The server returned a non-JSON response (HTTP ${response.status}). Check Preview sign-in and try again.`);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new UploadError('response_format', `The server returned unreadable JSON (HTTP ${response.status}). Please try again.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new UploadError('response_format', 'The server returned an invalid prediction response.');
  if (!response.ok && response.status !== 429) {
    const failure=safeScanFailure(data);
    const error=new UploadError(failure?.failureCategory||'http',failure?.error||(typeof data.error==='string'?data.error:`Prediction failed (HTTP ${response.status}). Please try again.`));
    if(failure){error.scanCode=failure.code;const detail=identityValidationMessage(data.identityValidation);if(detail)error.message=detail;}
    failedResponses.set(error,response);throw error;
  }
  return { response, data };
}
