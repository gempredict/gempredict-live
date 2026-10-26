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
    throw new UploadError('response_format', `The server returned a non-JSON response (HTTP ${response.status}). Check Preview sign-in and try again.`);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new UploadError('response_format', `The server returned unreadable JSON (HTTP ${response.status}). Please try again.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new UploadError('response_format', 'The server returned an invalid prediction response.');
  if (!response.ok && response.status !== 429) throw new UploadError('http', typeof data.error === 'string' ? data.error : `Prediction failed (HTTP ${response.status}). Please try again.`);
  return { response, data };
}
