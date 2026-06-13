function getMedian(nums) {
  if (!nums.length) return null;
  const sorted = nums.slice().sort(function(a, b) {
    return a - b;
  });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundMoney(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function getListingType(title, condition) {
  const t = (title || "").toLowerCase();
  const c = (condition || "").toLowerCase();

  const isGraded =
  c === "graded" ||
  /\bpsa\b|\bbgs\b|\bsgc\b|\bcgc\b/.test(t);

  const isLot =
    /\blot\b|lot of|\bx2\b|\bx3\b|\bx4\b|\bx5\b|\b2x\b|\b3x\b|\b4x\b|\b5x\b/.test(t);

  const isAutoOrPatch =
    /\bauto\b|autograph|signature|patch|relic|jersey|memorabilia/.test(t);

  if (isLot || isAutoOrPatch) return "excluded";
  if (isGraded) return "graded";
  return "raw";
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

  if (t.includes("248")) score += 20;
  if (t.includes("purple")) score += 20;
  if (t.includes("shock")) score += 20;
  if (t.includes("rated rookie")) score += 15;
  if (t.includes("optic")) score += 10;

  if (t.includes("psa") || t.includes("bgs") || t.includes("sgc") || t.includes("cgc")) score -= 40;
  if (t.includes("lot")) score -= 50;
  if (t.includes("auto") || t.includes("autograph")) score -= 35;
  if (t.includes("patch") || t.includes("relic")) score -= 35;

  return Math.max(0, score);
}

export default async function handler(req, res) {
  try {
    const identity = {
  game: typeof req.query.game === "string" ? req.query.game.trim() : null,
  year: typeof req.query.year === "string" ? req.query.year.trim() : null,
  brand: typeof req.query.brand === "string" ? req.query.brand.trim() : null,
  set: typeof req.query.set === "string" ? req.query.set.trim() : null,
  player: typeof req.query.player === "string" ? req.query.player.trim() : null,
  cardName: typeof req.query.cardName === "string" ? req.query.cardName.trim() : null,
  cardNumber: typeof req.query.cardNumber === "string" ? req.query.cardNumber.trim() : null,
  parallel: typeof req.query.parallel === "string" ? req.query.parallel.trim() : null,
};

const structuredQuery = [
  identity.year,
  identity.brand || identity.set,
  identity.player || identity.cardName,
  identity.cardNumber,
  identity.parallel,
]
  .filter(Boolean)
  .join(" ");

const q = typeof req.query.q === "string" && req.query.q.trim()
  ? req.query.q.trim()
  : structuredQuery;

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

    const items = (searchData.itemSummaries || [])
      .map(function(item) {
        const priceValue = item.price && item.price.value
          ? Number(item.price.value)
          : null;

        const title = item.title || "";
        const listingType = getListingType(title, item.condition);

        return {
          title,
          matchScore: scoreListing(title, q),
          listingType,
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
      })
      .sort(function(a, b) {
        return b.matchScore - a.matchScore;
      });

    const rawComparableItems = items.filter(function(item) {
      return item.listingType === "raw" &&
        item.matchScore >= 60 &&
        typeof item.priceValue === "number";
    });

    const gradedItems = items.filter(function(item) {
      return item.listingType === "graded";
    });

    const excludedItems = items.filter(function(item) {
      return item.listingType === "excluded";
    });

    const rawPrices = rawComparableItems
      .map(function(item) {
        return item.priceValue;
      })
      .filter(function(value) {
        return typeof value === "number" && Number.isFinite(value) && value > 0;
      });

    const rawLowest = rawPrices.length ? Math.min.apply(null, rawPrices) : null;
    const rawHighest = rawPrices.length ? Math.max.apply(null, rawPrices) : null;
    const rawMedian = getMedian(rawPrices);

    return res.status(200).json({
  success: true,
  environment: "production",
  query: q,
  identity,
      total: searchData.total || 0,
      count: items.length,
      marketSummary: {
        rawComparableCount: rawComparableItems.length,
        gradedCount: gradedItems.length,
        excludedCount: excludedItems.length,
        rawLowest: roundMoney(rawLowest),
        rawHighest: roundMoney(rawHighest),
        rawMedian: roundMoney(rawMedian),
      },
      rawComparableItems,
      gradedItems,
      excludedItems,
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