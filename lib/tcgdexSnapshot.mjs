// Server-only, offline evidence. Downloaded TypeScript is parsed as a restricted
// literal data format: never imported, transpiled, evaluated or executed.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { catalogNameKey } from './catalogNormalization.mjs';
const TRUSTED_DIGEST = 'bd218f4878223fc9f87e3b9641c8e572004b89f0080b03dc3ec5df5fa545b8df';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const gitBlob = content => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
const fail = reason => { throw new Error(reason); };
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10) ? Date.parse(value) : NaN;

export function parseCatalogLiteral(source) {
  if (typeof source !== 'string' || source.length > 131072) fail('source_size');
  const header = source.match(/^((?:import [^\n]+\n){2})\s*const (card|set): (Card|Set) =\s*/);
  if (!header || header[2] !== header[3].toLowerCase()) fail('source_header');
  const imports = header[1].trim().split('\n').map(line => {
    const match = line.match(/^import (\{ (?:Card|Set) \}|Set|serie) from (["'])([^"']+)\2;?$/);
    if (!match) fail('source_import');
    return { symbol: match[1], path: match[3] };
  });
  let i = header[0].length;
  const whitespace = () => { while (/\s/.test(source[i] || '') && i < source.length) i++; };
  function string() {
    const quote = source[i++]; let result = '';
    while (i < source.length) {
      const c = source[i++];
      if (c === quote) return result;
      if (c === '\n' || c === '\r') fail('source_string');
      if (c !== '\\') { result += c; continue; }
      const escaped = source[i++];
      if (escaped === 'u') {
        const hex = source.slice(i, i + 4);
        if (!/^[a-f0-9]{4}$/i.test(hex)) fail('source_escape');
        result += String.fromCharCode(parseInt(hex, 16)); i += 4;
      } else {
        const escapes = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
        if (!(escaped in escapes)) fail('source_escape');
        result += escapes[escaped];
      }
    }
    fail('source_string');
  }
  function value(depth = 0) {
    if (depth > 32) fail('source_depth');
    whitespace(); const c = source[i];
    if (c === '"' || c === "'") return string();
    if (c === '{' || c === '[') {
      i++; const object = c === '{'; const end = object ? '}' : ']';
      const result = object ? Object.create(null) : [];
      whitespace();
      while (source[i] !== end) {
        let k;
        if (object) {
          whitespace();
          if (source[i] === '"' || source[i] === "'") k = string();
          else { k = source.slice(i).match(/^[A-Za-z_$][\w$]*/)?.[0]; if (!k) fail('source_key'); i += k.length; }
          if (['__proto__', 'constructor', 'prototype'].includes(k) || Object.hasOwn(result, k)) fail('source_key');
          whitespace(); if (source[i++] !== ':') fail('source_colon');
        }
        const item = value(depth + 1);
        if (object) result[k] = item; else result.push(item);
        whitespace();
        if (source[i] === end) break;
        if (source[i++] !== ',') fail('source_comma');
        whitespace();
      }
      i++; return result;
    }
    const literal = source.slice(i).match(/^(?:-?\d+(?:\.\d+)?|true\b|false\b|null\b|Set\b|serie\b)/)?.[0];
    if (!literal) fail('source_nonliteral');
    i += literal.length;
    if (['Set', 'serie'].includes(literal)) return { reference: literal };
    return JSON.parse(literal);
  }
  const data = value(); whitespace();
  if (!new RegExp(`^;?\\s*export default ${header[2]};?\\s*$`).test(source.slice(i))) fail('source_trailing_code');
  return { data, imports };
}

export function validateCatalogSnapshot(snapshot, trustedDigest = TRUSTED_DIGEST) {
  if (digest(snapshot) !== trustedDigest) fail('snapshot_digest');
  if (snapshot.schemaVersion !== 1 || snapshot.repository !== 'tcgdex/cards-database') fail('snapshot_provenance');
  const revisions = snapshot.revisions;
  for (const ref of ['previous', 'correction', 'snapshot']) {
    if (!/^[a-f0-9]{40}$/.test(revisions?.[ref]?.sha) || !Number.isFinite(timestamp(revisions[ref].committedAt))) fail('snapshot_revision');
  }
  if (!(timestamp(revisions.previous.committedAt) < timestamp(revisions.correction.committedAt) && timestamp(revisions.correction.committedAt) <= timestamp(revisions.snapshot.committedAt))) fail('snapshot_revision_order');
  const files = new Map();
  for (const file of snapshot.sources) {
    if (files.has(file.id) || !revisions[file.revision] || gitBlob(file.content) !== file.blobSha || !/^data\/[^.]+\.ts$/.test(file.path)) fail('snapshot_blob');
    files.set(file.id, { ...file, ...parseCatalogLiteral(file.content) });
  }
  const records = [];
  for (const entry of snapshot.records) {
    const current = files.get(entry.card), previous = files.get(entry.previous), correction = files.get(entry.correction), set = files.get(entry.set);
    if (!current || !previous || !correction || !set || current.revision !== 'snapshot' || set.revision !== 'snapshot' || previous.revision !== 'previous' || correction.revision !== 'correction' || current.path !== previous.path || current.path !== correction.path) fail('snapshot_source_revision');
    const localId = path.posix.basename(current.path, '.ts');
    if (!/^[A-Za-z0-9-]+$/.test(localId) || current.imports[1].symbol !== 'Set' || path.posix.normalize(path.posix.join(path.posix.dirname(current.path), current.imports[1].path)) + '.ts' !== set.path) fail('snapshot_set_reference');
    for (const file of [current, previous, correction]) {
      if (file.data.set?.reference !== 'Set' || JSON.stringify(file.imports) !== JSON.stringify(current.imports) || file.data.category !== 'Pokemon' || JSON.stringify(file.data.name) !== JSON.stringify(current.data.name) || file.data.rarity !== current.data.rarity) fail('snapshot_identity');
    }
    // Only the known generated-default situation is eligible. A previously
    // explicit printing or multiple new printings requires separate review.
    if (previous.data.variants != null || !Array.isArray(current.data.variants) || current.data.variants.length !== 1 || !Array.isArray(correction.data.variants) || correction.data.variants.length !== 1) fail('snapshot_incomplete_printing');
    const type = current.data.variants[0].type;
    if (!['holo', 'normal', 'reverse'].includes(type) || correction.data.variants[0].type !== type) fail('snapshot_printing');
    if (!/^[A-Za-z0-9.-]+$/.test(set.data.id) || !Number.isInteger(set.data.cardCount?.official) || set.data.cardCount.official < 1 || !Number.isFinite(timestamp(set.data.releaseDate)) || !current.data.name?.en || !set.data.name?.en) fail('snapshot_set_identity');
    const id = `${set.data.id}-${localId}`;
    if (records.some(r => r.id === id)) fail('snapshot_duplicate_identity');
    records.push({ id, localId, names: current.data.name, setNames: set.data.name, setId: set.data.id, officialCount: set.data.cardCount.official, releaseDate: set.data.releaseDate, rarity: current.data.rarity, type, stamp: current.data.variants[0].stamp || [],
      previousAt: revisions.previous.committedAt, correctedAt: revisions.correction.committedAt,
      provenance: { repository: snapshot.repository, revision: revisions.snapshot.sha, correctionRevision: revisions.correction.sha, previousRevision: revisions.previous.sha, cardPath: current.path, cardBlob: current.blobSha, setPath: set.path, setBlob: set.blobSha, snapshotDigest: trustedDigest } });
  }
  return records;
}
let validated = [], snapshotError;
try { validated = validateCatalogSnapshot(JSON.parse(readFileSync(path.join(process.cwd(), 'data/tcgdex/upstream-snapshot.json'), 'utf8'))); }
catch (error) { snapshotError = /^(snapshot_|source_)/.test(error.message) ? error.message : 'snapshot_unavailable'; }

// Recognize only the hosted generated default, including its documented
// optional standard size. Other sizes, metadata and edition/promo claims are
// not evidence of the same printing and must not be replaced.
function isGeneratedNormalDefault(hosted) {
  const variants = hosted.variants;
  if (!variants || Array.isArray(variants) || variants.normal !== true || variants.holo !== false || variants.reverse !== false) return false;
  if (Object.entries(variants).some(([key, value]) =>
    !['normal', 'holo', 'reverse'].includes(key) &&
    (!['firstEdition', 'wPromo'].includes(key) || value !== false))) return false;
  const detail = hosted.variants_detailed;
  if (!Array.isArray(detail) || detail.length !== 1 || !detail[0] || typeof detail[0] !== 'object' || Array.isArray(detail[0])) return false;
  const printing = detail[0];
  return printing.type === 'normal' && printing.variantId === 'generated' &&
    (!Object.hasOwn(printing, 'size') || printing.size === 'standard') &&
    Object.keys(printing).every(key => ['type', 'variantId', 'size'].includes(key));
}

export function reconcileHostedPrinting(record, hosted, diagnostics) {
  const reject = reason => { diagnostics.push({ id: record.id, source: 'tcgdex_upstream_snapshot', accepted: false, reason }); return record; };
  if (snapshotError) return reject(snapshotError);
  const source = validated.find(item => item.id === record.id);
  if (!source) return record;
  if (hosted.id !== source.id || String(hosted.localId) !== source.localId || hosted.set?.id !== source.setId || catalogNameKey(hosted.name) !== catalogNameKey(source.names[record.language]) || catalogNameKey(hosted.set?.name) !== catalogNameKey(source.setNames[record.language]) || record.year !== source.releaseDate.slice(0, 4) || record.setId !== source.setId || record.localId !== source.localId || record.cardNumber !== `${source.localId}/${source.officialCount}` || record.officialCount !== source.officialCount || record.releaseDate !== source.releaseDate || catalogNameKey(record.subject) !== catalogNameKey(source.names[record.language]) || catalogNameKey(record.brandSet) !== catalogNameKey(source.setNames[record.language]) || catalogNameKey(record.rarity) !== catalogNameKey(source.rarity)) return reject('snapshot_identity_mismatch');
  const flags = { normal: source.type === 'normal', holo: source.type === 'holo', reverse: source.type === 'reverse' };
  if (Object.keys(flags).every(flag => hosted.variants?.[flag] === flags[flag])) return record; // Current hosted data wins; no rewrite.
  const updated = timestamp(hosted.updated);
  if (!Number.isFinite(updated) || updated < timestamp(source.previousAt) || updated >= timestamp(source.correctedAt)) return reject('hosted_revision_not_proven_older');
  if (!isGeneratedNormalDefault(hosted)) return reject('hosted_not_generated_default');
  const detail = hosted.variants_detailed;
  const printingProvenance = structuredClone({ ...source.provenance, hostedUpdated: hosted.updated, hostedVariants: hosted.variants, hostedDetailed: detail, type: source.type, stamp: source.stamp });
  diagnostics.push({ id: record.id, source: 'tcgdex_upstream_snapshot', accepted: true, reason: 'newer_explicit_printing_replaces_generated_default', ...printingProvenance });
  return { ...record, variants: flags, printingProvenance };
}
