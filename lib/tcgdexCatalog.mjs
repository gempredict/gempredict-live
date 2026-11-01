// Read-only TCGdex lookup. Identity is a catalog candidate, not a verified match
// until full collector-number, name, set and printing evidence have been checked.
const BASE = "https://api.tcgdex.net/v2/en";
const abortAfter = 4500;

function normalize(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }
function numberPart(s) { return String(s || "").trim().split("/")[0].replace(/^0+(?=\d)/, ""); }

export function evaluateTcgdexCandidates(cards, observed = {}) {
  const targetName = normalize(observed.subject);
  const targetNumber = numberPart(observed.cardNumber);
  const targetSet = normalize(observed.set);
  if (!targetName || !targetNumber || !Array.isArray(cards)) {
    return { status: "insufficient_evidence", candidates: [] };
  }
  const candidates = cards.filter(c =>
    normalize(c.name) === targetName &&
    numberPart(c.localId) === targetNumber
  ).map(c => ({
    id: c.id,
    name: c.name,
    localId: c.localId,
    setName: c.set?.name || null,
    imageAvailable: Boolean(c.image),
    setAgrees: Boolean(targetSet && normalize(c.set?.name) === targetSet),
  }));
  const matchingSet = candidates.filter(c => c.setAgrees);
  // Do NOT call a name + collector number a validated match: the same number
  // can occur across unrelated sets and finishes.
  return {
    status: matchingSet.length === 1 ? "catalog_candidate" : "needs_review",
    verified: false,
    candidates: candidates.slice(0, 20),
  };
}

export async function findTcgdexCandidates(observed = {}) {
  const name = String(observed.subject || "").trim();
  const number = numberPart(observed.cardNumber);
  if (!name || !number) return { status: "insufficient_evidence", verified: false, candidates: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), abortAfter);
  try {
    const url = BASE + "/cards?name=" + encodeURIComponent(name);
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) return { status: "catalog_unavailable", verified: false, candidates: [] };
    const cards = await response.json();
    return evaluateTcgdexCandidates(cards, observed);
  } catch {
    return { status: "catalog_unavailable", verified: false, candidates: [] };
  } finally { clearTimeout(timeout); }
}
