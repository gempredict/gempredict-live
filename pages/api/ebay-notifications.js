import crypto from "crypto";

export default async function handler(req, res) {
  try {
    const verificationToken = process.env.EBAY_MARKETPLACE_DELETION_TOKEN;
    const endpointUrl = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT;

    if (!verificationToken || !endpointUrl) {
      return res.status(500).json({
        error: "Missing eBay notification verification settings",
      });
    }

    if (req.method === "GET") {
      const challengeCode = req.query.challenge_code;

      if (!challengeCode || typeof challengeCode !== "string") {
        return res.status(400).json({
          error: "Missing challenge_code",
        });
      }

      const hash = crypto
        .createHash("sha256")
        .update(challengeCode)
        .update(verificationToken)
        .update(endpointUrl)
        .digest("hex");

      return res.status(200).json({
        challengeResponse: hash,
      });
    }

    if (req.method === "POST") {
      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (err) {
    return res.status(500).json({
      error: "eBay notification endpoint failed",
      message: err.message,
    });
  }
}