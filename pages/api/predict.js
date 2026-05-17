// pages/api/predict.js
// GemPredict — Card grading prediction API route
//
// ENVIRONMENT VARIABLES REQUIRED:
//   CLAUDE_API_KEY               — Anthropic API key
//   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase service role secret

import Anthropic from "@anthropic-ai/sdk";
import supabase from "../../lib/supabaseServer";

// ─── Config ───────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const CARD_NAME_MIN     = 2;
const CARD_NAME_MAX     = 80;
const CARD_SET_MAX      = 60;

const VALID_CARD_TYPES = new Set([
  "pokemon", "sports", "mtg", "yugioh", "dragonball", "onepiece", "tcg",
]);

const CARD_TYPE_LABELS = {
  pokemon: "Pokemon", sports: "Sports Card", mtg: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!", dragonball: "Dragon Ball", onepiece: "One Piece", tcg: "Other TCG",
};

// Condition labels sent from the frontend
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

function normaliseCard(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const VALID_VERDICTS = ["grade", "skip", "maybe"];
  const verdictRaw = typeof raw.verdict === "string" ? raw.verdict.trim().toLowerCase() : "";
  const verdict    = VALID_VERDICTS.includes(verdictRaw) ? verdictRaw : "maybe";
  const rawValue   = Math.max(0, safeInt(raw.rawValue));
  const psa9Value  = Math.max(0, safeInt(raw.psa9Value));
  const psa10Value = Math.max(0, safeInt(raw.psa10Value));
  const psa10Prob  = Math.min(100, Math.max(0, safeInt(raw.psa10Probability, 50)));
  const gradingUpside = raw.gradingUpside != null ? safeInt(raw.gradingUpside) : psa10Value - rawValue - 25;

  // Population fields — safe integers, null if missing (frontend renders conditionally)
  const psa9Pop  = raw.psa9Pop  != null ? Math.max(0, safeInt(raw.psa9Pop))  : null;
  const psa10Pop = raw.psa10Pop != null ? Math.max(0, safeInt(raw.psa10Pop)) : null;
  const populationInsight = typeof raw.populationInsight === "string" && raw.populationInsight.trim()
    ? raw.populationInsight.trim().slice(0, 200)
    : null;

  return {
    cardTitle:        (typeof raw.cardTitle === "string" && raw.cardTitle.trim() ? raw.cardTitle.trim() : "Unknown Card").slice(0, 120),
    cardMeta:         (typeof raw.cardMeta  === "string" && raw.cardMeta.trim()  ? raw.cardMeta.trim()  : "Details unavailable").slice(0, 200),
    rawValue, psa9Value, psa10Value,
    psa10Probability: psa10Prob,
    verdict, gradingUpside,
    analysis: (typeof raw.analysis === "string" && raw.analysis.trim() ? raw.analysis.trim() : "No analysis available.").slice(0, 500),
    action:   typeof raw.action   === "string" && raw.action.trim()   ? raw.action.trim().slice(0, 200) : null,
    psa9Pop, psa10Pop, populationInsight,
  };
}

// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

