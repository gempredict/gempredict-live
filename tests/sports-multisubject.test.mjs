// Synthetic responses/photos only. Never reconstructed from redacted scan 888c1493.
import test from 'node:test';
import assert from 'node:assert/strict';
import {IDENTITY_STRING_FIELDS,validateIdentityObject,safeIdentityValidation} from '../lib/identityValidation.mjs';
import {identityOutputFormat} from '../lib/identityOutputSchema.mjs';
import {parseIdentityMessage,buildIdentityPrompt,IDENTITY_OUTPUT_TOKENS} from '../lib/identityStage.mjs';
import {sportsIdentityEvidence} from '../lib/sportsIdentityEvidence.mjs';
import {photoIdentityStatus} from '../lib/photoIdentity.mjs';
import {runScan} from './helpers/reconciliationPipeline.mjs';
import {protectFinancialReport,protectedCopySummary,reportFromResponse,FINANCIAL_FIELDS} from '../lib/financialSafety.mjs';
import {renderIdentityResult} from './helpers/renderReports.mjs';
import {authorizeDiagnosticOwner,readDiagnosticTicket,TICKET_HEADER,SCAN_HEADER} from '../lib/scanDiagnosticsAuth.mjs';
const read=(field,text,side='front',area='name',certainty='clear')=>({field,text,side,area,certainty,alternatives:[]});
function observation(names=['Shohei Ohtani','Kyle Tucker']){
 const rows=names.flatMap(name=>[read('subject',name),read('subject',name,'back')]);rows.push(read('cardNumber','US102','back','collector_line'),read('serialNumber','96/99','front','body_text'));
 return {...Object.fromEntries(IDENTITY_STRING_FIELDS.map(k=>[k,null])),identifiedSubject:names.join(' / '),identifiedYear:'2026',identifiedManufacturer:'Topps',identifiedBrandSet:'Synthetic test product',identifiedCardNumber:'US102',identifiedRarity:null,identifiedParallel:null,identityConfidence:70,identityReadings:rows,
  sportsIdentity:{version:1,subjects:names.map((name,i)=>({name,certainty:'clear',readingIndices:[i*2,i*2+1]})),subset:'Synthetic subset',printedTitle:'Synthetic title',serialNumber:'96/99',serialReadingIndex:rows.length-1,foilTreatment:'green foil'}};
}
const report=raw=>({stage:'identity',identityV2:{category:'sports'},canonicalCard:{subject:raw.identifiedSubject,cardNumber:raw.identifiedCardNumber},originalIdentityObservation:raw});
const message=raw=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(raw)}]});
test('sports-only enforced schema adds bounded details while Pokemon provider schema remains unchanged',()=>{
 const pokemon=identityOutputFormat(true,'pokemon'),sports=identityOutputFormat(true,'sports');assert.equal(pokemon.schema.properties.sportsIdentity,undefined);assert.ok(sports.schema.required.includes('sportsIdentity'));assert.ok(sports.schema.properties.identityReadings.items.properties.field.enum.includes('serialNumber'));assert.equal(IDENTITY_OUTPUT_TOKENS,2000);
 assert.deepEqual(identityOutputFormat(true),pokemon);assert.equal(sports.schema.properties.sportsIdentity.additionalProperties,false);
 const walk=v=>{if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){assert.ok(!['maxItems','maxLength','minimum','maximum'].includes(k));walk(x);}};walk(sports);
});
test('single, two and three explicit players support their own name readings without independent verification',()=>{
 for(const names of [['Mike Trout'],['Shohei Ohtani','Kyle Tucker'],['Mike Trout','Aaron Judge','Mookie Betts']]){
  const raw=observation(names);assert.equal(validateIdentityObject(raw,['front','back'],'sports'),raw);const p=photoIdentityStatus(report(raw));assert.equal(p.subjectGroup.status,'supported_observations');assert.equal(p.subjectGroup.memberCount,names.length);assert.ok(!p.conflicts.includes('subject'));assert.equal(p.photoSupported,false);
 }
});
test('legacy single-player sports responses remain valid and legacy contradictory readings stay conflicting',()=>{
 const raw=observation(['Mike Trout']);delete raw.sportsIdentity;assert.deepEqual(parseIdentityMessage(message(raw),['front','back'],'sports'),raw);assert.equal(photoIdentityStatus(report(raw)).conflicts.length,0);raw.identityReadings[1].text='Aaron Judge';assert.ok(photoIdentityStatus(report(raw)).conflicts.includes('subject'));
});
test('unexpected athletes and fabricated group labels cannot hide genuine clear subject contradictions',()=>{
 const raw=observation();raw.identityReadings.push(read('subject','Aaron Judge','back'));let p=photoIdentityStatus(report(raw));assert.ok(p.conflicts.includes('subject'));assert.deepEqual(p.subjectGroup.unmatchedReadingIndices,[raw.identityReadings.length-1]);
 const clean=observation();const r=report(clean);r.canonicalCard.subject='Mike Trout';assert.ok(photoIdentityStatus(r).conflicts.includes('subject'));
});
test('teams/headlines or uncertain names cannot establish supported athlete membership',()=>{
 const raw=observation();raw.identityReadings[0].area='body_text';assert.notEqual(photoIdentityStatus(report(raw)).subjectGroup.status,'supported_observations');
 const uncertain=observation();uncertain.identityReadings[0].certainty='uncertain';assert.equal(sportsIdentityEvidence(uncertain,report(uncertain).canonicalCard).subjects[0].supported,false);
});
test('collector identifier, stamped autograph copy serial and rarity remain separate observations',()=>{
 const raw=observation(['Synthetic Athlete']);raw.identifiedCardNumber='PA-XX';raw.identityReadings[2].text='PA-XX';raw.identifiedAutoOrRelic='autograph';raw.identifiedRarity='96/99';const e=sportsIdentityEvidence(raw,report(raw).canonicalCard);
 assert.equal(e.serial.value,'96/99');assert.equal(e.serial.status,'observed_not_authenticated');assert.equal(e.rarity.issue,'serial_like_rarity_proposal');assert.equal(raw.identifiedRarity,'96/99');assert.equal(raw.identifiedCardNumber,'PA-XX');assert.equal(e.exactParallel.inferredFromSerial,false);
});
test('rarity-shaped serial is never automatically moved into the serial field; /99 does not identify green foil parallel',()=>{
 const raw=observation();raw.identifiedRarity='96/99';raw.sportsIdentity.serialNumber=null;raw.sportsIdentity.serialReadingIndex=null;const e=sportsIdentityEvidence(raw,report(raw).canonicalCard);assert.equal(e.serial.value,null);assert.equal(e.rarity.original,'96/99');assert.equal(e.exactParallel.value,null);assert.equal(e.exactParallel.status,'unverified');
});
test('bad serial evidence, numerator or link stays unresolved rather than becoming a physical printing claim',()=>{
 for(const serial of ['US102','100/99','0/99']){const raw=observation();raw.sportsIdentity.serialNumber=serial;assert.equal(sportsIdentityEvidence(raw,report(raw).canonicalCard).serial.status,'unresolved');}
 const raw=observation();raw.sportsIdentity.serialReadingIndex=0;assert.equal(sportsIdentityEvidence(raw,report(raw).canonicalCard).serial.status,'unresolved');
});
test('strict local validation rejects overlarge groups, wrong reference types, wrong sides and truncated JSON',()=>{
 const raw=observation();assert.throws(()=>validateIdentityObject({...raw,sportsIdentity:{...raw.sportsIdentity,subjects:Array(5).fill(raw.sportsIdentity.subjects[0])}},['front','back'],'sports'),e=>e.identityValidation.rule==='length_limit');
 raw.sportsIdentity.subjects[0].readingIndices=[999];assert.throws(()=>validateIdentityObject(raw,['front','back'],'sports'),e=>e.identityValidation.rule==='invalid_enum');assert.ok(safeIdentityValidation({phase:'schema',rule:'invalid_enum',path:'sportsIdentity/subjects/0/readingIndices'}));
 assert.throws(()=>parseIdentityMessage({stop_reason:'max_tokens',content:[{type:'text',text:'{'}]},['front'],'sports'),/INCOMPLETE/);assert.throws(()=>parseIdentityMessage(message(observation()),['front'],'sports'),e=>e.identityValidation.rule==='unexpected_photo_side');
 assert.throws(()=>validateIdentityObject(observation(),['front','back'],'pokemon'),e=>e.identityValidation.rule==='unexpected_fields');
});
test('complete sports handler renders, saves and copies separate observations while preserving all financial withholding',async()=>{
 const raw=observation();raw.identifiedRarity='96/99';const r=await runScan({fields:{mode:'identity',cardType:'sports'},visionResponse:message(raw)});assert.equal(r.status,200);assert.equal(r.metrics.vision,1);assert.equal(r.metrics.sdkMaxRetries,0);assert.equal(r.metrics.valuation,0);assert.equal(r.metrics.catalog,0);assert.ok(r.metrics.visionPrompt.includes('never rarity or collector number'));
 assert.equal(r.payload.originalIdentityObservation.identifiedRarity,'96/99');assert.equal(r.payload.canonicalCard.rarity,null);assert.equal(r.payload.canonicalCard.cardNumber,'US102');assert.equal(r.payload.canonicalCard.serialNumber,'96/99');assert.equal(r.payload.photoIdentityStatus.subjectGroup.status,'supported_observations');assert.equal(r.payload.identityV2.identityVerified,false);
 const restored=protectFinancialReport(JSON.parse(JSON.stringify(reportFromResponse(r.payload))));assert.equal(restored.financialDecision.allowed,false);for(const f of FINANCIAL_FIELDS)assert.equal(restored[f],null);
 const html=renderIdentityResult(restored);assert.match(html,/Reported subjects — unverified/);assert.match(html,/Copy serial observation: 96\/99/);assert.match(html,/Collector number: US102/);assert.match(html,/numbering alone does not identify/);const copy=protectedCopySummary(restored);assert.match(copy,/Original rarity observation: 96\/99/);assert.match(copy,/Synthetic subset/);assert.match(copy,/withheld/);
});
test('sports prompt is category-specific and never guesses exact treatment from serial; Pokemon prompt retains its contract',()=>{
 assert.ok(buildIdentityPrompt({cardType:'sports',hasBack:true}).includes('Do not infer exact parallel'));assert.ok(!buildIdentityPrompt({cardType:'pokemon',hasBack:true}).includes('sportsIdentity lists'));
});
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'gempredict-live-unit123.vercel.app',VERCEL_GIT_COMMIT_REF:'reconcile/iphone-upload-2026-11-03',VERCEL_GIT_COMMIT_SHA:'5d3fe66f15dd21cb6d071fae4d43dd5a90641d3d',VERCEL_GIT_REPO_OWNER:'gempredict',VERCEL_GIT_REPO_SLUG:'gempredict-live',VERCEL_PROJECT_ID:'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED:'true',GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY:'ab'.repeat(32),GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY:'cd'.repeat(32)};
test('actual SDK sports request and owner diagnostics retain member attribution and serial metadata without literal group names',async()=>{
 const raw=observation(['PRIVATE ATHLETE ONE','PRIVATE ATHLETE TWO']);raw.identifiedRarity='96/99';const req={method:'POST',headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};req.headers.cookie=authorizeDiagnosticOwner(req,env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,env).split(';')[0];
 const r=await runScan({fields:{mode:'identity',cardType:'sports'},env,headers:req.headers,actualSdkFetch:async()=>new Response(JSON.stringify({type:'message',role:'assistant',id:'msg_mock',model:'claude-sonnet-4-6',...message(raw),usage:{input_tokens:100,output_tokens:200}}),{status:200,headers:{'content-type':'application/json'}})});assert.equal(r.status,200);assert.deepEqual(r.metrics.sdkRequest.output_config,{format:identityOutputFormat(true,'sports')});assert.equal(r.metrics.visionMaxTokens,2000);assert.equal(r.metrics.sdkMaxRetries,0);
 const d=readDiagnosticTicket(req,r.responseHeaders[TICKET_HEADER],r.responseHeaders[SCAN_HEADER],env);assert.equal(d.sportsIdentity.memberCount,2);assert.equal(d.sportsIdentity.subjectStatus,'supported_observations');assert.equal(d.sportsIdentity.serial.status,'observed_not_authenticated');assert.equal(d.sportsIdentity.rarityIssue,'serial_like_rarity_proposal');assert.equal(d.sportsIdentity.exactParallelVerified,false);assert.deepEqual(d.sportsIdentity.members[0].readingIndices,[0,1]);assert.doesNotMatch(JSON.stringify(d.sportsIdentity),/PRIVATE ATHLETE|96\/99|Synthetic subset|Synthetic title/);assert.equal(d.model.unexpectedFieldCount,0);
});
