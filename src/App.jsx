import {controlledCategorySubmission} from '../lib/controlledCategories.mjs';
import ReportStyle from './components/ReportStyle.jsx';
import ConditionSnapshot from './components/ConditionSnapshot.jsx';
import DemoReportAction from './components/DemoReportAction.jsx';
import CompletedSalesSection from './components/CompletedSalesSection.jsx';
import ReportPhotos from './components/ReportPhotos';
import {attachReportPhotos,reportPhotos} from '../lib/reportPhotos.mjs';
import {reportListings} from '../lib/reportListings.mjs';
import GradingScenarioCalculator from './components/GradingScenarioCalculator';
import {reportHero,unifiedReportPresentation} from '../lib/unifiedReportPresentation.mjs';
import {collectorIdentityMessage,collectorConditions,collectorLimitations} from '../lib/collectorPresentation.mjs';
import ControlledValidation from './components/ControlledValidation';
import IdentityResult from "./components/IdentityResult";
import {safeScanFailure} from '../lib/scanFailures.mjs';
import {conditionAssessmentLabels} from '../lib/photoConditionLabels.mjs';
import ScanDiagnostics from './components/ScanDiagnostics';
import {rememberScanDiagnostic} from '../lib/scanDiagnosticClient.mjs';
import {reportTitle,verificationRows} from '../lib/reportVerification.mjs';
import {identitySummary} from '../lib/pokemonReportIdentity.mjs';
import { protectFinancialReport, reportFromResponse, protectedCopySummary, WITHHELD_MESSAGE } from "../lib/financialSafety.mjs";
// src/App.jsx — GemPredict main component
import { useState, useRef, useEffect } from "react";
import { track } from "@vercel/analytics/react";
import AtlasPanel from "./components/AtlasPanel";
import { buildGemPredictScore } from "../lib/gemPredictScore";
import { normalizeMobileImage, assertUploadBudget, UploadError } from "../lib/mobileImages.mjs";
import { predictionFailureResponse, requestPrediction } from "../lib/predictionTransport.mjs";

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
  withheld: {label:"Financial Recommendations Withheld",bg:"#fffbeb",color:"#92400e",border:"#fde68a",explain:WITHHELD_MESSAGE},
  grade: { label: "Grade It",    bg: "#f0fdf4", color: "#15803d", border: "#86efac", explain: "Strong upside — the PSA 10 premium makes grading clearly worth it." },
  skip:  { label: "Skip It",     bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", explain: "Not worth grading — the cost likely exceeds the value gained." },
  maybe: { label: "Consider It", bg: "#fffbeb", color: "#b45309", border: "#fde68a", explain: "Borderline — grading upside depends heavily on card condition." },
};

const VERDICT_USE_CASE = {
  withheld:"Confirm exact identity and independent market evidence before evaluating grading.",
  grade: "Best for submission or resale upside.",
  maybe: "Best for condition-sensitive cards — strong gem rate matters here.",
  skip:  "Best to sell raw, hold, or trade rather than submit.",
};

