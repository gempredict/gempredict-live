# Atlas Evidence Bus

## Goal

Create one standard format for all evidence that flows into Atlas.

Atlas should not care whether evidence comes from Claude, OCR, Google Vision, Gemini, eBay, PSA, PriceCharting, TCGplayer, or user confirmation.

Atlas should care:
- What was claimed?
- Who claimed it?
- How confident is the source?
- Does another source agree?
- Does any source conflict?

---

## Core Idea

Every signal becomes evidence.

Example:

```json
{
  "source": "ocr",
  "type": "identity.cardNumber",
  "claim": "214/187",
  "confidence": 98,
  "metadata": {
    "location": "bottom-left",
    "rawText": "214/187"
  }
}