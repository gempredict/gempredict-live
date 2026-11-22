import { isCollectorReading } from './collectorReading.mjs';
import { compactRegions as regions, readCompactPhotoObservations } from './compactPhotoObservations.mjs';
import { safeGeminiRejection } from './geminiRejection.mjs';
import { inspectGeminiPricing } from './geminiPricing.mjs';
import { ApiError, GoogleGenAI, createPartFromBase64 } from '@google/genai';
import sharp from 'sharp';
import { readIdentityReadings } from './visionIdentityEvidence.mjs';

export const GEMINI_MODEL = 'gemini-4-carbon';
export const GEMINI_MAX_OUTPUT = 4096;
export const GEMINI_TIMEOUT_MS = 45000;
const LIMITATIONS = ['blur', 'cropped', 'occluded', 'glare', 'sleeve', 'limited_resolution', 'perspective'];
const string = { type: 'string' };
const array = (items, maxItems) => ({ type: 'array', items, maxItems });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false,
});
const identityFields = [
  'identifiedSubject', 'identifiedManufacturer', 'identifiedSport', 'identifiedFranchise',
  'identifiedBrandSet', 'identifiedYear', 'identifiedCardNumber', 'identifiedLanguage',
  'identifiedRarity', 'identifiedTeam', 'identifiedSerialNumber', 'identifiedParallel',
  'subset', 'printedTitle', 'autographType', 'foilTreatment', 'identityNotes',
];
// Keep the wire schema compact. The byte envelope bounds these strings before
// local field-specific validation classifies any invalid length.
const identityText = { ...string, maxLength: 32768 };
const identityTextLimits = {
  identifiedYear: 4,
  identifiedCardNumber: 40,
  identifiedSerialNumber: 13,
  identityNotes: 240,
};
const maxIdentityLabel = 80;
const maxCombinedIdentityNotes = 400;
const maxSurfaceRows = 4;
const schemaFor = sides => object({
  identity: object({
    facts: array(object({ field: string, value: identityText }), identityFields.length),
    subjects: array(identityText, 4),
    alternatives: array(identityText, 3),
    readings: array(object({ field: string, text: identityText, certainty: string, side: string, area: string }), 12),
  }, []),
  photos: array(object({ side: string, status: string, limitations: array(string, LIMITATIONS.length) },
    ['side', 'status']), sides.length),
  observations: array(object({ side: string, region: string, status: string, evidence: string, location: string },
    ['side', 'region', 'status', 'evidence']), sides.length * (Object.keys(regions).length + maxSurfaceRows)),
});

// Keep repetition limits in the local validator. Avoid expanding the provider
// grammar for counts that are also enforced after parsing.
function providerSchema({ maxItems, maxLength, items, properties, ...schema }) {
  if (items) return { ...schema, items: providerSchema(items) };
  if (properties) return { ...schema, properties: Object.fromEntries(
    Object.entries(properties).map(([key, child]) => [key, providerSchema(child)])) };
  return schema;
}

const prompt = `Identify the trading card and describe the supplied photos. Put known values in identity.facts as field/value pairs and omit unknown values. Allowed fields: ${identityFields.join(', ')}. Name every subject in identity.subjects. Keep the collector number separate from a serial stamp and observed foilTreatment separate from the proposed official identifiedParallel. Distinguish sticker from on-card autograph and paper from Chrome only when supported. Use identityNotes and alternatives for uncertainty. Keep identityNotes at most 240 characters, with notes and alternatives together under 400 characters. Names, parallels, other identity labels, and each alternative are at most 80 characters. Use at most 4 characters for the release year, 40 for the collector number, and 13 for the serial number. Do not imply external catalog verification.
Use identity.readings only for literal visible text, with at most 80 characters per reading. Each reading names the front or back side, its field (subject, cardNumber, setCode, language, rarityMark, copyrightYear, serialNumber, subset, printedTitle, or foilMark), its certainty (clear, uncertain, unreadable), and its area (name, collector_line, set_mark, rarity_mark, body_text).
Return one photos row per supplied side (front or back), with status expected, mismatch, or uncertain and any limitations (blur, cropped, occluded, glare, sleeve, limited_resolution, perspective). Do not attribute readings or wear to a mismatched or uncertain side.
For each expected side return one observations row for each region: ${Object.keys(regions).join(', ')}. Add up to four surface rows for each side where useful, with region surface and a short location. Use status apparent, possible, or not_assessable. Keep observation evidence under 100 characters. Separate wear from artwork, printing, foil, glare and holder marks. Qualified no-obvious-wear observations are allowed. No grading, probabilities, prices, recommendations, coordinates or numeric defect confidence.`;

