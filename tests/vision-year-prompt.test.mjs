import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../pages/api/predict.js', import.meta.url), 'utf8');
// Exercise the real private vision function and its real parsing/normalization
// helpers without importing the API route's database and external SDK bindings.
const helpers = source.slice(source.indexOf('function safeInt('), source.indexOf('// ─── Anthropic client'));
const vision = source.slice(source.indexOf('async function fetchImageAnalysis('), source.indexOf('// ─── Main handler'));
function harness(response) {
  const requests = [];
  const analyze = vm.runInNewContext(`${helpers}\n${vision}\nfetchImageAnalysis;`, {
    Buffer,
    CARD_TYPE_LABELS: { pokemon: 'Pokemon' },
    anthropic: { messages: { create: async request => { requests.push(request); return response; } } },
  });
  return { analyze, requests };
}
const run = (analyze, back = null) => analyze(Buffer.from('mock-front'), 'image/png', back, 'image/jpeg', 'Pikachu', 'pokemon');

test('vision request prioritizes visible year evidence, explains copyright proposals and rejects guesses', async () => {
  const { analyze, requests } = harness({ content: [{ type: 'text', text: '{}' }] });
  await run(analyze);
  assert.equal(requests[0].max_tokens, 2000);
  const prompt = requests[0].messages[0].content.find(block => block.type === 'text').text;
  assert.match(prompt, /prioritize a year actually visible on the card or strongly supported by visible product identifiers/);
  assert.match(prompt, /General model knowledge alone is not year evidence/);
  assert.match(prompt, /Never override a visible year merely because you remember a different set release year/);
  assert.match(prompt, /visible copyright year is the best available evidence.*cautious proposed year.*copyright basis in identityNotes/);
  assert.match(prompt, /year evidence conflicts or is genuinely uncertain, return identifiedYear as null rather than guessing/);
  const instruction = prompt.split('\n').find(line => line.startsWith('identifiedYear -'));
  assert.match(instruction, /actually visible.*visible product identifiers/);
  assert.match(instruction, /copyright.*identityNotes/);
  assert.match(instruction, /never override a visible year.*return null for conflicting or genuinely uncertain/);
  assert.doesNotMatch(instruction, /visible or inferable/);
});

test('copyright-based year and explanatory notes survive actual vision response normalization', async () => {
  const notes = 'Visible copyright 2017 is the best evidence; this is a cautious proposed year, not a verified release year.';
  const { analyze, requests } = harness({ content: [{ type: 'text', text: JSON.stringify({ identifiedYear: '2017', identityNotes: notes }) }] });
  const result = await run(analyze, Buffer.from('mock-back'));
  assert.equal(result.identifiedYear, '2017');
  assert.equal(result.identityNotes, notes);
  const images = requests[0].messages[0].content.filter(block => block.type === 'image');
  assert.equal(images.length, 2);
  assert.equal(images[0].source.media_type, 'image/png');
  assert.equal(images[1].source.media_type, 'image/jpeg');
});

test('uncertain null year remains null instead of being filled from general knowledge', async () => {
  const notes = 'Visible year evidence conflicts; the product identifiers do not resolve it.';
  const { analyze } = harness({ content: [{ type: 'text', text: JSON.stringify({ identifiedYear: null, identityNotes: notes }) }] });
  const result = await run(analyze);
  assert.equal(result.identifiedYear, null);
  assert.equal(result.identityNotes, notes);
});

test('complete larger JSON is parsed; empty and incomplete responses remain non-fatal nulls', async () => {
  const data = { identifiedYear: '2017', identityNotes: 'Year visible on the back.', extraDetails: 'Visible text. '.repeat(600) };
  const complete = harness({ content: [{ type: 'text', text: JSON.stringify(data) }] });
  assert.equal((await run(complete.analyze)).identifiedYear, '2017');
  for (const response of [{ content: [] }, { content: [{ type: 'text', text: '{"identifiedYear":"2017", "identityNotes":' }] }]) {
    assert.equal(await run(harness(response).analyze), null);
  }
});

test('unsupported front/back image MIME cannot be relabeled as JPEG or reach the paid vision client', async () => {
  const { analyze, requests } = harness({ content: [{ type: 'text', text: '{}' }] });
  await assert.rejects(analyze(Buffer.from('raw-heic'), 'image/heic', null, null, 'Pikachu', 'pokemon'), /Unsupported analysis image format/);
  await assert.rejects(analyze(Buffer.from('front'), 'image/jpeg', Buffer.from('raw-heif'), 'image/heif', 'Pikachu', 'pokemon'), /Unsupported analysis image format/);
  assert.equal(requests.length, 0);
});

test('vision asks for structured observations separately from unverified identity and does not request numeric grade forecasts', async () => {
  const { analyze, requests } = harness({ content: [{ type: 'text', text: '{}' }] });
  const result = await run(analyze);
  const prompt = requests[0].messages[0].content.find(block => block.type === 'text').text;
  assert.match(prompt, /visualObservations - array of \{attribute, code\}/);
  assert.match(prompt, /Separate visual evidence from identity speculation/);
  assert.match(prompt, /estimatedGrade - null/); assert.match(prompt, /gradeCeiling - null/);
  assert.doesNotMatch(prompt, /should generally project as PSA 9 or better/);
  assert.equal(result.centering, null); assert.equal(result.corners, null);
});
