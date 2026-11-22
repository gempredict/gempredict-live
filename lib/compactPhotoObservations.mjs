import { readModelPhotoNotes } from './visualEvidence.mjs';

export const compactRegions = Object.freeze({
  corner_top_left: ['corners', 'top left corner'],
  corner_top_right: ['corners', 'top right corner'],
  corner_bottom_left: ['corners', 'bottom left corner'],
  corner_bottom_right: ['corners', 'bottom right corner'],
  edge_top: ['edges', 'top edge'],
  edge_bottom: ['edges', 'bottom edge'],
  edge_left: ['edges', 'left edge'],
  edge_right: ['edges', 'right edge'],
  centering: ['centering', 'centering'],
});

export function readCompactPhotoObservations(analysis, sides = analysis?.inspectedSides || []) {
  if (!Array.isArray(analysis?.compactPhotoObservations)) return [];
  const rows = [];
  for (const row of analysis.compactPhotoObservations.slice(0, 26)) {
    if (!['front', 'back'].includes(row?.side) || !sides.includes(row.side) ||
        (Array.isArray(analysis.photoSideUncertain) && analysis.photoSideUncertain.includes(row.side)) ||
        !['apparent', 'possible', 'not_assessable'].includes(row.status)) continue;
    const attribute = row.region === 'surface' ? 'surface' :
      Object.hasOwn(compactRegions, row.region) ? compactRegions[row.region][0] : null;
    if (!attribute || typeof row.text !== 'string' || row.text.length > 220) continue;
    const [note] = readModelPhotoNotes({
      inspectedSides: sides, visualEvidenceVersion: 4,
      modelPhotoNotes: [{ attribute, side: row.side, text: row.text }],
    });
    if (!note) continue;
    const safe = { attribute, side: row.side, region: row.region, status: row.status, text: note.text };
    if (!rows.some(old => old.side === safe.side && old.region === safe.region &&
        (safe.region !== 'surface' || old.text === safe.text))) rows.push(safe);
  }
  return rows;
}

// This state reports availability of model observations. Geometry, verified
// observations, grading and financial decisions keep their existing gates.
export function withCompactPhotoObservations(analysis) {
  if (!Array.isArray(analysis.compactPhotoObservations)) return analysis;
  const rows = readCompactPhotoObservations(analysis);
  const conditionAssessments = Object.fromEntries(Object.entries(analysis.conditionAssessments || {})
    .map(([attribute, assessment]) => [
      attribute, assessment.state === 'unassessable' && !assessment.observations?.length &&
        rows.some(row => row.attribute === attribute && row.status !== 'not_assessable')
        ? { ...assessment, state: 'model_observations_available' } : assessment,
    ]));
  return { ...analysis, compactPhotoObservations: rows, conditionAssessments };
}
