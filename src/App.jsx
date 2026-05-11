// src/App.jsx — GemPredict main component
import { useState, useRef, useEffect } from "react";
import { track } from "@vercel/analytics/react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_TYPES = [
  { value: "pokemon",    label: "Pokemon" },
  { value: "sports",     label: "Sports Card" },
  { value: "mtg",        label: "Magic: The Gathering" },
  { value: "yugioh",     label: "Yu-Gi-Oh!" },
  { value: "dragonball", label: "Dragon Ball" },
  { value: "onepiece",   label: "One Piece" },
  { value: "tcg",        label: "Other TCG" },
];

const EXAMPLES = [
  { name: "Charizard Holo",         type: "pokemon", set: "1999 Base Set" },
  { name: "LeBron James Rookie",    type: "sports",  set: "2003 Topps Chrome" },
  { name: "Black Lotus",            type: "mtg",     set: "Alpha 1993" },
  { name: "Blue-Eyes White Dragon", type: "yugioh",  set: "LOB 1st Edition" },
];

const VERDICTS = {
  grade: { label: "Grade It",    bg: "#f0fdf4", color: "#15803d", border: "#86efac", explain: "Strong upside — the PSA 10 premium makes grading clearly worth it." },
  skip:  { label: "Skip It",     bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", explain: "Not worth grading — the cost likely exceeds the value gained." },
  maybe: { label: "Consider It", bg: "#fffbeb", color: "#b45309", border: "#fde68a", explain: "Borderline — grading upside depends heavily on card condition." },
};

const VERDICT_USE_CASE = {
  grade: "Best for submission or resale upside.",
  maybe: "Best for condition-sensitive cards — strong gem rate matters here.",
  skip:  "Best to sell raw, hold, or trade rather than submit.",
};

const C = {
  cream: "#f5f3ee", white: "#ffffff", ink: "#0e0f0c",
  inkMid: "#3d3d39", inkSoft: "#7a7a74", border: "#e2dfd8",
  gold: "#c9a84c", goldLight: "#fdf6e3", amber: "#b45309",
  green: "#15803d", greenLight: "#f0fdf4",
  red: "#b91c1c", redLight: "#fef2f2",
};

const LS_HISTORY = "gp_search_history";
const LS_SAVED   = "gp_saved_reports";

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeMoney(val) {
  const n = typeof val === "number" && isFinite(val) ? val : 0;
  try { return n.toLocaleString(); } catch { return String(n); }
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());
}
function getVerdictBullets(data) {
  const upside = typeof data.gradingUpside === "number" ? data.gradingUpside : 0;
  const prob   = typeof data.psa10Probability === "number" ? data.psa10Probability : 50;
  const raw    = data.rawValue || 0;
  const psa10  = data.psa10Value || 0;
  const v      = data.verdict;
  const bullets = [];
  if (v === "grade") {
    bullets.push("PSA 10 premium is strong relative to raw value");
    if (upside > 0) bullets.push("Fee-adjusted upside is approximately $" + safeMoney(upside));
    bullets.push(prob >= 60 ? "PSA 10 probability is solid at ~" + prob + "%" : "PSA 10 probability estimated at ~" + prob + "%");
  } else if (v === "skip") {
    if (upside <= 0) bullets.push("Fee-adjusted upside is negative or break-even");
    if (raw > 500)   bullets.push("Raw value is already high — grading risk may outweigh reward");
    bullets.push(prob < 45 ? "PSA 10 probability is low at ~" + prob + "% — risky submission" : "Grading premium does not justify the submission cost");
    if (bullets.length < 3) bullets.push("Consider selling raw or holding instead");
  } else {
    bullets.push("Upside exists but depends on actual card condition");
    bullets.push(prob >= 50 ? "PSA 10 probability is moderate at ~" + prob + "%" : "PSA 10 odds below 50% — condition is the deciding factor");
    bullets.push(psa10 > raw * 2 ? "PSA 10 premium is meaningful if gem mint is achievable" : "Raw to PSA 10 uplift is limited at current market levels");
  }
  return bullets.slice(0, 3);
}
function buildCopySummary(data) {
  const v = VERDICTS[data.verdict] ? VERDICTS[data.verdict].label : data.verdict;
  return "GemPredict Report — " + data.cardTitle +
    " | Raw: $" + safeMoney(data.rawValue) +
    " | PSA 9: $" + safeMoney(data.psa9Value) +
    " | PSA 10: $" + safeMoney(data.psa10Value) +
    " | Upside: " + (data.gradingUpside >= 0 ? "+$" : "-$") + safeMoney(Math.abs(data.gradingUpside || 0)) +
    " | Verdict: " + v;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Outfit', system-ui, sans-serif; background: #f5f3ee; }
  .gp-field-row      { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .gp-search-row     { display: grid; grid-template-columns: 1fr auto; gap: 0.9rem; align-items: end; }
  .gp-value-grid     { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.85rem; }
  .gp-nav-links      { display: flex; gap: 1.5rem; align-items: center; }
  .gp-trust-grid     { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .gp-collector-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; margin-bottom: 3.5rem; }
  .gp-plan-grid      { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .gp-faq-item summary { list-style: none; cursor: pointer; }
  .gp-faq-item summary::-webkit-details-marker { display: none; }
  .gp-hero-logo { width: 180px; }
  button, input, select { font-family: inherit; }
  @media (max-width: 680px) {
    .gp-field-row      { grid-template-columns: 1fr !important; }
    .gp-search-row     { grid-template-columns: 1fr !important; }
    .gp-search-row button { width: 100% !important; }
    .gp-value-grid     { grid-template-columns: 1fr !important; }
    .gp-nav-links      { display: none !important; }
    .gp-collector-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
    .gp-trust-grid     { grid-template-columns: 1fr 1fr !important; }
    .gp-plan-grid      { grid-template-columns: 1fr !important; }
    .gp-hero-logo      { width: 120px !important; }
  }
  @media (max-width: 420px) {
    .gp-trust-grid { grid-template-columns: 1fr !important; }
  }
`;

const inputSt = { width: "100%", padding: "0.85rem 1rem", border: "1.5px solid " + C.border, borderRadius: 12, fontSize: "1rem", color: C.ink, background: C.white, outline: "none", appearance: "none" };
const labelSt = { display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.inkSoft, marginBottom: "0.45rem" };
const eyebrowSt = { fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: "0.6rem" };
const sectionH2St = { fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.75rem" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function FAQItem({ q, a }) {
  return (
    <details className="gp-faq-item" style={{ borderBottom: "1px solid " + C.border }}>
      <summary style={{ padding: "1.1rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: C.ink }}>{q}</span>
        <span style={{ fontSize: "1.1rem", color: C.gold, flexShrink: 0, fontWeight: 300 }}>+</span>
      </summary>
      <div style={{ fontSize: "0.9rem", color: C.inkMid, lineHeight: 1.8, paddingBottom: "1.1rem", fontWeight: 300, maxWidth: 640 }}>{a}</div>
    </details>
  );
}

function EmptyState() {
  return (
    <div style={{ marginTop: "2rem", border: "1.5px dashed " + C.border, borderRadius: 18, padding: "2.5rem 1.5rem", textAlign: "center", background: C.cream }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: C.inkMid, marginBottom: "0.4rem" }}>
        Your grading report will appear here
      </div>
      <div style={{ fontSize: "0.85rem", color: C.inkSoft, fontWeight: 300, marginBottom: "1rem" }}>
        Search a card above to see raw value, PSA grade estimates, grading upside, and a recommendation.
      </div>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
        {["Compare raw vs graded value", "Estimate PSA 10 upside", "Avoid wasted grading fees"].map(function(b) {
          return (
            <span key={b} style={{ fontSize: "0.75rem", fontWeight: 500, background: C.white, border: "1px solid " + C.border, color: C.inkSoft, padding: "0.25rem 0.7rem", borderRadius: 100 }}>
              {b}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ data, index, onSave, isSaved }) {
  const verdict  = VERDICTS[data.verdict] || VERDICTS.maybe;
  const profit   = typeof data.gradingUpside === "number" ? data.gradingUpside : 0;
  const barPct   = Math.min(100, Math.max(4, (Math.abs(profit) / Math.max(data.psa10Value || 1, 1)) * 100));
  const bullets  = getVerdictBullets(data);
  const useCase  = VERDICT_USE_CASE[data.verdict] || VERDICT_USE_CASE.maybe;
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  function handleCopy() {
    try { navigator.clipboard.writeText(buildCopySummary(data)); } catch {}
    setCopied(true); setTimeout(function() { setCopied(false); }, 2000);
  }
  function handleShare() {
    const summary = buildCopySummary(data);
    if (navigator.share) { navigator.share({ title: "GemPredict Report", text: summary }).catch(function() {}); }
    else { try { navigator.clipboard.writeText(summary); } catch {} }
    setShared(true); setTimeout(function() { setShared(false); }, 2000);
  }

  return (
    <div style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", animation: "fadeUp 0.4s " + (index * 0.07) + "s ease both" }}>
      {/* Header */}
      <div style={{ background: verdict.bg, borderBottom: "1px solid " + verdict.border, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: verdict.color }}>Grading Decision Report</div>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, background: C.ink, color: C.gold, padding: "0.1rem 0.4rem", borderRadius: 4, letterSpacing: "0.06em" }}>BETA</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: C.ink }}>{data.cardTitle}</div>
          <div style={{ fontSize: "0.75rem", color: C.inkSoft, marginTop: "0.15rem" }}>{data.cardMeta}</div>
          <div style={{ fontSize: "0.68rem", color: C.inkSoft, marginTop: "0.35rem", fontStyle: "italic" }}>
            Market-based AI estimate using collector pricing patterns.
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ background: verdict.color, color: "#fff", fontSize: "0.875rem", fontWeight: 800, padding: "0.45rem 1rem", borderRadius: 100, whiteSpace: "nowrap" }}>{verdict.label}</div>
          {data.psa10Probability != null && (
            <div style={{ fontSize: "0.7rem", color: verdict.color, fontWeight: 600, marginTop: "0.3rem" }}>~{data.psa10Probability}% PSA 10</div>
          )}
        </div>
      </div>

      <div style={{ padding: "1.1rem 1.25rem" }}>
        <div style={{ fontSize: "0.82rem", color: C.inkMid, fontStyle: "italic", marginBottom: "1rem" }}>{verdict.explain}</div>
        {/* Value grid */}
        <div className="gp-value-grid" style={{ marginBottom: "0.9rem" }}>
          {[
            { label: "Raw Value",   val: data.rawValue,   featured: false },
            { label: "PSA 9 Value", val: data.psa9Value,  featured: false },
            { label: "PSA 10",      val: data.psa10Value, featured: true  },
          ].map(function(b) {
            return (
              <div key={b.label} style={{ background: b.featured ? C.goldLight : C.cream, border: "1.5px solid " + (b.featured ? C.gold : C.border), borderRadius: 12, padding: "0.85rem 0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: b.featured ? C.amber : C.inkSoft, marginBottom: "0.3rem" }}>{b.label}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", fontWeight: 700, color: b.featured ? C.amber : C.ink }}>{"$" + safeMoney(b.val)}</div>
              </div>
            );
          })}
        </div>
        {/* Upside bar */}
        <div style={{ background: C.cream, borderRadius: 10, padding: "0.85rem 1rem", marginBottom: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.inkSoft }}>Grading Upside (PSA 10)</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: profit >= 0 ? C.green : C.red }}>{(profit >= 0 ? "+$" : "-$") + safeMoney(Math.abs(profit))}</span>
          </div>
          <div style={{ background: C.border, borderRadius: 100, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 100, background: profit >= 0 ? C.green : C.red, width: barPct + "%", transition: "width 0.9s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          <div style={{ fontSize: "0.7rem", color: C.inkSoft, marginTop: "0.35rem" }}>After $25 PSA fee</div>
        </div>
        {/* Population Report */}
        {(data.psa9Pop != null || data.psa10Pop != null) && (function() {
          // Scarcity signal: PSA 10 pop low relative to PSA 9 = scarce = positive tone
          const scarce = data.psa9Pop != null && data.psa10Pop != null && data.psa10Pop < data.psa9Pop * 0.3;
          const common = data.psa9Pop != null && data.psa10Pop != null && data.psa10Pop > data.psa9Pop * 0.6;
          const accentColor  = scarce ? C.green  : common ? C.amber  : C.inkSoft;
          const accentBg     = scarce ? C.greenLight : common ? C.goldLight : C.cream;
          const accentBorder = scarce ? "#86efac" : common ? C.gold    : C.border;
          const scarcityNote = scarce ? "Lower PSA 10 population supports scarcity." : null;
          return (
            <div style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden", marginBottom: "0.9rem" }}>
              {/* Header */}
              <div style={{ padding: "0.65rem 1rem", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: C.inkSoft }}>
                  Population Report
                </span>
                <span style={{ fontSize: "0.65rem", color: C.inkSoft, fontStyle: "italic" }}>AI estimate</span>
              </div>
              {/* Pop count row — both columns always render; missing values show — */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid " + C.border }}>
                {[
                  { label: "PSA 9 Population",  val: data.psa9Pop,  featured: false },
                  { label: "PSA 10 Population", val: data.psa10Pop, featured: true  },
                ].map(function(p, idx) {
                  const display = p.val != null ? p.val.toLocaleString() : "—";
                  const numColor = p.val == null ? C.inkSoft : (p.featured ? accentColor : C.inkMid);
                  return (
                    <div key={p.label} style={{
                      padding: "1rem",
                      background: p.featured ? accentBg : C.cream,
                      borderLeft: idx === 1 ? "1px solid " + C.border : "none",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: p.featured ? accentColor : C.inkSoft, marginBottom: "0.35rem" }}>
                        {p.label}
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: numColor, lineHeight: 1 }}>
                        {display}
                      </div>
                      {p.featured && scarcityNote && p.val != null && (
                        <div style={{ fontSize: "0.68rem", color: accentColor, fontWeight: 600, marginTop: "0.3rem" }}>
                          {scarcityNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Insight row — always renders with a default if missing */}
              <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, flexShrink: 0, paddingTop: "0.1rem" }}>
                  Collector Insight
                </span>
                <span style={{ fontSize: "0.82rem", color: C.inkMid, lineHeight: 1.65 }}>
                  {data.populationInsight || "Population data helps indicate how scarce top grades may be."}
                </span>
              </div>
            </div>
          );
        })()}
        {/* Analysis */}
        <div style={{ fontSize: "0.875rem", color: C.inkMid, lineHeight: 1.7, marginBottom: "0.9rem" }}>{data.analysis}</div>
        {/* Why this verdict */}
        <div style={{ background: C.cream, border: "1px solid " + C.border, borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "0.9rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, marginBottom: "0.6rem" }}>Why this verdict?</div>
          {bullets.map(function(b) {
            return (
              <div key={b} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.82rem", color: C.inkMid, marginBottom: "0.3rem" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold, flexShrink: 0, marginTop: "0.4rem", display: "inline-block" }} />
                {b}
              </div>
            );
          })}
        </div>
        {/* Best use case */}
        <div style={{ background: verdict.bg, border: "1px solid " + verdict.border, borderRadius: 10, padding: "0.65rem 0.9rem", marginBottom: data.action ? "0.9rem" : "0" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: verdict.color }}>Best Use Case: </span>
          <span style={{ fontSize: "0.82rem", color: C.inkMid }}>{useCase}</span>
        </div>
        {/* Action */}
        {data.action && (
          <div style={{ background: verdict.bg, border: "1px solid " + verdict.border, borderRadius: 10, padding: "0.7rem 0.9rem", display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "1rem" }}>
            <span style={{ color: verdict.color, fontWeight: 700, flexShrink: 0 }}>→</span>
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: verdict.color, marginBottom: "0.15rem" }}>Recommended Action</div>
              <div style={{ fontSize: "0.875rem", color: C.ink, fontWeight: 500 }}>{data.action}</div>
            </div>
          </div>
        )}
        {/* Action row */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.75rem", borderTop: "1px solid " + C.border }}>
          <button onClick={handleCopy} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.35rem 0.8rem", borderRadius: 100, border: "1px solid " + C.border, background: copied ? C.greenLight : C.white, color: copied ? C.green : C.inkMid, cursor: "pointer" }}>
            {copied ? "✓ Copied" : "Copy Summary"}
          </button>
          <button onClick={function() { onSave(data); }} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.35rem 0.8rem", borderRadius: 100, border: "1px solid " + C.border, background: isSaved ? C.goldLight : C.white, color: isSaved ? C.amber : C.inkMid, cursor: "pointer" }}>
            {isSaved ? "✓ Saved" : "Save Report"}
          </button>
          <button onClick={handleShare} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.35rem 0.8rem", borderRadius: 100, border: "1px solid " + C.border, background: shared ? C.greenLight : C.white, color: shared ? C.green : C.inkMid, cursor: "pointer" }}>
            {shared ? "✓ Copied" : "Share"}
          </button>
        </div>
        <div style={{ fontSize: "0.7rem", color: C.inkSoft, marginTop: "0.75rem", fontStyle: "italic" }}>
          Best used as a pre-submission grading filter — always verify with current comps.
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cardName,        setCardName]        = useState("");
  const [cardType,        setCardType]        = useState("pokemon");
  const [cardSet,         setCardSet]         = useState("");
  const [condition,       setCondition]       = useState("strong");
  const [email,           setEmail]           = useState("");
  const [waitlistEmail,   setWaitlistEmail]   = useState("");
  const [loading,         setLoading]         = useState(false);
  const [results,         setResults]         = useState([]);
  const [error,           setError]           = useState("");
  const [rateLimitMsg,    setRateLimitMsg]    = useState("");
  const [emailConfirm,    setEmailConfirm]    = useState(false);
  const [waitlistConfirm, setWaitlistConfirm] = useState(false);
  const [remaining,       setRemaining]       = useState(null);
  const [history,         setHistory]         = useState([]);
  const [savedReports,    setSavedReports]    = useState([]);

  const cardNameRef = useRef(null);
  const emailRef    = useRef(null);

  useEffect(function() {
    setHistory(lsGet(LS_HISTORY) || []);
    setSavedReports(lsGet(LS_SAVED) || []);
  }, []);

  function addToHistory(name, type, set) {
    setHistory(function(prev) {
      const deduped = prev.filter(function(h) { return h.name !== name || h.type !== type; });
      const next = [{ name, type, set, ts: Date.now() }, ...deduped].slice(0, 5);
      lsSet(LS_HISTORY, next); return next;
    });
  }
  function clearHistory() { lsSet(LS_HISTORY, []); setHistory([]); }
  function saveReport(data) {
    setSavedReports(function(prev) {
      const deduped = prev.filter(function(r) { return r.cardTitle !== data.cardTitle; });
      const next = [Object.assign({}, data, { savedAt: Date.now() }), ...deduped].slice(0, 10);
      lsSet(LS_SAVED, next); return next;
    });
  }
  function removeSavedReport(cardTitle) {
    setSavedReports(function(prev) {
      const next = prev.filter(function(r) { return r.cardTitle !== cardTitle; });
      lsSet(LS_SAVED, next); return next;
    });
  }
  function isSavedReport(data) { return savedReports.some(function(r) { return r.cardTitle === data.cardTitle; }); }

  function fillExample(ex) {
    setCardName(ex.name); setCardType(ex.type || "pokemon"); setCardSet(ex.set || "");
    setResults([]); setError(""); setRateLimitMsg("");
  }

  async function handleSubmit() {
    if (!cardName.trim()) return;
    if (email && !isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true); setError(""); setRateLimitMsg(""); setEmailConfirm(false);
    try {
      const res = await fetch("/api/predict", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName: cardName.trim(), cardType, cardSet: cardSet.trim(), condition, email: email.trim() || undefined }),
      });
      const data = await res.json();
      if (res.status === 429) { setRateLimitMsg(data.message || "Rate limit exceeded. Please try again later."); setLoading(false); return; }
      if (!res.ok) { setError(data.error || "Something went wrong. Please try again."); setLoading(false); return; }
      setResults(function(prev) { return [data.prediction, ...prev].slice(0, 5); });
      if (data.remaining != null) setRemaining(data.remaining);
      if (data.emailSaved) { setEmailConfirm(true); track("waitlist_signup"); }
      addToHistory(cardName.trim(), cardType, cardSet.trim());
      track("prediction_submitted", { cardType, condition });
    } catch { setError("Network error — check your connection and try again."); }
    finally   { setLoading(false); }
  }

  async function handleWaitlistSubmit() {
    if (!waitlistEmail || !isValidEmail(waitlistEmail)) return;
    try { await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: waitlistEmail.trim() }) }); } catch {}
    setWaitlistConfirm(true); track("waitlist_signup_standalone");
  }

  const CARD_TYPE_LABEL = {};
  CARD_TYPES.forEach(function(t) { CARD_TYPE_LABEL[t.value] = t.label; });

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", background: C.cream, minHeight: "100vh", color: C.ink, overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(245,243,238,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid " + C.border, height: 62, display: "flex", alignItems: "center", padding: "0 1.5rem", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
          <img src="/gempredict-logo.png" alt="GemPredict logo" style={{ height: 32, width: 32, borderRadius: 6, objectFit: "cover" }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.01em" }}>
            Gem<span style={{ color: C.gold }}>Predict</span>
          </span>
        </div>
        <div className="gp-nav-links" style={{ marginLeft: "auto" }}>
          <a href="#tool" style={{ fontSize: "0.875rem", fontWeight: 500, color: C.inkMid, textDecoration: "none" }}>Analyze</a>
          <a href="#how"  style={{ fontSize: "0.875rem", fontWeight: 500, color: C.inkMid, textDecoration: "none" }}>How It Works</a>
          <a href="#faq"  style={{ fontSize: "0.875rem", fontWeight: 500, color: C.inkMid, textDecoration: "none" }}>FAQ</a>
          <span style={{ background: C.ink, color: C.gold, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.3rem 0.75rem", borderRadius: 100 }}>Beta — Free</span>
        </div>
      </nav>

      {/* ── HERO — dark gradient, logo + headline + subtext ─────────────────── */}
      <div style={{
        background: "linear-gradient(160deg, #0d1117 0%, #111827 50%, #0a0f1e 100%)",
        padding: "4rem 1.5rem 4.5rem",
        textAlign: "center",
        borderBottom: "1px solid rgba(201,168,76,0.18)",
      }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

          {/* Logo */}
          <img
            src="/gempredict-logo.png"
            alt="GemPredict"
            className="gp-hero-logo"
            style={{ marginTop: 40, marginBottom: 28, borderRadius: 20, display: "block" }}
          />

          {/* Eyebrow */}
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: "0.75rem" }}>
            AI Grading Decision Tool
          </p>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
            fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.025em",
            color: "#ffffff", marginBottom: "1rem",
          }}>
            Stop Guessing. Know If Your<br />
            <em style={{ color: C.gold, fontStyle: "italic" }}>Card Is Worth Grading.</em>
          </h1>

          {/* Sub-headline */}
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.65)", fontWeight: 300, lineHeight: 1.75, maxWidth: 480, marginBottom: "0.6rem" }}>
            Get a clear Grade / Skip verdict with realistic PSA values and risk-adjusted upside — before you spend money on grading fees.
          </p>

          {/* Small print */}
          <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", marginBottom: "2rem" }}>
            Built for collectors, flippers, eBay sellers, and grading submitters. AI estimates only — not affiliated with PSA.
          </p>

          {/* CTA */}
          <a href="#tool" style={{
            display: "inline-flex", alignItems: "center", gap: "0.45rem",
            background: C.gold, color: C.ink,
            padding: "0.9rem 2rem", borderRadius: 100,
            textDecoration: "none", fontSize: "0.95rem", fontWeight: 800,
            boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
          }}>
            Analyze My Card →
          </a>

          {/* Trust note */}
          <p style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.35)", marginTop: "0.85rem" }}>
            Avoid wasted grading fees. Spot real gem candidates.
          </p>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", marginTop: "0.35rem" }}>
            Free to use · No account needed · 5 predictions per hour
          </p>
        </div>
      </div>

      {/* ── POSITIONING: Most Cards Should NOT Be Graded ─────────────────────── */}
      <div style={{ background: C.ink, padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.75rem" }}>
            Most Cards Should <em style={{ color: C.gold, fontStyle: "italic" }}>NOT</em> Be Graded
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", fontWeight: 300, lineHeight: 1.8, maxWidth: 520, margin: "0 auto" }}>
            Grading fees, low gem rates, and overhyped cards cost collectors money every day. GemPredict helps you make smarter submission decisions before you spend.
          </p>
        </div>
      </div>

      {/* ── POSITIONING: Not Another Pricing Tool ────────────────────────────── */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid rgba(201,168,76,0.12)", padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.3rem, 2.5vw, 1.75rem)", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.65rem" }}>
            Not Another Pricing Tool
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.8, maxWidth: 500, margin: "0 auto" }}>
            Platforms like Card Ladder show what a card sold for. GemPredict tells you if grading it actually makes sense.
          </p>
        </div>
      </div>

      {/* ── VALUE STRIP: 3-item ──────────────────────────────────────────────── */}
      <div style={{ background: C.cream, borderBottom: "1px solid " + C.border, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[
            { icon: "✅", title: "Clear Verdict", body: "Grade, Skip, or Maybe — one unambiguous answer per card." },
            { icon: "📊", title: "Realistic Values", body: "Raw vs PSA 9 vs PSA 10 — actual market range estimates, not hype." },
            { icon: "🎯", title: "Risk Analysis", body: "Know your true PSA 10 odds before you spend on submission fees." },
          ].map(function(item) {
            return (
              <div key={item.title} style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 14, padding: "1.25rem 1.1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.25rem", flexShrink: 0, lineHeight: 1, paddingTop: "0.1rem" }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.ink, marginBottom: "0.25rem" }}>{item.title}</div>
                  <div style={{ fontSize: "0.8rem", color: C.inkSoft, lineHeight: 1.6 }}>{item.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TOOL ────────────────────────────────────────────────────────────── */}
      <div id="tool" style={{ background: C.white, borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border, padding: "4rem 1.5rem 3.5rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>Analyze My Card</h2>
          <p style={{ fontSize: "0.9rem", color: C.inkSoft, fontWeight: 300, marginBottom: "0.5rem" }}>
            Enter any card below. Get a Grade / Skip verdict with raw, PSA 9, PSA 10 values, and real grading upside.
          </p>
          {/* Trust line */}
          <p style={{ fontSize: "0.78rem", color: C.inkSoft, fontStyle: "italic", marginBottom: "1.75rem", maxWidth: 520 }}>
            Most raw cards don't gem. This helps you find the ones that do.
          </p>

          <div style={{ background: C.cream, border: "1.5px solid " + C.border, borderRadius: 20, padding: "1.75rem", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {/* Row 1 */}
            <div className="gp-field-row" style={{ marginBottom: "0.9rem" }}>
              <div>
                <label style={labelSt}>Card Type</label>
                <select value={cardType} onChange={function(e) { setCardType(e.target.value); }} style={inputSt}>
                  {CARD_TYPES.map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
                </select>
              </div>
              <div>
                <label style={labelSt}>Set / Year <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.7rem" }}>(optional)</span></label>
                <input value={cardSet} onChange={function(e) { setCardSet(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleSubmit(); }} placeholder="e.g. 1999 Base Set, 2003 Topps Chrome" style={inputSt} />
              </div>
            </div>
            {/* Row 2 */}
            <div className="gp-search-row" style={{ marginBottom: "0.9rem" }}>
              <div>
                <label style={labelSt}>Card Name</label>
                <input ref={cardNameRef} value={cardName} onChange={function(e) { setCardName(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleSubmit(); }} placeholder="e.g. Charizard Holo, LeBron Rookie, Black Lotus" style={inputSt} />
              </div>
              <button onClick={handleSubmit} disabled={loading || !cardName.trim()} style={{ padding: "0.85rem 1.75rem", background: loading || !cardName.trim() ? "#94a3b8" : C.ink, color: "#fff", border: "none", borderRadius: 12, fontSize: "1rem", fontWeight: 700, cursor: loading || !cardName.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap", minWidth: 145, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                {loading ? (<><span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />Analyzing...</>) : "Analyze My Card"}
              </button>
            </div>
            {/* Condition */}
            <div style={{ marginBottom: "0.9rem" }}>
              <label style={labelSt}>
                Card Condition Estimate{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.68rem", color: C.gold }}>Improves estimate realism</span>
              </label>
              <select value={condition} onChange={function(e) { setCondition(e.target.value); }} style={inputSt}>
                <option value="risky">Risky / Played</option>
                <option value="strong">Strong Copy</option>
                <option value="gem">Gem Candidate</option>
              </select>
            </div>
            {/* Examples */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: C.inkSoft, fontWeight: 600 }}>Try:</span>
              {EXAMPLES.map(function(ex, i) {
                return (
                  <button key={i} onClick={function() { fillExample(ex); }} style={{ fontSize: "0.75rem", fontWeight: 500, background: C.white, border: "1px solid " + C.border, color: C.inkMid, padding: "0.28rem 0.7rem", borderRadius: 100, cursor: "pointer" }}>
                    {ex.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email capture */}
          <div style={{ marginTop: "1rem", background: C.cream, border: "1px solid " + C.border, borderRadius: 14, padding: "0.9rem 1.25rem" }}>
            <label style={Object.assign({}, labelSt, { marginBottom: "0.5rem" })}>
              Get notified when Photo Grading launches <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            {emailConfirm ? (
              <div style={{ background: C.greenLight, border: "1px solid #86efac", borderRadius: 10, padding: "0.6rem 1rem", color: C.green, fontSize: "0.875rem", fontWeight: 600 }}>
                You are on the list — we will email you at launch.
              </div>
            ) : (
              <input ref={emailRef} value={email} onChange={function(e) { setEmail(e.target.value); }} type="email" placeholder="your@email.com" style={Object.assign({}, inputSt, { maxWidth: 320 })} onFocus={function() { track("photo_grading_interest"); }} />
            )}
          </div>

          {/* Remaining */}
          {remaining !== null && (
            <p style={{ fontSize: "0.75rem", color: C.inkSoft, textAlign: "center", marginTop: "0.75rem" }}>
              {remaining} free prediction{remaining === 1 ? "" : "s"} remaining this hour
            </p>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ width: 40, height: 40, border: "3px solid " + C.border, borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 1rem" }} />
              <p style={{ color: C.inkSoft, fontSize: "0.9rem" }}>Pulling market data and grading intel...</p>
            </div>
          )}
          {/* Rate limit */}
          {rateLimitMsg && (
            <div style={{ marginTop: "1.25rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 700, color: C.amber, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Hourly limit reached</div>
              <div style={{ color: C.inkMid, fontSize: "0.85rem" }}>{rateLimitMsg}</div>
            </div>
          )}
          {/* Error */}
          {error && <div style={{ marginTop: "1.25rem", background: C.redLight, border: "1px solid #fca5a5", borderRadius: 12, padding: "1rem 1.25rem", color: C.red, fontSize: "0.875rem" }}>{error}</div>}

          {/* Empty state */}
          {!loading && results.length === 0 && !error && !rateLimitMsg && <EmptyState />}

          {/* Results */}
          {results.length > 0 && !loading && (
            <div style={{ marginTop: "2rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, marginBottom: "1rem" }}>
                {results.length === 1 ? "Your Report" : "Recent Reports (" + results.length + ")"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {results.map(function(r, i) { return <ResultCard key={i} data={r} index={i} onSave={saveReport} isSaved={isSavedReport(r)} />; })}
              </div>
              <p style={{ fontSize: "0.72rem", color: C.inkSoft, textAlign: "center", marginTop: "1.25rem" }}>
                AI estimates based on collector market data. Not affiliated with PSA. Always verify with current listings.
              </p>
              {/* What Next */}
              <div style={{ marginTop: "1.75rem", background: C.cream, border: "1.5px solid " + C.border, borderRadius: 18, padding: "1.75rem 1.5rem" }}>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: "0.4rem" }}>What Next?</p>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.01em", color: C.ink, marginBottom: "0.5rem" }}>Keep grading smarter.</h3>
                <p style={{ fontSize: "0.875rem", color: C.inkMid, fontWeight: 300, lineHeight: 1.75, marginBottom: "1.25rem", maxWidth: 480 }}>
                  Use GemPredict to compare more cards before you submit to PSA. The best grading profits usually come from the cards most collectors overlook.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button onClick={function() { var el = document.getElementById("tool"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(function() { if (cardNameRef.current) cardNameRef.current.focus(); }, 400); }} style={{ padding: "0.75rem 1.4rem", background: C.ink, color: "#fff", border: "none", borderRadius: 100, fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}>
                    Analyze Another Card
                  </button>
                  <button onClick={function() { var el = document.getElementById("waitlist-section"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ padding: "0.75rem 1.4rem", background: "transparent", color: C.ink, border: "1.5px solid " + C.border, borderRadius: 100, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                    Join Photo Grade Waitlist
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent History */}
          {history.length > 0 && (
            <div style={{ marginTop: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft }}>Recent Searches</span>
                <button onClick={clearHistory} style={{ fontSize: "0.72rem", color: C.inkSoft, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {history.map(function(h, i) {
                  return (
                    <button key={i} onClick={function() { fillExample(h); }} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: C.white, border: "1px solid " + C.border, borderRadius: 10, padding: "0.6rem 0.9rem", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: "0.8rem", color: C.inkSoft }}>🕐</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: C.ink }}>{h.name}</span>
                        <span style={{ fontSize: "0.75rem", color: C.inkSoft, marginLeft: "0.5rem" }}>{CARD_TYPE_LABEL[h.type] || h.type}{h.set ? " · " + h.set : ""}</span>
                      </span>
                      <span style={{ fontSize: "0.72rem", color: C.gold, fontWeight: 600, flexShrink: 0 }}>Load →</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <div style={{ marginTop: "1.75rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, marginBottom: "0.75rem" }}>Saved Reports</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {savedReports.map(function(r) {
                  const v = VERDICTS[r.verdict];
                  return (
                    <div key={r.cardTitle} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: C.white, border: "1px solid " + C.border, borderRadius: 12, padding: "0.75rem 1rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cardTitle}</div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                          {v && <span style={{ fontSize: "0.68rem", fontWeight: 700, background: v.bg, color: v.color, padding: "0.1rem 0.5rem", borderRadius: 100 }}>{v.label}</span>}
                          {r.psa10Probability != null && <span style={{ fontSize: "0.72rem", color: C.inkSoft }}>~{r.psa10Probability}% PSA 10</span>}
                          {r.gradingUpside != null && <span style={{ fontSize: "0.72rem", color: r.gradingUpside >= 0 ? C.green : C.red, fontWeight: 600 }}>{r.gradingUpside >= 0 ? "+$" : "-$"}{safeMoney(Math.abs(r.gradingUpside))}</span>}
                        </div>
                      </div>
                      <button onClick={function() { fillExample({ name: r.cardTitle, type: "tcg", set: r.cardMeta || "" }); }} style={{ fontSize: "0.72rem", color: C.gold, fontWeight: 600, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>Load</button>
                      <button onClick={function() { removeSavedReport(r.cardTitle); }} style={{ fontSize: "0.72rem", color: C.inkSoft, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TRUST BAND ──────────────────────────────────────────────────────── */}
      <div style={{ background: C.cream, padding: "3.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={Object.assign({}, eyebrowSt, { textAlign: "center" })}>Why collectors trust GemPredict</p>
          <div className="gp-trust-grid">
            {[
              { icon: "💰", title: "Save grading fees",     body: "Avoid wasting money on cards with weak grading upside." },
              { icon: "📈", title: "See ROI instantly",     body: "Compare raw, PSA 9, and PSA 10 value before submitting." },
              { icon: "🏆", title: "Built for collectors",  body: "Designed for flippers, submitters, and hobby investors." },
              { icon: "🎯", title: "Fewer bad submissions", body: "Focus only on cards with real grading potential." },
            ].map(function(t) {
              return (
                <div key={t.title} style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 16, padding: "1.25rem" }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: "0.6rem" }}>{t.icon}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: C.ink, marginBottom: "0.35rem" }}>{t.title}</div>
                  <div style={{ fontSize: "0.82rem", color: C.inkSoft, lineHeight: 1.65 }}>{t.body}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── POPULAR SEARCHES ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border, background: C.white, padding: "3.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={Object.assign({}, eyebrowSt, { textAlign: "center" })}>Popular Searches</p>
          <h2 style={Object.assign({}, sectionH2St, { textAlign: "center", marginBottom: "0.5rem" })}>Collectors are checking cards like these.</h2>
          <p style={{ fontSize: "0.9rem", color: C.inkSoft, fontWeight: 300, marginBottom: "1.75rem", textAlign: "center" }}>Tap any card to load it into the tool instantly.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem" }}>
            {[
              { name: "Charizard Holo",         type: "pokemon", set: "1999 Base Set",      emoji: "⚡", meta: "Pokemon · 1999 Base Set" },
              { name: "LeBron James Rookie",    type: "sports",  set: "2003 Topps Chrome",  emoji: "🏆", meta: "Sports · 2003 Topps Chrome" },
              { name: "Blue-Eyes White Dragon", type: "yugioh",  set: "LOB 1st Edition",    emoji: "🐉", meta: "Yu-Gi-Oh! · LOB 1st Edition" },
              { name: "Black Lotus",            type: "mtg",     set: "Alpha 1993",          emoji: "🧙", meta: "Magic: The Gathering · Alpha 1993" },
              { name: "Ohtani Rookie",          type: "sports",  set: "2018 Topps Update",   emoji: "⚾", meta: "Sports · 2018 Topps Update" },
              { name: "Pikachu Illustrator",    type: "pokemon", set: "Promo",               emoji: "✨", meta: "Pokemon · Promo" },
            ].map(function(ex) {
              return (
                <button key={ex.name} onClick={function() { fillExample(ex); var el = document.getElementById("tool"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  style={{ display: "flex", alignItems: "center", gap: "0.9rem", background: C.cream, border: "1.5px solid " + C.border, borderRadius: 14, padding: "1rem 1.1rem", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                  <span style={{ fontSize: "1.5rem", flexShrink: 0, lineHeight: 1 }}>{ex.emoji}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</span>
                    <span style={{ fontSize: "0.75rem", color: C.inkSoft }}>{ex.meta}</span>
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: C.gold, fontWeight: 700, flexShrink: 0 }}>Try →</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <div id="how" style={{ maxWidth: 900, margin: "0 auto", padding: "5rem 1.5rem" }}>
        <p style={eyebrowSt}>How It Works</p>
        <h2 style={sectionH2St}>Three steps. One clear answer.</h2>
        <p style={{ fontSize: "0.95rem", color: C.inkSoft, fontWeight: 300, maxWidth: 480, lineHeight: 1.8, marginBottom: "3rem" }}>
          Before you spend money on your next submission, run the card through GemPredict first.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
          {[
            { n: "01", title: "Search Your Card",    body: "Enter card name, type, set, and condition estimate. Covers Pokemon, sports, MTG, Yu-Gi-Oh!, and all major TCGs." },
            { n: "02", title: "See the Full Picture", body: "Compare raw, PSA 9, and PSA 10 prices with net profit after fees — no spreadsheet needed." },
            { n: "03", title: "Get Your Verdict",     body: "Grade It, Skip It, or Consider It — with a breakdown of why and a clear recommended action." },
          ].map(function(s) {
            return (
              <div key={s.n} style={{ borderTop: "3px solid " + C.border, paddingTop: "1.5rem" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "3rem", fontWeight: 900, color: C.border, lineHeight: 1, marginBottom: "1rem" }}>{s.n}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem" }}>{s.title}</h3>
                <p style={{ fontSize: "0.875rem", color: C.inkSoft, lineHeight: 1.75 }}>{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ABOUT / PRODUCT EXPLANATION ─────────────────────────────────────── */}
      <div style={{ background: C.white, borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={eyebrowSt}>About GemPredict</p>
          <h2 style={sectionH2St}>A grading decision tool. Not a price guide.</h2>
          <p style={{ fontSize: "0.95rem", color: C.inkMid, fontWeight: 300, lineHeight: 1.85, maxWidth: 620, marginBottom: "2.5rem" }}>
            GemPredict is not a live pricing database. It's a pre-submission filter — built to help collectors think clearly before spending money on grading fees.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
            {[
              { icon: "📊", title: "Market-informed estimates",     body: "Values reflect collector market patterns and known grading premiums — not live auction data or guaranteed valuations." },
              { icon: "🎯", title: "ROI-first analysis",            body: "GemPredict factors in the $25 PSA fee and realistic grade probabilities so you see real upside, not optimistic upsell." },
              { icon: "🧠", title: "Condition-aware output",         body: "Tell GemPredict your card's likely condition and the analysis calibrates accordingly — played cards and gem candidates are treated differently." },
              { icon: "🔍", title: "Best used before you submit",   body: "Use it at the decision point: before you build a submission batch, before you buy a raw card, or before you commit a high-value piece." },
            ].map(function(item) {
              return (
                <div key={item.title} style={{ background: C.cream, border: "1px solid " + C.border, borderRadius: 16, padding: "1.5rem" }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: "0.75rem" }}>{item.icon}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.45rem", color: C.ink }}>{item.title}</div>
                  <div style={{ fontSize: "0.84rem", color: C.inkSoft, lineHeight: 1.75 }}>{item.body}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SERIOUS COLLECTOR ────────────────────────────────────────────────── */}
      <div style={{ background: C.ink, padding: "5.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: "0.75rem" }}>For Serious Submitters</p>
          <div className="gp-collector-grid">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 3.5vw, 2.8rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.08, color: "#fff", margin: 0 }}>
              Every wasted submission<br />is a fee you don't<br /><em style={{ color: C.gold, fontStyle: "italic" }}>get back.</em>
            </h2>
            <div style={{ paddingTop: "0.25rem" }}>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", fontWeight: 300, lineHeight: 1.85, marginBottom: "1.25rem" }}>
                Grading fees, shipping, insurance, and months of wait time — the cost of a bad submission adds up fast. The collectors who win aren't the ones who grade the most. They're the ones who grade the <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.75)" }}>right</em> ones.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", fontWeight: 300, lineHeight: 1.85 }}>GemPredict is built for the moment before you commit — submit with confidence, not optimism.</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden", marginBottom: "3rem" }}>
            {[
              { stat: "Pre-screen",  label: "every card before it ships",    desc: "Run any card through GemPredict before building your submission batch." },
              { stat: "Prioritise",  label: "high-upside cards first",        desc: "Identify which cards in your stack have the strongest graded premium." },
              { stat: "Cut",         label: "low-ROI cards from your batch",  desc: "Drop the cards that don't justify the fee. Submit leaner. Profit more." },
              { stat: "Decide",      label: "faster and with more discipline", desc: "Less second-guessing. Less emotional grading. More consistent results." },
            ].map(function(item) {
              return (
                <div key={item.stat} style={{ padding: "2rem 1.5rem", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 900, color: C.gold, marginBottom: "0.2rem" }}>{item.stat}</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</div>
                  <div style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <div id="faq" style={{ maxWidth: 780, margin: "0 auto", padding: "5rem 1.5rem" }}>
        <p style={eyebrowSt}>FAQ</p>
        <h2 style={sectionH2St}>Frequently Asked Questions</h2>
        <div style={{ marginTop: "2rem", borderTop: "1px solid " + C.border }}>
          <FAQItem q="How accurate is GemPredict?" a="GemPredict provides AI-based grading ROI estimates using known collector market behavior and pricing patterns. Always verify against live sold listings before submitting expensive cards." />
          <FAQItem q="Does GemPredict guarantee a PSA grade?" a="No. GemPredict is a decision-support tool, not a grading company. Final grades always depend on PSA's physical inspection of the actual card submitted." />
          <FAQItem q="Can I use this for sports cards too?" a="Yes. GemPredict supports Pokemon, sports cards, Magic: The Gathering, Yu-Gi-Oh!, Dragon Ball, One Piece, and other major TCG categories." />
          <FAQItem q="Why does PSA 10 probability matter?" a="The biggest grading profits usually come from PSA 10s. A card with weak gem-rate odds can quickly become a bad submission — even if the PSA 10 value looks attractive." />
          <FAQItem q="What does the condition estimate do?" a="The condition estimate (Risky, Strong Copy, or Gem Candidate) helps GemPredict calibrate PSA 10 probability and grading upside more realistically. A played card and a gem candidate of the same card have very different submission economics." />
          <FAQItem q="Will photo grading be added?" a="Yes. AI Photo Grading is planned for a future release — estimating PSA 10 potential from front and back card images, covering centering, corners, edges, and surface quality." />
        </div>
      </div>

      {/* ── WHAT'S COMING / PRO (softened) ───────────────────────────────────── */}
      <div style={{ background: C.white, borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={eyebrowSt}>What's Coming</p>
          <h2 style={sectionH2St}>Built for collectors now. Expanding for power users next.</h2>
          <p style={{ fontSize: "0.95rem", color: C.inkSoft, fontWeight: 300, maxWidth: 520, lineHeight: 1.8, marginBottom: "2.5rem" }}>
            GemPredict is free in beta. A Pro tier is planned for serious collectors who need more.
          </p>
          <div className="gp-plan-grid">
            {[
              {
                label: "Free Beta", badge: "Available Now", badgeBg: C.greenLight, badgeColor: C.green, border: C.border,
                items: ["Card value lookup", "AI grading ROI verdict", "Raw / PSA 9 / PSA 10 estimates", "Condition-aware analysis", "Search history (local)", "Save up to 10 reports (local)"],
              },
              {
                label: "GemPredict Pro", badge: "Coming Soon", badgeBg: C.goldLight, badgeColor: C.amber, border: C.gold,
                items: ["AI photo grading", "Unlimited saved reports", "Batch submission analysis", "Portfolio tracking", "Market alerts", "Priority support"],
              },
            ].map(function(plan) {
              return (
                <div key={plan.label} style={{ background: C.cream, border: "1.5px solid " + plan.border, borderRadius: 18, padding: "1.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 900, color: C.ink }}>{plan.label}</div>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, background: plan.badgeBg, color: plan.badgeColor, padding: "0.2rem 0.5rem", borderRadius: 4, letterSpacing: "0.06em" }}>{plan.badge}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {plan.items.map(function(item) {
                      return (
                        <div key={item} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.85rem", color: C.inkMid }}>
                          <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0 }}>✓</span>{item}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PHOTO GRADING WAITLIST ────────────────────────────────────────────── */}
      <div id="waitlist-section" style={{ background: C.ink, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: "0.6rem" }}>Coming Soon</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.75rem", color: "#fff" }}>
            Get early access to AI Photo Grading
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.8, marginBottom: "2rem" }}>
            Be first when GemPredict launches image-based grading analysis — centering, corners, edges, surface, and PSA 10 probability from a photo.
          </p>
          {waitlistConfirm ? (
            <div style={{ background: C.greenLight, border: "1px solid #86efac", borderRadius: 12, padding: "1rem 1.5rem", color: C.green, fontSize: "0.95rem", fontWeight: 600, display: "inline-block" }}>
              You are on the list — we will email you at launch.
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <input value={waitlistEmail} onChange={function(e) { setWaitlistEmail(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleWaitlistSubmit(); }} type="email" placeholder="your@email.com"
                  style={{ padding: "0.85rem 1rem", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: "0.95rem", outline: "none", width: 260, background: "rgba(255,255,255,0.07)", color: "#fff" }} />
                <button onClick={handleWaitlistSubmit} style={{ padding: "0.85rem 1.5rem", background: C.gold, color: C.ink, border: "none", borderRadius: 12, fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}>
                  Join the Waitlist
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>No spam. Only product updates and launch access.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <div style={{ background: C.cream, borderTop: "1px solid " + C.border, padding: "5rem 1.5rem", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p style={eyebrowSt}>Start Free</p>
          <h2 style={Object.assign({}, sectionH2St, { marginBottom: "0.75rem" })}>Make smarter grading decisions today.</h2>
          <p style={{ fontSize: "0.95rem", color: C.inkSoft, fontWeight: 300, lineHeight: 1.8, marginBottom: "2rem" }}>
            Before you spend money on your next submission, run the card through GemPredict first.
          </p>
          <a href="#tool" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: C.ink, color: "#fff", padding: "1rem 2.25rem", borderRadius: 100, textDecoration: "none", fontSize: "1rem", fontWeight: 700 }}>
            Analyze My Card →
          </a>
          <p style={{ fontSize: "0.75rem", color: C.inkSoft, marginTop: "1rem" }}>
            No account needed. No credit card. 5 free predictions per hour.
          </p>
        </div>
      </div>

      {/* ── BETA NOTICE ──────────────────────────────────────────────────────── */}
      <div style={{ background: C.white, borderTop: "1px solid " + C.border, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: "0.4rem" }}>Beta Notice</p>
            <p style={{ fontSize: "0.85rem", color: C.inkMid, fontWeight: 300, lineHeight: 1.8 }}>
              GemPredict is in beta. Market prices move quickly and final grading outcomes depend on the physical card. Use this as a pre-submission filter — not a guarantee.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem 1.75rem", flexWrap: "wrap", alignItems: "center", paddingTop: "0.25rem" }}>
            {["AI estimates only", "Not affiliated with PSA", "Always verify with live comps"].map(function(bullet) {
              return (
                <div key={bullet} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: C.inkSoft }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold, flexShrink: 0, display: "inline-block" }} />
                  {bullet}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <div style={{ background: C.ink, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 900, color: "#fff" }}>Gem<span style={{ color: C.gold }}>Predict</span></span>
            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>Built for collectors making smarter grading decisions.</span>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.22)" }}>
              2026 GemPredict.com — Independent AI tool. Not affiliated with PSA or any grading company.
            </span>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              {[["Privacy Policy", "/privacy"], ["Terms", "/terms"], ["Contact", "#"]].map(function(l) {
                return <a key={l[0]} href={l[1]} style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{l[0]}</a>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