function valid(schema, value) {
  if (schema.type === 'array') return Array.isArray(value) && value.length <= schema.maxItems &&
    value.every(item => valid(schema.items, item));
  if (schema.type === 'object') return value && typeof value === 'object' && !Array.isArray(value) &&
    (schema.required || []).every(key => Object.hasOwn(value, key)) &&
    Object.entries(value).every(([key, child]) => Object.hasOwn(schema.properties, key) && valid(schema.properties[key], child));
  return typeof value === 'string' && value.trim().length > 0 && value.length <= (schema.maxLength ?? 100);
}

const validationRules = new Set([
  'content_parts', 'response_byte_limit', 'json_syntax', 'root_schema', 'identity_schema',
  'photos_schema', 'observations_schema', 'identity_facts', 'identity_identifier_length', 'identity_subject_length',
  'identity_alternative_length', 'identity_note_length', 'identity_reading_length',
  'reading_side', 'sports_collector_number', 'identity_reading', 'photo_side_coverage',
  'observation_side', 'observation_status', 'observation_region_or_location',
  'photo_status_or_limitations', 'uncertain_side_has_evidence', 'regional_coverage',
  'duplicate_region', 'surface_row_limit',
]);
export function safeGeminiValidationRule(rule) {
  return validationRules.has(rule) ? rule : null;
}
function invalidResponse(rule) {
  const error = Error('ANALYSIS_RESPONSE_INVALID');
  error.geminiValidationRule = rule;
  throw error;
}

