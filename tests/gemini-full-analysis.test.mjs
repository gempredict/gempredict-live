import { retainSportsVisionEvidence } from '../lib/visionResponsePolicy.mjs';
import { renderReports } from './helpers/renderReports.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { ApiError, GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL, GEMINI_MAX_OUTPUT, parseGeminiAnalysis, requestGeminiAnalysis } from '../lib/geminiFullAnalysis.mjs';
import { protectFinancialReport } from '../lib/financialSafety.mjs';
import { sportsIdentityEvidence } from '../lib/sportsIdentityEvidence.mjs';
import { providerFailure } from '../lib/scanFailures.mjs';
import { normalizeMobileImage } from '../lib/mobileImages.mjs';
import { validateAnalysisImage } from '../lib/uploadValidation.mjs';
import { authorizeDiagnosticOwner, readDiagnosticTicket, SCAN_HEADER, TICKET_HEADER } from '../lib/scanDiagnosticsAuth.mjs';
import { runScan } from './helpers/reconciliationPipeline.mjs';

const countFetch = async () => Response.json({totalTokens:2621});
const env = {
  GEMPREDICT_GEMINI_PRICING_VERIFIED_THROUGH: new Date(Date.now()+86400000).toISOString().slice(0,10),
  VERCEL: '1', VERCEL_ENV: 'preview', GEMPREDICT_GEMINI_FULL_ANALYSIS: 'true',
  VISION_BENCH_GEMINI_KEY: 'synthetic-test-only',
  GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION: '0.10',
  GEMPREDICT_GEMINI_OUTPUT_USD_PER_MILLION: '0.40',
  GEMPREDICT_GEMINI_MAX_SCAN_USD: '0.20',
};
const diagnosticsEnv = {
  VERCEL_GIT_COMMIT_REF: 'feature/gemini-primary-phase5a',
  VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40),
  VERCEL_GIT_REPO_OWNER: 'gempredict', VERCEL_GIT_REPO_SLUG: 'gempredict-live',
  VERCEL_PROJECT_ID: 'prj_hu0Q2BybH0PskmTxFaEkz1NVtus4',
  GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED: 'true',
  GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY: 'ab'.repeat(32),
  GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY: 'cd'.repeat(32),
};
const makePhoto = (width, height, color) => sharp({create:{width,height,channels:3,background:color}}).jpeg().toBuffer();
const front = await makePhoto(1152, 1536, '#abcdfe');
const back = await makePhoto(300, 400, '#fedcba');
const images = [{ side: 'front', buffer: front, mimeType: await validateAnalysisImage(front) },
  { side: 'back', buffer: back, mimeType: await validateAnalysisImage(back) }];
const observed = evidence => ({status:'apparent',evidence});
const notAssessed = evidence => ({status:'not_assessable',evidence});

function observations(side) {
  return [
    ...['top_left','top_right','bottom_left','bottom_right'].map(location =>
      ({side,region:'corner_'+location,...observed('No obvious corner wear visible.')})),
    ...['top','bottom','left','right'].map(location =>
      ({side,region:'edge_'+location,...observed('No obvious edge wear visible.')})),
    {side,region:'centering',...notAssessed('Camera angle limits border comparison.')},
  ];
}

function mark(payload, side, region, finding) {
  Object.assign(payload.observations.find(row=>row.side===side&&row.region===region),finding);
}

