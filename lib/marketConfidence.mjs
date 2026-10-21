// Price reliability for active asking-price comparables, not identity confidence
// or completed-sale evidence. Inputs must describe the final usable raw prices.
export function calculateMarketConfidence({ rawUsedCount, rawMedian, rawTypicalRangeLow, rawTypicalRangeHigh }) {
  if (!Number.isInteger(rawUsedCount) || rawUsedCount <= 0) return 0;

  let confidence = rawUsedCount >= 15 ? 80
    : rawUsedCount >= 10 ? 70
    : rawUsedCount >= 5 ? 55
    : rawUsedCount >= 3 ? 45
    : rawUsedCount >= 2 ? 35
    : 20;

  // One/two observations cannot establish a meaningful typical price range.
  if (rawUsedCount >= 3 && Number.isFinite(rawMedian) && rawMedian > 0 &&
      Number.isFinite(rawTypicalRangeLow) && rawTypicalRangeLow > 0 &&
      Number.isFinite(rawTypicalRangeHigh) && rawTypicalRangeHigh >= rawTypicalRangeLow) {
    const relativeWidth = (rawTypicalRangeHigh - rawTypicalRangeLow) / rawMedian;
    if (relativeWidth <= 0.25) confidence += 10;
    else if (relativeWidth <= 0.5) confidence += 5;
    else if (relativeWidth > 1) confidence -= 10;
  }

  return Math.max(0, Math.min(95, confidence));
}
