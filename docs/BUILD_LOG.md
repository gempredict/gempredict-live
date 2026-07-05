# GemPredict Build Log

## Current Product Goal

Get a polished beta in front of trusted collector/business friends this week.

Primary beta priorities:
1. Accurate card identification
2. Comparable listings showing reliably
3. Clear grading recommendation
4. Trust-building evidence/confidence
5. Simple feedback loop

---

## Completed Foundations

- Local development setup
- GitHub SSH push workflow
- Protected `.env.local`
- GemPredict Score engine
- Report builder
- Universal identity fields in image analysis
- Search candidate engine
- Identity confidence engine
- Beta feedback buttons

---

## Active Architecture Direction

GemPredict should become a collector intelligence platform, not just a grading calculator.

Core engines:
- Identity Engine
- Search Candidate Engine
- Market Evidence Engine
- Confidence Engine
- Image Grading Engine
- Scoring Engine
- Recommendation Engine
- Feedback / Benchmark Engine

---

## Open Product Backlog

### Beta Critical

- Improve card identification across sports, Pokémon, TCG, Disney, Star Wars, Lorcana, One Piece, Marvel, etc.
- Make comps more reliable.
- Show evidence/confidence in the report.
- Add feedback capture for correct / incorrect identification.
- Avoid showing uncertain set names as fact.
- Add top possible matches when identity confidence is low.

### Intelligence Engine Work

- Wire `buildSearchCandidates.js` into market lookup.
- Wire `calculateIdentityConfidence.js` into report output.
- Build `marketEvidenceEngine.js`.
- Build candidate validation using market results.
- Add OCR extraction later for card number and set text.
- Add benchmark deck later.

### UI / Product Polish

- GemPredict Score display polish.
- Identity card / evidence panel.
- Better report hierarchy.
- Mobile beta polish.
- Friend-facing beta instructions.

---

## Parking Lot

Things we discussed but are intentionally not doing yet:

- Full component refactor
- Identity Engine v2 full rebuild
- Multi-model consensus AI
- OCR pipeline
- Benchmark dashboard
- Bulk upload
- Inventory manager
- Submission builder
- Collection dashboard
- Mobile app

---

## Product Principle

Awe factor should come from accuracy, evidence, and trust — not flashy UI.

The user should think:

> “I can’t believe it identified the card, found comps, and explained what to do.”  