function output({ subjects, set, number, year, parallel, serial = null, foil = null, autograph = null, subset = null }) {
  const readings = subjects.map(text => ({field:'subject',text,certainty:'clear',side:'front',area:'name'}));
  readings.push({field:'cardNumber',text:number,certainty:'clear',side:'front',area:'collector_line'});
  if (serial) readings.push({field:'serialNumber',text:serial,certainty:'clear',side:'back',area:'body_text'});
  return {
    identity: {
      facts: Object.entries({
        identifiedSubject: subjects.join(' / '), identifiedBrandSet:set, identifiedCardNumber:number,
        identifiedLanguage:'English', identityNotes:'Proposed identity awaiting catalog reconciliation.',
        ...(year?{identifiedYear:year}:{}), ...(parallel?{identifiedParallel:parallel}:{}),
        ...(serial?{identifiedSerialNumber:serial}:{}), ...(subset?{subset}:{}),
        ...(autograph?{autographType:autograph}:{}), ...(foil?{foilTreatment:foil}:{}),
      }).map(([field,value])=>({field,value})),
      subjects, readings,
    },
    photos: ['front','back'].map(side=>({side,status:'expected'})),
    observations: ['front','back'].flatMap(observations),
  };
}
function response(payload, finishReason = 'STOP') {
  return {candidates:[{finishReason,content:{parts:[{text:JSON.stringify(payload)}]}}],
    usageMetadata:{promptTokenCount:1400,candidatesTokenCount:800,thoughtsTokenCount:130}};
}
const cards = [
  { subjects:['Fraxure'], set:'Unified Minds', number:'155/236', year:'2019', parallel:'Reverse Holo', category:'pokemon' },
  { subjects:['Snivy'], set:"McDonald's Collection", number:'5/25', year:'2021', parallel:'Confetti Holo', category:'pokemon' },
  { subjects:['Shohei Ohtani','Kyle Tucker'], set:'Topps Update', number:'US102', year:null, parallel:'Green Diamante Foil', serial:'96/99', foil:'Diamante pattern', category:'sports' },
  { subjects:['Josh Dix'], set:'Bowman University', number:'PA-JD', year:null, parallel:'Green Border', serial:'41/99', autograph:'sticker', subset:'Paper retail auto', category:'sports' },
];

for (const card of cards) {
  test(`synthetic ${card.subjects.join(' / ')} result retains identity and qualified condition without granting financial trust`, () => {
    const payload = output(card);
    mark(payload,'back','corner_bottom_right',observed('Corner whitening along the outline.'));
    if(card.number === '155/236') {
      mark(payload,'front','edge_right',observed('Edge chipping near the bottom.'));
      payload.observations.push({side:'front',region:'surface',location:'lower foil',status:'possible',evidence:'Fine surface scratches.'});
    }
    if (card.subjects.length > 1) {
      payload.photos[0].limitations=['sleeve'];
      payload.observations.push({side:'front',region:'surface',location:'center surface', ...notAssessed('Holder reflection obscures surface.')});
    }
    const analysis = parseGeminiAnalysis(response(payload), ['front','back'], card.category);
    const safe = protectFinancialReport({imageAnalysis:{...analysis,inspectedSides:['front','back']}});
    assert.equal(safe.imageAnalysis.identifiedSubject,card.subjects.join(' / '));
    assert.equal(safe.imageAnalysis.identifiedCardNumber,card.number);
    assert.equal(safe.imageAnalysis.identifiedBrandSet,card.set);
    assert.equal(safe.imageAnalysis.identifiedParallel,card.parallel);
    assert.equal(safe.imageAnalysis.identifiedSerialNumber,card.serial ?? null);
    assert.equal(safe.imageAnalysis.worthGrading,null);
    assert.equal(safe.financialDecision.allowed,false);
    assert.ok(safe.imageAnalysis.modelPhotoNotes.some(note=>note.side==='back'&&note.text.includes('whitening')));
    assert.equal(safe.imageAnalysis.visualObservations.length,0);
    if(card.subjects.length > 1) assert.ok(safe.imageAnalysis.imageLimitations.includes('sleeve'));
    if(card.category==='sports') {
      const evidence = sportsIdentityEvidence(analysis);
      assert.equal(evidence.subjectStatus,'supported_observations');
      assert.equal(evidence.serial.status,'observed_not_authenticated');
      assert.equal(evidence.exactParallel.status,'unverified');
    }
  });
}

test('unknown printing and serial remain null, with a warning for mislabeled photos', () => {
  const payload = output({...cards[0],parallel:null});
  payload.photos[1].status='mismatch';
  payload.observations=payload.observations.filter(row=>row.side==='front');
  const result = parseGeminiAnalysis(response(payload),['front','back'],'pokemon');
  assert.equal(result.identifiedParallel,null);
  assert.equal(result.identifiedSerialNumber,null);
  assert.deepEqual(result.photoSideUncertain,['back']);
  assert.ok(result.modelPhotoNotes.every(note=>note.side==='front'));
});

