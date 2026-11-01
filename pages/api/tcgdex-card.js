// Read-only catalog detail inspection. Does not change scanner predictions or reports.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!/^[a-zA-Z0-9-]{2,65}$/.test(id)) return res.status(400).json({ error: "Invalid catalog card ID" });
  res.setHeader("Cache-Control", "no-store");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(id), {
      signal: controller.signal, headers: { Accept: "application/json" }
    });
    if (!response.ok) return res.status(502).json({ error: "TCGdex detail lookup failed", upstreamStatus: response.status });
    const card = await response.json();
    return res.status(200).json({
      provider: "TCGdex",
      catalogId: card.id || null,
      name: card.name || null,
      localId: card.localId || null,
      set: card.set ? { id: card.set.id || null, name: card.set.name || null } : null,
      rarity: card.rarity || null,
      category: card.category || null,
      variants: card.variants || null,
      illustrationAvailable: Boolean(card.image),
      illustrator: card.illustrator || null,
      hp: card.hp || null,
      types: card.types || null,
      // These are catalog observations, not a verified photo-to-artwork match.
      verifiedAgainstPhoto: false
    });
  } catch (e) {
    return res.status(502).json({ error: "TCGdex detail request unavailable", reason: e?.name === "AbortError" ? "timeout" : "connection" });
  } finally { clearTimeout(timer); }
}
