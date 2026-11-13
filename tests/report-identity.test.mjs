import test from 'node:test';
import assert from 'node:assert/strict';
import {scan,vision,neutral} from './helpers/pikachuFixture.mjs';
import {protectFinancialReport,reportFromResponse,protectedCopySummary,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {verificationRows,reportTitle} from '../lib/reportVerification.mjs';
import {renderReports} from './helpers/renderReports.mjs';
// A deliberately conflicting synthetic model proposal, not a retained live payload.
const conflicting={...vision,identifiedBrandSet:'Scarlet & Violet / Prismatic Evolutions'};
const clean=html=>html.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
function checkRendering(report){
 const {upper,lower}=renderReports(report);const title=reportTitle(report);
 assert.ok(upper.includes(title));assert.ok(lower.includes(title));
 assert.match(lower,/<h3[^>]*>2026.*30th Celebration/);
 assert.match(lower,/<summary[^>]*>Original AI Observation — Unverified<\/summary>/);
 assert.ok(lower.indexOf(title)<lower.indexOf('Original AI Observation'));
 assert.match(lower,/Prismatic Evolutions/);
 for(const html of [upper,lower]){
  for(const label of ['Catalog identity: Verified','Variant:','Artwork: Not verified','Physical printing: Not verified','Financial evidence: Unavailable'])assert.ok(clean(html).includes(label),label);
 }
 assert.doesNotMatch(clean(upper),/-\$80|0%|\$123|\$456|\$789/);
 assert.match(clean(upper),/PSA Submission Fee Unavailable/);
 assert.match(clean(lower),/Unassessed/);
 assert.doesNotMatch(clean(lower),/Borderline Submission Risk|Confidence Level Moderate/);
}
test('complete handler: conflicting AI proposal remains secondary to catalog identity in both rendered reports',async()=>{
 const r=await scan({vision:conflicting});assert.equal(r.status,200);assert.equal(r.metrics.valuation,0);
 const p=r.payload;assert.equal(p.pokemonIdentityStatus.catalogVerified,true);assert.equal(p.financialDecision.allowed,false);
 assert.equal(p.originalIdentityObservation.identifiedBrandSet,conflicting.identifiedBrandSet);
 assert.equal(p.imageAnalysis.identifiedBrandSet,conflicting.identifiedBrandSet);
 const report=reportFromResponse({...p,prediction:{...p.prediction,psaFee:80,rawValue:123,psa9Value:456,psa10Value:789}});
 for(const field of FINANCIAL_FIELDS)assert.equal(report[field],null);
 checkRendering(report);
});
test('complete handler: insufficient variant evidence stays unresolved independently of verified catalog',async()=>{
 const r=await scan({vision:conflicting,neutral:neutral.slice(0,2)});assert.equal(r.status,200);
 const report=reportFromResponse(r.payload),rows=verificationRows(report);
 assert.equal(report.pokemonIdentityStatus.catalogVerified,true);
 assert.equal(rows[0].status,'Verified');assert.notEqual(rows[1].status,'Supported');assert.notEqual(rows[1].status,'Supported correction');
 assert.equal(rows[4].status,'Unavailable — recommendations withheld');
 assert.match(clean(renderReports(report).lower),/Variant: (Insufficient evidence|Unresolved)/);
 const restored=protectFinancialReport(JSON.parse(JSON.stringify(report)));
 assert.deepEqual(verificationRows(restored),rows);
 assert.ok(protectedCopySummary(restored).includes(`Variant: ${rows[1].status}`));
});
test('saved/restored reports and copied summaries retain canonical/original distinction and separate verification dimensions',async()=>{
 const r=await scan({vision:conflicting});const report=reportFromResponse(r.payload);
 const saved=JSON.parse(JSON.stringify(report));const restored=protectFinancialReport(saved);
 assert.deepEqual(restored.originalIdentityObservation,report.originalIdentityObservation);checkRendering(restored);
 const copy=protectedCopySummary(restored);
 for(const marker of ['2026','30th Celebration','Prismatic Evolutions','Catalog identity: Verified','Variant:','Artwork:','Physical printing:','Financial evidence:','withheld'])assert.ok(copy.includes(marker),marker);
 const tampered=protectFinancialReport({...saved,canonicalCard:{...saved.canonicalCard,cardNumber:'149/165'}});
 assert.equal(verificationRows(tampered)[0].status,'Unresolved');assert.equal(tampered.financialDecision.allowed,false);
});
test('safe unresolved reasons never interpolate raw explanations, URLs or unknown diagnostic fields',()=>{
 const report={identityVerification:{catalog:{status:'unavailable',explanation:'secret https://internal.example/?token=private'}},pokemonIdentityStatus:{catalogVerified:false,conflicts:['https://private'],gate:{invalidFields:['language','token']}}};
 const rows=verificationRows(report);assert.match(rows[0].reason,/language/);assert.doesNotMatch(JSON.stringify(rows),/https:|token|secret/);
});
test('complete handler retains documented condition and photo-quality evidence without inventing an assessment',async()=>{
 const visualObservations=[{attribute:'corners',code:'whitening',certainty:'confirmed',evidence:{side:'front',cue:'localized_color_loss',region:[0.01,0.01,0.1,0.1],confidence:0.95}}];
 const r=await scan({vision:{...conflicting,visualObservations,imageLimitations:['glare'],inspectedSides:['front','back']}});
 const report=reportFromResponse(r.payload),before=structuredClone(report.imageAnalysis);
 const html=clean(renderReports(report).lower);
 assert.match(html,/Possible corners whitening/);assert.match(html,/glare/i);assert.match(html,/Not assessed from the photo/);
 assert.deepEqual(report.imageAnalysis,before);assert.equal(report.imageAnalysis.overallScore,null);assert.equal(report.imageAnalysis.estimatedGrade,null);
});