test('one call sets the deadline, image resolution, order, unchanged bytes and thinking configuration', async () => {
  let attempts = 0;
  const usage = [];
  const result = await requestGeminiAnalysis({ images, env, countFetch, cardType:'pokemon',
    diagnostics:{geminiAttempt(){},geminiUsage(value){usage.push(value);},providerLatency(){}},
    makeClient(options) {
      assert.equal(options.httpOptions.retryOptions.attempts,1);
      assert.equal(options.httpOptions.timeout,45000);
      assert.equal(options.httpOptions.baseUrl,'https://generativelanguage.googleapis.com');
      return {models:{async generateContent(request) {
        attempts++;
        assert.equal(request.model,GEMINI_MODEL);
        assert.equal(request.config.thinkingConfig.thinkingLevel,'LOW');
        assert.equal(request.config.maxOutputTokens,GEMINI_MAX_OUTPUT);
        assert.ok(request.config.abortSignal instanceof AbortSignal);
        const parts=request.contents[0].parts.filter(part=>part.inlineData);
        assert.deepEqual(parts.map(part=>Buffer.from(part.inlineData.data,'base64')),[front,back]);
        assert.ok(parts.every(part=>part.mediaResolution.level==='MEDIA_RESOLUTION_HIGH'));
        const data=output(cards[0]);
        data.photos[1].limitations=['glare'];
        return response(data);
      }}};
    },
  });
  assert.equal(attempts,1);
  assert.deepEqual(usage.map(value=>value.thoughtsTokenCount),[130]);
  assert.deepEqual(result.imageLimitations,['limited_resolution','glare']);
});

test('budget and credential configuration fail closed before client construction', async () => {
  const makeClient=()=>assert.fail('must not construct the client');
  const noCount=()=>assert.fail('must not contact Gemini');
  for (const [settings, message] of [
    [{VISION_BENCH_GEMINI_KEY:''},'GEMINI_CREDENTIAL_MISSING'],
    [{VERCEL_ENV:'production'},'GEMINI_MODEL_DISABLED'],
    [{GEMPREDICT_GEMINI_FULL_ANALYSIS:''},'GEMINI_MODEL_DISABLED'],
    [{GEMPREDICT_GEMINI_PRICING_VERIFIED_THROUGH:''},'GEMINI_PRICING_UNVERIFIED'],
    [{GEMPREDICT_GEMINI_PRICING_VERIFIED_THROUGH:'2000-01-01'},'GEMINI_PRICING_UNVERIFIED'],
    [{GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION:''},'GEMINI_PRICING_UNVERIFIED'],
    [{GEMPREDICT_GEMINI_MAX_SCAN_USD:'0.001'},'GEMINI_BUDGET_EXCEEDED'],
  ]) {
    await assert.rejects(requestGeminiAnalysis({images,env:{...env,...settings},makeClient,countFetch:noCount}),{message});
    assert.equal(providerFailure(Error(message)).status,503);
  }
});

test('timeout and SDK rejection are fixed vocabulary with no retries or leaked upstream body', async () => {
  for (const [cause,code] of [[new DOMException('private','TimeoutError'),'ANALYSIS_PROVIDER_TIMEOUT'],
    [new ApiError({message:'private',status:401}),'ANALYSIS_PROVIDER_AUTH_FAILED']]) {
    let calls=0;
    await assert.rejects(requestGeminiAnalysis({images,env,countFetch,makeClient:()=>({models:{async generateContent(){calls++;throw cause;}}})}),
      error=>providerFailure(error).payload.code===code && !JSON.stringify(error).includes('private') && !error.message.includes('private'));
    assert.equal(calls,1);
  }
});