const RATING_COLORS = {
  excellent: { color: "#15803d", bg: "#f0fdf4", label: "Excellent" },
  good:      { color: "#1a56db", bg: "#eff6ff", label: "Good"      },
  fair:      { color: "#b45309", bg: "#fffbeb", label: "Fair"      },
  poor:      { color: "#b91c1c", bg: "#fef2f2", label: "Poor"      },
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
  if (val == null) return "—";
  const n = typeof val === "number" && isFinite(val) ? val : 0;
  try { return n.toLocaleString(); } catch { return String(n); }
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());
}
function getVerdictBullets(data) {
  if(data.financialDecision?.actionable!==true)return [WITHHELD_MESSAGE];
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
function buildCopySummary(data) { return protectedCopySummary(data); }

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Outfit, system-ui, sans-serif; background: #f5f3ee; }
  .gp-field-row      { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .gp-search-row     { display: grid; grid-template-columns: 1fr auto; gap: 0.9rem; align-items: end; }
  .gp-value-grid     { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.85rem; }
  .gp-vision-grid    { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.75rem; }
  .gp-nav-links      { display: flex; gap: 1.5rem; align-items: center; }
  .gp-trust-grid     { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .gp-collector-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; margin-bottom: 3.5rem; }
  .gp-plan-grid      { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .gp-faq-item summary { list-style: none; cursor: pointer; }
  .gp-faq-item summary::-webkit-details-marker { display: none; }
  .gp-hero-logo { width: 180px; }
  .gp-img-upload-zone { border: 2px dashed #e2dfd8; border-radius: 14px; padding: 1.25rem 1rem; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .gp-img-upload-zone:hover { border-color: #c9a84c; background: #fdf6e3; }
  button, input, select { font-family: inherit; }
  @media (max-width: 680px) {
    .gp-field-row      { grid-template-columns: 1fr !important; }
    .gp-search-row     { grid-template-columns: 1fr !important; }
    .gp-search-row button { width: 100% !important; }
    .gp-value-grid     { grid-template-columns: 1fr !important; }
    .gp-vision-grid    { grid-template-columns: 1fr !important; }
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

// ─── Image Analysis Result component ─────────────────────────────────────────
function IdentityReviewCard({ report }) {
  const catalog = report.catalogCrossCheck;
  const [review, setReview] = useState("pending");
  const [catalogId, setCatalogId] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState(null);
  if (!catalog || !report.imageAnalysis) return null;
  const name = [catalog.catalogSet, catalog.catalogName,
    report.canonicalCard?.cardNumber ? "#" + report.canonicalCard.cardNumber : ""].filter(Boolean).join(" ");
  const conflicts = catalog.conflicts || [];
  async function submit(action) {
    if (!report.identityReviewToken) { setMessage("Secure review is unavailable for this scan. Please scan again."); return; }
    setBusy(true);setMessage("");
    try {
      const response = await fetch("/api/identity-review",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token:report.identityReviewToken,action,
          catalogId:action==="correct"?catalogId.trim():undefined,
          confirmedNumber:action==="correct"?number.trim():undefined})});
      const result = await response.json();
      if (!response.ok) {setMessage(result.message||result.error||result.reason||"Identity review failed.");return;}
      setReviewed(result);
      setReview("complete");
    } catch {setMessage("Unable to reach identity verification service.");}
    finally {setBusy(false);}
  }
  return (
    <div style={{marginTop:"0.8rem",padding:"1rem",background:C.cream,border:"1px solid "+C.border,borderRadius:12}}>
      <div style={{fontSize:"0.74rem",fontWeight:800,color:C.ink,marginBottom:"0.5rem"}}>Review Card Identity</div>
      <p style={{fontSize:"0.82rem",color:C.inkMid,marginBottom:"0.6rem"}}>Catalog candidate: <strong>{name||"No unique catalog match"}</strong></p>
      <p style={{fontSize:"0.74rem",color:C.inkSoft,marginBottom:"0.6rem"}}>
        {conflicts.length?"AI/catalog conflict: "+conflicts.join(", ")+". ":""}
        Confirm your exact card or correct the catalog selection. This review will not automatically change the grading report or unlock sold prices.
      </p>
      {review==="pending" ? (
        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
          <button type="button" disabled={busy||!catalog.catalogId||conflicts.length>0} onClick={()=>submit("confirm")}
            style={{background:C.ink,color:"#fff",border:0,borderRadius:8,padding:"0.55rem 0.9rem",cursor:"pointer"}}>This is my card</button>
          <button type="button" disabled={busy} onClick={()=>{setCatalogId(catalog.catalogId||"");setNumber(report.canonicalCard?.cardNumber||"");setReview("correct");}}
            style={{border:"1px solid "+C.border,background:"#fff",borderRadius:8,padding:"0.55rem 0.9rem",cursor:"pointer"}}>Wrong card / variation</button>
        </div>
      ) : review==="correct" ? (
        <div style={{display:"grid",gap:"0.55rem"}}>
          <label style={{fontSize:"0.74rem",color:C.inkMid}}>TCGdex catalog ID
            <input aria-label="TCGdex catalog ID" value={catalogId} onChange={e=>setCatalogId(e.target.value)} maxLength={65}
              placeholder="e.g. 30th-149" style={{display:"block",boxSizing:"border-box",marginTop:"0.2rem",padding:"0.6rem",width:"100%",border:"1px solid "+C.border,borderRadius:8}}/>
          </label>
          <label style={{fontSize:"0.74rem",color:C.inkMid}}>Full printed card number
            <input aria-label="Full printed card number" value={number} onChange={e=>setNumber(e.target.value)} maxLength={10}
              placeholder="e.g. 149/128" style={{display:"block",boxSizing:"border-box",marginTop:"0.2rem",padding:"0.6rem",width:"100%",border:"1px solid "+C.border,borderRadius:8}}/>
          </label>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button type="button" disabled={busy||!catalogId.trim()||!number.trim()} onClick={()=>submit("correct")}
              style={{background:C.ink,color:"#fff",border:0,borderRadius:8,padding:"0.55rem 0.9rem"}}>{busy?"Checking…":"Verify correction"}</button>
            <button type="button" disabled={busy} onClick={()=>setReview("pending")} style={{background:"transparent",border:"1px solid "+C.border,borderRadius:8,padding:"0.55rem 0.9rem"}}>Back</button>
          </div>
        </div>
      ) : (
        <p style={{fontSize:"0.76rem",color:C.inkMid}}>
          Server-reviewed: <strong>{reviewed?.identity?.set} {reviewed?.identity?.subject} #{reviewed?.identity?.number}</strong>.
          Artwork/printing remain unverified. Sold-comp lookup remains blocked.
        </p>
      )}
      {message&&<p role="alert" style={{fontSize:"0.75rem",color:C.red,marginTop:"0.55rem"}}>{message}</p>}
    </div>
  );
}

function VerificationStatus({report}) {
  return <dl aria-label="Verification status" style={{fontSize:"0.75rem",lineHeight:1.5,margin:"0.75rem 0"}}>
    {verificationRows(report).map(row=><div key={row.key} style={{marginBottom:"0.55rem"}}>
      <dt style={{fontWeight:700,color:C.ink}}>{row.label}: {row.status}</dt>
      <dd style={{margin:0,color:C.inkSoft}}>{row.reason}</dd>
    </div>)}
  </dl>;
}

export function ImageAnalysisCard({report,embedded=false}) {
 const safe=protectFinancialReport(report),data=safe.imageAnalysis,observation=safe.originalIdentityObservation||data;
 if(!data)return null;
 const overview=collectorConditions(data),limitations=collectorLimitations(data);
 function RatingPill({label}){return <span>{label}</span>;}
 const attributes=['centering','corners','edges','surface'].map(key=>({key,label:key[0].toUpperCase()+key.slice(1),note:data[key+'Note']}));
 return <section aria-label="Photo condition report" style={{background:C.white,border:'1px solid '+C.border,borderRadius:18,padding:'1.1rem 1.25rem',marginTop:embedded?0:20}}>
  {!embedded&&<><p style={{color:C.gold,fontWeight:700}}>AI Photo Grading Analysis · Photo observations</p>
  <h3 style={{margin:'0.4rem 0'}}>{reportTitle(safe)}</h3>
  <p>{collectorIdentityMessage(safe)}</p></>}
  {(safe.catalogComparison?.initialConflicts||[]).some(f=>['year','brandSet'].includes(f))&&safe.coreCatalogIdentity?.supported&&<p>Catalog evidence corrected the original AI proposal. The disagreement is retained in Technical Details.</p>}
  <p>These photo observations do not establish a grade, whole-card cleanliness or a submission recommendation.</p>
  <div className="gp-vision-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',gap:12,margin:'1rem 0'}}>
   {overview.map(a=><div key={a.key} style={{padding:12,borderRadius:10,background:C.cream}}><strong>{a.name}</strong><p style={{margin:'0.4rem 0'}}>{a.state}</p></div>)}
  </div>
  <h4>Important observations</h4>
  {overview.flatMap(a=>a.observations.map((o,i)=><p key={a.key+i}>{o.side==='front'?'Front photo':o.side==='back'?'Back photo':'Photograph not established'} · {a.name}: {o.text}</p>))}
  {!overview.some(a=>a.observations.length)&&<p>No supported regional condition observations are available.</p>}
  {limitations.map((text,i)=><p key={i} role="status">{text}</p>)}
  {(data.modelPhotoNotes||[]).map((note,i)=><p key={'note'+i}>Model photo note — unverified ({note.side==='front'?'Front photo':note.side==='back'?'Back photo':'Photo side not established'}): {note.text}</p>)}
  {(data.conditionEvidenceLimits?.observationsExceeded||data.conditionEvidenceLimits?.coverageExceeded)&&<p>The response exceeded the evidence limits; retained observations remain unassessable.</p>}
  <p>Grading recommendations and financial estimates remain withheld.</p>
  <details><summary style={{cursor:'pointer',fontWeight:700}}>Technical Details</summary>
   <VerificationStatus report={safe}/>
   <p>{data.imageSummary}</p><p>{data.gradingRisk}</p><p>Unassessed attributes are not proof of clean condition.</p>
      {/* Original observation is secondary and never supplies the heading. */}
      {(observation.identifiedSubject ||
        observation.identifiedBrandSet ||
        observation.identifiedYear ||
        observation.identifiedParallel ||
        observation.identifiedCardNumber) && (
        <details
          style={{
            margin: "1rem 1.25rem 0",
            background: C.cream,
            border: "1px solid " + C.border,
            borderRadius: 12,
            padding: "0.9rem 1rem",
          }}
        >
          <summary style={{fontSize:"0.72rem",color:C.inkSoft,cursor:"pointer"}}>Original AI Observation — Unverified</summary>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: C.ink }}>
            {[observation.identifiedYear, observation.identifiedBrandSet, observation.identifiedSubject]
              .filter(Boolean)
              .join(" · ") || "Card identity uncertain"}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45rem",
              marginTop: "0.55rem",
            }}
          >
            {observation.identifiedParallel && (
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: C.amber, background: C.goldLight, border: "1px solid " + C.gold, borderRadius: 100, padding: "0.15rem 0.55rem" }}>
                {observation.identifiedParallel}
              </span>
            )}

            {observation.identifiedCardNumber && (
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: C.inkSoft, background: C.white, border: "1px solid " + C.border, borderRadius: 100, padding: "0.15rem 0.55rem" }}>
                #{observation.identifiedCardNumber}
              </span>
            )}

            {observation.identifiedAutoOrRelic && observation.identifiedAutoOrRelic !== "none" && observation.identifiedAutoOrRelic !== "unknown" && (
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: C.inkSoft, background: C.white, border: "1px solid " + C.border, borderRadius: 100, padding: "0.15rem 0.55rem" }}>
                {observation.identifiedAutoOrRelic}
              </span>
            )}

            {Number.isFinite(observation.identityConfidence) && <span style={{fontSize:"0.68rem",color:C.inkSoft}}>
              Model-reported observation confidence: {observation.identityConfidence}% (not catalog or financial confidence)
            </span>}
          </div>

          {observation.identityNotes && (
            <div
              style={{
                fontSize: "0.72rem",
                color: C.inkSoft,
                marginTop: "0.55rem",
                lineHeight: 1.45,
              }}
            >
              {observation.identityNotes}
            </div>
          )}
        </details>
      )}

        {/* 4 attribute ratings */}
        <div className="gp-vision-grid" style={{ marginBottom: "1rem" }}>
          {attributes.map(function(attr) {
            const rating = data[attr.key] || "unassessed";
            const assessment=data.conditionAssessments?.[attr.key];
            const notes=(data.modelPhotoNotes||[]).filter(note=>note.attribute===attr.key);
            return (
              <div key={attr.key} style={{ background: C.cream, border: "1px solid " + C.border, borderRadius: 12, padding: "0.85rem 0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkSoft }}>{attr.label}</span>
                  <RatingPill rating={rating} label={assessment ? conditionAssessmentLabels[assessment.state] || "Unable to assess" : undefined} />
                </div>
                {assessment?.observations?.length ? assessment.observations.map((observation,i)=><p key={i} style={{fontSize:"0.78rem",color:C.inkMid,lineHeight:1.55,margin:0}}>
                  {observation.side==='front'?'Front photo: ':observation.side==='back'?'Back photo: ':'Photo side not established: '}{observation.text}{observation.region&&<span> Model-proposed photo region [{observation.region.join(', ')}].</span>}
                </p>) : <p style={{ fontSize: "0.78rem", color: C.inkMid, lineHeight: 1.55, margin: 0 }}>{"Unassessed: Not assessed from the photo — no qualified regional observation available."}</p>}
                {assessment?.sides?.length>0 && <p style={{fontSize:"0.7rem",color:C.inkSoft,margin:"0.35rem 0"}}>Evidence: {assessment.sides.map(side=>side==='front'?'Front photo':'Back photo').join(', ')}</p>}
                {(data.inspectionCoverage||[]).filter(c=>c.attribute===attr.key).map(c=><p key={c.side} style={{fontSize:"0.7rem",color:C.inkSoft,margin:"0.35rem 0"}}>
                  {c.side==='front'?'Front':'Back'} inspection: {c.reason==='photo_unavailable'?'photograph unavailable':c.regions.length?`${c.status} — ${c.regions.length} reported region(s)`:'coverage not established'}.
                  {c.regions.map((r,i)=><span key={i}> Region {i+1}: {r.effectiveStatus||r.status}; proposed image box [{r.region.join(', ')}].</span>)}
                  {c.limitations.map((l,i)=><span key={i}> Limitation: {l.code.replace(/_/g,' ')} ({l.region?'localized region':'this side'}).</span>)}
                </p>)}
                <p style={{fontSize:"0.7rem",color:C.inkSoft,margin:"0.35rem 0"}}>Model-reported findings describe photo areas, not independently verified whole-card condition. Locations are model proposals, not verified card geometry.</p>
                {attr.key==='centering'&&<p style={{fontSize:"0.7rem",color:C.inkSoft,margin:"0.35rem 0"}}>Centering measurement: {data.centeringMeasurementStatus==='unverified_geometry'?'unverified model estimate; geometry not established':'unavailable'}.</p>}
                {notes.map((note,i)=><p key={i} style={{fontSize:"0.74rem",color:C.inkSoft,margin:"0.35rem 0"}}>
                  Model photo note — unverified ({note.side==='front'?'Front photo':note.side==='back'?'Back photo':'Photo side not established'}): {note.text}
                </p>)}
              </div>
            );
          })}
        </div>

   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{JSON.stringify({visualObservations:data.visualObservations,inspectionCoverage:data.inspectionCoverage,conditionEvidenceLimits:data.conditionEvidenceLimits,catalogComparison:safe.catalogComparison},null,2)}</pre>
  </details>
 </section>;
}

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
        Identify a card and review qualified photo observations. Market comparisons and grading recommendations remain unavailable without verified evidence.
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

export function ResultCard({ data, index, onSave, isSaved,photos=null,completedSalesEvidence=null,demo=false }) {
  data = protectFinancialReport(data);
  const view=unifiedReportPresentation(data),listings=reportListings(data),hero=reportHero(data),observation=data.originalIdentityObservation||data.imageAnalysis,prefix=`gp-report-${index}`;
  const [copied,setCopied]=useState(false),[shared,setShared]=useState(false),[feedback,setFeedback]=useState(null);
  function handleCopy(){try{navigator.clipboard.writeText(buildCopySummary(data));}catch{}setCopied(true);setTimeout(()=>setCopied(false),2000);}
  function handleShare(){const summary=buildCopySummary(data);if(navigator.share)navigator.share({title:'GemPredict Report',text:summary}).catch(()=>{});else{try{navigator.clipboard.writeText(summary);}catch{}}setShared(true);setTimeout(()=>setShared(false),2000);}
  return <article className="gp-unified" aria-label="Unified card analysis report">
   <ReportStyle/>
   {demo&&<p className="gp-report-demo" role="note">DEMO — SYNTHETIC DATA · Mock observations and listings. No real valuation.</p>}
   <div className="gp-decision-report">
    <header className="gp-original-header" aria-label="Card identification"><div className="gp-header-copy"><p className="gp-report-kicker">Grading Decision Report <span className="gp-beta">BETA</span></p><h2>{hero.title}</h2><p className="gp-original-subtitle">{hero.subtitle}{hero.printing?' · '+hero.printing:''}</p><p className="gp-original-note">{view.category} · {view.identityLabel} · printing not verified</p></div><div className="gp-header-status"><strong>Pending</strong><small>Evidence required</small></div></header>
    <div className="gp-original-body">
     <section className="gp-reference-panel gp-decision-panel" aria-label="Grading decision"><p className="gp-decision-question">Should you grade this?</p><div className="gp-decision-oval"><span>GemPredict decision</span><strong>Unavailable</strong><small>Evidence not yet verified</small></div><p className="gp-decision-verdict">Not determined</p><dl className="gp-five-metrics" aria-label="Five decision metrics">{['Most Likely Outcome','PSA 10 Odds','Expected Net','Decision Confidence','Potential Upside'].map(label=><div key={label}><dt>{label}</dt><dd>Unavailable</dd></div>)}</dl></section>
     <section className="gp-reference-panel" id={prefix+'-listings'} aria-label="eBay discovery"><div className="gp-section-head"><h3>Listings used</h3>{demo&&<span className="gp-synthetic" aria-label="Synthetic listings">Synthetic</span>}</div><dl className="gp-market-summary">{[['GemPredict Fair Market Value','Unavailable'],['Typical range','Unavailable'],['Comparable listings',data.marketData?.success===true?listings.candidates.length+' possible':'Unavailable'],['Market confidence','Unavailable']].map(([label,value])=><div key={label}><dt>{label}</dt><dd className={value==='Unavailable'?'gp-unavailable':undefined}>{value}</dd></div>)}</dl><p className="gp-fine"><em>Active asking prices · printing unverified.</em></p>
      {listings.candidates.length>0?<div className="gp-listing-list"><h4 className="gp-panel-title">Possible matches</h4>{listings.candidates.slice(0,6).map(item=><article className="gp-listing" key={item.url}>{!demo&&item.image&&<img src={item.image} loading="lazy" referrerPolicy="no-referrer" alt="eBay listing photograph"/>}<div className="gp-listing-body"><div className="gp-listing-head">{demo?<span className="gp-listing-title">{item.title.replace(/^DEMO — SYNTHETIC DATA — /,'')}</span>:<a className="gp-listing-title" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>}<span className="gp-price"><span className="gp-asking-label">{demo?'Synthetic asking amount: ':'Asking price: '}</span>{item.amount!==null?item.currency+' '+item.amount.toFixed(2):'Unavailable'}</span></div><p className="gp-fine">Condition: {item.condition||'Not supplied'}</p><p className="gp-fine">Unverified candidate · active listing{demo?' · Synthetic listing; no live link.':''}</p></div></article>)}</div>:<p className="gp-fine">No reliable listing matches available.</p>}

     </section>
     <section className="gp-reference-panel gp-why" aria-label="Decision explanation"><h3>Why this decision?</h3><p>Grading decision unavailable.</p><ul><li><span className="gp-why-marker" aria-hidden="true">– </span>{view.identityLabel==='Core catalog support'?'Core catalog supported; printing unverified.':view.identityLabel==='Identity needs review'?'Conflicting identity evidence needs review.':'Independent identity unverified.'}</li><li><span className="gp-why-marker" aria-hidden="true">– </span>Photo observations do not establish a PSA grade or probability.</li><li><span className="gp-why-marker" aria-hidden="true">– </span>Qualified sales and costs are required.</li></ul></section>
     <section className="gp-three-values" aria-label="Raw and PSA values">{['Raw Value','PSA 9 Value','PSA 10'].map(label=><div className="gp-value-tile" key={label}><span>{label}</span><strong>Unavailable</strong></div>)}</section>
     <section className="gp-reference-panel gp-economics" id={prefix+'-psa'} aria-label="Grading economics"><h3>Expected grading economics</h3><dl>{['Expected Graded Value','Current Raw Value','PSA Submission Fee','Expected Net'].map((label,i)=><div className={'gp-ledger-row'+(i===3?' gp-ledger-net':'')} key={label}><dt>{label}</dt><dd>Unavailable</dd></div>)}</dl><p className="gp-fine"><em>Automatic estimates withheld pending qualified evidence and costs.</em></p></section>
     <aside className="gp-bottom-strip" aria-label="Best use case"><strong>Best use case:</strong> Evidence review only; not a grading or sale recommendation.</aside>
     <aside className="gp-bottom-strip" aria-label="Recommended action"><strong>→ Recommended action</strong><p>Verify exact printing and qualified sales before a grading decision.</p></aside>
     <div className="gp-u-actions">{demo?<><button type="button" disabled>Copy Summary</button><button type="button" disabled>Save Report</button><button type="button" disabled>Share</button></>:<><button type="button" onClick={handleCopy}>{copied?'✓ Copied':'Copy Summary'}</button><button type="button" onClick={()=>onSave?.(data)}>{isSaved?'✓ Saved':'Save Report'}</button><button type="button" onClick={handleShare}>{shared?'✓ Copied':'Share'}</button></>}</div>
     {demo?<p className="gp-source-footer">Synthetic demo — copy, saving and sharing disabled.</p>:<><div className="gp-u-feedback"><p>Was this card identification useful?</p><button type="button" onClick={()=>setFeedback('yes')}>👍 Yes</button><button type="button" onClick={()=>setFeedback('review')}>👎 Needs review</button>{feedback&&<p>{feedback==='yes'?'Thanks. Feedback recorded for this view.':'Review the identification before using it.'}</p>}</div><p className="gp-source-footer">Review the evidence and limitations before any grading, selling or submission decision.</p></>}
    </div>
   </div>
   <section className="gp-photo-analysis" id={prefix+'-condition'} aria-label="Condition evidence"><header className="gp-photo-analysis-header"><h3>Photo Condition Analysis <span className="gp-beta">BETA</span></h3>{demo&&<span className="gp-synthetic" aria-label="Synthetic observations">Synthetic</span>}</header><div className="gp-photo-analysis-body">
    <div className="gp-identity-brief"><h4>{hero.title}</h4><p>{hero.subtitle} · {hero.printing||'Printing unresolved'} — printing not verified</p><span className="gp-badge">{view.identityLabel==='Identification proposal'?'Identity unverified · Identification proposal':view.identityLabel}</span>{view.categoryConflict&&<p>Category needs review. Contradictory category details are excluded.</p>}{data.userIdentityConflicts?.length>0&&<p>Your supplied identity conflicts with catalog evidence. Review required.</p>}
     <details><summary>Identity &amp; provenance details</summary><div className="gp-detail-body"><p>{reportTitle(data)}</p><p>{collectorIdentityMessage(data)}</p><dl className="gp-u-fields">{view.fields.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><p>{view.printingStatus}</p><VerificationStatus report={data}/><p>{identitySummary(data)}</p>{observation&&<details><summary>Original AI Observation — Unverified</summary><p>{[observation.identifiedYear,observation.identifiedBrandSet,observation.identifiedSubject,observation.identifiedCardNumber,observation.identifiedParallel].filter(Boolean).join(' · ')||'No original identity proposal retained.'}</p></details>}{data.stage==='identity'&&<IdentityResult report={data}/>}</div></details>
     {data.imageAnalysis&&!demo&&<details><summary>Review or correct identification</summary><div className="gp-legacy-details"><IdentityReviewCard report={data}/></div></details>}
    </div>
    <details open={!!photos}><summary>Submitted front / back photographs</summary><ReportPhotos photos={photos}/></details>
    <ConditionSnapshot data={data.imageAnalysis} demo={demo}/>
    <div className="gp-report-evidence"><h3>Report evidence &amp; manual scenarios</h3>      <details><summary>Listing evidence and limitations</summary><div className="gp-detail-body"><p>{view.discovery.status}. Exact-printing matches: {listings.qualified.length}. Unverified candidates: {listings.candidates.length}. {listings.rejectedCount} rejected or unsafe records are excluded.</p><p>{view.printingStatus} Only the first six screened candidates are shown; not exhaustive market coverage.</p>{(Array.isArray(data.scanNotices)?data.scanNotices:[]).map(safeScanFailure).filter(n=>['MARKETPLACE_UNAVAILABLE','VERIFICATION_UNRESOLVED'].includes(n?.code)).map(n=><p key={n.code} role="status">{n.error}</p>)}</div></details>
      <details><summary>Completed-sales comparisons</summary><CompletedSalesSection evidence={completedSalesEvidence} demo={demo} sectionId={prefix+'-market'}/></details><details><summary>What is needed for grading economics?</summary><div className="gp-detail-body"><p>{WITHHELD_MESSAGE}</p><p>PSA outlook not available yet. PSA Submission Fee Unavailable in automatic report economics. Grade probabilities and automatic submission advice are not supported.</p></div></details><details><summary>Explore manual PSA scenarios</summary><p className="gp-fine">Optional hypothetical assumptions only. Inputs never change this report's evidence or protected financial status.</p><div className="gp-legacy-details"><GradingScenarioCalculator embedded/></div></details></div>
   </div></section>
  </article>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cardName,        setCardName]        = useState("");
  const [cardType,        setCardType]        = useState("pokemon");
  const cardTypeCurrent=useRef(cardType);cardTypeCurrent.current=cardType;
  const [cardSet,         setCardSet]         = useState("");
  const [condition,       setCondition]       = useState("strong");
  const [email,           setEmail]           = useState("");
  const [waitlistEmail,   setWaitlistEmail]   = useState("");
  const [loading,         setLoading]         = useState(false);
  const [identityResult,setIdentityResult] = useState(null);
  const [activeStage,setActiveStage] = useState('full');
  const scanInFlight = useRef(false);
  const [results,         setResults]         = useState([]);
  const [failedScanDiagnostic,setFailedScanDiagnostic] = useState(null);
  const [imageAnalysis,   setImageAnalysis]   = useState(null);   // latest image analysis result
  const [error,           setError]           = useState("");
  const [rateLimitMsg,    setRateLimitMsg]    = useState("");
  const [emailConfirm,    setEmailConfirm]    = useState(false);
  const [waitlistConfirm, setWaitlistConfirm] = useState(false);
  const [remaining,       setRemaining]       = useState(null);
  const [history,         setHistory]         = useState([]);
  const [savedReports,    setSavedReports]    = useState([]);

  // Image upload state
const [imageFile,       setImageFile]       = useState(null);   // Front image
const [imagePreview,    setImagePreview]    = useState(null);

const [backImageFile,   setBackImageFile]   = useState(null);   // Back image
const [backImagePreview,setBackImagePreview]= useState(null);

const fileInputRef = useRef(null);
const backFileInputRef = useRef(null);

const cardNameRef = useRef(null);
const emailRef    = useRef(null);

  useEffect(function() {
    setHistory(lsGet(LS_HISTORY) || []);
    const stored = lsGet(LS_SAVED);
    setSavedReports(Array.isArray(stored) ? stored.map(protectFinancialReport) : []);
  }, []);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(function() {
    return function() {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // The uploaded file must be a validated, oriented JPEG before it can be previewed
  // or submitted. Keep both sides and all processing failures fail-closed.
  const [processingImages, setProcessingImages] = useState(0);
  const [photoErrors, setPhotoErrors] = useState({ front: false, back: false });
  const selectionVersions = useRef({ front: 0, back: 0 });

  async function selectPhoto(file, side) {
    if (!file) return;
    const version = ++selectionVersions.current[side];
    const setFile = side === "front" ? setImageFile : setBackImageFile;
    const setPreview = side === "front" ? setImagePreview : setBackImagePreview;
    setFile(null);
    setPreview(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setPhotoErrors(previous => ({ ...previous, [side]: false }));
    setProcessingImages(n => n + 1);
    setError("");
    try {
      const normalized = await normalizeMobileImage(file);
      if (selectionVersions.current[side] !== version) return;
      setFile(normalized);
      setPreview(URL.createObjectURL(normalized));
    } catch (error) {
      if (selectionVersions.current[side] === version) {
        setPhotoErrors(previous => ({ ...previous, [side]: true }));
        setError(error instanceof UploadError ? error.message : "Photo processing failed. Please choose another photo.");
      }
    } finally {
      setProcessingImages(n => n - 1);
    }
  }
  function handleImageSelect(file) { return selectPhoto(file, "front"); }
  function handleBackImageSelect(file) { return selectPhoto(file, "back"); }
  useEffect(() => () => {
    if (backImagePreview) URL.revokeObjectURL(backImagePreview);
  }, [backImagePreview]);

  function handleImageDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  }

  function clearImage() {
    selectionVersions.current.front++;
    setPhotoErrors(previous => ({ ...previous, front: false }));
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addToHistory(name, type, set) {
    setHistory(function(prev) {
      const deduped = prev.filter(function(h) { return h.name !== name || h.type !== type; });
      const next = [{ name, type, set, ts: Date.now() }, ...deduped].slice(0, 5);
      lsSet(LS_HISTORY, next); return next;
    });
  }
  function clearHistory() { lsSet(LS_HISTORY, []); setHistory([]); }
  function saveReport(data) {
    data=protectFinancialReport(data);
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
    setResults([]); setImageAnalysis(null); setError(""); setRateLimitMsg("");
  }

  async function handleSubmit(mode='full',prepared=null) {
    const controlled=mode==='condition-validation';
    mode=controlled?mode:mode==='identity'?'identity':'full';
    if(controlled&&(!controlledCategorySubmission(prepared,cardTypeCurrent.current)||cardType!==cardTypeCurrent.current)){setError('Choose and confirm the current controlled card category, then prepare again. No scan submitted.');return;}
    if(controlled&&(!prepared||prepared.front!==imageFile||prepared.back!==backImageFile||prepared.version!==selectionVersions.current.front+':'+selectionVersions.current.back)){setError('Frozen preparation changed. Export and verify again.');return;}
    if(scanInFlight.current||mode==='identity'&&!imageFile)return;
    if (loading || processingImages || photoErrors.front || photoErrors.back || (!cardName.trim() && !imageFile)) return;
    if (email && !isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    scanInFlight.current=true;setActiveStage(mode);if(mode==='identity')setIdentityResult(null);
    setLoading(true); setError(""); setRateLimitMsg(""); setEmailConfirm(false); setImageAnalysis(null); setFailedScanDiagnostic(null);

    try {
      let result;
      if (imageFile) {
        // Multipart/form-data when image is present
        const formData = new FormData();
        if(mode==='identity')formData.append("mode","identity");
        if(controlled){formData.append("mode","condition-validation");formData.append("validationManifest",prepared.manifest);formData.append("validationCategorySelected",prepared.category);formData.append("validationCategoryConfirmed",prepared.confirmedCategory);formData.append("validationCategoryAttempt",prepared.confirmationAttemptId);if(prepared.validationMechanism){formData.append("validationMechanism",prepared.validationMechanism);formData.append("validationPreflightTicket",prepared.validationPreflightTicket||'');formData.append("validationSpendApproval",prepared.validationSpendApproval||'');}}
        formData.append("cardName", controlled&&prepared.validationMechanism?'':cardName.trim());
        formData.append("cardType",  controlled?prepared.category:cardType);
        formData.append("cardSet",   controlled&&prepared.validationMechanism?'':cardSet.trim());
        formData.append("condition", condition);
        if (email.trim()&&!(controlled&&prepared.validationMechanism)) formData.append("email", email.trim());
        formData.append("image", controlled?prepared.front:imageFile);
        if (backImageFile) {
  formData.append("backImage", controlled?prepared.back:backImageFile);
}
        await assertUploadBudget(formData);
        result = await requestPrediction({ method: "POST", body: formData });
      } else {
        // JSON when no image
        result = await requestPrediction({
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardName: cardName.trim(), cardType, cardSet: cardSet.trim(), condition, email: email.trim() || undefined }),
        });
      }

      const { response: res, data } = result;
      if(!res.ok){const failed={};rememberScanDiagnostic(failed,res,{controlled,manifest:controlled?JSON.parse(prepared.manifest):null,failed:true});setFailedScanDiagnostic(failed);}
      if (res.status === 429) { setRateLimitMsg(data.message || "Rate limit exceeded. Please try again later."); setLoading(false); return; }
      if (!res.ok) { setError(data.error || "Something went wrong. Please try again."); setLoading(false); return; }

      if(mode==='identity'){
        const identified=attachReportPhotos(reportFromResponse(data),{front:controlled?prepared.front:imageFile,back:controlled?prepared.back:backImageFile});rememberScanDiagnostic(identified,res);setIdentityResult(identified);
        if(data.remaining!=null)setRemaining(data.remaining);
        return;
      }
      setResults(function(prev) {
  const newReport = attachReportPhotos(reportFromResponse(data),{front:controlled?prepared.front:imageFile,back:controlled?prepared.back:backImageFile});
  rememberScanDiagnostic(newReport,res,{controlled,manifest:controlled?JSON.parse(prepared.manifest):null});

  return [newReport, ...prev].slice(0, 5);
});

if (data.imageAnalysis) setImageAnalysis(protectFinancialReport(data).imageAnalysis);
      if (data.remaining != null) setRemaining(data.remaining);
      if (data.emailSaved) { setEmailConfirm(true); track("waitlist_signup"); }
      addToHistory(cardName.trim() || "Image upload", cardType, cardSet.trim());
      track("prediction_submitted", {
  cardType,
  condition,
  hasImage: !!imageFile,
  hasBackImage: !!backImageFile,
});
    

    } catch (error) { const response=predictionFailureResponse(error);if(response||controlled){const failed={};rememberScanDiagnostic(failed,response||{},{controlled,manifest:controlled?JSON.parse(prepared.manifest):null,failed:true});setFailedScanDiagnostic(failed);}setError(error instanceof UploadError ? error.message+(error.scanCode?" (Reference: "+error.scanCode+")":"") : "Unexpected report display error. No financial recommendation was generated."); }
    finally   { scanInFlight.current=false;setLoading(false); }
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

            {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background:
            "linear-gradient(160deg, #0d1117 0%, #111827 50%, #0a0f1e 100%)",
          padding: "4rem 1.5rem 4.5rem",
          textAlign: "center",
          borderBottom: "1px solid rgba(201,168,76,0.18)",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          <img
            src="/gempredict-logo.png"
            alt="GemPredict"
            className="gp-hero-logo"
            style={{
              marginTop: 40,
              marginBottom: 28,
              borderRadius: 20,
              display: "block",
            }}
          />

          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.gold,
              marginBottom: "0.75rem",
            }}
          >
            TRADING CARD DECISION INTELLIGENCE
          </p>

          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              color: "#ffffff",
              marginBottom: "1rem",
            }}
          >
            Know What to Do With Your Cards—
            <br />
            <em style={{ color: C.gold, fontStyle: "italic" }}>and Why.</em>
          </h1>

          <p
            style={{
              fontSize: "1.05rem",
              color: "rgba(255,255,255,0.65)",
              fontWeight: 300,
              lineHeight: 1.75,
              maxWidth: 560,
              marginBottom: "0.6rem",
            }}
          >
            GemPredict brings together card identity, visible condition, real
            market evidence, grading probabilities, and total costs to help you
            decide what to grade, sell, hold, or inspect further.
          </p>

          <p
            style={{
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "2rem",
            }}
          >
            Built for collectors who want clearer decisions—not more guesses.
          </p>

          <a
            href="#tool"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: C.gold,
              color: C.ink,
              padding: "0.9rem 2rem",
              borderRadius: 100,
              textDecoration: "none",
              fontSize: "0.95rem",
              fontWeight: 800,
              boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
            }}
          >
            Analyze My Card →
          </a>

          <p
            style={{
              fontSize: "0.73rem",
              color: "rgba(255,255,255,0.35)",
              marginTop: "0.85rem",
            }}
          >
            Avoid wasted grading fees. Spot real gem candidates.
          </p>

          <p
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.2)",
              marginTop: "0.35rem",
            }}
          >
            Free to use · No account needed · 5 predictions per hour
          </p>
        </div>
      </div>

      {/* ── POSITIONING SECTIONS ─────────────────────────────────────────────── */}
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
      <div style={{ background: C.cream, borderBottom: "1px solid " + C.border, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[
            { icon: "✅", title: "Clear Verdict", body: "Grade, Skip, or Maybe — one unambiguous answer per card." },
            { icon: "📊", title: "Realistic Values", body: "Completed-sale values stay unavailable until qualified evidence is connected." },
            { icon: "🎯", title: "Risk Analysis", body: "See photo limitations before considering a grading submission." },
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
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>Analyze My Card</h2>
          <p style={{ fontSize: "0.9rem", color: C.inkSoft, fontWeight: 300, marginBottom: "0.5rem" }}>
            Identify your card and review photo observations. Any manual grading scenarios remain hypothetical.
          </p>
          <p style={{ fontSize: "0.78rem", color: C.inkSoft, fontStyle: "italic", marginBottom: "1.75rem", maxWidth: 720 }}>
            Most raw cards don't gem. This helps you find the ones that do.
          </p>

          <div style={{ background: C.cream, border: "1.5px solid " + C.border, borderRadius: 20, padding: "1.75rem", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {/* Row 1: type + set */}
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
            {/* Row 2: name + button */}
            <div className="gp-search-row" style={{ marginBottom: "0.9rem" }}>
              <div>
                <label style={labelSt}>Card Name</label>
                <input ref={cardNameRef} value={cardName} onChange={function(e) { setCardName(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleSubmit(); }} placeholder="e.g. Charizard Holo, LeBron Rookie, Black Lotus" style={inputSt} />
              </div>
              <button onClick={()=>handleSubmit()} disabled={loading || processingImages > 0 || photoErrors.front || photoErrors.back || (!cardName.trim() && !imageFile)} style={{ padding: "0.85rem 1.75rem", background: loading || (!cardName.trim() && !imageFile) ? "#94a3b8" : C.ink, color: "#fff", border: "none", borderRadius: 12, fontSize: "1rem", fontWeight: 700, cursor: loading || (!cardName.trim() && !imageFile) ? "not-allowed" : "pointer", whiteSpace: "nowrap", minWidth: 155, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                {loading ? (<><span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />Analyzing...</>) : "Analyze My Card"}
              </button>
            </div>
            <ScanDiagnostics />
            <DemoReportAction />
            {failedScanDiagnostic && <><ScanDiagnostics report={failedScanDiagnostic} prominent scrollToCapture/><ScanDiagnostics report={failedScanDiagnostic}/></>}
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

            {/* ── IMAGE UPLOAD ──────────────────────────────────────────────── */}
            <div style={{ marginBottom: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
                <label style={labelSt}>
                  Card Photo <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.68rem", color: C.gold }}>Optional — enables AI photo analysis</span>
                </label>
                {imageFile && (
                  <button onClick={clearImage} style={{ fontSize: "0.72rem", color: C.inkSoft, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
                )}
              </div>
              {imagePreview ? (
                <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", background: C.white, border: "1px solid " + C.border, borderRadius: 12, padding: "0.75rem" }}>
                  <img src={imagePreview} alt="Card preview" style={{ width: 72, height: 100, objectFit: "contain", borderRadius: 6, background: "#f0f0f0", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageFile.name}</div>
                    <div style={{ fontSize: "0.72rem", color: C.inkSoft, marginTop: "0.2rem" }}>{(imageFile.size / 1024).toFixed(0)} KB · Photo analysis will run alongside value lookup</div>
                    <div style={{ marginTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, background: C.goldLight, color: C.amber, padding: "0.15rem 0.5rem", borderRadius: 100 }}>📷 Photo Grade Enabled</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="gp-img-upload-zone"
                  onClick={function() { fileInputRef.current && fileInputRef.current.click(); }}
                  onDrop={handleImageDrop}
                  onDragOver={function(e) { e.preventDefault(); }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📷</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: C.inkMid, marginBottom: "0.2rem" }}>Upload card photo for AI photo grading</div>
                  <div style={{ fontSize: "0.75rem", color: C.inkSoft }}>Click to browse or drag and drop · JPEG, PNG, WebP, HEIF/HEIC · Max 25 MB</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                style={{ display: "none" }}
                onChange={function(e) { const file = e.target.files && e.target.files[0]; e.target.value = ""; handleImageSelect(file); }}
              />
              <input
  ref={backFileInputRef}
  type="file"
  accept="image/*,.heic,.heif"
  style={{ display: "none" }}
  onChange={function(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; handleBackImageSelect(file);
  }}
/>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
  <button
    type="button"
    onClick={function() {
      backFileInputRef.current && backFileInputRef.current.click();
    }}
    style={{
      fontSize: "0.78rem",
      fontWeight: 600,
      background: C.white,
      border: "1px solid " + C.border,
      color: C.inkMid,
      padding: "0.55rem 0.9rem",
      borderRadius: 10,
      cursor: "pointer"
    }}
  >
    Upload Back Photo (Optional)
  </button>

  {backImagePreview && (
  <div
    style={{
      display: "flex",
      gap: "0.9rem",
      alignItems: "center",
      background: C.white,
      border: "1px solid " + C.border,
      borderRadius: 12,
      padding: "0.75rem",
      marginTop: "0.75rem"
    }}
  >
    <img
      src={backImagePreview}
      alt="Back preview"
      style={{
        width: 72,
        height: 100,
        objectFit: "contain",
        borderRadius: 6,
        background: "#f0f0f0",
        flexShrink: 0
      }}
    />

    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: C.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {backImageFile.name}
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: C.inkSoft,
          marginTop: "0.2rem"
        }}
      >
        {(backImageFile.size / 1024).toFixed(0)} KB · Back photo ready for analysis
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            background: C.goldLight,
            color: C.amber,
            padding: "0.15rem 0.5rem",
            borderRadius: 100
          }}
        >
          📷 Back Photo Enabled
        </span>
      </div>
    </div>
  </div>
)}
</div>
<div
  style={{
    marginTop: "1rem",
    background: "#f8f6f2",
    border: "1px solid #e7dcc7",
    borderRadius: 12,
    padding: "0.9rem 1rem",
  }}
>
  <div
    style={{
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "#8b6b2c",
      marginBottom: "0.5rem",
    }}
  >
    Photo Tips for Better Grading Analysis
  </div>

  <ul
    style={{
      margin: 0,
      paddingLeft: "1rem",
      fontSize: "0.82rem",
      lineHeight: 1.7,
      color: "#555",
    }}
  >
    <li>Use a dark flat background</li>
    <li>Remove sleeves/toploaders if safe</li>
    <li>Avoid harsh glare and shadows</li>
    <li>Take the photo straight-on</li>
    <li>Include all corners and edges</li>
    <li>Clean lighting improves surface analysis</li>
    <li>Front and back photos will improve future grading accuracy</li>
  </ul>
</div>
            {/* Examples */}
            <p style={{ fontSize: "0.72rem", color: C.inkSoft, marginBottom: "0.75rem" }}>Review identification and photo evidence. Real-market valuations and grading recommendations are unavailable.</p>
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

          <div style={{marginTop:16,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            <button type="button" onClick={()=>handleSubmit('identity')} disabled={loading||processingImages>0||!!photoErrors.front||!!photoErrors.back||!imageFile} style={{padding:'0.85rem 1.75rem',borderRadius:12,border:'1px solid #d2b48c',background:C.ink,color:'#fff',fontWeight:700}}>Identify Card</button>
            <span style={{fontSize:'0.8rem',color:C.inkSoft}}>Front photo required; back optional. Identification only. Analyze My Card remains the separate full scan.</span>
          </div>
          <p><a href="/grading-economics">Grading Economics — manual scenario calculator</a></p>
          <ControlledValidation cardType={cardType} onCategoryChange={setCardType} front={imageFile} back={backImageFile} busy={loading||processingImages>0||!!photoErrors.front||!!photoErrors.back} getSelectionEpoch={()=>selectionVersions.current.front+':'+selectionVersions.current.back} onSubmit={prepared=>handleSubmit('condition-validation',prepared)}/>
          {identityResult&&!loading&&<ResultCard data={identityResult} photos={reportPhotos(identityResult)} index={0} onSave={saveReport} isSaved={isSavedReport(identityResult)}/>}

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
              <p style={{ color: C.inkSoft, fontSize: "0.9rem" }}>{activeStage==='identity'?"Reading printed card identity and checking catalog evidence...":imageFile ? "Analyzing card values and photo..." : "Pulling market data and grading intel..."}</p>
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
          {!loading && !identityResult && results.length === 0 && !error && !rateLimitMsg && <EmptyState />}

          {/* Results */}
          {results.length > 0 && !loading && (
            <div style={{ marginTop: "2rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, marginBottom: "1rem" }}>
                {results.length === 1 ? "Your Report" : "Recent Reports (" + results.length + ")"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
               {results.map(function(saved, i) {
  const r = protectFinancialReport(saved);
  return (
    <div key={i}>
      <ScanDiagnostics report={saved} prominent scrollToCapture={i===0} />
      <ResultCard
        data={r}
        photos={reportPhotos(saved)}
        index={i}
        onSave={saveReport}
        isSaved={isSavedReport(r)}
      />

      <ScanDiagnostics report={saved} />
      {/* Identification review and <ImageAnalysisCard> now live inside ResultCard. */}
    </div>
  );
})}
              </div>

              
              <p style={{ fontSize: "0.72rem", color: C.inkSoft, textAlign: "center", marginTop: "1.25rem" }}>
                Photo findings are limited to the supplied images. Market evidence and grading recommendations remain withheld. Not affiliated with PSA.
              </p>
              {/* What Next */}
              <div style={{ marginTop: "1.75rem", background: C.cream, border: "1.5px solid " + C.border, borderRadius: 18, padding: "1.75rem 1.5rem" }}>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: "0.4rem" }}>What Next?</p>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.01em", color: C.ink, marginBottom: "0.5rem" }}>Keep grading smarter.</h3>
                <p style={{ fontSize: "0.875rem", color: C.inkMid, fontWeight: 300, lineHeight: 1.75, marginBottom: "1.25rem", maxWidth: 480 }}>
                  Inspect another card, review its identity and photo limitations, or explore your own clearly labeled cost assumptions.
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

          {/* Saved Card Reports */}
{savedReports.length > 0 && (
  <div style={{ marginTop: "1.75rem" }}>
    <div
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: C.inkSoft,
        marginBottom: "0.75rem",
      }}
    >
      Saved Card Reports
    </div>

    <div
      style={{
        background: C.white,
        border: "1px solid " + C.border,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {savedReports
        .slice()
        .sort(function(a, b) {
          const scoreA =
            (a.gemPredictScore || 0) +
            Math.max(0, a.expectedNetValue || 0);

          const scoreB =
            (b.gemPredictScore || 0) +
            Math.max(0, b.expectedNetValue || 0);

          return scoreB - scoreA;
        })
        .slice(0, 5)
        .map(function(r, idx) {
          return (
            <div
              key={r.cardTitle}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.85rem 1rem",
                borderBottom:
                  idx < 4 ? "1px solid " + C.border : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: C.ink,
                  }}
                >
                  #{idx + 1} {r.cardTitle}
                </div>

                <div
  style={{
    fontSize: "0.68rem",
    fontWeight: 700,
    marginTop: "0.15rem",
    color:
      (r.gemPredictScore || 0) >= 85
        ? C.green
        : (r.gemPredictScore || 0) >= 70
        ? C.amber
        : C.red,
  }}
>
  {(r.gemPredictScore || 0) >= 85
    ? "🟢 Strong Grade Candidate"
    : (r.gemPredictScore || 0) >= 70
    ? "🟡 Good Candidate"
    : "🟠 Borderline Candidate"}
</div>

                <div
                  style={{
                    fontSize: "0.72rem",
                    color: C.inkSoft,
                    marginTop: "0.2rem",
                  }}
                >
                  Score {r.gemPredictScore || "—"}/99
                  {" • "}
                  Expected Net{" "}
                  {r.expectedNetValue != null
                    ? (r.expectedNetValue >= 0 ? "+$" : "-$") +
                      safeMoney(Math.abs(r.expectedNetValue))
                    : "—"}
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: C.green,
                  flexShrink: 0,
                }}
              >
                Grade →
              </div>
            </div>
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
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reportTitle(r)}</div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                          {v && <span style={{ fontSize: "0.68rem", fontWeight: 700, background: v.bg, color: v.color, padding: "0.1rem 0.5rem", borderRadius: 100 }}>{v.label}</span>}
                          {r.psa10Probability != null && <span style={{ fontSize: "0.72rem", color: C.inkSoft }}>~{r.psa10Probability}% PSA 10</span>}
                          {r.gemPredictScore != null && (
  <span
    style={{
      fontSize: "0.72rem",
      color: C.amber,
      fontWeight: 700,
    }}
  >
    Score {r.gemPredictScore}/99
  </span>
)}
{r.financialDecision?.allowed && r.marketData?.marketSummary?.rawMedian != null && (
  <span style={{ fontSize: "0.72rem", color: C.green, fontWeight: 700 }}>
    Ask ${safeMoney(r.marketData.marketSummary.rawMedian)}
  </span>
)}
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

<div
  style={{
    marginTop: "2rem",
    background: C.cream,
    border: "1px solid " + C.border,
    borderRadius: 14,
    padding: "1rem 1.25rem",
  }}
>
  <div
    style={{
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: C.inkSoft,
      marginBottom: "0.75rem",
    }}
  >
    Available Today + Coming Soon
  </div>

  <div style={{ marginTop: "1rem" }}>
  <div
    style={{
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: C.green,
      marginBottom: "0.5rem",
    }}
  >
    Available Today
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
      gap: "0.5rem",
      marginBottom: "1rem",
    }}
  >
    <div>✅ AI Grading Reports</div>
    <div>✅ Live Market Intelligence</div>
    <div>✅ Comparable Listings</div>
    <div>✅ Image Analysis</div>
    <div>✅ Saved Reports</div>
    <div>✅ Saved Card Reports</div>
    <div>✅ Listing Match Score Engine</div>
  </div>

  <div
    style={{
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: C.gold,
      marginBottom: "0.5rem",
    }}
  >
    Coming Soon
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
      gap: "0.5rem",
    }}
  >
    <div>🚧 Inventory Tracker</div>
    <div>🚧 Bulk Card Uploads</div>
    <div>🚧 Bulk Submission Builder</div>
    <div>🚧 Card Identification Confidence</div>
    <div>🚧 Parallel Recognition</div>
    <div>🚧 Population Intelligence</div>
    <div>🚧 Collection Intelligence Dashboard</div>
    <div>🚧 ROI Alerts</div>
  </div>
</div>
  <div
    style={{
      marginTop: "1rem",
      fontSize: "0.72rem",
      color: C.inkSoft,
      lineHeight: 1.5,
    }}
  >
    GemPredict is evolving into an AI-powered collection intelligence platform for collectors, dealers, flippers, and grading submitters. Analyze cards, track opportunities, manage inventory, and make smarter grading decisions.
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
            { n: "01", title: "Search Your Card",    body: "Enter card name, type, set, and condition estimate. Optionally upload a photo for AI image analysis." },
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
          <h2 style={sectionH2St}>AI Collection Intelligence For Trading Cards.</h2>
          <p style={{ fontSize: "0.95rem", color: C.inkMid, fontWeight: 300, lineHeight: 1.85, maxWidth: 620, marginBottom: "2.5rem" }}>
            Analyze cards, evaluate grading opportunities, track reports, and make smarter submission decisions with live market intelligence.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
            {[
              { icon: "📊", title: "Market-informed estimates",     body: "Values reflect collector market patterns and known grading premiums — not live auction data or guaranteed valuations." },
              { icon: "🎯", title: "ROI-first analysis",            body: "GemPredict factors in the current $80 PSA fee and realistic grade probabilities so you see real upside, not optimistic upsell." },
              { icon: "🧠", title: "Condition-aware output",         body: "Tell GemPredict your card's likely condition and the analysis calibrates accordingly — played cards and gem candidates are treated differently." },
              { icon: "📷", title: "AI photo analysis (Beta)",       body: "Upload a card photo and GemPredict will assess centering, corners, edges, and surface to estimate grading potential from the image." },
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
          <FAQItem q="How accurate is GemPredict?" a="GemPredict separates identification, qualified photo observations and manual hypothetical economics. Real-market values and grading recommendations remain withheld until the required evidence is available." />
          <FAQItem q="Does GemPredict guarantee a PSA grade?" a="No. GemPredict is a decision-support tool, not a grading company. Final grades always depend on PSA's physical inspection of the actual card submitted." />
          <FAQItem q="Can I use this for sports cards too?" a="Yes. GemPredict supports Pokemon, sports cards, Magic: The Gathering, Yu-Gi-Oh!, Dragon Ball, One Piece, and other major TCG categories." />
          <FAQItem q="Why does PSA 10 probability matter?" a="GemPredict does not predict PSA grade probabilities. You can explore hypothetical outcomes using your own costs and resale assumptions." />
          <FAQItem q="What does the condition estimate do?" a="Photo findings describe supported visible regions and limitations. They are not a calibrated grade or probability; missing evidence remains unassessed." />
          <FAQItem q="How does photo analysis work?" a="Photo analysis proposes card identity and localized visual observations. Independent catalog checks and condition-evidence validation qualify the report. Glare, angle and resolution can prevent assessment; no numerical grade or submission verdict is supplied." />
          <FAQItem q="Will photo grading be added as a full feature?" a="Front and back photo observations are available now. Grading predictions would require separately validated calibration and are not enabled." />
        </div>
      </div>

      {/* ── WHAT'S COMING / PRO ───────────────────────────────────────────────── */}
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
                items: ["Card value lookup", "AI grading ROI verdict", "Raw / PSA 9 / PSA 10 estimates", "Condition-aware analysis", "AI photo analysis (Beta)", "Search history (local)", "Save up to 10 reports (local)"],
              },
              {
                label: "GemPredict Pro", badge: "Coming Soon", badgeBg: C.goldLight, badgeColor: C.amber, border: C.gold,
                items: ["Full AI photo grading (front + back)", "Unlimited saved reports", "Batch submission analysis", "Portfolio tracking", "Market alerts", "Priority support"],
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
            Be first when GemPredict launches full image-based grading analysis — centering, corners, edges, surface, and PSA 10 probability from front and back photos.
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
              GemPredict is in beta. Market prices move quickly and final grading outcomes depend on the physical card. Photo analysis accuracy depends on image quality. Use this as a pre-submission filter — not a guarantee.
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
