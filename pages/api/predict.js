import { buildVisionPrompt } from '../../lib/visionPrompt.mjs';
import { readVisualEvidence, conditionPresentation } from '../../lib/visualEvidence.mjs';
import { readIdentityReadings } from '../../lib/visionIdentityEvidence.mjs';
import { VISION_MODEL_CONFIGURATION, VALUATION_MODEL_CONFIGURATION } from '../../lib/modelConfiguration.mjs';
import { fetchCompletedSales } from "../../lib/completedSales.mjs";
import { loggingFailure } from "../../lib/supabaseDiagnostics.mjs";
import { predictionPricingReceipt } from "../../lib/pricingDiagnostics.mjs";
import { validateAnalysisImage } from "../../lib/uploadValidation.mjs";
import { MAX_IMAGE_BYTES } from "../../lib/mobileImages.mjs";
import { isVercelPreview, verifyPreviewIntegration } from '../../lib/previewIntegration.mjs';
import { identitySearchGate } from '../../lib/catalogIdentity.mjs';
import { calculateGradingEconomics } from '../../lib/gradingEconomics.mjs';
import { selectMarketQuery } from "../../lib/marketQuerySelection.mjs";
import { buildCanonicalCardFromText, missingTextIdentityFields } from "../../lib/textCardIdentity.mjs";
import { reconcileVariant, parseVariantConfirmation } from "../../lib/variantVerification.mjs";
import { isVariantVerificationTrusted, protectValuation } from "../../lib/valuationProtection.mjs";
import { getUserIdentityProtection } from "../../lib/userIdentityProtection.mjs";
import { resolveMarketIdentity } from "../../lib/reconcileMarketIdentity.mjs";
// pages/api/predict.js
// GemPredict — Card grading prediction API route
//
// ENVIRONMENT VARIABLES REQUIRED:
//   CLAUDE_API_KEY               — Anthropic API key
//   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase service role secret
//
// MULTIPART NOTE:
//   bodyParser is disabled so formidable can parse multipart/form-data.
//   Text-only (JSON) requests also work: the handler detects content-type
//   and falls back to req.body when no image is present.

import atlasOrchestrator from "../../lib/atlasOrchestrator";

import calculateIdentityConfidence from "../../lib/calculateIdentityConfidence";


import {
  buildCanonicalCardFromImageAnalysis,
} from "../../lib/cardIdentifier";

import { createAnthropicClient } from "../../lib/anthropicClient.mjs";
import supabase from "../../lib/supabaseServer";
import formidable from "formidable";
import fs from "fs";
import path from "path";

// ─── Disable Next.js body parser so formidable can handle multipart ───────────
export const config = { api: { bodyParser: false } };

// ─── Config ───────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const CARD_NAME_MIN     = 2;
const CARD_NAME_MAX     = 80;
const CARD_SET_MAX      = 60;
const IMAGE_MAX_BYTES   = MAX_IMAGE_BYTES;

const VALID_CARD_TYPES = new Set([
  "pokemon", "sports", "mtg", "yugioh", "dragonball", "onepiece", "tcg",
]);

const CARD_TYPE_LABELS = {
  pokemon: "Pokemon", sports: "Sports Card", mtg: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!", dragonball: "Dragon Ball", onepiece: "One Piece", tcg: "Other TCG",
};

const CONDITION_LABELS = {
  risky:  "Risky / Played — visible wear, likely PSA 6–8 at best",
  strong: "Strong Copy — well-centered, minimal wear, PSA 9 realistic",
  gem:    "Gem Candidate — near-perfect copy, PSA 10 possible",
};

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetInMins: 60 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const resetInMins = Math.ceil((RATE_LIMIT_WINDOW - (now - entry.windowStart)) / 60000);
    return { allowed: false, remaining: 0, resetInMins };
  }
  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetInMins: 60 };
}

// ─── Input helpers ────────────────────────────────────────────────────────────
function sanitiseString(val) {
  if (typeof val !== "string") return "";
  return val.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

function looksLikeJunk(str) {
  if (!str || str.length < CARD_NAME_MIN) return true;
  if (!/[a-zA-Z]/.test(str)) return true;
  if (/^(.)\1+$/.test(str)) return true;
  return false;
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const t = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) && t.length <= 254;
}

