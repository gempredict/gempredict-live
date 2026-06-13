function getMedian(nums) {
  if (!nums.length) return null;

  const sorted = nums.slice().sort(function(a, b) {
    return a - b;
  });

  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2) return sorted[mid];

  return (sorted[mid - 1] + sorted[mid]) / 2;
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

      return {
        title: item.title || null,
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
    });

    const priceValues = items
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
        listingCount: priceValues.length,
        lowest,
        highest,
        median,
      },
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