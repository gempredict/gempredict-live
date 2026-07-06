# Atlas Recognition Layer

**Version:** 1.0  
**Project:** Atlas Intelligence Platform  
**Status:** Design Specification

---

# Purpose

The Atlas Recognition Layer is responsible for determining the identity of a trading card before any valuation, grading recommendation, market analysis, or investment decision is made.

Recognition is not Atlas.

Recognition exists to provide Atlas with trustworthy evidence.

Atlas exists to make decisions from that evidence.

---

# Mission

Atlas Recognition should identify trading cards with the highest practical confidence while remaining completely independent of any single AI model or vendor.

The Recognition Layer should always prefer transparency over certainty.

If Atlas is uncertain, it should explain why.

---

# Core Philosophy

Atlas never asks one model:

> "What card is this?"

Instead, Atlas asks multiple independent systems to contribute evidence.

Recognition is evidence collection.

Identification is evidence evaluation.

Atlas owns the evaluation.

---

# Architectural Principle

**Never couple Atlas to a vendor.**

Couple Atlas to evidence.

Claude, GPT, Gemini, Google Vision, OCR, PSA, eBay, PriceCharting, TCGplayer, and future providers are all evidence sources.

None of them are Atlas.

---

# Recognition Pipeline

```
User Upload
        │
        ▼
Image Intake
        │
        ▼
Image Normalization
        │
        ▼
OCR Extraction
        │
        ▼
Vision Extraction
        │
        ▼
Candidate Generation
        │
        ▼
Candidate Validation
        │
        ▼
Recognition Confidence Engine
        │
        ├───────────────┐
        │               │
        ▼               ▼
High Confidence    Low Confidence
        │               │
        ▼               ▼
 Atlas         User Confirmation
        │
        ▼
Market Analysis
        │
        ▼
Recommendation Engine
```

---

# Stage 1 — Image Intake

## Purpose

Accept trading card images from the user.

## Supported Inputs

- Front image
- Back image (optional)
- Typed card name (optional)
- Card category (optional)
- Condition selection

## Responsibilities

- Validate image format
- Validate image size
- Detect front/back availability
- Preserve metadata
- Reject unsupported uploads

## Output

A normalized upload package ready for processing.

---

# Stage 2 — Image Normalization

## Purpose

Prepare images for OCR and vision models.

## Responsibilities

- Correct orientation
- Resize oversized images
- Compress when appropriate
- Preserve fine card details
- Detect poor image quality

## Quality Flags

- glare
- blur
- cropped edges
- low light
- angled photo
- card number obscured
- back image missing

Atlas should remember these flags because they reduce recognition confidence.

---

# Stage 3 — OCR Extraction

## Purpose

Extract exact text visible on the card.

OCR is often more reliable than vision for identity.

## OCR Targets

- Card name
- Card number
- Set text
- Copyright
- Year
- Language
- Manufacturer
- Team
- Player
- Character
- Serial number
- Auto indicator
- Relic indicator

OCR does not identify cards.

OCR contributes evidence.

---

# Stage 4 — Vision Extraction

## Purpose

Describe visible characteristics of the card.

Possible providers include:

- Claude Vision
- OpenAI Vision
- Gemini Vision
- Google Vision
- Future recognition providers

Vision contributes observations.

Examples:

- Subject
- Franchise
- Set
- Parallel
- Rarity
- Language
- Manufacturer
- Year
- Visual style

Vision is not authoritative.

---

# Stage 5 — Candidate Generation

## Purpose

Generate multiple possible identities.

Atlas should never assume the first answer is correct.

Candidate generation combines:

- OCR
- Vision
- User input
- Internal rules
- Previous evidence

Example candidates:

- Greninja ex SIR #214/187
- Greninja ex Full Art #106/086

Candidates are hypotheses.

Not conclusions.

---

# Stage 6 — Candidate Validation

## Purpose

Validate generated candidates using outside evidence.

Validation sources include:

- eBay
- PriceCharting
- PSA
- TCGplayer
- Internal benchmark data
- Future databases

Atlas should ask:

"Does the market support this candidate?"

Validation strengthens or weakens confidence.

---

# Stage 7 — Recognition Confidence Engine

## Purpose

Convert evidence into confidence.

Atlas does not average confidence.

Atlas weighs confidence.

Example evidence hierarchy:

| Evidence | Trust |
|----------|------:|
| User confirmed identity | 100 |
| OCR exact card number | 95 |
| Image similarity | 95 |
| OCR exact card name | 90 |
| Market validation | 85 |
| Vision subject | 75 |
| Vision parallel | 65 |
| Vision set | 60 |
| User typed card name | 50 |

Confidence bands:

95–100
Confirmed

80–94
Likely

60–79
Needs Verification

Below 60
Unknown

---

# Stage 8 — Conflict Resolution

Atlas should preserve disagreements.

Example:

OCR

214/187

Vision

106/086

Atlas should never silently choose.

Instead:

- Lower confidence
- Record disagreement
- Ask for confirmation
- Preserve evidence

Conflicts improve transparency.

---

# Stage 9 — User Confirmation

When Atlas lacks confidence it should ask the collector.

Example:

"We found two likely matches.

Greninja ex SIR #214/187

Greninja ex Full Art #106/086

Please confirm before valuation."

User confirmation becomes evidence.

---

# Stage 10 — Atlas Handoff

Only after recognition is complete should Atlas continue.

Atlas receives:

- confirmed identity
- recognition confidence
- supporting evidence
- conflicting evidence
- quality flags

Atlas then performs:

- Market Analysis
- Grade Analysis
- ROI Analysis
- Recommendation
- Report Generation

Recognition ends here.

Atlas begins here.

---

# Recognition Philosophy

Recognition is not finding an answer.

Recognition is determining which answer is most likely correct.

---

# Engineering Rules

Recognition providers produce evidence.

Atlas weighs evidence.

Atlas makes decisions.

No recognition provider should ever directly determine a recommendation.

---

# Product Rules

Atlas should optimize for trust before speed.

A slower correct answer is more valuable than a fast incorrect one.

Incorrect certainty destroys trust.

Collector trust compounds over time.

---

# Beta Goals

For beta:

- Support assisted recognition.
- Allow user confirmation.
- Show uncertainty honestly.
- Never fabricate confidence.
- Never value an unidentified card.

---

# Long-Term Vision

Atlas Recognition should become completely vendor agnostic.

Recognition providers can change.

Evidence format remains constant.

Atlas remains the intelligence layer.

Recognition finds possibilities.

Atlas determines probability.

Collectors make the final decision.