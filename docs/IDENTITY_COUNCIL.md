# Atlas Identity Council

Version: 1.0

---

# Purpose

The Identity Council exists to determine the most probable identity of a trading card.

No single AI model, OCR engine, marketplace, or database determines identity.

Each contributes evidence.

Atlas evaluates that evidence.

---

# Philosophy

Recognition providers make observations.

Atlas makes decisions.

---

# Council Members

## Vision Models

Claude

Strengths

- Artwork
- Subject
- Parallel
- Language

Weaknesses

- Hallucinated set names
- Incorrect card numbers
- Newly released products

---

Gemini

Strengths

- Different visual reasoning
- Independent observations

Weaknesses

- Can disagree with Claude
- Can hallucinate

---

OpenAI Vision

Strengths

- Alternate reasoning path

Weaknesses

- Same hallucination risk

---

## OCR

Strengths

- Exact printed text
- Card number
- Copyright
- Year

Weaknesses

- Blur
- Glare
- Stylized fonts

---

## Market Evidence

eBay

Strengths

- Real collector titles
- Recent listings
- Multiple independent sellers

Weaknesses

- Seller typos
- Keyword stuffing

---

TCGplayer

Strengths

- Official product names

Weaknesses

- Limited grading information

---

PriceCharting

Strengths

- Standardized identities

Weaknesses

- Limited newest products

---

Pokemon Database

Strengths

- Canonical identities
- Exact card numbering

Weaknesses

- No pricing

---

# Identity Weighting

Highest Trust

- Exact card number
- Database confirmation
- OCR exact match

High Trust

- eBay consensus
- TCGplayer match
- Multiple vision agreement

Medium Trust

- Single vision provider

Low Trust

- User supplied set name

---

# Decision Rules

Rule 1

Card Number beats guessed Set.

---

Rule 2

If two vision providers disagree,
vision confidence decreases.

---

Rule 3

If OCR and market agree,
Atlas should heavily favor that identity.

---

Rule 4

If every provider disagrees,
Atlas should ask the collector.

Never fabricate confidence.

---

# Council Output

Atlas should produce

Subject

Card Number

Set

Parallel

Language

Manufacturer

Confidence

Evidence Summary

Conflicting Evidence

Recommended Next Step

---

# Long Term Goal

Atlas should become the most trusted card identification engine available.

Not because one AI model is smarter.

Because Atlas evaluates evidence better than anyone else.