// Synthetic response regression, not a replay of the redacted Josh Dix scan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {isCollectorReading} from '../lib/collectorReading.mjs';
import {readIdentityReadings} from '../lib/visionIdentityEvidence.mjs';
import {photoIdentityStatus} from '../lib/photoIdentity.mjs';
import {IDENTITY_STRING_FIELDS} from '../lib/identityValidation.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport} from '../lib/financialSafety.mjs';
const row=(field,text)=>({field,text,certainty:'clear',side:'front',area:field==='subject'?'name':'collector_line',alternatives:[]});
test('PA-JD reproduces the old digit requirement rejection and is retained only with sports context',()=>{
 assert.equal(isCollectorReading('PA-JD'),false);assert.equal(readIdentityReadings([row('cardNumber','PA-JD')]).length,0);
 assert.equal(isCollectorReading('PA-JD','sports'),true);assert.equal(readIdentityReadings([row('cardNumber','PA-JD')],'sports')[0].text,'PA-JD');
});
test('bounded sports syntax supports numeric, mixed and reviewed autograph-initial identifiers',()=>{
 for(const value of ['PA-JD','PA-AB','US102','BCP-86','MNL-11','BB-11','102','# PA-JD',' pa - jd '])assert.equal(isCollectorReading(value,'sports'),true,value);
});
test('sports syntax rejects arbitrary words, unreviewed letter schemes, serials, malformed or malicious identifiers',()=>{
 for(const value of ['Josh','AUTOGRAPH','FOO-BAR','AB-CD','PA-JOSH','PA-J','PA--JD','PA/JD','PA_JD','-PA-JD','PA-JD-','US 102','96/99','PA-<script>','https://example.com','PA-JD\n<script>', 'PA-JD\n', 'A'.repeat(41), 'PA-'+ 'J'.repeat(90), 'US１２３',null,{},''])assert.equal(isCollectorReading(value,'sports'),false,String(value));
});
test('Pokemon promo/fraction grammar remains unchanged and rejects alphabetic sports autograph numbers',()=>{
 for(const value of ['004/165','133/128','TG01/TG30','SV49/SV94','SWSH020','001/SV-P'])assert.equal(isCollectorReading(value,'pokemon'),true,value);
 for(const value of ['PA-JD','Pikachu','004//165','004--165','004/<script>','A'.repeat(41)])assert.equal(isCollectorReading(value,'pokemon'),false,value);
});
test('sports canonical comparisons retain wrong-number and invalid-alternative protection',()=>{
 const report={identityV2:{category:'sports'},canonicalCard:{subject:'Josh Dix',cardNumber:'PA-JD'},originalIdentityObservation:{identityReadings:[row('subject','Josh Dix'),row('cardNumber','PA-JD')]}};
 let p=photoIdentityStatus(report);assert.deepEqual(p.missingReadings,[]);assert.deepEqual(p.conflicts,[]);assert.equal(p.readingDisposition[1].disposition,'retained');assert.equal(p.photoSupported,false);
 report.canonicalCard.cardNumber='PA-AB';assert.ok(photoIdentityStatus(report).conflicts.includes('cardNumber'));
 const r=row('cardNumber','PA-JD');r.alternatives=['arbitrary'];assert.equal(readIdentityReadings([r],'sports').length,0);
});
test('complete Josh Dix mock retains collector, serial, subset, title and foil without independent or financial approval',async()=>{
 const raw={...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:'Josh Dix',identifiedYear:'2025',identifiedBrandSet:'Bowman University Basketball',identifiedCardNumber:'PA-JD',identifiedAutoOrRelic:'autograph',identityConfidence:80,identityReadings:[row('subject','Josh Dix'),row('cardNumber','PA-JD'),row('serialNumber','12/99')],sportsIdentity:{version:1,subjects:[{name:'Josh Dix',certainty:'clear',readingIndices:[0]}],subset:'Synthetic subset',printedTitle:'Synthetic title',serialNumber:'12/99',serialReadingIndex:2,foilTreatment:'green foil'}};
 const r=await runScan({fields:{mode:'identity',cardType:'sports'},visionResponse:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(raw)}]}});
 assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.catalog,0);assert.equal(r.metrics.valuation,0);
 const p=r.payload;assert.ok(!p.photoIdentityStatus.missingReadings.includes('cardNumber'));assert.equal(p.photoIdentityStatus.readingDisposition[1].disposition,'retained');assert.equal(p.canonicalCard.cardNumber,'PA-JD');assert.equal(p.sportsIdentityEvidence.serial.value,'12/99');assert.equal(p.sportsIdentityEvidence.subset.value,'Synthetic subset');assert.equal(p.sportsIdentityEvidence.printedTitle.value,'Synthetic title');assert.equal(p.sportsIdentityEvidence.foil.value,'green foil');assert.deepEqual(p.originalIdentityObservation,raw);
 assert.equal(p.identityV2.identityVerified,false);assert.equal(p.photoIdentityStatus.photoSupported,false);assert.equal(protectFinancialReport(JSON.parse(JSON.stringify(p))).financialDecision.allowed,false);
});
