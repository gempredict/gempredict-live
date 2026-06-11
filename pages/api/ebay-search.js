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
        limit: "10",
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
      return {
        title: item.title || null,
        price: item.price
          ? {
              value: item.price.value,
              currency: item.price.currency,
            }
          : null,
        condition: item.condition || null,
        itemWebUrl: item.itemWebUrl || null,
        image: item.image && item.image.imageUrl ? item.image.imageUrl : null,
        itemId: item.itemId || null,
      };
    });

    return res.status(200).json({
      success: true,
      environment: "production",
      query: q,
      total: searchData.total || 0,
      count: items.length,
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