// ─── Supabase logging ─────────────────────────────────────────────────────────
async function logRequest({ ip, cardName, cardType, cardSet, status, errorMessage }) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("prediction_logs").insert({
      ip: ip || "unknown",
      card_name:     (cardName  || "").slice(0, 120),
      card_type:     (cardType  || "").slice(0, 40),
      card_set:      (cardSet   || "").slice(0, 80),
      status:        status || "unknown",
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
    });
    if (error) console.error("[GemPredict] Log insert diagnostic:", loggingFailure(error));
  } catch (err) {
    console.error("[GemPredict] Log insert diagnostic:", loggingFailure(err));
  }
}

// ─── Request parsing ──────────────────────────────────────────────────────────
// Parses both multipart/form-data (with optional image) and application/json.
// Returns { fields, imageBuffer, imageMimeType, backImageBuffer, backImageMimeType }.
async function parseRequest(req) {
  const contentType = req.headers["content-type"] || "";

  // Multipart — use formidable
  if (contentType.includes("multipart/form-data")) {
    return new Promise(function(resolve, reject) {
      const form = formidable({
        maxFileSize: IMAGE_MAX_BYTES,
        maxTotalFileSize: 2 * IMAGE_MAX_BYTES,
        maxFiles: 2,
        maxFieldsSize: 64 * 1024,
        uploadDir: "/tmp",
        keepExtensions: false,
      });
      form.parse(req, async function(err, fields, files) {
        const uploaded = Object.values(files || {}).flat();
        try {
          if (err) throw err;
          if (Object.keys(files).some(key => !['image', 'backImage'].includes(key)) ||
              Object.values(files).some(value => Array.isArray(value) && value.length !== 1)) throw new Error('Unexpected image fields');
          const flat = {};
          for (const key of Object.keys(fields)) flat[key] = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
          const readImage = async key => {
            const file = Array.isArray(files[key]) ? files[key][0] : files[key];
            if (!file) return { buffer: null, mime: null };
            const buffer = fs.readFileSync(file.filepath);
            return { buffer, mime: await validateAnalysisImage(buffer) };
          };
          const front = await readImage('image');
          const back = await readImage('backImage');
          if (back.buffer && !front.buffer) throw new Error('Front photo required');
          resolve({ fields: flat, imageBuffer: front.buffer, imageMimeType: front.mime, backImageBuffer: back.buffer, backImageMimeType: back.mime });
        } catch (error) { reject(error); }
        finally {
          for (const file of uploaded) { try { fs.unlinkSync(file.filepath); } catch {} }
        }
      });
    });
  }
  // JSON — collect body manually (bodyParser is disabled globally for this route)
  return new Promise(function(resolve, reject) {
    let body = "";
    req.on("data", function(chunk) { body += chunk; });
    req.on("end", function() {
      try {
        const parsed = body ? JSON.parse(body) : {};
       resolve({
  fields: parsed,
  imageBuffer: null,
  imageMimeType: null,
  backImageBuffer: null,
  backImageMimeType: null,
});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// ─── Claude response parsing ──────────────────────────────────────────────────
function safeInt(val, fallback) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return typeof n === "number" && isFinite(n) ? Math.round(n) : (fallback !== undefined ? fallback : 0);
}

function extractJSON(text) {
  if (!text || typeof text !== "string") return null;
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const slice = text.slice(start, i + 1);
        try { return JSON.parse(slice); }
        catch {
          const cleaned = slice.replace(/,\s*([\]}])/g, "$1");
          try { return JSON.parse(cleaned); } catch { return null; }
        }
      }
    }
  }
  return null;
}
function normaliseCard(raw, marketMedian = null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const financials = calculateGradingEconomics(raw, marketMedian ?? raw.rawValue);
  const psa9Pop = null; // Population counts require an authorized population source.
  const psa10Pop = null;
  return {
    cardTitle: (typeof raw.cardTitle === "string" && raw.cardTitle.trim() ? raw.cardTitle.trim() : "Unknown Card").slice(0, 120),
    cardMeta: (typeof raw.cardMeta === "string" && raw.cardMeta.trim() ? raw.cardMeta.trim() : "Details unavailable").slice(0, 200),
    ...financials,
    psa9Pop, psa10Pop,
    populationInsight: typeof raw.populationInsight === "string" && raw.populationInsight.trim() ? raw.populationInsight.trim().slice(0, 200) : null,
  };
}

