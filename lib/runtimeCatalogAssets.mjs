// Server-only runtime verification in the actual prediction function. No file
// contents, paths, hashes or raw exceptions are exposed by the result.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateCatalogSnapshot } from './tcgdexSnapshot.mjs';
const LICENSE_SHA256 = '12e7dd2d018848b9997d0226c4632f01da86ec4bf6ebe0c8b19953d5e5eeb6ff';
export function verifyRuntimeCatalogAssets({ root = process.cwd(), readFile = readFileSync } = {}) {
  let snapshot = false, license = false;
  try {
    const data = JSON.parse(readFile(path.join(root, 'data/tcgdex/upstream-snapshot.json'), 'utf8'));
    snapshot = validateCatalogSnapshot(data).length > 0;
  } catch { /* Fail closed, without filesystem or artifact diagnostics. */ }
  try {
    const data = readFile(path.join(root, 'data/tcgdex/LICENSE'));
    license = createHash('sha256').update(data).digest('hex') === LICENSE_SHA256;
  } catch { /* Fail closed. */ }
  return { snapshot, license };
}
