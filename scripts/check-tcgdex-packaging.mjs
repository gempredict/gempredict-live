import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Next NFT paths are relative to the trace file, not the repository root.
export function checkCatalogPackaging(root = process.cwd()) {
  const tracePath = path.resolve(root, '.next/server/pages/api/predict.js.nft.json');
  const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
  if (!Array.isArray(trace.files) || trace.files.some(file => typeof file !== 'string')) {
    throw new Error('Invalid /api/predict output trace');
  }
  const included = new Set(trace.files.map(file => path.resolve(path.dirname(tracePath), file)));
  const required = ['data/tcgdex/upstream-snapshot.json', 'data/tcgdex/LICENSE'];
  for (const relative of required) {
    const file = path.resolve(root, relative);
    if (!included.has(file)) throw new Error(`Missing from /api/predict output trace: ${relative}`);
    if (!statSync(file).isFile()) throw new Error(`Traced catalog asset is not a file: ${relative}`);
  }
  return required;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const file of checkCatalogPackaging()) console.log(`PASS catalog packaging: ${file} traced and present`);
}