// Validate and normalise image analysis response from Claude Vision
function normaliseImageAnalysis(raw, inspectedSides = ['front']) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const clean = value => typeof value === 'string' && value.trim() ? value.trim().slice(0,400) : null;
  const source = { ...raw, inspectedSides,
    imageLimitations: [...(Array.isArray(raw.imageLimitations) ? raw.imageLimitations : []), ...(!inspectedSides.includes('back') ? ['back_not_visible'] : [])] };
  const safe = conditionPresentation(source, { identityVerified: false, trusted: false });
  return { ...safe,
    ...Object.fromEntries(['identifiedLanguage','identifiedYear','identifiedBrandSet','identifiedSubject','identifiedCardNumber','identifiedParallel','identifiedRarity'].map(field=>[field,clean(raw[field])])),
    identifiedAutoOrRelic: clean(raw.identifiedAutoOrRelic) || 'unknown',
    identityConfidence: Math.min(100,Math.max(0,safeInt(raw.identityConfidence,0))),
    identityNotes: clean(raw.identityNotes),identityReadings:readIdentityReadings(raw.identityReadings).filter(reading=>inspectedSides.includes(reading.side)),
    authenticityWarning: clean(raw.authenticityWarning),isUnofficial:raw.isUnofficial===true,
    unverifiedInterpretation: { imageSummary:clean(raw.imageSummary),estimatedGrade:clean(raw.estimatedGrade),identityNotes:clean(raw.identityNotes) },
  };
}
// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = createAnthropicClient();

