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
const IMAGE_MAX_BYTES   = 5 * 1024 * 1024; // 5 MB hard limit

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
        uploadDir: "/tmp",
        keepExtensions: true,
        filter: function(part) {
          // Only allow image files through
          return part.mimetype && part.mimetype.startsWith("image/");
        },
      });

      form.parse(req, function(err, fields, files) {
        if (err) { reject(err); return; }

        // formidable v3 returns arrays for all values
        const flat = {};
        for (const key of Object.keys(fields)) {
          flat[key] = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
        }

        let imageBuffer = null;
        let imageMimeType = null;
        let backImageBuffer = null;
        let backImageMimeType = null;

        const imageFile = files.image ? (Array.isArray(files.image) ? files.image[0] : files.image) : null;
        if (imageFile && imageFile.filepath) {
          try {
            imageBuffer = fs.readFileSync(imageFile.filepath);
            imageMimeType = imageFile.mimetype || "image/jpeg";
            // Clean up temp file — non-fatal
            try { fs.unlinkSync(imageFile.filepath); } catch {}
          } catch (readErr) {
            console.error("[GemPredict] Image read error:", readErr.message);
          }
        }

        const backImageFile = files.backImage ? (Array.isArray(files.backImage) ? files.backImage[0] : files.backImage) : null;
if (backImageFile && backImageFile.filepath) {
  try {
    backImageBuffer = fs.readFileSync(backImageFile.filepath);
    backImageMimeType = backImageFile.mimetype || "image/jpeg";

    // Clean up temp file — non-fatal
    try { fs.unlinkSync(backImageFile.filepath); } catch {}
  } catch (readErr) {
    console.error("[GemPredict] Back image read error:", readErr.message);
  }
}

     resolve({
          fields: flat,
          imageBuffer,
          imageMimeType,
          backImageBuffer,
          backImageMimeType,
        });
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
function normaliseImageAnalysis(raw) {
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
    identifiedYear: raw.identifiedYear != null ? safeStr(raw.identifiedYear, null) : null,
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
  };
}
// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
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

let preMarketData = null;
let preLiveRawMarket = null;

try {
  const preMarketQuery = [
    cardName,
    cardSet,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/Prospect Auto or Base/gi, "")
    .replace(/Prospects/gi, "")
    .replace(/Auto/gi, "")
    .replace(/Base/gi, "")
    .replace(/Parallel/gi, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://gempredict-live.vercel.app";

  const preMarketUrl =
    `${baseUrl}/api/ebay-search?q=` + encodeURIComponent(preMarketQuery);

  const preMarketRes = await fetch(preMarketUrl);
  const preMarketJson = await preMarketRes.json();

  if (preMarketRes.ok && preMarketJson.success) {
    preMarketData = preMarketJson;
    preLiveRawMarket = preMarketJson?.marketSummary?.rawMedian ?? null;
  }
} catch (err) {
  preMarketData = null;
  preLiveRawMarket = null;
}

const marketContext =
  preLiveRawMarket != null
    ? "\n\nLIVE MARKET DATA:\n" +
      "- Current GemPredict Fair Market Value: $" + preLiveRawMarket + "\n" +
      "- Use this as the raw card value baseline.\n" +
      "- Do not refer to a different raw value in the analysis or action.\n"
    : "";
  
  const prompt =
  "IMPORTANT MARKET RULES:\n" +
"- If live market data is available, treat it as the authoritative raw market value.\n" +
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
    model: "claude-sonnet-4-6", max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("").trim();
  if (!text)   throw new Error("EMPTY_RESPONSE");
  const parsed = extractJSON(text);
  if (!parsed) throw new Error("PARSE_FAILED");
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
  cardType
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

  const imagePrompt =
  "You are an expert card pre-grader helping a collector decide whether this card is worth submitting to PSA.\n\n" +
  "Card name: " + (cardName || "unknown") + "\n" +
  "Card type: " + typeLabel + "\n\n" +

  "Your job is NOT to guarantee a PSA grade. Your job is to identify visible grade limiters and estimate the card's realistic grading ceiling from the image.\n\n" +

  "Assess ONLY what is visible in the uploaded image. If the back of the card is not visible, say that this limits confidence. If glare, sleeve reflection, angle, blur, or low resolution limits surface inspection, say so.\n\n" +

  "Think like a strict PSA pre-screen reviewer:\n" +
  "- Centering can cap the grade even if the card is otherwise clean.\n" +
  "- Surface defects are often the biggest hidden risk, especially for holo, chrome, foil, and glossy cards.\n" +
    "- Surface analysis is confidence-sensitive. If glare, shadows, sleeve plastic, blur, reflections, or low image quality prevent reliable inspection, clearly explain that surface confidence is limited instead of assuming the surface is clean.\n" +
  "- Corners and edges should be evaluated for whitening, chipping, fraying, soft corners, dents, and rough cuts.\n" +
  "- One moderate defect can cap the card below a PSA 10 even if other categories look strong.\n" +
    "If any visible crease, bend, dent, corner bend, surface indentation, peeling, major whitening, heavy edge wear, or wrinkle is detected, it MUST be listed as the primaryLimiter and majorGradeCap. Do not say 'no major limiter identified' when a visible crease, bend, or corner damage exists.\n" +
    "Avoid generic grading summaries. Identify the most likely grade cap first, then describe smaller concerns separately.\n" +
    "Hard grading rules:\n" +
"- If a visible crease, wrinkle, bend, dent, peeling layer, or corner fold exists, PSA 10 is impossible.\n" +
"- Visible structural damage must always appear in both primaryLimiter and majorGradeCap.\n" +
"- If visible whitening exists, do not say 'no concerns identified'.\n" +
"- If surface glare or image quality prevents reliable inspection, confidenceLevel cannot be 'high'.\n" +
"- If corners show visible bends or softening, those issues must appear in minorConcerns or majorGradeCap.\n" +
"- If multiple moderate flaws exist together, the grade ceiling should drop accordingly.\n" +
"- Do not give optimistic grades when visible defects clearly cap the card lower.\n\n" +
    "- If visible surface scratches, print lines, chrome lines, dents, dimples, roller marks, or holo scratches are present, surface cannot be rated excellent.\n" +
"- If surface scratches or print lines are clearly visible, they must appear in primaryLimiter, majorGradeCap, or minorConcerns depending on severity.\n" +
"- For Pokemon holo, foil, chrome, and glossy cards, visible surface scratches should materially reduce PSA 10 confidence.\n" +
  "- Do not give a PSA 10 candidate label unless all visible categories look exceptionally clean and image quality is good enough to justify it.\n\n" +

  "Use card-type awareness:\n" +
  "- Pokemon/TCG: pay close attention to holo scratches, whitening, silvering, edge chipping, print lines, and surface dents.\n" +
  "- Chrome/sports parallels: pay close attention to centering, surface lines, dimples, print defects, roller marks, and corner sharpness.\n" +
  "- Vintage cards: be stricter about corner softness, edge wear, print registration, staining, and overall eye appeal.\n\n" +

  "Important consistency rule:\n" +
  "The final overallScore and estimatedGrade MUST logically follow the category ratings and notes. If centering, corners, edges, and surface are all good or excellent with no meaningful defect, the card should generally project as PSA 9 or better unless image confidence is low. If you assign a lower score, explicitly explain the grade-capping issue.\n\n" +

"Card identification task:\n" +
"- Identify the card as specifically as possible from the image and provided card name.\n" +
"- Look for year, brand, set, player/character, card number, parallel, serial numbering, autograph/relic indicators, and visible text.\n" +
"- Do not invent details. If a detail is uncertain, use null and explain uncertainty in identityNotes.\n" +
"- identityConfidence should be high only when visible card text and provided card name strongly agree.\n\n" +

  "Respond with ONLY a single raw JSON object. No markdown. No backticks. No extra text.\n\n" +

  "Required fields:\n" +
  "identifiedYear - likely card year if visible or inferable, otherwise null (string or null)\n" +
"identifiedBrandSet - likely brand/set/product name if visible or inferable, otherwise null (string or null)\n" +
"identifiedSubject - player, character, or card subject if visible or inferable, otherwise null (string or null)\n" +
"identifiedCardNumber - card number if visible or inferable, otherwise null (string or null)\n" +
"identifiedParallel - likely parallel/variant if visible or inferable, otherwise null (string or null)\n" +
"identifiedAutoOrRelic - one of: auto, relic, auto relic, none, unknown (string)\n" +
"identityConfidence - 0-100 confidence in the card identification from image plus provided card name (integer)\n" +
"identityNotes - one short sentence explaining what identity details are certain vs uncertain (string)\n" +
  "centering - one of: excellent, good, fair, poor (string)\n" +
  "centeringNote - specific visible centering assessment, mention left/right and top/bottom if visible (string)\n" +
  "corners - one of: excellent, good, fair, poor (string)\n" +
  "cornersNote - specific visible corner assessment, mention any whitening, softness, fraying, bends, or unclear areas (string)\n" +
  "edges - one of: excellent, good, fair, poor (string)\n" +
  "edgesNote - specific visible edge assessment, mention whitening, chipping, rough cuts, or unclear areas (string)\n" +
  "surface - one of: excellent, good, fair, poor (string)\n" +
  "surfaceNote - specific visible surface assessment, mention scratches, print lines, dimples, glare limitations, haze, staining, or uncertainty (string)\n" +
  "overallScore - realistic estimated grade ceiling from visible evidence, 1-10 integer (integer)\n" +
    "gradeCeiling - realistic PSA ceiling based on visible condition like 'PSA 8 ceiling', 'PSA 9 candidate', or 'PSA 10 upside with risk' (string)\n" +
"primaryLimiter - the single biggest visible issue or uncertainty likely limiting the grade ceiling (string)\n" +
    "majorGradeCap - the biggest visible issue most likely preventing a higher grade, written collector-style (string)\n" +
"minorConcerns - short collector-style list of smaller visible risks or uncertainties separated by commas (string)\n" +
"confidenceLevel - one of: high, moderate, low (string)\n" +
  "gradingRisk - 1-2 sentences explaining the main grade cap or uncertainty. This must directly justify the overallScore (string)\n" +
  "estimatedGrade - short collector-friendly label like 'PSA 8 ceiling', 'PSA 9 candidate', 'PSA 9 with PSA 10 upside', or 'PSA 10 candidate but confidence limited' (string)\n" +
  "mostLikelyGradeRange - short realistic range like 'PSA 8-9 likely' or 'PSA 9 with outside PSA 10 upside' (string)\n" +
  "psa10Upside - one sentence explaining whether PSA 10 is realistically achievable from the visible image (string)\n" +
  "gemRiskFactors - array of 2-4 short PSA 10 risk factors focused on collector submission concerns (array of strings)\n" +
  "worthGrading - based only on visible condition, whether the card appears worth grading before considering market value (boolean)\n" +
  "worthGradingReason - 1 sentence explaining the grading recommendation from visible condition only (string)\n" +
  "imageSummary - 1-2 sentences summarizing the card's visible condition and confidence level (string)\n\n" +

  "Rating scale:\n" +
  "excellent = no meaningful visible flaw in that category\n" +
  "good = minor visible flaw or slight uncertainty\n" +
  "fair = moderate visible flaw that may cap grade\n" +
  "poor = significant visible flaw likely to strongly cap grade\n\n" +

  "Scoring guidance:\n" +
  "10 = only if all visible categories are excellent and image quality is strong\n" +
  "9 = strong card with only minor visible concerns or limited image uncertainty\n" +
  "8 = clean-looking card with one meaningful limiter or moderate uncertainty\n" +
  "7 or below = visible moderate-to-major flaw, multiple issues, or poor image confidence\n\n" +

    "Confidence guidance:\n" +
"high = strong image quality with clearly visible surfaces, corners, and edges\n" +
"moderate = some uncertainty from glare, angle, reflections, or missing card back\n" +
"low = image quality too limited for confident grading assessment\n\n" +

  "Be strict, specific, and internally consistent. Avoid canned language.";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1000,
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
    text: imagePrompt +
      (backBase64
        ? "\n\nBoth front and back images are provided. Evaluate both sides when assessing confidence, corners, edges, whitening, and grading risk."
        : "\n\nOnly the front image is provided. Missing back image should reduce confidence where appropriate."),
  },
      ],
    }],
  });

  const text = (message.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("").trim();
  if (!text) return null;
  const parsed = extractJSON(text);
  if (!parsed) return null;
  return normaliseImageAnalysis(parsed);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
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
  } catch (parseErr) {
    console.error("[GemPredict] Request parse error:", parseErr.message);
    return res.status(400).json({ error: "Could not read request. Please try again." });
  }

  const cardName  = sanitiseString(fields.cardName  || "");
  const cardSet   = sanitiseString(fields.cardSet   || "");
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
    return res.status(400).json({ error: "Image file is too large. Please upload an image under 5 MB." });
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

