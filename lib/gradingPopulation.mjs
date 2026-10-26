import { exactEvidenceIdentity, validEvidenceDate } from './completedSales.mjs';
export const unavailablePopulation = () => ({ status: 'unavailable', reason: 'provider_not_configured', psa10Population: null, psa9Population: null, totalPSAPopulation: null, historicalGemRate: null, individualCardProbability: null });
export function analyzePopulation(record, card, { now = Date.now() } = {}) {
  const fail = reason => ({ ...unavailablePopulation(), reason });
  if (!record || record.grader !== 'PSA' || !exactEvidenceIdentity(card, record.identity)) return fail('identity_or_grader_unverified');
  if (!['providerId', 'reference', 'rightsReference'].every(key => typeof record.provenance?.[key] === 'string' && record.provenance[key].trim()) || !validEvidenceDate(record.observedAt, now)) return fail('missing_provenance_or_date');
  const distribution = record.gradeDistribution;
  if (!distribution || typeof distribution !== 'object' || Array.isArray(distribution) || !Object.keys(distribution).length || Object.entries(distribution).some(([grade,n]) => !/^(?:[1-8](?:\.5)?|9|10)$/.test(grade) || !Number.isSafeInteger(n) || n < 0) || !Object.hasOwn(distribution,'9') || !Object.hasOwn(distribution,'10')) return fail('invalid_distribution');
  const total = Object.values(distribution).reduce((sum,n) => sum+n,0);
  if (!Number.isSafeInteger(record.totalPSAPopulation) || record.totalPSAPopulation !== total || !Number.isSafeInteger(total)) return fail('inconsistent_total');
  const p = total ? distribution['10']/total : null, z=1.96, divisor=1+z*z/(total||1);
  const center = p == null ? null : (p+z*z/(2*total))/divisor;
  const delta = p == null ? null : z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/divisor;
  return { status: now-Date.parse(record.observedAt)>30*86400000 ? 'stale' : 'available', identity: record.identity, grader: 'PSA', psa10Population: distribution['10'], psa9Population: distribution['9'], totalPSAPopulation: total, gradeDistribution: { ...distribution }, observedAt: record.observedAt, provenance: { ...record.provenance }, historicalGemRate: p, historicalRateInterval95: p==null ? null : [Math.max(0,center-delta),Math.min(1,center+delta)], lowSample: total<30, individualCardProbability: null, limitations: ['Counts are graded submissions, not necessarily unique physical cards.', 'Selection, resubmission and crossover bias are not removed.', 'Historical population gem rate is not a photo-adjusted probability.', 'Recategorizations and source revisions can change populations.'] };
}
