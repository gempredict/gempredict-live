// The SDK embeds Google's JSON error body in ApiError.message. Export only
// fixed classifications. Field paths and descriptions can contain input.
const fields = [
  ['response_schema', /^(?:generation_?config\.)?response_?json_?schema(?:\.|\[|$)|^(?:generation_?config\.)?response_?schema(?:\.|\[|$)/i],
  ['response_mime_type', /^(?:generation_?config\.)?response_?mime_?type$/i],
  ['thinking_config', /^(?:generation_?config\.)?thinking_?config(?:\.|\[|$)/i],
  ['output_token_limit', /^(?:generation_?config\.)?max_?output_?tokens$/i],
  ['media_resolution', /(?:^|\.)media_?resolution(?:\.|\[|$)/i],
  ['inline_image', /(?:^|\.)inline_?data(?:\.|\[|$)/i],
  ['model', /^model$/i],
];
const messages = [
  ['schema_complexity', /schema (?:is )?too complex|schema.{0,80}(?:too many states|exceeds.{0,25}complexity)/i],
  ['response_schema', /(?:response[_ ]?(?:json[_ ]?)?schema|json schema).{0,80}(?:invalid|not supported|unsupported)|(?:invalid|unsupported) (?:response[_ ]?(?:json[_ ]?)?schema|json schema)/i],
  ['thinking_config', /thinking(?:[_ ]?(?:config|level|budget)).{0,80}(?:invalid|not supported|unsupported|must be)/i],
  ['media_resolution', /media[_ ]?resolution.{0,80}(?:invalid|not supported|unsupported|must be)/i],
  ['inline_image', /(?:invalid image|unsupported image|unable to (?:decode|process) (?:the )?image|invalid mime type)/i],
  ['output_token_limit', /max[_ ]?output[_ ]?tokens.{0,80}(?:invalid|must be|out of range|exceeds)/i],
];

export function safeGeminiRejection(error) {
  if (![400, 422].includes(error?.status)) return null;
  let upstream;
  if (typeof error.message === 'string' && error.message.length <= 32768) {
    try { upstream = JSON.parse(error.message)?.error; } catch { /* Unknown SDK body. */ }
  }
  const reasons = new Set();
  const details = Array.isArray(upstream?.details) ? upstream.details.slice(0, 8) : [];
  for (const detail of details) {
    if (detail?.['@type'] !== 'type.googleapis.com/google.rpc.BadRequest' ||
        !Array.isArray(detail.fieldViolations)) continue;
    for (const violation of detail.fieldViolations.slice(0, 16)) {
      if (typeof violation?.field !== 'string' || violation.field.length > 256) continue;
      const field = fields.find(([, pattern]) => pattern.test(violation.field));
      if (field) reasons.add(field[0]);
    }
  }
  const message = typeof upstream?.message === 'string' ? upstream.message.slice(0, 4096) : '';
  const hint = messages.find(([, pattern]) => pattern.test(message))?.[0];
  return {
    googleStatus: upstream?.status === 'INVALID_ARGUMENT' ? 'INVALID_ARGUMENT' : null,
    fieldCategories: [...reasons],
    messageHint: hint ?? null,
  };
}
