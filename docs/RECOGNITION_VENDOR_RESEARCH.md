# Recognition Vendor Research

## Goal

Find the lowest-cost path to reliable card identification without building our own model.

## Constraint

GemPredict should avoid expensive custom model training unless the product proves demand.

## Vendors / Approaches to Evaluate

### 1. OCR-first recognition

Use OCR to extract:
- Card name
- Card number
- Set text
- Year
- Language
- Copyright
- Serial numbering

Pros:
- Cheap
- Useful across sports and TCG
- Card number is often the strongest signal

Cons:
- Fails on blurry photos
- Hard with stylized foil/text
- Needs cleanup logic

Beta usefulness:
High

---

### 2. Multi-model vision extraction

Use Claude, GPT, or Gemini to extract visible card facts.

Pros:
- Fast to test
- No custom model
- Good at describing images

Cons:
- Can hallucinate set/number/rarity
- Not reliable enough alone

Beta usefulness:
Medium-high as one signal

---

### 3. Image similarity search

Compare uploaded card image against known reference images.

Pros:
- Closest to true card recognition
- Better than asking an LLM to guess

Cons:
- Needs reference image database
- More setup work
- May cost more at scale

Beta usefulness:
High later

---

### 4. Market validation

Use eBay/market searches to validate candidates.

Pros:
- Already partly built
- Confirms whether card identity exists in market
- Helps catch bad model guesses

Cons:
- Search results can be noisy
- No comps does not always mean wrong identity

Beta usefulness:
High

---

## Recommended Beta Pipeline

1. OCR extracts card number/text.
2. Vision model extracts subject/franchise/set/parallel.
3. Atlas generates candidate identities.
4. Market search validates candidates.
5. If confidence is below threshold, ask user to confirm.

## Beta Rule

Never present uncertain identity as fact.

Use:
- Confirmed Identity
- Likely Identity
- Needs User Verification

## Next Build Step

Create an OCR extraction layer stub so Atlas Recognition can accept OCR evidence later.