async function fetchPrediction(cardName, cardType, cardSet, condition) {
  if (!anthropic) throw new Error("NO_API_KEY");

  const typeLabel      = CARD_TYPE_LABELS[cardType] || "Card";
  const setLabel       = cardSet || "not specified";
  const conditionLabel = CONDITION_LABELS[condition] || CONDITION_LABELS.strong;

  // Improved prompt: condition-aware, conservative, ROI-focused
  const prompt =
    "You are an experienced card grading ROI analyst helping collectors make smarter submission decisions.\n\n" +
    "Your job is to give a realistic grading ROI analysis using CURRENT collector market awareness.\n" +
"Think like an experienced card dealer who understands modern hobby demand, PSA premiums, grail cards, liquidity, rarity, and collector behavior.\n" +
"Be conservative about card condition and PSA 10 probability, but do NOT artificially lowball iconic chase cards, modern grails, rare alt arts, or historically high-demand collectibles.\n" +
"Reflect realistic current collector-market pricing behavior when evaluating premium cards.\n\n" +
    "Card: " + cardName + "\n" +
    "Type: " + typeLabel + "\n" +
    "Set/Year: " + setLabel + "\n" +
    "Collector's condition estimate: " + conditionLabel + "\n\n" +
    "IMPORTANT MARKET CONTEXT:\n" +
"For iconic chase cards, rare alt arts, vintage grails, major rookie cards, and highly liquid collectibles, assume collector demand and PSA premiums may be substantially higher than conservative historical averages.\n" +
"When uncertain, prefer realistic modern collector-market pricing behavior over outdated low-end estimates.\n" +
"Use broad hobby awareness of current collector demand, rarity, liquidity, and grading premiums.\n\n" +
    "Use the condition estimate to calibrate:\n" +
    "- PSA 10 probability (be conservative — most cards do not gem)\n" +
    "- Verdict (factor in whether condition makes grading a realistic ROI)\n" +
    "- Analysis (be direct and practical, not generic)\n" +
    "- Action (give a specific actionable recommendation)\n\n" +
    "Respond with ONLY a single raw JSON object. No markdown. No backticks. No extra text before or after.\n\n" +
    "Required fields:\n" +
    "cardTitle - full proper card name (string)\n" +
    "cardMeta - set name, year, variant details (string)\n" +
    "rawValue - realistic CURRENT collector-market raw USD estimate based on modern hobby demand (integer)\n" +
"psa9Value - realistic CURRENT collector-market PSA 9 USD estimate (integer)\n" +
"psa10Value - realistic CURRENT collector-market PSA 10 USD estimate (integer)\n" +
    "psa10Probability - honest 0-100 chance of PSA 10 given this condition (integer — be conservative)\n" +
    "verdict - exactly one of: grade, skip, maybe (string)\n" +
    "gradingUpside - psa10Value minus rawValue minus 25 (integer)\n" +
    "analysis - 2 sentences max: direct, practical, no filler (string)\n" +
    "action - one sentence starting with a verb, specific to this card and condition (string)\n" +
    "psa9Pop - estimated PSA 9 population count based on collector market knowledge (integer)\n" +
    "psa10Pop - estimated PSA 10 population count based on collector market knowledge (integer)\n" +
    "populationInsight - one concise sentence interpreting the population for collectors: " +
    "is the PSA 10 scarce relative to PSA 9 (strong premium), common (weaker scarcity), or meaningful for this card's upside? (string)\n\n" +
    "Population rules:\n" +
    "- psa9Pop and psa10Pop are whole integers — realistic estimates based on known collector market data\n" +
    "- A low psa10Pop relative to psa9Pop suggests scarcity and stronger grading premium\n" +
    "- A high psa10Pop relative to psa9Pop suggests common gem rate and weaker scarcity premium\n" +
    "- populationInsight should be short, direct, and collector-focused (one sentence only)\n\n" +
    "Verdict rules: grade=clear positive ROI with realistic grade potential; " +
    "skip=fee risk outweighs realistic upside given condition; " +
    "maybe=upside exists but depends on actual card condition or market timing.\n" +
    "Be realistic. Most raw cards do not get PSA 10. Grading fees are $25+. Factor that in.";

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

  const body      = req.body || {};
  const cardName  = sanitiseString(body.cardName);
  const cardSet   = sanitiseString(body.cardSet   || "");
  const email     = sanitiseString(body.email     || "");
  const condition = ["risky", "strong", "gem"].includes(body.condition) ? body.condition : "strong";
  const cardTypeRaw = typeof body.cardType === "string" ? body.cardType.trim().toLowerCase() : "";
  const cardType    = VALID_CARD_TYPES.has(cardTypeRaw) ? cardTypeRaw : "tcg";

  if (!cardName) { logRequest({ ip, cardName, cardType, cardSet, status: "invalid_input", errorMessage: "missing card name" }); return res.status(400).json({ error: "Card name is required." }); }
  if (cardName.length < CARD_NAME_MIN) { logRequest({ ip, cardName, cardType, cardSet, status: "invalid_input", errorMessage: "too short" }); return res.status(400).json({ error: "Card name must be at least " + CARD_NAME_MIN + " characters." }); }
  if (cardName.length > CARD_NAME_MAX) { logRequest({ ip, cardName, cardType, cardSet, status: "invalid_input", errorMessage: "too long" }); return res.status(400).json({ error: "Card name must be " + CARD_NAME_MAX + " characters or fewer." }); }
  if (cardSet.length > CARD_SET_MAX)   { logRequest({ ip, cardName, cardType, cardSet, status: "invalid_input", errorMessage: "set too long" }); return res.status(400).json({ error: "Set / year must be " + CARD_SET_MAX + " characters or fewer." }); }
  if (looksLikeJunk(cardName))         { logRequest({ ip, cardName, cardType, cardSet, status: "invalid_input", errorMessage: "junk input" }); return res.status(400).json({ error: "Please enter a valid card name." }); }

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
    const prediction = await fetchPrediction(cardName, cardType, cardSet, condition);
    logRequest({ ip, cardName, cardType, cardSet, status: "success" });
    return res.status(200).json({ success: true, prediction, remaining: rateCheck.remaining, emailSaved });
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
