import { getListingType, scoreListing, readMarketIdentity, buildStructuredQuery } from "../../lib/ebayIdentityMatch.mjs";

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

export default async function handler(req, res) {
  try {
    const identity = readMarketIdentity(req.query);
    const q = typeof req.query.q === "string" && req.query.q.trim()
      ? req.query.q.trim()
      : buildStructuredQuery(identity);

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
        const match = scoreListing(title, q, identity);
        const type = getListingType(title, item.condition);
        const listingType = type === "raw" && !match.comparable ? "excluded" : type;

return {
  title,
  matchScore: match.score,
  matchReasons: match.reasons,
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
        typeof item.priceValue === "number" &&
        item.priceValue > 0 && item.price?.currency === "USD";
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

const sortedRawPrices = rawPrices.slice().sort(function(a, b) {
  return a - b;
});

const rawTypicalRangeLow = sortedRawPrices.length
  ? sortedRawPrices[Math.floor(sortedRawPrices.length * 0.25)]
  : null;

const rawTypicalRangeHigh = sortedRawPrices.length
  ? sortedRawPrices[Math.floor(sortedRawPrices.length * 0.75)]
  : null;

const filteredRawPrices = rawPrices.filter(function(price) {
  if (rawTypicalRangeLow == null || rawTypicalRangeHigh == null) return true;
  return price >= rawTypicalRangeLow * 0.5 && price <= rawTypicalRangeHigh * 1.75;
});

const rawLowest = filteredRawPrices.length ? Math.min.apply(null, filteredRawPrices) : null;
const rawHighest = filteredRawPrices.length ? Math.max.apply(null, filteredRawPrices) : null;
const rawMedian = getMedian(filteredRawPrices);

let marketConfidence = 50;

if (filteredRawPrices.length >= 5) marketConfidence += 10;
if (filteredRawPrices.length >= 10) marketConfidence += 10;
if (filteredRawPrices.length >= 15) marketConfidence += 10;

const avgMatchScore =
  rawComparableItems.length > 0
    ? rawComparableItems.reduce(function(sum, item) {
        return sum + item.matchScore;
      }, 0) / rawComparableItems.length
    : 0;

if (avgMatchScore >= 120) marketConfidence += 10;
if (avgMatchScore >= 150) marketConfidence += 10;

marketConfidence = Math.max(1, Math.min(99, marketConfidence));


    return res.status(200).json({
  success: true,
  environment: "production",
  query: q,
  identity,
      total: searchData.total || 0,
      count: items.length,
      marketSummary: {
        rawComparableCount: rawComparableItems.length,
        rawUsedCount: filteredRawPrices.length,
rawOutlierCount: rawPrices.length - filteredRawPrices.length,
        gradedCount: gradedItems.length,
        excludedCount: excludedItems.length,
        rawLowest: roundMoney(rawLowest),
        rawHighest: roundMoney(rawHighest),
        rawMedian: roundMoney(rawMedian),
        fairMarketValue: roundMoney(rawMedian),
        rawTypicalRangeLow: roundMoney(rawTypicalRangeLow),
rawTypicalRangeHigh: roundMoney(rawTypicalRangeHigh),
        marketConfidence,
averageMatchScore: Math.round(avgMatchScore),
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