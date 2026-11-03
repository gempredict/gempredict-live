import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCatalogPackaging } from '../scripts/check-tcgdex-packaging.mjs';

const assets = ['data/tcgdex/upstream-snapshot.json', 'data/tcgdex/LICENSE'];
function fixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'gp-packaging-'));
  const trace = path.join(root, '.next/server/pages/api/predict.js.nft.json');
  mkdirSync(path.dirname(trace), { recursive: true });
  mkdirSync(path.join(root, 'data/tcgdex'), { recursive: true });
  for (const file of assets) writeFileSync(path.join(root, file), 'packaging test data');
  const writeTrace = files => writeFileSync(trace, JSON.stringify({ version: 1, files }));
  const entries = assets.map(file => path.relative(path.dirname(trace), path.join(root, file)));
  writeTrace(entries);
  try { run({ root, trace, entries, writeTrace }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('catalog packaging resolves NFT entries relative to the trace file', () => {
  fixture(({ root }) => assert.deepEqual(checkCatalogPackaging(root), assets));
});

test('catalog packaging fails when either required asset is absent from the trace', () => {
  fixture(({ root, entries, writeTrace }) => {
    for (let i = 0; i < assets.length; i++) {
      writeTrace(entries.filter((_, index) => index !== i));
      assert.throws(() => checkCatalogPackaging(root), /Missing from .* output trace/);
    }
    writeTrace(assets); // Repository-relative paths are not valid NFT locations.
    assert.throws(() => checkCatalogPackaging(root), /Missing from .* output trace/);
  });
});

test('catalog packaging fails when either traced file is missing on disk', () => {
  for (const asset of assets) fixture(({ root }) => {
    rmSync(path.join(root, asset));
    assert.throws(() => checkCatalogPackaging(root), /ENOENT/);
  });
});
