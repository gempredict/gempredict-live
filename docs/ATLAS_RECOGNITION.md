# Atlas Recognition

## Goal

Identify any trading card with high confidence before Atlas performs valuation, grading analysis, ROI, or recommendation.

Atlas should not rely on one model blindly. Recognition should use multiple signals and only proceed confidently when evidence agrees.

---

## Core Principle

AI provides observations. Atlas makes the decision.

---

## Recognition Pipeline

### 1. Image Intake

Inputs:
- Front image
- Back image, optional but preferred
- User typed card name, optional
- User selected category, optional

Outputs:
- Normalized image files
- Image quality flags
- Front/back availability

---

### 2. OCR Layer

Purpose:
Read visible text from the card.

Extract:
- Card name
- Card number
- Set text
- Year
- Language
- Copyright text
- Player or character name
- Team name
- Manufacturer
- Rarity text
- Serial numbering
- Auto/relic indicators

---

### 3. Vision Recognition Layer

Purpose:
Use external vision models to describe the card and detect visual features.

Possible models:
- Claude Vision
- GPT Vision
- Gemini Vision
- Google Vision / Lens-style API if available
- OCR-specific services
- Future image similarity model

Outputs:
- Subject
- Franchise
- Manufacturer
- Set/product
- Parallel/rarity
- Visual style
- Confidence
- Uncertainty notes

---

### 4. Candidate Generation

Purpose:
Create possible card identities from OCR + vision outputs.

Example candidates:
- Subject + card number
- Subject + set
- Subject + parallel
- Year + manufacturer + subject
- OCR card number + franchise
- User typed input + OCR evidence

Outputs:
- Ranked list of possible identities
- Search candidates
- Reason each candidate was generated

---

### 5. Candidate Validation

Purpose:
Validate likely identities against outside evidence.

Validation sources:
- eBay listings
- PriceCharting
- TCGplayer where applicable
- Card databases where available
- PSA population later
- Internal benchmark data later

Outputs:
- Matching listings count
- Market confidence
- Conflicting evidence
- Best candidate
- Alternate candidates

---

### 6. Confidence Decision

Purpose:
Atlas decides whether identity is good enough.

Confidence levels:
- 95–100: Auto-proceed
- 80–94: Proceed with visible caution
- 60–79: Ask user to confirm
- Under 60: Do not proceed as fact

Rules:
- Never silently proceed with weak identity.
- Never present uncertain set/card number as confirmed.
- Show alternate matches when confidence is low.
- User confirmation can override weak confidence but should be logged.

---

### 7. Atlas Handoff

Once identity is confirmed, Atlas runs:
- Market Evidence Engine
- Condition / Grade Explanation Engine
- ROI Engine
- Recommendation Engine
- Decision Engine
- Report Builder

---

## Beta Strategy

For beta, recognition should be assisted, not perfect.

Minimum beta behavior:
- Use image when possible.
- If identity is uncertain, show “Verify identity.”
- Allow user to correct card name/set/number.
- Do not produce confident valuation from uncertain identity.

---

## Long-Term Goal

Atlas Recognition should become model-agnostic.

Claude, GPT, Gemini, OCR, Google Vision, and future tools should all be interchangeable evidence sources.

Atlas remains the decision layer.