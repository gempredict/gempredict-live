import {safeIdentityValidation} from '../../lib/identityValidation.mjs';
import {identifyFromPhotos} from '../../lib/identityStage.mjs';
import {VISION_MODEL,visionOutputBudget,parseVisionMessage,retainSportsVisionEvidence} from '../../lib/visionResponsePolicy.mjs';
import {buildSportsVisionPrompt} from '../../lib/visionPromptContract.mjs';
import {scanFailure,providerFailure} from '../../lib/scanFailures.mjs';
import {beginScanDiagnostics} from '../../lib/scanDiagnostics.mjs';
import {conditionPresentation} from '../../lib/visualEvidence.mjs';
import {buildVisionPrompt} from '../../lib/pokemonVisionPrompt.mjs';
import {resolvePokemonIdentity} from '../../lib/pokemonIdentityPipeline.mjs';
import {readIdentityReadings} from '../../lib/visionIdentityEvidence.mjs';
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

import { financialEligibility, protectFinancialReport } from "../../lib/financialSafety.mjs";
import { internalMarketContext } from "../../lib/internalMarketAuth.mjs";
import { identityComplete } from "../../lib/ebayIdentityMatch.mjs";
import atlasOrchestrator from "../../lib/atlasOrchestrator";

import calculateIdentityConfidence from "../../lib/calculateIdentityConfidence";
import { assessIdentityEvidence } from "../../lib/identityEvidence";
import { findTcgdexCandidates } from "../../lib/tcgdexCatalog.mjs";
import { crossCheckIdentity, fetchFullTcgdexCard } from "../../lib/tcgdexCrossCheck.mjs";
import { assessSoldIdentityGate } from "../../lib/soldIdentityGate.mjs";
import { canonicalIdentityV2, emptyGraderScenarios } from "../../lib/canonicalIdentityV2.mjs";
import { auditSportsIdentity } from "../../lib/sportsIdentityAudit.mjs";
import { issueIdentityReviewToken } from "../../lib/identityReviewToken.mjs";
import { assessArtworkSimilarity } from "../../lib/artworkSimilarity.mjs";
import { validateAnalysisImage } from "../../lib/uploadValidation.mjs";
import { MAX_IMAGE_BYTES } from "../../lib/mobileImages.mjs";

import buildSearchCandidates from "../../lib/buildSearchCandidates";

import {
  buildCanonicalCardFromImageAnalysis,
  buildMarketQueryFromCanonicalCard,
} from "../../lib/cardIdentifier";

