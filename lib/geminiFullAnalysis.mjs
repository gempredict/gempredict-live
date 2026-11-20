import { ApiError, GoogleGenAI, createPartFromBase64 } from '@google/genai';
import sharp from 'sharp';
import { readIdentityReadings } from './visionIdentityEvidence.mjs';

export const GEMINI_MODEL = 'gemini-4-carbon';
export const GEMINI_MAX_OUTPUT = 4096;
export const GEMINI_TIMEOUT_MS = 45000;
const LIMITATIONS = ['blur', 'cropped', 'occluded', 'glare', 'sleeve', 'limited_resolution', 'perspective'];
const string = { type: 'string' };
const enumOf = (...values) => ({ ...string, enum: values });
const nullable = { type: ['string', 'null'] };
const array = (items, maxItems) => ({ type: 'array', items, maxItems });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const identityFields = [
  'identifiedSubject', 'identifiedManufacturer', 'identifiedSport', 'identifiedFranchise',
  'identifiedBrandSet', 'identifiedYear', 'identifiedCardNumber', 'identifiedLanguage',
  'identifiedRarity', 'identifiedTeam', 'identifiedSerialNumber', 'identifiedParallel',
  'subset', 'printedTitle', 'autographType', 'foilTreatment', 'identityNotes',
];
const certainty = enumOf('clear', 'uncertain', 'unreadable');
const observation = object({ status: enumOf('apparent', 'possible', 'not_assessable'), evidence: string });
const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const edges = ['top', 'bottom', 'left', 'right'];
const regions = keys => object(Object.fromEntries(keys.map(key => [key, observation])));
const sideSchema = object({
  sideStatus: enumOf('expected', 'mismatch', 'uncertain'),
  corners: regions(corners),
  edges: regions(edges),
  surface: array(object({ location: string, ...observation.properties }), 4),
  centering: observation,
  limitations: array(enumOf(...LIMITATIONS), LIMITATIONS.length),
});
const schemaFor = sides => object({
  identity: object({
    ...Object.fromEntries(identityFields.map(key => [key, nullable])),
    subjects: array(string, 4),
    alternatives: array(string, 3),
    readings: array(object({
      field: enumOf('subject', 'cardNumber', 'setCode', 'language', 'rarityMark', 'copyrightYear',
        'serialNumber', 'subset', 'printedTitle', 'foilMark'),
      text: string, certainty, side: enumOf(...sides),
      area: enumOf('name', 'collector_line', 'set_mark', 'rarity_mark', 'body_text'),
    }), 12),
  }),
  photos: object(Object.fromEntries(sides.map(side => [side, sideSchema]))),
});

const prompt = `Identify the trading card and describe its visual condition in the supplied photos.
The photo labels specify the expected side. If the images appear reversed, obstructed or mislabelled, mark sideStatus as mismatch or uncertain and do not attribute wear to a side you cannot establish. Transcribe only visible printed readings and name every subject separately. Keep the collector number separate from a printed serial stamp and the observed finish separate from a proposed official parallel. Distinguish sticker from on-card autograph and paper from Chrome only when supported. Put uncertainties and inferred identity in identityNotes and alternatives. Use null for unknown identity fields. Do not imply external catalog verification.
For each supplied side, cover all four corners and edges, centering, and localized surface marks. Keep each evidence description under 100 characters and each identity value under 80 characters. Use apparent for visible observations, possible for uncertain findings and not_assessable for areas you cannot inspect. Separate wear from artwork, printing, foil, glare and holder marks. A qualified no-obvious-wear observation is allowed for visible areas. Note blur, cropping, obstruction and severe glare as limitations. No grading, probabilities, prices, recommendations, coordinates or numeric defect confidence.`;

function valid(schema, value) {
  if (value === null) return Array.isArray(schema.type) && schema.type.includes('null');
  if (schema.type === 'array') return Array.isArray(value) && value.length <= schema.maxItems &&
    value.every(item => valid(schema.items, item));
  if (schema.type === 'object') return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === schema.required.length &&
    schema.required.every(key => Object.hasOwn(value, key) && valid(schema.properties[key], value[key]));
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100 &&
    (!schema.enum || schema.enum.includes(value));
}

