# Recognition Provider Interface

Version: 1.0

---

# Purpose

Every Recognition provider should implement the same contract.

Atlas should never care whether evidence came from Claude, Gemini, OCR, eBay, or a future provider.

Providers generate evidence.

Atlas evaluates evidence.

---

# Provider Input

Each provider receives:

- Front image
- Back image
- User supplied information
- Previous recognition context (optional)

---

# Provider Output

Each provider returns:

## Provider Name

Example

Claude Vision

---

## Confidence

0–100

---

## Evidence

Each evidence item contains

Type

Claim

Confidence

Reason

Example

Type

identity.cardNumber

Claim

110/068

Confidence

99

Reason

Visible OCR text

---

Supported Evidence Types

identity.subject

identity.cardNumber

identity.set

identity.parallel

identity.language

identity.manufacturer

identity.year

condition.surface

condition.edges

condition.corners

condition.centering

---

# Provider Responsibilities

Providers never make final decisions.

Providers never assign market values.

Providers never determine grading recommendations.

Providers only submit evidence.

---

# Atlas Responsibilities

Merge evidence.

Resolve conflicts.

Weight evidence.

Determine confidence.

Explain reasoning.

Request user confirmation when necessary.

---

# Future Providers

Claude Vision

Gemini Vision

OpenAI Vision

Google Lens

OCR

eBay

TCGplayer

PriceCharting

PSA Database

Pokemon Database

Sports Card Database

Local Image Similarity Engine

---

# Guiding Principle

Recognition providers are replaceable.

Atlas is permanent.