export function parseGeminiAnalysis(response, sides, cardType, lowResolution = []) {
  const candidate = response?.candidates?.[0];
  if (response?.candidates?.length !== 1 || candidate?.finishReason !== 'STOP') {
    throw Error(candidate?.finishReason === 'SAFETY' || response?.promptFeedback?.blockReason
      ? 'ANALYSIS_PROVIDER_REFUSED' : 'ANALYSIS_RESPONSE_INCOMPLETE');
  }
  const contentParts = candidate.content?.parts;
  if (contentParts != null && !Array.isArray(contentParts)) invalidResponse('content_parts');
  const parts = contentParts?.filter(part => part?.thought !== true);
  if (!parts?.length) throw Error('ANALYSIS_EMPTY_RESPONSE');
  if (parts.some(part => typeof part?.text !== 'string')) invalidResponse('content_parts');
  const text = parts.map(part => part.text).join('');
  if (Buffer.byteLength(text) > 32768) invalidResponse('response_byte_limit');
  let payload;
  try { payload = JSON.parse(text); } catch { invalidResponse('json_syntax'); }
  const schema = schemaFor(sides);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).length !== schema.required.length ||
      !schema.required.every(key => Object.hasOwn(payload, key))) invalidResponse('root_schema');
  for (const key of schema.required) {
    if (!valid(schema.properties[key], payload[key])) invalidResponse(`${key}_schema`);
  }
  const { facts = [], readings = [], subjects = [], alternatives = [] } = payload.identity;
  const values = new Map(facts.map(({ field, value }) => [field, value]));
  if (values.size !== facts.length || facts.some(({ field }) => !identityFields.includes(field))) {
    invalidResponse('identity_facts');
  }
  const identity = Object.fromEntries(identityFields.map(key => [key, values.get(key) ?? null]));
  if (subjects.some(value => value.length > maxIdentityLabel)) invalidResponse('identity_subject_length');
  if (alternatives.some(value => value.length > maxIdentityLabel)) invalidResponse('identity_alternative_length');
  if (readings.some(row => row.text.length > maxIdentityLabel)) invalidResponse('identity_reading_length');
  for (const [field, value] of values) {
    if (value.length > (identityTextLimits[field] ?? maxIdentityLabel)) {
      invalidResponse(field === 'identityNotes' ? 'identity_note_length' :
        field === 'identifiedSubject' ? 'identity_subject_length' : 'identity_identifier_length');
    }
  }
  const identityNotes = [identity.identityNotes, alternatives.length ? `Alternatives: ${alternatives.join(', ')}.` : null]
    .filter(Boolean).join(' ');
  if (identityNotes.length > maxCombinedIdentityNotes) invalidResponse('identity_note_length');
  const identityReadings = readIdentityReadings(readings, cardType);
  if (readings.some(row => !sides.includes(row.side))) invalidResponse('reading_side');
  if (cardType === 'sports' && readings.some(row => row.field === 'cardNumber' &&
      !isCollectorReading(row.text, cardType))) invalidResponse('sports_collector_number');
  if (identityReadings.length !== readings.length) invalidResponse('identity_reading');
  const modelPhotoNotes = [];
  const compactPhotoObservations = [];
  const photoSideUncertain = [];
  const imageLimitations = new Set(lowResolution.length ? ['limited_resolution'] : []);
  function add(attribute, side, observations) {
    for (const row of observations) {
      compactPhotoObservations.push({ side, region: row.region, status: row.status, text: `${row.location}: ${row.evidence}` });
    }
    const text = observations.filter(row => row.status !== 'not_assessable' || /glare|blur|sleeve|holder|obscur|crop/i.test(row.evidence))
      .map(row => `${row.location}: ${row.status === 'possible' ? 'possible — ' : row.status === 'not_assessable' ? 'not assessable — ' : ''}${row.evidence}`).join('; ');
    if (text) modelPhotoNotes.push({ attribute, side, text });
  }
  const photos = new Map(payload.photos.map(photo => [photo.side, photo]));
  if (payload.photos.length !== sides.length || sides.some(side => !photos.has(side))) invalidResponse('photo_side_coverage');
  const observations = payload.observations;
  for (const row of observations) {
    if (!sides.includes(row.side)) invalidResponse('observation_side');
    if (!['apparent', 'possible', 'not_assessable'].includes(row.status)) invalidResponse('observation_status');
    if (row.region === 'surface' ? !row.location : !Object.hasOwn(regions, row.region) || row.location !== undefined) {
      invalidResponse('observation_region_or_location');
    }
  }
  for (const side of sides) {
    const photo = photos.get(side);
    const limitations = photo.limitations || [];
    if (!['expected', 'mismatch', 'uncertain'].includes(photo.status) ||
        limitations.some(code => !LIMITATIONS.includes(code))) invalidResponse('photo_status_or_limitations');
    limitations.forEach(code => imageLimitations.add(code));
    const rows = observations.filter(row => row.side === side);
    if (photo.status !== 'expected') {
      photoSideUncertain.push(side);
      if (rows.length || identityReadings.some(reading => reading.side === side)) invalidResponse('uncertain_side_has_evidence');
      continue;
    }
    const fixed = rows.filter(row => row.region !== 'surface');
    const surface = rows.filter(row => row.region === 'surface');
    if (new Set(fixed.map(row => row.region)).size !== fixed.length) invalidResponse('duplicate_region');
    if (fixed.length !== Object.keys(regions).length) invalidResponse('regional_coverage');
    if (surface.length > maxSurfaceRows) invalidResponse('surface_row_limit');
    for (const attribute of ['corners', 'edges', 'centering']) {
      add(attribute, side, fixed.filter(row => regions[row.region][0] === attribute)
        .map(row => ({ ...row, location: regions[row.region][1] })));
    }
    add('surface', side, surface.map(row => ({ ...row, location: `surface, ${row.location}` })));
  }
  const readingIndices = (field, value) => identityReadings.flatMap((row, index) =>
    row.field === field && row.certainty === 'clear' && row.text.toLowerCase() === value?.toLowerCase()
      ? [index] : []);
  return {
    ...identity,
    identifiedSubject: subjects.length ? subjects.join(' / ') : identity.identifiedSubject,
    identifiedAutoOrRelic: identity.autographType && /sticker|on.card|autograph/i.test(identity.autographType) ? 'auto' : null,
    identityNotes,
    identityReadings,
    visualEvidenceVersion: 4,
    modelPhotoNotes,
    compactPhotoRowsReceived: observations.length,
    compactPhotoObservations: readCompactPhotoObservations({compactPhotoObservations, photoSideUncertain}, sides),
    photoSideUncertain,
    imageLimitations: [...imageLimitations],
    ...(cardType === 'sports' ? { sportsIdentity: {
      version: 1,
      subjects: subjects.map(name => {
        const indices = readingIndices('subject', name);
        return { name, readingIndices: indices, certainty: indices.length ? 'clear' : 'uncertain' };
      }),
      subset: identity.subset,
      printedTitle: identity.printedTitle,
      serialNumber: identity.identifiedSerialNumber,
      serialReadingIndex: readingIndices('serialNumber', identity.identifiedSerialNumber)[0] ?? null,
      foilTreatment: identity.foilTreatment,
    } } : {}),
  };
}

// Reserve the full published model output limit for thinking separately until
// the relationship between maxOutputTokens and thinking is confirmed.
// Do not treat LOW as a numerical thinking cap.
const THINKING_RESERVE = 32768;
const API_ORIGIN = 'https://generativelanguage.googleapis.com';