// ─── Text-only prediction (existing logic, unchanged) ─────────────────────────
async function fetchPrediction(
  cardName,
  cardType,
  cardSet,
  condition,
  canonicalCard = null,
  marketData = null
) {
  if (!anthropic) throw new Error("NO_API_KEY");

  const typeLabel      = CARD_TYPE_LABELS[cardType] || "Card";
const setLabel       = cardSet || "not specified";
const conditionLabel = CONDITION_LABELS[condition] || CONDITION_LABELS.strong;

// Reuse the ranked result supplied by the handler. No second market lookup
// can drift from the evidence ultimately returned to the caller.
const preLiveRawMarket = marketData?.marketSummary?.rawUsedCount > 0
  ? marketData.marketSummary.rawMedian ?? null : null;

const marketContext =
  preLiveRawMarket != null
    ? "\n\nLIVE MARKET DATA:\n" +
      "- Active asking median (not completed sales): $" + preLiveRawMarket + "\n" +
      "- Use this as the raw card value baseline.\n" +
      "- Do not refer to a different raw value in the analysis or action.\n"
    : "";
  
  const prompt =
  "IMPORTANT MARKET RULES:\n" +
"- Use selected asking prices only as a conditional scenario baseline, never as verified fair market value or completed sales. Grade prices and individual probabilities remain modeled estimates.\n" +
"- Never estimate a PSA 10 value that is less than the raw market value unless there is an explicit and compelling reason.\n" +
"- In normal markets the relationship should generally be:\n" +
"  PSA10 >= PSA9 >= Raw.\n" +
"- Base your PSA 9 and PSA 10 estimates relative to the market value rather than inventing an unrelated raw value.\n" +
"- Be internally consistent. Do not produce impossible pricing relationships.\n\n" +
    "You are an experienced card grading ROI analyst helping collectors make smarter submission decisions.\n\n" +
    "Your job is to give a realistic, conservative grading analysis — not hype. " +
    "Think like a dealer who has lost money on bad grading decisions. " +
    "Avoid optimistic PSA 10 assumptions unless the card and condition strongly support it.\n\n" +
    "Card: " + cardName + "\n" +
    "Type: " + typeLabel + "\n" +
    "Set/Year: " + setLabel + "\n" +
    "Collector's condition estimate: " + conditionLabel + "\n" +
marketContext +
"\n" +
    
    "Use the collector condition as an uncalibrated scenario input:\n" +
    "- PSA 10 probability (be conservative — most cards do not gem)\n" +
    "- Verdict (factor in whether condition makes grading a realistic ROI)\n" +
    "- Analysis (be direct and practical, not generic)\n" +
    "- Action (give a specific actionable recommendation)\n\n" +
    "Respond with ONLY a single raw JSON object. No markdown. No backticks. No extra text before or after.\n\n" +
    "No photographs are provided to this financial request. Do not invent visible defects or OCR readings. The collector-supplied condition is an uncalibrated scenario input, not a physical grade or population-derived probability.\n" +
  "Required fields:\n" +
    "cardTitle - full proper card name (string)\n" +
    "cardMeta - set name, year, variant details (string)\n" +
    "rawValue - realistic ungraded USD market estimate (number, cents allowed)\n" +
    "psa9Value - realistic PSA 9 USD estimate (number, cents allowed)\n" +
    "psa10Value - realistic PSA 10 USD estimate (number, cents allowed)\n" +
    "psa10Probability - modeled conditional 0-100 scenario probability, not independently calibrated (integer — be conservative)\n" +
    "verdict - exactly one of: grade, skip, maybe (string)\n" +
    "gradingUpside - psa10Value minus rawValue minus 80 (number, cents allowed)\n" +
    "analysis - 2 sentences max: direct, practical, no filler (string)\n" +
    "action - one sentence starting with a verb, specific to this card and condition (string)\n" +
    "psa9Pop - null; never estimate observed population counts\n" +
    "psa10Pop - null; never estimate observed population counts\n" +
    "populationInsight - state that independently sourced population data is unavailable (string)\n\n" +
    "Population rules:\n" +
    "- Population counts are unavailable without an independent population provider; return null\n" +
    "- populationInsight should be short, direct, and collector-focused (one sentence only)\n\n" +
    "Verdict rules: grade=clear positive ROI with realistic grade potential; " +
    "skip=fee risk outweighs realistic upside given condition; " +
    "maybe=upside exists but depends on actual card condition or market timing.\n" +
    "Be realistic. Most raw cards do not get PSA 10. Standard grading fees are approximately $80. Factor that into all ROI calculations and recommendations.";

  const message = await anthropic.messages.create({
    ...VALUATION_MODEL_CONFIGURATION,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("").trim();
  if (!text)   throw new Error("EMPTY_RESPONSE");
  const parsed = extractJSON(text);
  if (!parsed) throw new Error("PARSE_FAILED");
  const result = normaliseCard(parsed, preLiveRawMarket);
  if (!result) throw new Error("NORMALISE_FAILED");
  return result;
}

// ─── Vision analysis (new) ────────────────────────────────────────────────────
// Sends the card image to Claude with a structured grading prompt.
// Returns a normalised imageAnalysis object, or null on failure (non-fatal).
async function fetchImageAnalysis(
  imageBuffer,
  imageMimeType,
  backImageBuffer,
  backImageMimeType,
  cardName,
  cardType
) {
  if (!anthropic) throw new Error("NO_API_KEY");
  if (!imageBuffer || imageBuffer.length === 0) return null;

  const typeLabel = CARD_TYPE_LABELS[cardType] || "Card";
  const base64 = imageBuffer.toString("base64");

// Validate mime type for Claude
const VALID_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];

if (!VALID_MIME.includes(imageMimeType) || (backImageBuffer && !VALID_MIME.includes(backImageMimeType))) throw new Error("Unsupported analysis image format");
const mime = imageMimeType;

const backBase64 = backImageBuffer
  ? backImageBuffer.toString("base64")
  : null;

const backMime = backImageMimeType &&
  VALID_MIME.includes(backImageMimeType)
  ? backImageMimeType
  : null;

  const imagePrompt = buildVisionPrompt({cardName,typeLabel,hasBack:!!backBase64});

  const message = await anthropic.messages.create({
    ...VISION_MODEL_CONFIGURATION,
    messages: [{
      role: "user",
      content: [
  {
    type: "image",
    source: {
      type: "base64",
      media_type: mime,
      data: base64,
    },
  },

  ...(backBase64
    ? [{
        type: "image",
        source: {
          type: "base64",
          media_type: backMime,
          data: backBase64,
        },
      }]
    : []),

  {
    type: "text",
    text: imagePrompt,
  },
      ],
    }],
  });

  const text = (message.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("").trim();
  if (!text) return null;
  const parsed = extractJSON(text);
  if (!parsed) return null;
  return normaliseImageAnalysis(parsed, backImageBuffer ? ['front','back'] : ['front']);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const startedAt = Date.now();
  const preview = isVercelPreview(process.env);
  if (preview && req.method === 'GET' && req.query?.preflight === '1' && process.env.GEMPREDICT_PREVIEW_PREFLIGHT_ENABLED === 'true') {
    const result = await verifyPreviewIntegration({ env: process.env, requestHeaders: req.headers, fetchImpl: fetch });
    res.setHeader('Cache-Control', 'private, no-store');
    // This endpoint is opt-in and remains behind Vercel Authentication. If
    // protection verification fails, expose only a generic unavailable result.
    if (!result.checks.protection) return res.status(503).json({ integrationReady: false });
    return res.status(result.integrationReady ? 200 : 503).json(result);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (preview) {
    const result = await verifyPreviewIntegration({ env: process.env, requestHeaders: req.headers, fetchImpl: fetch });
    if (!result.integrationReady) return res.status(503).json({ error: 'Preview integration preflight is incomplete.' });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    logRequest({ ip, cardName: "", cardType: "", cardSet: "", status: "rate_limited" });
    return res.status(429).json({
      error: "rate_limit",
      message: "You have used all " + RATE_LIMIT_MAX + " free predictions this hour. Please try again in " + rateCheck.resetInMins + " minute" + (rateCheck.resetInMins === 1 ? "" : "s") + ".",
      resetInMins: rateCheck.resetInMins,
    });
  }

  // Parse request — handles both multipart and JSON
  let fields,
    imageBuffer,
    imageMimeType,
    backImageBuffer,
    backImageMimeType;
  try {
    const parsed = await parseRequest(req);
    fields = parsed.fields;
imageBuffer = parsed.imageBuffer;
imageMimeType = parsed.imageMimeType;
backImageBuffer = parsed.backImageBuffer;
backImageMimeType = parsed.backImageMimeType;
  } catch (parseErr) {
    return res.status(400).json({ error: "Could not read the upload. Use valid, prepared JPEG/PNG/WebP/GIF photos within the upload limit, with a front photo when including a back." });
  }

  const cardName  = sanitiseString(fields.cardName  || "");
  const cardSet   = sanitiseString(fields.cardSet   || "");
  const confirmedVariant = fields.confirmedVariant ? parseVariantConfirmation(fields.confirmedVariant) : null;
  let confirmedCardIdentity = null;
  let originalIdentityProposal = null;
  if (fields.confirmedVariant && !confirmedVariant) return res.status(400).json({ error: "Provide a specific version, such as Base, Common non-holo, Alternate Art or Green Sand Glitter /99." });
  if (confirmedVariant) {
    for (const field of ["confirmedCardIdentity", "originalIdentityProposal"]) {
      if (!fields[field]) continue;
      try {
        const input = typeof fields[field] === "string" ? JSON.parse(fields[field]) : fields[field];
        const card = {};
        for (const key of ["subject", "cardNumber", "year", "brandSet", "parallel", "autoOrRelic", "printRun", "language"]) card[key] = sanitiseString(input?.[key] || "").slice(0, 140) || null;
        if (card.subject && card.cardNumber) {
          if (field === "confirmedCardIdentity") confirmedCardIdentity = card;
          else originalIdentityProposal = card;
        }
      } catch { /* A rescan can still establish the card identity. */ }
    }
    if (originalIdentityProposal?.subject !== confirmedCardIdentity?.subject || originalIdentityProposal?.cardNumber !== confirmedCardIdentity?.cardNumber) originalIdentityProposal = null;
  }
  const email     = sanitiseString(fields.email     || "");
  const condition = ["risky", "strong", "gem"].includes(fields.condition) ? fields.condition : "strong";
  const cardTypeRaw = typeof fields.cardType === "string" ? fields.cardType.trim().toLowerCase() : "";
  const cardType    = VALID_CARD_TYPES.has(cardTypeRaw) ? cardTypeRaw : "tcg";

  const hasImage = !!imageBuffer;
const hasTypedCardName = !!(cardName && cardName.trim());

if (!hasTypedCardName && !hasImage) {
  logRequest({
    ip,
    cardName,
    cardType,
    cardSet,
    status: "invalid_input",
    errorMessage: "missing card name and image",
  });
  return res.status(400).json({ error: "Card name or image is required." });
}

if (hasTypedCardName && cardName.length < CARD_NAME_MIN) {
  logRequest({
    ip,
    cardName,
    cardType,
    cardSet,
    status: "invalid_input",
    errorMessage: "too short",
  });
  return res.status(400).json({
    error: "Card name must be at least " + CARD_NAME_MIN + " characters.",
  });
}

if (hasTypedCardName && cardName.length > CARD_NAME_MAX) {
  logRequest({
    ip,
    cardName,
    cardType,
    cardSet,
    status: "invalid_input",
    errorMessage: "too long",
  });
  return res.status(400).json({
    error: "Card name must be " + CARD_NAME_MAX + " characters or fewer.",
  });
}

if (cardSet.length > CARD_SET_MAX) {
  logRequest({
    ip,
    cardName,
    cardType,
    cardSet,
    status: "invalid_input",
    errorMessage: "set too long",
  });
  return res.status(400).json({
    error: "Set / year must be " + CARD_SET_MAX + " characters or fewer.",
  });
}

if (hasTypedCardName && looksLikeJunk(cardName)) {
  logRequest({
    ip,
    cardName,
    cardType,
    cardSet,
    status: "invalid_input",
    errorMessage: "junk input",
  });
  return res.status(400).json({ error: "Please enter a valid card name." });
}

  // Image size guard (redundant with formidable limit but belt-and-suspenders)
  if (imageBuffer && imageBuffer.length > IMAGE_MAX_BYTES) {
    return res.status(400).json({ error: "Image file is too large. Please prepare a smaller photo and retry." });
  }

  let emailSaved = false;
  if (email) {
    if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (supabase) {
      try {
        const { error: dbError } = await supabase.from("waitlist_emails").insert({ email: email.toLowerCase() });
        if (dbError && dbError.code !== "23505") console.error("[GemPredict] Waitlist DB error:", dbError.code, dbError.message);
      } catch (dbErr) { console.error("[GemPredict] Waitlist error:", dbErr.message); }
    }
    emailSaved = true;
  }

  try {
    let imageAnalysis = null;

    if (imageBuffer) {
      imageAnalysis = await fetchImageAnalysis(
        imageBuffer,
        imageMimeType,
        backImageBuffer,
        backImageMimeType,
        cardName,
        cardType
      ).catch(function(err) {
        console.error("[GemPredict] Image analysis error (non-fatal):", err.message);
        return null;
      });
    }

    const identifiedCardName = imageAnalysis
      ? [
          imageAnalysis.identifiedYear,
          imageAnalysis.identifiedBrandSet,
          imageAnalysis.identifiedSubject,
          imageAnalysis.identifiedParallel,
          imageAnalysis.identifiedCardNumber ? "#" + imageAnalysis.identifiedCardNumber : null,
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      : "";

    const hasUserCardName =
  cardName && cardName.trim() && cardName.trim() !== "Unknown card from image";

let effectiveCardName =
  hasUserCardName
    ? cardName.trim()
    : identifiedCardName || "Unknown card from image";

    let effectiveCardSet =
      cardSet && cardSet.trim()
        ? cardSet.trim()
        : [
            imageAnalysis?.identifiedYear,
            imageAnalysis?.identifiedBrandSet,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

    const originalCanonicalCard = buildCanonicalCardFromImageAnalysis(
  imageAnalysis,
  cardName,
  cardSet
) || confirmedCardIdentity || (!imageBuffer ? buildCanonicalCardFromText({ ...fields, cardName, cardSet }) : null);

// This measures visible image identifiers only. Text/confirmation identities
// still use market verification, but have no image confidence to calculate.
const atlasIdentityConfidence = imageAnalysis
  ? calculateIdentityConfidence(imageAnalysis)
  : null;

    // Protect explicit year/set choices independently; a typed subject alone
    // does not lock either field against neutral market evidence.
    const identityEvidence = await resolveMarketIdentity(originalCanonicalCard, {
      cardType,
      visionReadings: imageAnalysis?.identityReadings || [],
      allowCollectorDiscovery: !!imageAnalysis && cardType === 'pokemon',
      collectorNumberProtected: !!confirmedCardIdentity || /\d+\s*\/\s*\d+/.test([hasUserCardName ? cardName : '', cardSet].join(' ')),
      ...getUserIdentityProtection({ cardName, cardSet, year: fields.year, set: fields.set, confirmedIdentity: fields.confirmedIdentity }),
    });
    const variantProposal = imageAnalysis ? originalCanonicalCard : originalIdentityProposal || originalCanonicalCard;
    const variantResult = reconcileVariant(identityEvidence.identityVerification?.catalog?.source === 'tcgdex' && ['verified', 'corrected'].includes(identityEvidence.identityVerification.catalog.status) ? identityEvidence.canonicalCard : variantProposal, identityEvidence.canonicalCard, {
      identityEvidenceItems: identityEvidence.identityEvidenceItems,
      search: identityEvidence.search,
    }, confirmedVariant);
    const canonicalCard = variantResult.canonicalCard;
    let variantVerification = variantResult.variantVerification;
    if (identityEvidence.identityVerification?.catalog?.source === 'tcgdex' && (identityEvidence.identityVerification.catalog.requiresConfirmation || ['ambiguous', 'conflict', 'insufficient_evidence'].includes(identityEvidence.identityVerification.catalog.status))) {
      variantVerification = { ...variantVerification, status: 'needs_confirmation', explanation: 'Independent catalog evidence is conflicting or incomplete. Confirm the printed identity, language and version, or rescan clearer identifiers. Valuation remains withheld.' };
    }
    // Existing photo-confirmation requests retain their original behavior.
    const isTextIdentityRequest = !imageBuffer && (!confirmedCardIdentity || fields.textOnlyIdentity === true || fields.textOnlyIdentity === "true");
    const missingIdentityFields = isTextIdentityRequest ? missingTextIdentityFields(canonicalCard) : [];
    if (missingIdentityFields.length) {
      variantVerification = { ...variantVerification, status: "insufficient_evidence", missingIdentityFields,
        explanation: `Exact identification needs: ${missingIdentityFields.join(", ")}. Use Verify Variant to enter these details and request fresh prices; no photo is required.` };
    }
    const identityVerification = identityEvidence.identityVerification;
    const valuationIdentityGate = identitySearchGate(identityVerification, canonicalCard);
    const identityAdjusted = canonicalCard && originalCanonicalCard &&
      (canonicalCard.year !== originalCanonicalCard.year || canonicalCard.brandSet !== originalCanonicalCard.brandSet || canonicalCard.parallel !== originalCanonicalCard.parallel || canonicalCard.autoOrRelic !== originalCanonicalCard.autoOrRelic || canonicalCard.printRun !== originalCanonicalCard.printRun);
    if (identityAdjusted) {
      if (!hasUserCardName) effectiveCardName = canonicalCard.displayName;
      effectiveCardSet = [canonicalCard.year, canonicalCard.brandSet].filter(Boolean).join(" ");
    }
    const marketData = valuationIdentityGate.allowed === false
      ? { success: false, error: "Identity needs independent verification before valuation searches", rawComparableItems: [], excludedItems: [], marketSummary: { rawUsedCount: 0, rawMedian: null, marketConfidence: 0, valuationTrusted: false }, querySelection: { attempts: [], selectedQuery: null, selectionReason: "Identity unresolved; valuation searches withheld" } }
      : await selectMarketQuery(canonicalCard, {
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL,
      routingEnv: process.env,
      requestHeaders: req.headers,
      fetchImpl: fetch,
    });

    const prediction = valuationIdentityGate.allowed === false
      ? { cardTitle: canonicalCard?.displayName || effectiveCardName, cardMeta: effectiveCardSet, analysis: null }
      : await fetchPrediction(
      effectiveCardName,
      cardType,
      effectiveCardSet,
      condition,
      canonicalCard,
      marketData
    );

    if (imageAnalysis && identifiedCardName && (!hasUserCardName || identityAdjusted)) {
  prediction.cardTitle = identityAdjusted ? canonicalCard.displayName : effectiveCardName;
  prediction.cardMeta = effectiveCardSet || prediction.cardMeta;
}

    logRequest({
  ip,
  cardName: effectiveCardName,
  cardType,
  cardSet: effectiveCardSet,
  status: "success",
});

   
    const completedSales = valuationIdentityGate.allowed && isVariantVerificationTrusted(variantVerification, canonicalCard)
      ? await fetchCompletedSales(canonicalCard)
      : { status: 'unavailable', reason: 'identity_or_variant_unresolved', records: [] };
    const result = protectValuation({
  success: true,
  completedSales,
  populationRecord: null,
  probabilityEvidence: null,
  prediction,
  marketData,
  authenticityWarnings: Array.isArray(fields.authenticityWarnings) ? fields.authenticityWarnings : [],
  identityEvidenceExclusions: identityEvidence.identityEvidenceExclusions || [],
  identityEvidenceItems: identityEvidence.identityEvidenceItems,
  identityEvidenceSearch: identityEvidence.search,
  imageAnalysis,
  atlas: null,
  atlasIdentityConfidence,
  originalCanonicalCard: variantProposal,
  identityVerification,
  valuationIdentityGate,
  ...(process.env.NODE_ENV === "development" ? { identityDiagnostics: {
    catalog: { ...identityVerification.catalog, diagnostics: identityEvidence.catalogDiagnostics },
    neutralSearch: identityEvidence.search,
    accepted: identityEvidence.identityEvidenceItems,
    rejected: identityEvidence.identityEvidenceExclusions,
    fieldDecisions: { year: identityVerification.year, set: identityVerification.set },
    valuationGate: valuationIdentityGate,
  } } : {}),
  variantVerification,
  canonicalCard,
  hasImageAnalysis: imageAnalysis !== null,
  remaining: rateCheck.remaining,
  emailSaved,
});
    result.atlas = result.valuationVerification.status === "trusted"
      ? atlasOrchestrator({ ...result, gpScore: { score: result.prediction.gemPredictScore } })
      : null;
    if (preview || process.env.NODE_ENV === 'development') {
      result.pricingDiagnostics = predictionPricingReceipt(result, { startedAt, privatePreview: preview, codeRevision: process.env.VERCEL_GIT_COMMIT_SHA, mode: confirmedVariant ? 'revaluation' : imageBuffer ? 'scan' : 'text' });
      console.log('[GemPredict] Pricing diagnostic', JSON.stringify({ ...result.pricingDiagnostics, searches: undefined }));
      result.pricingDiagnostics.searches.forEach((search, index) => console.log('[GemPredict] Pricing search', JSON.stringify({ requestId: result.pricingDiagnostics.requestId, attempt: index + 1, ...search })));
    }
    return res.status(200).json(result);

  } catch (err) {
    console.error("[GemPredict] Prediction error:", err.status || "", err.message);
    let userMessage = "Something went wrong. Please try again.";
    let logLabel    = err.message || "unknown";
    if (err.message === "NO_API_KEY")           { userMessage = "Service is not configured. Please contact support."; logLabel = "missing_api_key"; }
    else if (err.status === 401)                { userMessage = "Service configuration error. Please contact support."; logLabel = "anthropic_auth_failed"; }
    else if (err.status === 429)                { userMessage = "The AI service is temporarily busy. Please try again in a moment."; logLabel = "anthropic_rate_limit"; }
    else if (err.status === 529 || err.status === 500) { userMessage = "The AI service is temporarily unavailable. Please try again shortly."; logLabel = "anthropic_server_error"; }
    else if (["EMPTY_RESPONSE","PARSE_FAILED","NORMALISE_FAILED"].includes(err.message)) { userMessage = "The AI returned an unexpected response. Please try your search again."; }
    logRequest({ ip, cardName, cardType, cardSet, status: "failed", errorMessage: logLabel });
    return res.status(500).json({ error: userMessage });
  }
}