const effectiveCardName =
  hasUserCardName
    ? cardName.trim()
    : identifiedCardName || "Unknown card from image";

    const effectiveCardSet =
      cardSet && cardSet.trim()
        ? cardSet.trim()
        : [
            imageAnalysis?.identifiedYear,
            imageAnalysis?.identifiedBrandSet,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

    const prediction = await fetchPrediction(
      effectiveCardName,
      cardType,
      effectiveCardSet,
      condition
    );

    if (imageAnalysis && !hasUserCardName && identifiedCardName) {
  prediction.cardTitle = identifiedCardName;
  prediction.cardMeta = effectiveCardSet || prediction.cardMeta;
}

    logRequest({
  ip,
  cardName: effectiveCardName,
  cardType,
  cardSet: effectiveCardSet,
  status: "success",
});

    let marketData = null;

try {
  const marketQuery = [
  imageAnalysis?.identifiedSubject,
  imageAnalysis?.identifiedBrandSet,
  imageAnalysis?.identifiedParallel,
  imageAnalysis?.identifiedCardNumber
    ? "#" + imageAnalysis.identifiedCardNumber
    : null,
  effectiveCardName,
  prediction.cardTitle,
]
  .filter(Boolean)
  .join(" ")
  .replace(/Prospect Auto or Base/gi, "")
  .replace(/Prospects/gi, "")
  .replace(/Special Illustration Rare/gi, "SIR")
  .replace(/Auto/gi, "")
  .replace(/Base/gi, "")
  .replace(/Parallel/gi, "")
  .replace(/,/g, " ")
  .replace(/\s+/g, " ")
  .trim();

   const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://gempredict-live.vercel.app";

const marketUrl =
  `${baseUrl}/api/ebay-search?q=` +
  encodeURIComponent(marketQuery);

  const marketRes = await fetch(marketUrl);
const marketJson = await marketRes.json();

const liveRawMarket =
  marketJson?.marketSummary?.rawMedian ?? null;

  if (marketRes.ok && marketJson.success) {
    marketData = marketJson;
  }
} catch (marketErr) {
  marketData = {
    success: false,
    error: "Market data unavailable",
  };
}

    return res.status(200).json({
  success: true,
  prediction,
  marketData,
  imageAnalysis,
  hasImageAnalysis: imageAnalysis !== null,
  remaining: rateCheck.remaining,
  emailSaved,
});

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
