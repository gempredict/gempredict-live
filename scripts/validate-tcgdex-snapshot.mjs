// Offline validation only. No source code is executed and no network is used.
import { createRequire } from 'node:module';
import { validateCatalogSnapshot } from '../lib/tcgdexSnapshot.mjs';
const data = createRequire(import.meta.url)('../data/tcgdex/upstream-snapshot.json');
const records = validateCatalogSnapshot(data);
console.log(`Validated ${records.length} explicit printing records at ${data.revisions.snapshot.sha}`);