test('malformed and truncated output cannot produce a report', () => {
  const payload = output(cards[0]);
  payload.observations.shift();
  assert.throws(()=>parseGeminiAnalysis(response(payload),['front','back'],'pokemon'),{message:'ANALYSIS_RESPONSE_INVALID'});
  assert.throws(()=>parseGeminiAnalysis(response(payload,'MAX_TOKENS'),['front','back'],'pokemon'),{message:'ANALYSIS_RESPONSE_INCOMPLETE'});
});

test('unsigned Full Analysis stops before a provider call even with Preview configuration', async () => {
  const outcome=await runScan({env:{...env,...diagnosticsEnv,GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false'}});
  assert.equal(outcome.status,403);
  assert.equal(outcome.metrics.vision,0);
});

test('authorized multipart Full Analysis uses the real SDK serialization and protected diagnostics', async () => {
  const host='gempredict-live-unit123.vercel.app';
  const headers={host,origin:'https://'+host};
  const configuration={...env,...diagnosticsEnv,VERCEL_URL:host,GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false'};
  headers.cookie=authorizeDiagnosticOwner({headers,method:'POST'},configuration.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,configuration).split(';')[0];
  let calls=0;
  let countedRequest;
  const result=await runScan({
    env:configuration,headers,frontBytes:front,backBytes:back,fields:{cardType:'sports'},items:[],
    geminiCountFetch: async(url,init)=>{
      assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-carbon:countTokens');
      assert.equal(init.redirect,'error');
      ({generateContentRequest:countedRequest}=JSON.parse(init.body));
      return Response.json({totalTokens:2621});
    },
    geminiClient: options=>new GoogleGenAI({...options,httpOptions:{...options.httpOptions,
      fetch:async (url, init)=>{
        calls++;
        const parsed=new URL(url);
        assert.equal(parsed.origin,'https://generativelanguage.googleapis.com');
        assert.equal(parsed.pathname,'/v1beta/models/gemini-4-carbon:generateContent');
        assert.equal(new Headers(init.headers).get('x-goog-api-key'),env.VISION_BENCH_GEMINI_KEY);
        assert.equal(parsed.search,'');
        const body=JSON.parse(init.body);
        assert.deepEqual(countedRequest,{model:'models/gemini-4-carbon',...body});
        const parts=body.contents[0].parts.filter(part=>part.inlineData);
        assert.deepEqual(parts.map(part=>Buffer.from(part.inlineData.data,'base64')),[front,back]);
        assert.ok(parts.every(part=>part.mediaResolution.level==='MEDIA_RESOLUTION_HIGH'));
        assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');
        return Response.json(response(output(cards[2])));
      },
    }}),
  });
  assert.equal(calls,1);
  assert.equal(result.metrics.vision,0);
  assert.equal(result.status,200);
  assert.equal(result.payload.financialDecision.allowed,false);
  assert.equal(result.payload.imageAnalysis.identifiedSubject,'Shohei Ohtani / Kyle Tucker');
  const ticket=readDiagnosticTicket({headers,method:'POST'},result.responseHeaders[TICKET_HEADER],result.responseHeaders[SCAN_HEADER],configuration);
  assert.equal(ticket.visionRequest.model,GEMINI_MODEL);
  assert.equal(ticket.images.front.width,1152);
  assert.equal(ticket.images.back.height,400);
  assert.equal(ticket.provider.usage.thinking,130);
  assert.equal(ticket.model.conditionFormat,'compact_photo_observations');
  assert.equal(ticket.model.compactPhotoObservations.count,18);
  assert.equal(ticket.model.compactPhotoObservations.received,18);
  assert.equal(ticket.finalPresentation.compactPhotoObservations.count,18);
  assert.equal(ticket.finalPresentation.states.corners,'model_observations_available');
  assert.equal(ticket.finalPresentation.observations,0);
  assert.ok(!JSON.stringify(ticket).includes('No obvious corner wear visible'));

  assert.ok(ticket.provider.estimatedCostUSD>0);
  assert.ok(!JSON.stringify({body:result.payload,ticket}).includes(env.VISION_BENCH_GEMINI_KEY));
});

test('sideways phone JPEG is prepared portrait without upscaling and sent without another JPEG encode', async () => {
  const original = await sharp({create:{width:4032,height:3024,channels:3,background:'#fbacaf'}})
    .jpeg().withMetadata({orientation:6}).toBuffer();
  assert.equal((await sharp(original).metadata()).orientation,6);
  let quality;
  const prepared = await normalizeMobileImage(new File([original],'sideways.jpg',{type:'image/jpeg'}), {
    decodeImage:async file=>{
      const oriented=await sharp(Buffer.from(await file.arrayBuffer())).autoOrient().toBuffer();
      const metadata=await sharp(oriented).metadata();
      return {width:metadata.width,height:metadata.height,source:oriented};
    },
    makeCanvas:()=>{
      let source;
      return {getContext:()=>({fillRect(){},drawImage(bytes){source=bytes;}}),
        toBlob(callback,mimeType,q){
          quality=q;
          sharp(source).resize(this.width,this.height).jpeg({quality:Math.round(q*100)}).toBuffer()
            .then(bytes=>callback(new Blob([bytes],{type:mimeType})),()=>callback(null));
        }};
    },
  });
  const bytes=Buffer.from(await prepared.arrayBuffer());
  const preparedMetadata=await sharp(bytes).metadata();
  assert.deepEqual([preparedMetadata.width,preparedMetadata.height,quality],[1920,2560,0.94]);
  const data=output(cards[3]);
  data.photos.pop();
  data.observations=data.observations.filter(row=>row.side==='front');
  data.identity.readings=data.identity.readings.filter(row=>row.side==='front');
  await requestGeminiAnalysis({images:[{side:'front',buffer:bytes,mimeType:await validateAnalysisImage(bytes)}],
    env,countFetch,cardType:'sports',makeClient:()=>({models:{async generateContent(request){
      assert.deepEqual(Buffer.from(request.contents[0].parts[1].inlineData.data,'base64'),bytes);
      return response(data);
    }}})});
});

test('verified request count must fit the ceiling before generation can start',async()=>{
 const makeClient=()=>assert.fail('generation cannot start');
 for(const [totalTokens,message] of [[1000000,'GEMINI_BUDGET_EXCEEDED'],[null,'GEMINI_INPUT_COUNT_FAILED']]){
  await assert.rejects(requestGeminiAnalysis({images,env:{...env,GEMPREDICT_GEMINI_MAX_SCAN_USD:'0.05'},makeClient,
    countFetch:async()=>Response.json({totalTokens})}),{message});
 }
});

test('authorized route reports missing pricing without provider attempts or sensitive values',async()=>{
 const host='gempredict-live-unit123.vercel.app';
 const headers={host,origin:'https://'+host};
 const configuration={...env,...diagnosticsEnv,VERCEL_URL:host,GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false',
  GEMPREDICT_GEMINI_INPUT_USD_PER_MILLION:''};
 headers.cookie=authorizeDiagnosticOwner({headers,method:'POST'},configuration.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,configuration).split(';')[0];
 const result=await runScan({env:configuration,headers,
  geminiCountFetch:()=>assert.fail('count cannot start'),
  geminiClient:()=>assert.fail('generation cannot start')});
 assert.equal(result.status,503);
 assert.equal(result.payload.code,'GEMINI_PRICING_UNVERIFIED');
 assert.match(result.payload.error,/No generation request was sent/);
 assert.ok(!JSON.stringify(result.payload).includes(env.VISION_BENCH_GEMINI_KEY));
 const ticket=readDiagnosticTicket({headers,method:'POST'},result.responseHeaders[TICKET_HEADER],result.responseHeaders[SCAN_HEADER],configuration);
 assert.equal(ticket.provider.sdkAttempts,0);
 assert.equal(ticket.visionStatus,'provider_not_configured');
});

test('real SDK HTTP 400 preserves only fixed Google status, field and schema hint in the encrypted export', async () => {
  const host='gempredict-live-unit123.vercel.app';
  const headers={host,origin:'https://'+host};
  const configuration={...env,...diagnosticsEnv,VERCEL_URL:host,GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false'};
  headers.cookie=authorizeDiagnosticOwner({headers,method:'POST'},configuration.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,configuration).split(';')[0];
  const privateMarker='private-provider-marker';
  let attempts=0;
  const result=await runScan({
    env:configuration,headers,frontBytes:front,backBytes:back,geminiCountFetch:countFetch,
    geminiClient:options=>new GoogleGenAI({...options,httpOptions:{...options.httpOptions,
      fetch:async()=>{
        attempts++;
        return Response.json({error:{code:400,status:'INVALID_ARGUMENT',
          message:'The schema is too complex for serving. '+privateMarker,
          details:[{'@type':'type.googleapis.com/google.rpc.BadRequest',fieldViolations:[
            {field:'generationConfig.responseJsonSchema.properties.'+privateMarker,description:privateMarker},
            {field:'contents[0].parts[1].mediaResolution.level',description:privateMarker},
            {field:privateMarker,description:privateMarker},
          ]}]}},{status:400});
      },
    }}),
  });
  assert.equal(attempts,1);
  assert.equal(result.metrics.vision,0);
  assert.equal(result.status,502);
  const ticket=readDiagnosticTicket({headers,method:'POST'},result.responseHeaders[TICKET_HEADER],result.responseHeaders[SCAN_HEADER],configuration);
  assert.equal(ticket.provider.sdkAttempts,1);
  assert.equal(ticket.provider.rejection.upstreamHttpStatus,400);
  assert.deepEqual(ticket.provider.rejection.gemini,{
    googleStatus:'INVALID_ARGUMENT',fieldCategories:['response_schema','media_resolution'],messageHint:'schema_complexity',
  });
  assert.ok(!JSON.stringify({body:result.payload,ticket}).includes(privateMarker));
});

test('compact arrays reject duplicate identity facts and duplicate or misattributed observations', () => {
  const payload = output(cards[0]);
  const parse = value => parseGeminiAnalysis(response(value), ['front','back'], 'pokemon');
  for (const change of [
    data => data.identity.facts.push({...data.identity.facts[0]}),
    data => { data.observations[1].region=data.observations[0].region; },
    data => { data.observations[0].side='unknown'; },
    data => { data.photos[0].status='uncertain'; },
  ]) {
    const invalid=structuredClone(payload);
    change(invalid);
    assert.throws(()=>parse(invalid),{message:'ANALYSIS_RESPONSE_INVALID'});
  }
  const normalized=parse(payload);
  assert.equal(normalized.identityReadings[0].text,'Fraxure');
  assert.equal(normalized.identifiedManufacturer,null);
});

test('synthetic Fraxure condition preserves eight photo groups and localized notes without boosting trust',()=>{
 const data=output(cards[0]);
 for(const side of ['front','back']){
  mark(data,side,'centering',observed('Borders appear slightly uneven.'));
  data.observations.push({side,region:'surface',location:'lower edge',status:'possible',evidence:'Fine surface marks.'});
 }
 mark(data,'back','corner_bottom_right',observed('Corner whitening along the outline.'));
 const parsed=parseGeminiAnalysis(response(data),['front','back'],'pokemon');
 assert.equal(parsed.modelPhotoNotes.length,8);
 const safe=protectFinancialReport({imageAnalysis:{...parsed,inspectedSides:['front','back']}});
 const restored=protectFinancialReport(JSON.parse(JSON.stringify(safe)));
 assert.deepEqual(restored,safe);
 assert.equal(safe.imageAnalysis.compactPhotoObservations.length,20);
 assert.equal(safe.imageAnalysis.conditionAssessments.corners.state,'model_observations_available');
 assert.equal(safe.imageAnalysis.conditionAssessments.corners.wholeAttributeVerified,false);
 assert.equal(safe.imageAnalysis.centeringGeometryVerified,false);
 assert.equal(safe.imageAnalysis.visualObservations.length,0);
 assert.equal(safe.financialDecision.allowed,false);
 assert.equal(safe.imageAnalysis.estimatedGrade,null);
 const html=renderReports(restored).upper;
 assert.match(html,/Back · Reported: bottom right corner: Corner whitening/);
 assert.match(html,/Back · Possible: surface, lower edge: Fine surface marks/);
 assert.match(html,/Model photo observations/);
});

test('synthetic Topps numeric-leading insert number preserves sports evidence and optional metadata',()=>{
 const data=output({subjects:['Bryce Harper'],set:'Topps',number:'8B-11',parallel:null,subset:'8-Bit Ballers'});
 data.identity.readings.push({field:'subset',text:'8-Bit Ballers',certainty:'clear',side:'back',area:'body_text'});
 const parsed=parseGeminiAnalysis(response(data),['front','back'],'sports');
 assert.equal(parsed.identifiedCardNumber,'8B-11');
 assert.equal(parsed.identityReadings.find(row=>row.field==='cardNumber').text,'8B-11');
 assert.equal(parsed.sportsIdentity.subset,'8-Bit Ballers');
 assert.equal(parsed.sportsIdentity.subjects[0].certainty,'clear');
 assert.equal(parsed.sportsIdentity.serialNumber,null);
 assert.equal(parsed.identifiedParallel,null);
});

test('Gemini parser classifies invalid response rules without retaining failed values',()=>{
 const parse=value=>parseGeminiAnalysis(value,['front','back'],'sports');
 const base=output(cards[2]);
 for(const [rule, mutate] of [
  ['root_schema',data=>{delete data.photos;}],
  ['identity_schema',data=>{data.identity.unexpected='private-marker';}],
  ['photos_schema',data=>{data.photos=null;}],
  ['observations_schema',data=>{data.observations=null;}],
  ['identity_facts',data=>{data.identity.facts.push({...data.identity.facts[0]});}],
  ['identity_subject_length',data=>{data.identity.facts[0].value='x'.repeat(81);}],
  ['identity_identifier_length',data=>{data.identity.facts.find(f=>f.field==='identifiedCardNumber').value='1'.repeat(41);}],
  ['identity_alternative_length',data=>{data.identity.alternatives=['x'.repeat(81)];}],
  ['identity_note_length',data=>{data.identity.facts.find(f=>f.field==='identityNotes').value='x'.repeat(241);}],
  ['identity_note_length',data=>{
   data.identity.facts.find(f=>f.field==='identityNotes').value='x'.repeat(240);
   data.identity.alternatives=['a'.repeat(80),'b'.repeat(80),'c'.repeat(80)];
  }],
  ['identity_reading_length',data=>{data.identity.readings[0].text='x'.repeat(81);}],
  ['reading_side',data=>{data.identity.readings[0].side='private-marker';}],
  ['sports_collector_number',data=>{data.identity.readings.find(row=>row.field==='cardNumber').text='private-marker';}],
  ['identity_reading',data=>{data.identity.readings[0].area='private-marker';}],
  ['photo_side_coverage',data=>{data.photos[1].side='front';}],
  ['observation_side',data=>{data.observations[0].side='private-marker';}],
  ['observation_status',data=>{data.observations[0].status='private-marker';}],
  ['observation_region_or_location',data=>{data.observations[0].region='private-marker';}],
  ['photo_status_or_limitations',data=>{data.photos[0].limitations=['private-marker'];}],
  ['uncertain_side_has_evidence',data=>{data.photos[0].status='uncertain';}],
  ['regional_coverage',data=>{data.observations.shift();}],
  ['duplicate_region',data=>{data.observations[1].region=data.observations[0].region;}],
  ['surface_row_limit',data=>{
   data.observations.push(...Array.from({length:5},()=>({side:'front',region:'surface',status:'possible',location:'edge',evidence:'Possible scuff.'})));
  }],
 ]) {
  const data=structuredClone(base);
  mutate(data);
  assert.throws(()=>parse(response(data)),error=>error.message==='ANALYSIS_RESPONSE_INVALID'&&
    error.geminiValidationRule===rule&&!JSON.stringify(error).includes('private-marker'),rule);
 }
 for(const [content, rule] of [
  [{parts:[null]},'content_parts'],
  [{parts:[{text:'x'.repeat(32769)}]},'response_byte_limit'],
  [{parts:[{text:'private-marker'}]},'json_syntax'],
 ]) {
  assert.throws(()=>parse({candidates:[{finishReason:'STOP',content}]}),
    {message:'ANALYSIS_RESPONSE_INVALID',geminiValidationRule:rule});
 }
});

test('sports validation rule is available only in encrypted owner diagnostics',async()=>{
 const host='gempredict-live-unit123.vercel.app';
 const headers={host,origin:'https://'+host};
 const configuration={...env,...diagnosticsEnv,VERCEL_URL:host,GEMPREDICT_FULL_ANALYSIS_CLAUDE_ROLLBACK:'false'};
 headers.cookie=authorizeDiagnosticOwner({headers,method:'POST'},configuration.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,configuration).split(';')[0];
 const data=output({subjects:['Synthetic Athlete'],set:'Synthetic Set',number:'private-marker',parallel:null});
 let attempts=0;
 const result=await runScan({
  env:configuration,headers,frontBytes:front,backBytes:back,fields:{cardType:'sports'},
  geminiCountFetch:countFetch,geminiClient:()=>({models:{async generateContent(){attempts++;return response(data);}}}),
 });
 assert.equal(attempts,1);
 assert.equal(result.payload.code,'ANALYSIS_RESPONSE_INVALID');
 assert.ok(!JSON.stringify(result.payload).includes('sports_collector_number'));
 const ticket=readDiagnosticTicket({headers,method:'POST'},result.responseHeaders[TICKET_HEADER],result.responseHeaders[SCAN_HEADER],configuration);
 assert.deepEqual(ticket.geminiValidation,{rule:'sports_collector_number'});
 assert.equal(ticket.visionStatus,'gemini_response_rejected');
 assert.equal(ticket.normalization,null);
 assert.ok(!JSON.stringify(ticket).includes('private-marker'));
});

test('descriptive identity notes survive for a synthetic Harper insert and a Pokémon card',()=>{
 const notes='The visible insert title and collector number support this identification. The release year is uncertain because the copyright line is partly obscured. The photograph does not establish an official parallel.';
 assert.ok(notes.length>100&&notes.length<240);
 for(const item of [
  {...cards[0],category:'pokemon'},
  {subjects:['Bryce Harper'],set:'Topps',number:'8B-11',year:'2024',parallel:null,subset:'8-Bit Ballers',category:'sports'},
 ]) {
  const data=output(item);
  data.identity.facts.find(f=>f.field==='identityNotes').value=notes;
  const alternative='Another release year may apply if the obscured copyright line differs';
  data.identity.alternatives=[alternative];
  const parsed=parseGeminiAnalysis(response(data),['front','back'],item.category);
  assert.equal(parsed.identifiedCardNumber,item.number);
  assert.equal(parsed.identityReadings.find(row=>row.field==='cardNumber').text,item.number);
  assert.equal(parsed.identityNotes,notes+' Alternatives: '+alternative+'.');
  assert.ok(parsed.identityNotes.length>240);
  if(item.category==='sports'){
   const retained=retainSportsVisionEvidence(parsed,['front','back'],{extended:true});
   assert.equal(retained.originalIdentityObservation.identityNotes,parsed.identityNotes);
  }
 }
});

test('identifier limits remain strict even when descriptive notes are longer',()=>{
 const base=output({subjects:['Bryce Harper'],set:'Topps',number:'8B-11',year:'2024',parallel:'Blue',serial:'123/999',subset:'8-Bit Ballers'});
 for(const [field,value] of [
  ['identifiedYear','20242'],['identifiedSerialNumber','1234567/123456'],['identifiedParallel','x'.repeat(81)],
 ]) {
  const data=structuredClone(base);
  data.identity.facts.find(f=>f.field===field).value=value;
  assert.throws(()=>parseGeminiAnalysis(response(data),['front','back'],'sports'),
   {message:'ANALYSIS_RESPONSE_INVALID',geminiValidationRule:'identity_identifier_length'});
 }
});
