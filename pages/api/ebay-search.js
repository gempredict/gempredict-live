function getMedian(nums) {
  if (!nums.length) return null;
  const sorted = nums.slice().sort(function(a, b) {
    return a - b;
  });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function scoreListing(title, query) {
  const t = (title || "").toLowerCase();
  const q = (query || "").toLowerCase();

  let score = 0;

  const queryWords = q
    .split(/\s+/)
    .map(function(w) { return w.trim(); })
    .filter(Boolean);

  queryWords.forEach(function(word) {
    if (t.includes(word)) score += 10;
  });

  // Early card-specific boosts
  if (t.includes("248")) score += 20;
  if (t.includes("purple")) score += 20;
  if (t.includes("shock")) score += 20;
  if (t.includes("rated rookie")) score += 15;
  if (t.includes("optic")) score += 10;

  // Penalize things that distort raw comps
  if (t.includes("psa") || t.includes("bgs") || t.includes("sgc") || t.includes("cgc")) score -= 40;
  if (t.includes("lot")) score -= 50;
  if (t.includes("auto") || t.includes("autograph")) score -= 35;
  if (t.includes("patch") || t.includes("relic")) score -= 35;

  return Math.max(0, score);
}

export default async function handler(req, res) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!q) {
      return res.status(400).json({
        success: false,
        error: "Missing search query. Use /api/ebay-search?q=2024%20Optic%20Jayden%20Daniels",
      });
    }

    const clientId = process.env.EBAY_PROD_CLIENT_ID;
    const clientSecret = process.env.EBAY_PROD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        error: "Missing eBay production credentials",
      });
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        success: false,
        error: "eBay token request failed",
        details: tokenData,
      });
    }

    const searchUrl =
      "https://api.ebay.com/buy/browse/v1/item_summary/search?" +
      new URLSearchParams({
        q,
        limit: "20",
      }).toString();

    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });

    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      return res.status(searchRes.status).json({
        success: false,
        error: "eBay search request failed",
        details: searchData,
      });
    }

    const items = (searchData.itemSummaries || []).map(function(item) {
      const priceValue = item.price && item.price.value
        ? Number(item.price.value)
        : null;

      const title = item.title || null;

      return {
        title,
        matchScore: scoreListing(title, q),
        price: item.price
          ? {
              value: item.price.value,
              currency: item.price.currency,
            }
          : null,
        priceValue: Number.isFinite(priceValue) ? priceValue : null,
        condition: item.condition || null,
        itemWebUrl: item.itemWebUrl || null,
        image: item.image && item.image.imageUrl ? item.image.imageUrl : null,
        itemId: item.itemId || null,
      };
    }).sort(function(a, b) {
      return b.matchScore - a.matchScore;
    });

    const comparableItems = items.filter(function(item) {
      return item.matchScore >= 60 && typeof item.priceValue === "number";
    });

    const priceValues = comparableItems
      .map(function(item) {
        return item.priceValue;
      })
      .filter(function(value) {
        return typeof value === "number" && Number.isFinite(value) && value > 0;
      });

    const lowest = priceValues.length ? Math.min.apply(null, priceValues) : null;
    const highest = priceValues.length ? Math.max.apply(null, priceValues) : null;
    const median = getMedian(priceValues);

    return res.status(200).json({
      success: true,
      environment: "production",
      query: q,
      total: searchData.total || 0,
      count: items.length,
      marketSummary: {
        comparableCount: comparableItems.length,
        listingCount: priceValues.length,
        lowest,
        highest,
        median,
      },
      comparableItems,
      items,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "eBay search failed",
      message: err.message,
    });
  }
}