import Anthropic from "@anthropic-ai/sdk";
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
    if (error) console.error("[GemPredict] Log insert error:", error.code, error.message);
  } catch (err) {
    console.error("[GemPredict] Log unexpected error:", err.message);
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
const PSA_FEE = 80;
function normaliseCard(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const VALID_VERDICTS = ["grade", "skip", "maybe"];
  const verdictRaw = typeof raw.verdict === "string" ? raw.verdict.trim().toLowerCase() : "";
  const verdict    = VALID_VERDICTS.includes(verdictRaw) ? verdictRaw : "maybe";
  const rawValue = Math.max(0, safeInt(raw.rawValue));

let psa9Value = Math.max(0, safeInt(raw.psa9Value));
let psa10Value = Math.max(0, safeInt(raw.psa10Value));

if (psa9Value < rawValue) psa9Value = rawValue;
if (psa10Value < psa9Value) psa10Value = psa9Value;
if (psa10Value < rawValue) psa10Value = rawValue;
  const psa10Prob  = Math.min(100, Math.max(0, safeInt(raw.psa10Probability, 50)));
  const gradingUpside =
    raw.gradingUpside != null
        ? safeInt(raw.gradingUpside)
        : psa10Value - rawValue - PSA_FEE;
  const psa10ProbDecimal = psa10Prob / 100;
const psa9ProbDecimal = Math.max(0, 1 - psa10ProbDecimal);

const expectedGradedValue = Math.round(
  psa10Value * psa10ProbDecimal +
  psa9Value * psa9ProbDecimal
);

const expectedNetValue = expectedGradedValue - rawValue - PSA_FEE;
  let decisionConfidence = 50;

decisionConfidence += Math.round(psa10Prob * 0.3);

if (expectedNetValue > 0) {
  decisionConfidence += 20;
}

decisionConfidence = Math.max(1, Math.min(99, decisionConfidence));
let gemPredictScore = 50;

gemPredictScore += Math.round(psa10Prob * 0.25);

if (expectedNetValue > 0) gemPredictScore += 20;
if (expectedNetValue > 50) gemPredictScore += 10;
if (gradingUpside > 0) gemPredictScore += 10;
if (gradingUpside > 100) gemPredictScore += 10;

gemPredictScore = Math.max(1, Math.min(99, gemPredictScore));
  const psa9Pop   = raw.psa9Pop  != null ? Math.max(0, safeInt(raw.psa9Pop))  : null;
  const psa10Pop  = raw.psa10Pop != null ? Math.max(0, safeInt(raw.psa10Pop)) : null;
  const populationInsight = typeof raw.populationInsight === "string" && raw.populationInsight.trim()
    ? raw.populationInsight.trim().slice(0, 200) : null;
  return {
    cardTitle:        (typeof raw.cardTitle === "string" && raw.cardTitle.trim() ? raw.cardTitle.trim() : "Unknown Card").slice(0, 120),
    cardMeta:         (typeof raw.cardMeta  === "string" && raw.cardMeta.trim()  ? raw.cardMeta.trim()  : "Details unavailable").slice(0, 200),
    rawValue, psa9Value, psa10Value,
    psa10Probability: psa10Prob,
    verdict, gradingUpside,
    analysis: (typeof raw.analysis === "string" && raw.analysis.trim() ? raw.analysis.trim() : "No analysis available.").slice(0, 500),
    action:   typeof raw.action   === "string" && raw.action.trim()   ? raw.action.trim().slice(0, 200) : null,
    psa9Pop, psa10Pop, populationInsight,
    psaFee: PSA_FEE,
expectedGradedValue,
expectedNetValue,
decisionConfidence,
gemPredictScore,
};
}

// Validate and normalise image analysis response from Claude Vision
function normaliseImageAnalysis(raw,inspectedSides=['front'],cardType=null) {
  if (!raw || typeof raw !== "object") return null;

  function safeStr(val, fallback) {
    return typeof val === "string" && val.trim() ? val.trim().slice(0, 400) : fallback;
  }
  function safeScore(val) {
    const n = safeInt(val, 0);
    return Math.min(10, Math.max(0, n));
  }
  function safeRating(val) {
    const valid = ["excellent", "good", "fair", "poor"];
    return typeof val === "string" && valid.includes(val.toLowerCase()) ? val.toLowerCase() : "fair";
  }
const combinedNotes = [
  raw.centeringNote,
  raw.cornersNote,
  raw.edgesNote,
  raw.surfaceNote,
  raw.gradingRisk,
  raw.imageSummary
].join(" ").toLowerCase();

const hasImageQualityIssues =
  /glare|reflection|reflections|blurry|blur|out of focus|poor lighting|lighting issue|shadow|shadows|low visibility|surface not fully visible|unclear surface|image quality limited|difficult to inspect|angle prevents|hard to determine|holo glare|foil glare/.test(combinedNotes);

  const structuralDamageText = [
  raw.cornersNote,
  raw.edgesNote,
  raw.surfaceNote
].join(" ").toLowerCase();
  
  const saysNoStructuralDamage =
  /no structural damage|no obvious structural damage|no visible structural damage|no bends or folds|no obvious bends|no obvious bending|no obvious folds|no creasing visible|no visible creases/.test(structuralDamageText);

const hasCatastrophicDamage =
  /multiple creases|heavy creases|major creases|deep creases|creased throughout|badly creased|heavily creased|large crease|large creases|trashed|heavily damaged|major structural damage|severe structural damage|corner destroyed|corners destroyed/.test(structuralDamageText);

const hasObviousStructuralDamage =
  /visible crease|obvious crease|clear crease|major crease|deep crease|visible bend|obvious bend|clear bend|corner bend detected|corner fold detected|visible corner fold|obvious corner fold|warped|warping|structural damage is visible|visible structural damage/.test(structuralDamageText);

let forcedLimiter = null;  
let forcedGrade = null;
let forcedScore = null;
let forcedConfidence = null;

if (hasImageQualityIssues) {
  forcedConfidence = "low";
}

if (hasCatastrophicDamage) {
  forcedLimiter = "Heavy structural damage is visible and creates a major grading cap.";
  forcedGrade = "PSA 1-3 ceiling likely";
  forcedScore = 2;
}
else if (hasObviousStructuralDamage && !saysNoStructuralDamage) {
  forcedLimiter = "Visible structural damage such as a crease, bend, fold, or corner bend may significantly cap the grade.";
  forcedGrade = "PSA 3-6 ceiling likely";
  forcedScore = 5;
}  
  return {  
    // Card identity
    ...(cardType==='pokemon'?{identifiedRarity:raw.identifiedRarity!=null?safeStr(raw.identifiedRarity,null):null,identityReadings:readIdentityReadings(raw.identityReadings).filter(r=>inspectedSides.includes(r.side))}:{}),
    identifiedLanguage: raw.identifiedLanguage != null ? safeStr(raw.identifiedLanguage,null) : null,
    identifiedFranchise: raw.identifiedFranchise != null ? safeStr(raw.identifiedFranchise,null) : null,
    identifiedYear: raw.identifiedYear != null ? safeStr(raw.identifiedYear, null) : null,
    identifiedManufacturer: raw.identifiedManufacturer != null ? safeStr(raw.identifiedManufacturer, null) : null,
    identifiedSport: raw.identifiedSport != null ? safeStr(raw.identifiedSport, null) : null,
    identifiedTeam: raw.identifiedTeam != null ? safeStr(raw.identifiedTeam, null) : null,
    identifiedSerialNumber: raw.identifiedSerialNumber != null ? safeStr(raw.identifiedSerialNumber, null) : null,
    identifiedBrandSet: raw.identifiedBrandSet != null ? safeStr(raw.identifiedBrandSet, null) : null,
    identifiedSubject: raw.identifiedSubject != null ? safeStr(raw.identifiedSubject, null) : null,
    identifiedCardNumber: raw.identifiedCardNumber != null ? safeStr(raw.identifiedCardNumber, null) : null,
    identifiedParallel: raw.identifiedParallel != null ? safeStr(raw.identifiedParallel, null) : null,
    identifiedAutoOrRelic: safeStr(raw.identifiedAutoOrRelic, "unknown"),
    identityConfidence: Math.min(100, Math.max(0, safeInt(raw.identityConfidence, 0))),
    identityNotes: safeStr(raw.identityNotes, "Card identity could not be confidently determined."),
    // Per-attribute ratings
    centering:      safeRating(raw.centering),
    corners:        safeRating(raw.corners),
    edges:          safeRating(raw.edges),
    surface:        safeRating(raw.surface),
    // Qualitative notes
    centeringNote:  safeStr(raw.centeringNote,  "Centering not assessed."),
    cornersNote:    safeStr(raw.cornersNote,     "Corners not assessed."),
    edgesNote:      safeStr(raw.edgesNote,       "Edges not assessed."),
    surfaceNote:    safeStr(raw.surfaceNote,     "Surface not assessed."),
    // Overall
    overallScore: forcedScore || safeScore(raw.overallScore), // 0-10
    gradingRisk: forcedLimiter || safeStr(raw.gradingRisk, "Grading risk could not be determined from this image."),
      

estimatedGrade: forcedGrade
  ? forcedGrade
  : safeStr(raw.estimatedGrade, "Unable to estimate."),

worthGrading: hasCatastrophicDamage
  ? false
  : (typeof raw.worthGrading === "boolean" ? raw.worthGrading : null),
    
worthGradingReason: hasCatastrophicDamage
  ? "Heavy visible damage usually makes this a poor grading candidate unless the card is extremely rare or valuable."
  : safeStr(raw.worthGradingReason, "Insufficient image quality to determine."),

gradeCeiling: forcedGrade
  ? forcedGrade
  : safeStr(raw.gradeCeiling, "Unknown"),

primaryLimiter: forcedLimiter || safeStr(raw.primaryLimiter, "No primary limiter identified."),

majorGradeCap: forcedLimiter || safeStr(raw.majorGradeCap, "No major grade cap identified."),

confidenceLevel: forcedConfidence || safeStr(raw.confidenceLevel, "moderate"),

imageSummary: hasImageQualityIssues
  ? safeStr(raw.imageSummary, "Image quality limits grading confidence.") +
    " Surface glare, reflections, lighting, or image quality may hide additional defects."
  : safeStr(raw.imageSummary, "No summary available."),

    mostLikelyGradeRange:
  safeStr(raw.mostLikelyGradeRange, "Most likely PSA range uncertain."),

psa10Upside:
  safeStr(raw.psa10Upside, "PSA 10 upside could not be confidently determined."),

gemRiskFactors:
  Array.isArray(raw.gemRiskFactors)
    ? raw.gemRiskFactors.slice(0, 4).map(function(v) {
        return typeof v === "string" ? v.slice(0, 120) : null;
      }).filter(Boolean)
    : [],

minorConcerns: safeStr(raw.minorConcerns, "No additional visible concerns identified."),
    ...(cardType==='pokemon'?conditionPresentation({...raw,inspectedSides,imageLimitations:[...(Array.isArray(raw.imageLimitations)?raw.imageLimitations:[]),...(!inspectedSides.includes('back')?['back_not_visible']:[])]}):{}),
    ...(cardType!=='pokemon'?retainSportsVisionEvidence(raw,inspectedSides):{}),
  };
}
// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 })
  : null;

// ─── Text-only prediction (existing logic, unchanged) ─────────────────────────
async function fetchPrediction(
  cardName,
  cardType,
  cardSet,
  condition
) {
  if (!anthropic) throw new Error("NO_API_KEY");

  const typeLabel      = CARD_TYPE_LABELS[cardType] || "Card";
const setLabel       = cardSet || "not specified";
const conditionLabel = CONDITION_LABELS[condition] || CONDITION_LABELS.strong;

// Preliminary unstructured pricing was removed. Only canonical local screening may supply discovery evidence.
const marketContext = "";

  const prompt =
  "IMPORTANT MARKET RULES:\n" +
"- Active eBay listing prices are asking prices, NOT verified completed sales or authoritative market value.\n" +
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
    
    "Use the condition estimate to calibrate:\n" +
    "- PSA 10 probability (be conservative — most cards do not gem)\n" +
    "- Verdict (factor in whether condition makes grading a realistic ROI)\n" +
    "- Analysis (be direct and practical, not generic)\n" +
    "- Action (give a specific actionable recommendation)\n\n" +
    "Respond with ONLY a single raw JSON object. No markdown. No backticks. No extra text before or after.\n\n" +
    "Required fields:\n" +
    "cardTitle - full proper card name (string)\n" +
    "cardMeta - set name, year, variant details (string)\n" +
    "rawValue - realistic ungraded USD market estimate (integer)\n" +
    "psa9Value - realistic PSA 9 USD estimate (integer)\n" +
    "psa10Value - realistic PSA 10 USD estimate (integer)\n" +
    "psa10Probability - honest 0-100 chance of PSA 10 given this condition (integer — be conservative)\n" +
    "verdict - exactly one of: grade, skip, maybe (string)\n" +
    "gradingUpside - psa10Value minus rawValue minus 80 (integer)\n" +
    "analysis - 2 sentences max: direct, practical, no filler (string)\n" +
    "action - one sentence starting with a verb, specific to this card and condition (string)\n" +
    "psa9Pop - estimated PSA 9 population count based on collector market knowledge (integer)\n" +
    "psa10Pop - estimated PSA 10 population count based on collector market knowledge (integer)\n" +
    "populationInsight - one concise sentence interpreting the population for collectors (string)\n\n" +
    "Population rules:\n" +
    "- psa9Pop and psa10Pop are whole integers — realistic estimates based on known collector market data\n" +
    "- A low psa10Pop relative to psa9Pop suggests scarcity and stronger grading premium\n" +
    "- A high psa10Pop relative to psa9Pop suggests common gem rate and weaker scarcity premium\n" +
    "- populationInsight should be short, direct, and collector-focused (one sentence only)\n\n" +
    "Verdict rules: grade=clear positive ROI with realistic grade potential; " +
    "skip=fee risk outweighs realistic upside given condition; " +
    "maybe=upside exists but depends on actual card condition or market timing.\n" +
    "Be realistic. Most raw cards do not get PSA 10. Standard grading fees are approximately $80. Factor that into all ROI calculations and recommendations.";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("").trim();
  if (!text)   throw new Error("EMPTY_RESPONSE");
  const parsed = extractJSON(text);
  if (!parsed) {
    console.error("[GemPredict] Prediction JSON parse failed", {
      stopReason: message.stop_reason || "unknown",
      textLength: text.length,
      contentBlocks: (message.content || []).length,
    });
    throw new Error("PARSE_FAILED");
  }
  const result = normaliseCard(parsed);
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
  cardType,
  scanDiagnostics=null
) {
  if (!anthropic) throw new Error("NO_API_KEY");
  if (!imageBuffer || imageBuffer.length === 0) return null;

  const typeLabel = CARD_TYPE_LABELS[cardType] || "Card";
  const base64 = imageBuffer.toString("base64");

// Validate mime type for Claude
const VALID_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const mime = VALID_MIME.includes(imageMimeType)
  ? imageMimeType
  : "image/jpeg";

const backBase64 = backImageBuffer
  ? backImageBuffer.toString("base64")
  : null;

const backMime = backImageMimeType &&
  VALID_MIME.includes(backImageMimeType)
  ? backImageMimeType
  : "image/jpeg";

  const imagePrompt=buildSportsVisionPrompt({cardName,typeLabel,hasBack:!!backBase64});

  scanDiagnostics?.vision('request_started');
  const message = await anthropic.messages.create({
    model: VISION_MODEL, max_tokens: visionOutputBudget(!!backBase64),
    messages: [{
      role: "user",
      content: [
  ...(cardType==='pokemon'?[{type:"text",text:"Image 1 — FRONT photo."}]:[]),
  {
    type: "image",
    source: {
      type: "base64",
      media_type: mime,
      data: base64,
    },
  },

  ...(backBase64
    ? [...(cardType==='pokemon'?[{type:"text",text:"Image 2 — BACK photo."}]:[]),{
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
    text: cardType==='pokemon'?buildVisionPrompt({cardName,typeLabel,hasBack:!!backBase64}):imagePrompt,
  },
      ],
    }],
  });

  let parsed;
  try{parsed=parseVisionMessage(message);}
  catch(error){if(error.message==='ANALYSIS_EMPTY_RESPONSE')scanDiagnostics?.vision('empty_response');else scanDiagnostics?.model(null);throw error;}
  scanDiagnostics?.model(parsed);
  let normalized;
  try{normalized=normaliseImageAnalysis(parsed,backImageBuffer?['front','back']:['front'],cardType);}
  catch{scanDiagnostics?.normalized(null);throw new Error('ANALYSIS_NORMALIZATION_FAILED');}
  scanDiagnostics?.normalized(normalized);
  if (!normalized) console.error("[GemPredict] Vision normalization failed", { stopReason: message.stop_reason || "unknown" });
  if(!normalized)throw new Error('ANALYSIS_NORMALIZATION_FAILED');
  return normalized;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const scanDiagnostics = beginScanDiagnostics(req,res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

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
await scanDiagnostics?.images(imageBuffer,backImageBuffer);
  } catch (parseErr) {
    const failure=scanFailure('UPLOAD_PROCESSING_FAILED');return res.status(failure.status).json(failure.payload);
  }

  const cardName  = sanitiseString(fields.cardName  || "");
  const cardSet   = sanitiseString(fields.cardSet   || "");
  const email     = sanitiseString(fields.email     || "");
  const condition = ["risky", "strong", "gem"].includes(fields.condition) ? fields.condition : "strong";
  const cardTypeRaw = typeof fields.cardType === "string" ? fields.cardType.trim().toLowerCase() : "";
  const cardType    = VALID_CARD_TYPES.has(cardTypeRaw) ? cardTypeRaw : "tcg";

  scanDiagnostics?.category(cardType);
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
    return res.status(400).json({ error: "Image file is too large. Please upload a prepared image under 1.6 MB." });
  }

  // Explicitly isolated mode shares the same parser, image checks and hourly cap.
  if(fields.mode && !['identity','full'].includes(fields.mode))return res.status(400).json({error:'Unsupported scan mode.'});
  if(fields.mode==='identity'){
    scanDiagnostics?.stage('identity');
    if(!imageBuffer)return res.status(400).json({error:'A front photograph is required to identify a card.'});
    try{
      const identity=await identifyFromPhotos({client:anthropic,front:imageBuffer,frontMime:imageMimeType,back:backImageBuffer,backMime:backImageMimeType,cardType,fields,diagnostics:scanDiagnostics,fetchImpl:fetch});
      return res.status(200).json({...identity,remaining:rateCheck.remaining});
    }catch(error){
      const runtime=error.message==='IDENTITY_VERIFICATION_RUNTIME_FAILED';
      const failure=runtime?scanFailure('VERIFICATION_RUNTIME_FAILED'):providerFailure(error);
      if(!runtime&&!['ANALYSIS_RESPONSE_INCOMPLETE','ANALYSIS_EMPTY_RESPONSE','ANALYSIS_RESPONSE_INVALID'].includes(error.message))scanDiagnostics?.vision(error.message==='NO_API_KEY'?'provider_not_configured':[401,403].includes(error.status)?'provider_authentication_failed':error.status===429?'rate_limited':'request_failed');
      return res.status(failure.status).json({...failure.payload,...(safeIdentityValidation(error.identityValidation)?{identityValidation:safeIdentityValidation(error.identityValidation)}:{})});
    }
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

  let failureStage='analysis';
  try {
    let imageAnalysis = null;
    let analysisFailure=null;

    if (imageBuffer) {
      imageAnalysis = await fetchImageAnalysis(
        imageBuffer,
        imageMimeType,
        backImageBuffer,
        backImageMimeType,
        cardName,
        cardType,
        scanDiagnostics
      ).catch(function(err) {
        analysisFailure=providerFailure(err);
        if(!['ANALYSIS_RESPONSE_INCOMPLETE','ANALYSIS_EMPTY_RESPONSE','ANALYSIS_RESPONSE_INVALID','ANALYSIS_NORMALIZATION_FAILED'].includes(err.message))scanDiagnostics?.vision(err.message==='NO_API_KEY'?'provider_not_configured':[401,403].includes(err.status)?'provider_authentication_failed':err.status===429?'rate_limited':'request_failed');
        console.error('[GemPredict] Image analysis failed',analysisFailure.payload.code);
        return null;
      });
    }

    // A photo upload must never result in a fabricated generic-card valuation.
    // Retain the original full report behavior whenever vision actually succeeds.
    if (imageBuffer && !imageAnalysis) {
      console.error("[GemPredict] Photo scan stopped: no usable image-analysis result");
      const failure=analysisFailure||scanFailure('ANALYSIS_NORMALIZATION_FAILED');
      return res.status(failure.status).json(failure.payload);
    }

    failureStage='verification';
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

    let canonicalCard = buildCanonicalCardFromImageAnalysis(
  imageAnalysis,
  cardName,
  cardSet
);

console.log("[Atlas Identity Debug]", {
  imageAnalysisIdentity: imageAnalysis
    ? {
        year: imageAnalysis.identifiedYear,
        franchise: imageAnalysis.identifiedFranchise,
        manufacturer: imageAnalysis.identifiedManufacturer,
        set: imageAnalysis.identifiedBrandSet,
        subject: imageAnalysis.identifiedSubject,
        number: imageAnalysis.identifiedCardNumber,
        parallel: imageAnalysis.identifiedParallel,
        language: imageAnalysis.identifiedLanguage,
        confidence: imageAnalysis.identityConfidence,
        notes: imageAnalysis.identityNotes,
      }
    : null,
  canonicalCard,
});

const atlasIdentityConfidence =
  calculateIdentityConfidence(imageAnalysis || {});
const identityEvidence = assessIdentityEvidence(imageAnalysis, { cardName, cardSet });

// Pokémon uses the independent October pipeline; sports retains its current path.
let pokemonIdentity=null;
let catalogCrossCheck={status:'not_checked',verified:false};
let catalogTitleCandidate=null;
if(imageAnalysis&&cardType==='pokemon'){
 pokemonIdentity=await resolvePokemonIdentity(imageAnalysis,fields,{fetchImpl:fetch,clientId:process.env.EBAY_PROD_CLIENT_ID,clientSecret:process.env.EBAY_PROD_CLIENT_SECRET});
 canonicalCard=pokemonIdentity.canonicalCard;
 catalogCrossCheck=pokemonIdentity.catalogCrossCheck;
 effectiveCardName=canonicalCard?.displayName||effectiveCardName;
 effectiveCardSet=canonicalCard?.brandSet||effectiveCardSet;
}

const identityReviewToken = imageBuffer ? issueIdentityReviewToken({catalogId:catalogCrossCheck.catalogId, subject:pokemonIdentity?canonicalCard?.subject:imageAnalysis?.identifiedSubject, number:pokemonIdentity?canonicalCard?.cardNumber:imageAnalysis?.identifiedCardNumber, set:pokemonIdentity?canonicalCard?.brandSet:imageAnalysis?.identifiedBrandSet, conflicts:catalogCrossCheck.conflicts||[],imageAnalyzed:Boolean(imageAnalysis)}) : null;
const soldIdentityGate = assessSoldIdentityGate({
  cardType,
  crossCheck: catalogCrossCheck,
  artwork: catalogCrossCheck.artwork,
  photoIdentity: { subject: imageAnalysis?.identifiedSubject, number: imageAnalysis?.identifiedCardNumber,
    set: imageAnalysis?.identifiedBrandSet, printingConfirmed: false }
});

    const identityV2 = canonicalIdentityV2({category:cardType === 'pokemon' ? 'pokemon' : cardType === 'sports' ? 'sports' : 'unknown',vision:imageAnalysis||{},catalog:catalogCrossCheck});
    const sportsIdentityAudit = cardType === 'sports' ? auditSportsIdentity(imageAnalysis||{},'unspecified') : null;
    const financialDecision = financialEligibility(identityV2);
    const prediction = financialDecision.allowed
      ? await fetchPrediction(effectiveCardName,cardType,effectiveCardSet,condition)
      : {cardTitle:canonicalCard?.displayName||effectiveCardName,cardMeta:effectiveCardSet};

    if (catalogTitleCandidate) {
      prediction.cardTitle = effectiveCardName;
      prediction.cardMeta = effectiveCardSet + " — Catalog candidate; artwork/printing not verified";
    } else if (!pokemonIdentity && imageAnalysis && !hasUserCardName && identifiedCardName) {
      prediction.cardTitle = identifiedCardName;
      prediction.cardMeta = effectiveCardSet || prediction.cardMeta;
    }

const atlas = null; // Financial recommendations require independent identity and qualified sales.

    logRequest({
  ip,
  cardName: effectiveCardName,
  cardType,
  cardSet: effectiveCardSet,
  status: "success",
});

   
  let marketData = null;

  try {
    const context = internalMarketContext(process.env.NEXT_PUBLIC_SITE_URL,process.env,req.headers);
    scanDiagnostics?.market('routing',context.ok);
    if (!context.ok) throw new Error(context.reason);
    const baseUrl = context.baseUrl;
  
      const marketQueries = [
        ...buildSearchCandidates(pokemonIdentity ? {...imageAnalysis,identifiedYear:canonicalCard.year,identifiedBrandSet:canonicalCard.brandSet,identifiedSubject:canonicalCard.subject,identifiedCardNumber:canonicalCard.cardNumber,identifiedParallel:canonicalCard.parallel} : catalogTitleCandidate ? { ...imageAnalysis, identifiedSubject: catalogTitleCandidate.name, identifiedBrandSet: catalogTitleCandidate.set.name } : (imageAnalysis || {})),
        buildMarketQueryFromCanonicalCard(canonicalCard),
        effectiveCardName,
        prediction.cardTitle,
      ]
        .filter(Boolean)
        .map(function(q) {
          return q
            .replace(/,/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        })
        .filter(function(q, i, arr) {
          return q && arr.indexOf(q) === i;
        });
  
    const lookupIdentity = {
      year: canonicalCard?.year || "",
      brand: imageAnalysis?.identifiedManufacturer || "",
      set: canonicalCard?.brandSet || "",
      player: canonicalCard?.subject || "",
      cardNumber: canonicalCard?.cardNumber || "",
      parallel: canonicalCard?.parallel || "",
      autoOrRelic: imageAnalysis?.identifiedAutoOrRelic || "",
    };
    const stamp=imageAnalysis?.identifiedSerialNumber?.match(/^\s*\d+\s*\/\s*(\d+)\s*$/);
    if(stamp)lookupIdentity.printRun=stamp[1];
    if(!identityComplete(lookupIdentity))throw new Error('identity_incomplete');
    if(pokemonIdentity){
      if(!pokemonIdentity.valuationIdentityGate.allowed)throw new Error('identity_incomplete');
      Object.assign(lookupIdentity,{game:'pokemon',brand:'',language:canonicalCard.language||'',variantIdentity:JSON.stringify(canonicalCard.variant||{})});
    }
    const attempts = [];
    // Bounded progressively broader discovery; acceptance remains identity-strict.
    for (const q of marketQueries.slice(0, 6)) {
      const params = new URLSearchParams({q});
      for (const [k,v] of Object.entries(lookupIdentity)) if(v)params.set(k,v);
      scanDiagnostics?.market('request');
      const response = await fetch(baseUrl + "/api/ebay-search?" + params.toString(),{headers:context.headers,redirect:"manual",signal:AbortSignal.timeout(12000)});
      scanDiagnostics?.market('status',response.status);
      if (!response.ok) continue;
      const candidate = await response.json();
      if (!candidate.success) continue;
      attempts.push({query:q,found:candidate.count||0,accepted:candidate.marketSummary?.rawComparableCount||0,rejected:candidate.marketSummary?.rejectedCount||0});
      if (!marketData || (candidate.marketSummary?.rawComparableCount||0) > (marketData.marketSummary?.rawComparableCount||0)) {
        marketData = {...candidate,queryUsed:q};
      }
      if ((marketData?.marketSummary?.rawComparableCount||0)>=5)break;
    }
    if(marketData)marketData.queryAttempts=attempts;
  } catch (marketErr) {
  marketData = {
    success: false,
    error: "Market data unavailable",
    reason: /^(?:production_host_blocked|missing_or_invalid_deployment_origin|mismatched_deployment_origin|preview_protection_token_unavailable|invalid_internal_base_url|missing_internal_base_url|identity_incomplete)$/.test(marketErr.message) ? marketErr.message : "market_request_unavailable",
  };
}

    failureStage='report';
    const graderScenariosV2 = emptyGraderScenarios();

    return res.status(200).json(protectFinancialReport({
  success: true,
  scanNotices:[...(!marketData||marketData.success===false?[scanFailure('MARKETPLACE_UNAVAILABLE').payload]:[]),...(pokemonIdentity&&!pokemonIdentity.valuationIdentityGate.allowed?[scanFailure('VERIFICATION_UNRESOLVED').payload]:[])],
  identityV2,
  graderScenariosV2,
  sportsIdentityAudit,
  prediction,
  marketData,
  imageAnalysis,
  atlas,
  atlasIdentityConfidence,
  canonicalCard,
  ...(process.env.NODE_ENV==='development'&&pokemonIdentity?{identityDiagnostics:{catalog:{...pokemonIdentity.identityVerification.catalog,diagnostics:pokemonIdentity.catalogDiagnostics}}}:{}),
  identityEvidence,
  ...(pokemonIdentity?{identityVerification:pokemonIdentity.identityVerification,originalIdentityObservation:pokemonIdentity.originalIdentityObservation,originalCanonicalCard:pokemonIdentity.originalCanonicalCard,userIdentityConflicts:pokemonIdentity.userIdentityConflicts,variantVerification:pokemonIdentity.variantVerification,artworkStatus:pokemonIdentity.artworkStatus,physicalPrintingStatus:pokemonIdentity.physicalPrintingStatus,identityEvidenceItems:pokemonIdentity.identityEvidenceItems,identityEvidenceExclusions:pokemonIdentity.identityEvidenceExclusions,identityEvidenceSearch:pokemonIdentity.search,runtimeCatalogAssets:pokemonIdentity.runtimeCatalogAssets}:{}),
  catalogCrossCheck,
  soldIdentityGate,
  identityReviewToken,
  hasImageAnalysis: imageAnalysis !== null,
  remaining: rateCheck.remaining,
  emailSaved,
}));

  } catch (err) {
    const failure=scanFailure(failureStage==='verification'?'VERIFICATION_RUNTIME_FAILED':'UNEXPECTED_SCAN_ERROR');
    console.error('[GemPredict] Scan failure',failure.payload.code);
    return res.status(failure.status).json(failure.payload);
  }
}
