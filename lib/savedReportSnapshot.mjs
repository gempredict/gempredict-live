import { reportListings } from './reportListings.mjs';

export const SAVED_REPORT_SCHEMA_VERSION = 1;
export const SAVED_REPORT_MODELS = new Set(['gemini-4-carbon', 'claude-sonnet-4-6']);
const reportFields = [
  'success', 'scanNotices', 'identityV2', 'graderScenariosV2', 'sportsIdentityAudit',
  'originalIdentityObservation', 'sportsIdentityEvidence', 'prediction',
  'imageAnalysis', 'canonicalCard', 'identityEvidence', 'identityVerification',
  'originalCanonicalCard', 'userIdentityConflicts', 'variantVerification', 'artworkStatus',
  'physicalPrintingStatus', 'identityEvidenceItems', 'identityEvidenceExclusions',
  'catalogCrossCheck', 'soldIdentityGate', 'financialDecision', 'valuationVerification',
  'catalogComparison', 'coreCatalogIdentity', 'pokemonIdentityStatus', 'rarityVerification',
  'photoIdentityStatus', 'sourceCatalogEvidence', 'valuationIdentityGate', 'hasImageAnalysis',
];
const omitKey = /^(?:secret|token|rawProviderResponse|rawModel|debug|__proto__|constructor|prototype|authorization|cookie|headers|ticket|raw|photos?|photoBytes|frontImage|backImage|image|imageUrl|preparedSha256|request|apiKey|email|ownerKey|signingKey|providerResponse|rawResponse|diagnostics|credential|accessToken|refreshToken|identityReviewToken|emailSaved|conditionValidation)$/i;
const privateText = /(?:\b(?:AIza[\w-]{30,}|sk-[\w-]{16,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:data|blob):[^\s]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i;

function snapshotValue(value, depth = 0) {
  if (depth > 16) throw Error('saved_report_depth');
  if (typeof value === 'string') return privateText.test(value) ? undefined : value;
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (Array.isArray(value)) return value.map(item => snapshotValue(item, depth + 1)).filter(item => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype && Object.getPrototypeOf(prototype) !== null) return undefined;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (omitKey.test(key)) return [];
    const saved = snapshotValue(item, depth + 1);
    return saved === undefined ? [] : [[key, saved]];
  }));
}

export function createSavedSnapshot(report) {
  if (report?.success !== true || report.stage === 'identity' || !report.imageAnalysis ||
      !report.prediction || !report.financialDecision) return null;
  const safe = snapshotValue(Object.fromEntries(reportFields.map(key => [key, report[key]])));
  const listings = reportListings(report);
  const payload = {
    ...safe, ...safe.prediction,
    marketData: report.marketData ? {
      success: report.marketData.success === true,
      count: Number.isSafeInteger(report.marketData.count) ? report.marketData.count : null,
    } : null,
    savedListingView: snapshotValue(listings),
  };
  // The report renderer consumes the flattened form. Strip the old duplicate object.
  delete payload.prediction;
  if (Buffer.byteLength(JSON.stringify(payload)) > 240000) throw Error('saved_report_bytes');
  return payload;
}

export function readSavedSnapshot(row) {
  const payload = row?.payload;
  if (row?.schema_version !== SAVED_REPORT_SCHEMA_VERSION || payload?.success !== true ||
      !payload.imageAnalysis || !payload.financialDecision ||
      !Array.isArray(payload.savedListingView?.candidates) || !Array.isArray(payload.savedListingView?.qualified)) return null;
  return payload;
}