export function parseGeminiAnalysis(response, sides, cardType, lowResolution = []) {
  const candidate = response?.candidates?.[0];
  if (response?.candidates?.length !== 1 || candidate?.finishReason !== 'STOP') {
    throw Error(candidate?.finishReason === 'SAFETY' || response?.promptFeedback?.blockReason
      ? 'ANALYSIS_PROVIDER_REFUSED' : 'ANALYSIS_RESPONSE_INCOMPLETE');
  }
  const parts = candidate.content?.parts?.filter(part => part.thought !== true);
  if (!parts?.length) throw Error('ANALYSIS_EMPTY_RESPONSE');
  if (parts.some(part => typeof part.text !== 'string')) throw Error('ANALYSIS_RESPONSE_INVALID');
  const text = parts.map(part => part.text).join('');
  if (Buffer.byteLength(text) > 32768) throw Error('ANALYSIS_RESPONSE_INVALID');
  let payload;
  try { payload = JSON.parse(text); } catch { throw Error('ANALYSIS_RESPONSE_INVALID'); }
  if (!valid(schemaFor(sides), payload)) throw Error('ANALYSIS_RESPONSE_INVALID');
  const { readings, subjects, alternatives, ...identity } = payload.identity;
  if ([...subjects, ...Object.values(identity), ...readings.map(row => row.text)]
      .some(value => value?.length > 80)) throw Error('ANALYSIS_RESPONSE_INVALID');
  const identityReadings = readIdentityReadings(readings, cardType);
  if (identityReadings.length !== readings.length) throw Error('ANALYSIS_RESPONSE_INVALID');
  const modelPhotoNotes = [];
  const photoSideUncertain = [];
  const imageLimitations = new Set(lowResolution.length ? ['limited_resolution'] : []);
  const locationLabel = key => key.replace(/[A-Z]/g, letter => ' ' + letter.toLowerCase());
  function add(attribute, side, observations) {
    const text = observations.filter(row => row.status !== 'not_assessable' || /glare|blur|sleeve|holder|obscur|crop/i.test(row.evidence))
      .map(row => `${row.location}: ${row.status === 'possible' ? 'possible — ' : row.status === 'not_assessable' ? 'not assessable — ' : ''}${row.evidence}`).join('; ');
    if (text) modelPhotoNotes.push({ attribute, side, text });
  }
  for (const side of sides) {
    const photo = payload.photos[side];
    photo.limitations.forEach(code => imageLimitations.add(code));
    if (photo.sideStatus !== 'expected') {
      photoSideUncertain.push(side);
      if (identityReadings.some(reading => reading.side === side)) throw Error('ANALYSIS_RESPONSE_INVALID');
      continue;
    }
    for (const attribute of ['corners', 'edges']) {
      add(attribute, side, Object.entries(photo[attribute]).map(([key, row]) =>
        ({ ...row, location: `${locationLabel(key)} ${attribute === 'corners' ? 'corner' : 'edge'}` })));
    }
    add('surface', side, photo.surface.map(row => ({ ...row, location: `surface, ${row.location}` })));
    add('centering', side, [{ ...photo.centering, location: 'centering' }]);
  }
  const readingIndices = (field, value) => identityReadings.flatMap((row, index) =>
    row.field === field && row.certainty === 'clear' && row.text.toLowerCase() === value?.toLowerCase()
      ? [index] : []);
  return {
    ...identity,
    identifiedSubject: subjects.length ? subjects.join(' / ') : identity.identifiedSubject,
    identifiedAutoOrRelic: identity.autographType && /sticker|on.card|autograph/i.test(identity.autographType) ? 'auto' : null,
    identityNotes: [identity.identityNotes, alternatives.length ? `Alternatives: ${alternatives.join(', ')}.` : null].filter(Boolean).join(' '),
    identityReadings,
    visualEvidenceVersion: 4,
    modelPhotoNotes,
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

// Preview configuration must be based on verified current model-specific billing.
// Use the model's whole input window and a separate full thinking allowance to
// stay conservative until tighter billable image/thinking bounds are confirmed.
export function geminiBudget(env) {
  const names = ['GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION', 'GEMPREDICT_GEMINI_OUTPUT_USD_PER_MILLION', 'GEMPREDICT_GEMINI_MAX_SCAN_USD'];
  if (names.some(name => !/^\d+(?:\.\d+)?$/.test(env[name] || ''))) return null;
  const [input, output, ceiling] = names.map(name => Number(env[name]));
  const maximum = (1048576 * input + (32768 + GEMINI_MAX_OUTPUT) * output) / 1e6;
  return [input, output, ceiling, maximum].every(value => Number.isFinite(value) && value > 0) &&
    maximum <= ceiling ? { input, output, maximum } : null;
}

export async function requestGeminiAnalysis({ images, cardType, diagnostics, env = process.env, makeClient = options => new GoogleGenAI(options) }) {
  const budget = geminiBudget(env);
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL !== '1' || env.GEMPREDICT_GEMINI_FULL_ANALYSIS !== 'true' ||
      !env.VISION_BENCH_GEMINI_KEY || !budget) throw Error('NO_API_KEY');
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
  const client = makeClient({
    apiKey: env.VISION_BENCH_GEMINI_KEY, vertexai: false,
    httpOptions: {
      apiVersion: 'v1beta', baseUrl: 'https://generativelanguage.googleapis.com',
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
      contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
      config: {
        candidateCount: 1, maxOutputTokens: GEMINI_MAX_OUTPUT,
        responseMimeType: 'application/json', responseJsonSchema: schemaFor(sides),
        thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    });
  } catch (cause) {
    // Never propagate the SDK error body, URL, or headers.
    const error = Error(cause?.name === 'TimeoutError' || cause?.name === 'AbortError'
      ? 'ANALYSIS_PROVIDER_TIMEOUT' : 'GEMINI_REQUEST_FAILED');
    if (cause instanceof ApiError && Number.isInteger(cause.status)) error.status = cause.status;
    diagnostics?.providerRequestFailed(error);
    throw error;
  } finally {
    diagnostics?.providerLatency(Date.now() - started);
  }
  diagnostics?.geminiUsage(response.usageMetadata, budget);
  return parseGeminiAnalysis(response, sides, cardType, lowResolution);
}
