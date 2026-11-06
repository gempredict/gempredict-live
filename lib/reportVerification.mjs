// Presentation only: never grants identity or financial eligibility. Reasons are
// allowlisted prose, never provider explanations, URLs, tokens or raw diagnostics.
const fields = {subject:'card name',cardNumber:'collector number',year:'year',brandSet:'set',set:'set',parallel:'variant',finish:'finish',language:'language',rarity:'rarity'};
export function verificationRows(report = {}) {
 const s=report.pokemonIdentityStatus, catalog=report.identityVerification?.catalog;
 const core=report.stage==='identity'&&report.coreCatalogIdentity?.supported===true,printing=report.catalogComparison?.printing;
 const uncertainSet=(Array.isArray(report.originalIdentityObservation?.identityReadings)?report.originalIdentityObservation.identityReadings:[]).some(r=>r?.field==='setCode'&&r.certainty==='uncertain');
 const conflicts=[...new Set([...(s?.conflicts||[]),...(report.userIdentityConflicts||[]).map(c=>c.field)])].map(f=>fields[f]).filter(Boolean);
 const outcomeReason={not_found:'No matching catalog candidate was found. Identity remains unresolved.',unavailable:'The independent catalog service is unavailable. Identity remains unresolved.',incomplete:'Independent catalog evidence is incomplete. Missing evidence is not a contradiction.',ambiguous:'Multiple plausible catalog candidates remain; no unique identity is established.'}[s?.catalogOutcome];
 const missing=[...new Set([...(s?.gate?.invalidFields||[]),...(report.stage==='identity'?report.coreCatalogIdentity?.missingFields||[]:[])])].map(f=>fields[f]).filter(Boolean);
 let catalogReason=core?'Independent catalog facts support the core name, full collector number, set, year and language. Finish, artwork and physical printing are separate requirements.':s?.catalogVerified&&report.stage!=='identity'?'Independent catalog evidence supports this identity; this does not verify the physical card.':
  report.userIdentityConflicts?.length?'Your supplied identity conflicts with the catalog candidate. Review the conflicting fields.':
  catalog?.reasonCodes?.includes('unsupported_printed_collector_format')?'The printed collector number was retained, but the connected catalog adapter does not support this numbering format. No number or denominator was substituted.':
  outcomeReason?outcomeReason:
  conflicts.length?`Catalog identity conflicts remain: ${conflicts.join(', ')}.`:
  missing.length?`Required identity evidence is missing or invalid: ${missing.join(', ')}.`:
  report.runtimeCatalogAssets && (!report.runtimeCatalogAssets.snapshot||!report.runtimeCatalogAssets.license)?'Catalog reference assets could not be verified.':
  catalog?.requiresLanguageConfirmation?'Card language has not been established.':
  catalog && (!catalog.source || !catalog.referenceId)?'Independent catalog source attribution or reference is missing.':
  'Independent catalog evidence is incomplete, ambiguous or unavailable; a candidate is not verification.';
 const variant=report.variantVerification?.status;
 const variants={verified:['Supported','Neutral identity evidence supports the proposed variant; physical printing remains unverified.'],corrected:['Supported correction','Neutral identity consensus supports the corrected variant; physical printing remains unverified.'],user_confirmed:['User confirmed','User confirmation is recorded; independent physical-printing verification is still missing.'],needs_confirmation:['Unresolved','Variant evidence is conflicting, ambiguous or incomplete. Check foil, artwork and printing.'],insufficient_evidence:['Insufficient evidence','Not enough informative neutral identity evidence supports the variant.']};
 const [variantStatus,variantReason]=variants[variant]||['Unresolved','No independent variant verification result is available.'];
 // The current pipeline never verifies artwork or physical printing. Missing
 // results are distinguished from its explicit negative verification results.
 const artworkStatus=report.artworkStatus?.verified===false?'Not verified':'Unresolved';
 const printingStatus=report.physicalPrintingStatus?.verified===false?'Not verified':'Unresolved';
 return [
  {key:'catalog',label:report.stage==='identity'?'Catalog record':'Catalog identity',status:core?'Supported':report.stage!=='identity'&&s?.catalogVerified?'Verified':'Unresolved',reason:catalogReason},
  ...(report.stage==='identity'?[{key:'catalog_printing',label:'Catalog printing comparison',status:printing?.status==='conflict'?'Conflict':printing?.status==='unresolved'?'Unresolved':'Not independently verified',reason:printing?.status==='conflict'?'Finish or variant disagrees with catalog metadata: '+printing.conflicts.map(f=>fields[f]).filter(Boolean).join(', ')+'. This does not by itself establish a different core card; the printing remains unverified.':printing?.status==='unresolved'?(printing.reason==='printing_evidence_incomplete'?'Finish or artwork evidence is incomplete or ambiguous. Core card facts may agree, but this printing cannot be verified.':'An earlier printing comparison remains unresolved and requires review; an empty final comparison does not resolve that history.'):'No independent physical-printing verification is established.'},{key:'photo',label:'Printed identity evidence',status:report.photoIdentityStatus?.photoSupported?'Agrees with catalog':report.photoIdentityStatus?.status==='conflict'?'Conflicting':'Unresolved',reason:report.photoIdentityStatus?.status==='conflict'?'Printed readings conflict with the proposed or catalog identity: '+report.photoIdentityStatus.conflicts.map(f=>fields[f]||'set marking').join(', ')+'. Review the readings; no exact-card claim is made.':report.photoIdentityStatus?.photoSupported?'Clear model-read name, collector number, set marking and language agree with the independent catalog. Artwork and physical printing remain unverified.':report.photoIdentityStatus?.missingReadings?.length?(uncertainSet?'The set marking remains uncertain. ':'')+'Clear photo readings are missing: '+report.photoIdentityStatus.missingReadings.map(f=>fields[f]||'set marking').join(', ')+'. Catalog agreement alone does not verify this photograph.':report.coreCatalogIdentity?.supported?'Core catalog facts agree, but exact printing/catalog agreement remains unresolved.':'Printed observations are retained, but independent catalog support is unavailable.'}]:[]),
  {key:'variant',label:'Variant',status:variantStatus,reason:variantReason},
  {key:'artwork',label:'Artwork',status:artworkStatus,reason:'No independent artwork comparison has verified this card.'},
  {key:'printing',label:'Physical printing',status:printingStatus,reason:'Catalog facts and listing consensus do not authenticate the photographed physical printing.'},
  {key:'financial',label:'Financial evidence',status:'Unavailable — recommendations withheld',reason:'Qualified completed-sale evidence is unavailable. Prices, profit, financial confidence and grading recommendations remain withheld.'},
 ];
}
export function reportTitle(report={}) {
 return report.canonicalCard?.displayName || report.cardTitle || 'Unidentified card';
}
export function verificationSummary(report) {
 return verificationRows(report).map(r=>`${r.label}: ${r.status} — ${r.reason}`).join(' | ');
}
