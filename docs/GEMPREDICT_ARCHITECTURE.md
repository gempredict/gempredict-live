# GemPredict Architecture

GemPredict is an AI collection intelligence platform for trading cards.

## Core Engines

### 1. Card Identifier
Identifies the card from image and/or user input.

Outputs:
- Subject
- Year
- Brand / Set
- Card Number
- Parallel
- Language
- Auto / Relic status
- Identity confidence
- Uncertainty notes

Rule: This engine should not calculate grading ROI or market value.

### 2. Canonical Card Record
Creates one clean card object every other engine uses.

Rule: The canonical card record is the source of truth for report titles, market queries, saved reports, and inventory.

### 3. Image Grader
Evaluates visible card condition only.

Outputs:
- Centering
- Corners
- Edges
- Surface
- Grade ceiling
- PSA 10 risk factors
- Confidence level

### 4. Market Intelligence
Finds and evaluates comparable listings.

Outputs:
- Fair market value
- Typical value range
- Comparable listings
- Listings used
- Outliers removed
- Market confidence

Rule: If set confidence is low, do not let the set poison the search.

### 5. ROI Engine
Combines condition, market value, grading fees, and probability.

Outputs:
- GemPredict Score
- Expected Net
- PSA 10 Odds
- Verdict
- Recommendation

### 6. Collection Engine
Helps collectors manage and prioritize collections.

Outputs:
- Saved Reports
- Inventory
- What To Grade Next
- Submission Builder
- Collection Dashboard
- ROI Alerts

## Near-Term Build Order

1. Stabilize Canonical Card Record
2. Identity Confidence Engine
3. Market Query Ladder
4. Image-only Upload Flow
5. Bulk Uploads
6. Inventory Tracker
7. Collection Dashboard
8. Submission Builder

## Product Principle

Every engine should do one job well.

Bad:
One AI prompt identifies, grades, prices, and recommends.

Good:
- Card Identifier identifies.
- Image Grader grades.
- Market Intelligence prices.
- ROI Engine recommends.
- Collection Engine helps users act.