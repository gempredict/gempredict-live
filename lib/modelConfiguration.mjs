// Temperature zero reduces avoidable sampling variation; it is not a provider
// determinism guarantee or a substitute for independent identity verification.
export const VISION_MODEL_CONFIGURATION = Object.freeze({ model: 'claude-sonnet-4-6', max_tokens: 2000, temperature: 0 });
export const VALUATION_MODEL_CONFIGURATION = Object.freeze({ model: 'claude-sonnet-4-6', max_tokens: 1000, temperature: 0 });
