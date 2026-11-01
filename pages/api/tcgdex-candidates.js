import { findTcgdexCandidates } from "../../lib/tcgdexCatalog.mjs";

// Non-destructive diagnostic API. No automatic report-title changes.
// GET /api/tcgdex-candidates?subject=Pikachu%20ex&number=149/128&set=...
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const subject = typeof req.query.subject === "string" ? req.query.subject.slice(0, 80) : "";
  const cardNumber = typeof req.query.number === "string" ? req.query.number.slice(0, 25) : "";
  const set = typeof req.query.set === "string" ? req.query.set.slice(0, 80) : "";
  if (!subject || !cardNumber) return res.status(400).json({ error: "subject and number required" });
  res.setHeader("Cache-Control", "no-store");
  const result = await findTcgdexCandidates({ subject, cardNumber, set });
  return res.status(200).json({ provider: "TCGdex", ...result });
}
