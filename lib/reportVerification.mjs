// Presentation only: never grants identity or financial eligibility. Reasons are
// allowlisted prose, never provider explanations, URLs, tokens or raw diagnostics.
const fields = {subject:'card name',cardNumber:'collector number',year:'year',brandSet:'set',set:'set',parallel:'variant',finish:'finish',language:'language',rarity:'rarity'};
export function verificationRows(report = {}) {
 const s=report.pokemonIdentityStatus, catalog=report.identityVerification?.catalog;
 const conflicts=[...new Set([...(s?.conflicts||[]),...(report.userIdentityConflicts||[]).map(c=>c.field)])].map(f=>fields[f]).filter(Boolean);
 const outcomeReason={not_found:'No matching catalog candidate was found. Identity remains unresolved.',unavailable:'The independent catalog service is unavailable. Identity remains unresolved.',incomplete:'Independent catalog evidence is incomplete. Missing evidence is not a contradiction.',ambiguous:'Multiple plausible catalog candidates remain; no unique identity is established.'}[s?.catalogOutcome];
 const missing=[...new Set(s?.gate?.invalidFields||[])].map(f=>fields[f]).filter(Boolean);
 let catalogReason=s?.catalogVerified?'Independent catalog evidence supports this identity; this does not verify the physical card.':
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
  {key:'catalog',label:report.stage==='identity'?'Catalog record':'Catalog identity',status:s?.catalogVerified?(report.stage==='identity'?'Supported':'Verified'):'Unresolved',reason:catalogReason},
  ...(report.stage==='identity'?[{key:'photo',label:'Printed identity evidence',status:report.photoIdentityStatus?.photoSupported?'Agrees with catalog':report.photoIdentityStatus?.status==='conflict'?'Conflicting':'Unresolved',reason:report.photoIdentityStatus?.status==='conflict'?'Printed readings conflict with the proposed or catalog identity: '+report.photoIdentityStatus.conflicts.map(f=>fields[f]||'set marking').join(', ')+'. Review the readings; no exact-card claim is made.':report.photoIdentityStatus?.photoSupported?'Clear model-read name, collector number, set marking and language agree with the independent catalog. Artwork and physical printing remain unverified.':report.photoIdentityStatus?.missingReadings?.length?'Clear photo readings are missing: '+report.photoIdentityStatus.missingReadings.map(f=>fields[f]||'set marking').join(', ')+'. Catalog agreement alone does not verify this photograph.':'Printed observations are retained, but independent catalog support is unavailable.'}]:[]),
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
