# Atlas Provider Priority

Purpose

Providers should be added in the order that most improves Recognition accuracy.

---

## Tier 1 (Highest ROI)

### OCR

Purpose

Extract exact printed text.

Reason

Card numbers are the strongest identity signal.

---

### Pokemon Database

Purpose

Validate that a subject + card number actually exists.

Reason

Stops hallucinated set names.

---

### eBay

Purpose

Validate identity through collector consensus.

Reason

Thousands of listings become evidence.

---

## Tier 2

Gemini Vision

Independent visual opinion.

---

OpenAI Vision

Independent visual opinion.

---

Google Lens

Independent visual opinion.

---

## Tier 3

Image Similarity Engine

Nearest-neighbor search against known cards.

---

Historical Atlas Recognition Memory

Learn from previous successful recognitions.

---

PSA Population Database

Validate rarity and grading context.

---

Rule

Every provider must improve benchmark accuracy.

If it doesn't, remove it.