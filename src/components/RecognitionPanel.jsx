import React from "react";

export default function RecognitionPanel({ recognition }) {
  if (!recognition) return null;

  const confidence = recognition.recognitionConfidence || {};
  const handoff = recognition.handoff || {};
  const health = recognition.health || {};

  return (
    <div
      style={{
        background: "#0d1117",
        borderRadius: 16,
        padding: "1rem",
        marginTop: "1rem",
        color: "#fff",
        border: "1px solid rgba(201,168,76,0.35)",
      }}
    >
      <div
        style={{
          color: "#c9a84c",
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          marginBottom: "1rem",
        }}
      >
        Atlas Recognition
      </div>

      <div>
        <strong>Confidence:</strong>{" "}
        {confidence.score ?? "—"}%
      </div>

      <div>
        <strong>Level:</strong>{" "}
        {confidence.level || "Unknown"}
      </div>

      <div>
        <strong>Top Candidate:</strong>{" "}
        {confidence.topCandidate?.displayName || "None"}
      </div>

      <div>
        <strong>Next Step:</strong>{" "}
        {handoff.nextStep || "None"}
      </div>

      {health.warnings?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Warnings</strong>

          <ul>
            {health.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}