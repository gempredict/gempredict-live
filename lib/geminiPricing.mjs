const dateName = 'GEMPREDICT_GEMINI_PRICING_VERIFIED_THROUGH';
const numericNames = [
  'GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION',
  'GEMPREDICT_GEMINI_OUTPUT_USD_PER_MILLION',
  'GEMPREDICT_GEMINI_MAX_SCAN_USD',
];

// Keep the paid admission rules and owner readiness diagnostics in sync.
export function inspectGeminiPricing(env, now = new Date()) {
  const issues = [];
  const verifiedThrough = env[dateName];
  if (!verifiedThrough) {
    issues.push({ variable: dateName, rule: 'missing' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedThrough)) {
    issues.push({ variable: dateName, rule: 'invalid_date_format' });
  } else if (!Number.isFinite(Date.parse(verifiedThrough)) ||
      new Date(verifiedThrough).toISOString().slice(0, 10) !== verifiedThrough) {
    issues.push({ variable: dateName, rule: 'invalid_calendar_date' });
  } else if (verifiedThrough < now.toISOString().slice(0, 10)) {
    issues.push({ variable: dateName, rule: 'expired_utc' });
  }
  const [input, output, ceiling] = numericNames.map(variable => {
    const value = env[variable];
    const number = Number(value);
    const rule = !value ? 'missing' : !/^\d+(?:\.\d+)?$/.test(value)
      ? 'invalid_decimal_format' : !Number.isFinite(number) ? 'non_finite' : number <= 0 ? 'not_positive' : null;
    if (rule) issues.push({ variable, rule });
    return number;
  });
  return { issues, pricing: issues.length ? null : { input, output, ceiling } };
}