export async function requestGeminiAnalysis({
  images, cardType, diagnostics, env = process.env, makeClient = options => new GoogleGenAI(options),
  countFetch = fetch,
}) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL !== '1' ||
      env.GEMPREDICT_GEMINI_FULL_ANALYSIS !== 'true') throw Error('GEMINI_MODEL_DISABLED');
  if (!env.VISION_BENCH_GEMINI_KEY?.trim()) throw Error('GEMINI_CREDENTIAL_MISSING');
  const { pricing: budget } = inspectGeminiPricing(env);
  if (!budget) throw Error('GEMINI_PRICING_UNVERIFIED');
  const outputReserve = THINKING_RESERVE + GEMINI_MAX_OUTPUT;
  if (outputReserve * budget.output / 1e6 >= budget.ceiling) throw Error('GEMINI_BUDGET_EXCEEDED');
  if (![1, 2].includes(images.length) || images[0].side !== 'front' ||
      (images.length === 2 && images[1].side !== 'back')) throw Error('ANALYSIS_PROVIDER_REQUEST_REJECTED');
  const sides = images.map(image => image.side);
  const lowResolution = [];
  const parts = [];
  for (const { side, buffer, mimeType } of images) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw Error('ANALYSIS_PROVIDER_REQUEST_REJECTED');
    const { width, height } = await sharp(buffer).metadata();
    if (Math.min(width, height) < 512) lowResolution.push(side);
    parts.push({ text: `Expected ${side} photo:` },
      createPartFromBase64(buffer.toString('base64'), mimeType, 'MEDIA_RESOLUTION_HIGH'));
  }
  const contents = [{ role: 'user', parts: [...parts, { text: prompt }] }];
  const generationConfig = {
    candidateCount: 1, maxOutputTokens: GEMINI_MAX_OUTPUT,
    responseMimeType: 'application/json', responseJsonSchema: providerSchema(schemaFor(sides)),
    thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
  };
  const deadline = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  let inputTokens;
  try {
    const counted = await countFetch(`${API_ORIGIN}/v1beta/models/${GEMINI_MODEL}:countTokens`, {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.VISION_BENCH_GEMINI_KEY },
      signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
      body: JSON.stringify({ generateContentRequest: { model: `models/${GEMINI_MODEL}`, contents, generationConfig } }),
    });
    if (!counted.ok) {
      if ([401, 403].includes(counted.status)) throw Error('GEMINI_COUNT_AUTH_FAILED');
      throw Error('GEMINI_INPUT_COUNT_FAILED');
    }
    inputTokens = (await counted.json()).totalTokens;
    if (!Number.isSafeInteger(inputTokens) || inputTokens < 1 || inputTokens > 1048576) throw Error('GEMINI_INPUT_COUNT_FAILED');
  } catch (cause) {
    throw Error(cause?.message === 'GEMINI_COUNT_AUTH_FAILED' ? 'GEMINI_COUNT_AUTH_FAILED' : 'GEMINI_INPUT_COUNT_FAILED');
  }
  const maximum = (inputTokens * budget.input + outputReserve * budget.output) / 1e6;
  if (!Number.isFinite(maximum) || maximum > budget.ceiling) throw Error('GEMINI_BUDGET_EXCEEDED');
  const client = makeClient({
    apiKey: env.VISION_BENCH_GEMINI_KEY, vertexai: false,
    httpOptions: {
      apiVersion: 'v1beta', baseUrl: API_ORIGIN,
      timeout: GEMINI_TIMEOUT_MS, retryOptions: { attempts: 1 },
      fetch: (url, init) => fetch(url, { ...init, redirect: 'error' }),
    },
  });
  const started = Date.now();
  diagnostics?.geminiAttempt(cardType);
  let response;
  try {
    response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { ...generationConfig, abortSignal: deadline },
    });
  } catch (cause) {
    // Never propagate the SDK error body, URL, or headers.
    const error = Error(cause?.name === 'TimeoutError' || cause?.name === 'AbortError'
      ? 'ANALYSIS_PROVIDER_TIMEOUT' : 'GEMINI_REQUEST_FAILED');
    if (cause instanceof ApiError && Number.isInteger(cause.status)) error.status = cause.status;
    diagnostics?.providerRequestFailed(error, cause instanceof ApiError ? safeGeminiRejection(cause) : null);
    throw error;
  } finally {
    diagnostics?.providerLatency(Date.now() - started);
  }
  diagnostics?.geminiUsage(response.usageMetadata, budget);
  try {
    return parseGeminiAnalysis(response, sides, cardType, lowResolution);
  } catch (error) {
    const rule = safeGeminiValidationRule(error?.geminiValidationRule);
    if (rule) diagnostics?.geminiValidation?.(rule);
    throw error;
  }
}
