import React from "react";

function Metric({ label, value, sub }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "0.7rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "0.62rem",
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "1rem",
          color: "#fff",
          fontWeight: 900,
          marginTop: "0.25rem",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: "0.65rem",
          color: "#c9a84c",
          marginTop: "0.15rem",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

export default function AtlasPanel({ atlas }) {
  if (!atlas) return null;

  const identity = atlas.identityConfidence || {};
  const market = atlas.marketEvidence || {};
  const decision = atlas.decision || {};
  const evidence = atlas.evidence || [];
  const recognition = atlas.recognition || {};
  const recognitionConfidence = recognition.recognitionConfidence || {};
  const recognitionHandoff = recognition.handoff || {};
  const topCandidate =
  recognitionConfidence.topCandidate || recognitionHandoff.selectedCandidate || {};

  return (
    <div
      style={{
        background: "#0d1117",
        color: "#fff",
        borderRadius: 16,
        padding: "1rem",
        marginBottom: "1.25rem",
        border: "1px solid rgba(201,168,76,0.35)",
      }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#c9a84c",
          marginBottom: "0.8rem",
        }}
      >
        Atlas Intelligence
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.65rem",
          marginBottom: "0.9rem",
        }}
      >
        <Metric
          label="Identity"
          value={identity.score != null ? identity.score + "%" : "—"}
          sub={identity.level || "Unknown"}
        />

        <Metric
          label="Market"
          value={market.confidence != null ? market.confidence + "%" : "—"}
          sub={market.level || "Unknown"}
        />

<Metric
  label="Recognition"
  value={
    recognitionConfidence.score != null
      ? recognitionConfidence.score + "%"
      : "—"
  }
  sub={recognitionConfidence.level || "Unknown"}
/>

        <Metric
          label="Decision"
          value={decision.label || "Review"}
          sub={decision.decision || "review"}
        />
      </div>

      {topCandidate.displayName && (
  <div
    style={{
      borderTop: "1px solid rgba(255,255,255,0.12)",
      paddingTop: "0.75rem",
      marginTop: "0.75rem",
      fontSize: "0.78rem",
      color: "#e5e7eb",
      lineHeight: 1.4,
    }}
  >
    <span style={{ color: "#c9a84c", fontWeight: 800 }}>
      Top Candidate:
    </span>{" "}
    {topCandidate.displayName}
  </div>
)}

      {recognitionHandoff.nextStep && (
  <div
    style={{
      borderTop: "1px solid rgba(255,255,255,0.12)",
      paddingTop: "0.75rem",
      marginTop: "0.75rem",
      fontSize: "0.78rem",
      color: "#e5e7eb",
      lineHeight: 1.4,
    }}
  >
    <span style={{ color: "#c9a84c", fontWeight: 800 }}>
      Recognition Next Step:
    </span>{" "}
    {recognitionHandoff.nextStep}
  </div>
)}

      {evidence.length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.12)",
            paddingTop: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              color: "#c9a84c",
              marginBottom: "0.45rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Evidence
          </div>

          {evidence.slice(0, 4).map(function (item, i) {
            return (
              <div
                key={i}
                style={{
                  fontSize: "0.78rem",
                  color: "#e5e7eb",
                  marginTop: "0.35rem",
                  lineHeight: 1.4,
                }}
              >
                ✓ {item.message}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}