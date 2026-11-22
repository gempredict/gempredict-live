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

function photo() {
  return {
    sideStatus: 'expected',
    corners: Object.fromEntries(['topLeft','topRight','bottomLeft','bottomRight'].map(key =>
      [key,observed('No obvious corner wear visible.')])),
    edges: Object.fromEntries(['top','bottom','left','right'].map(key => [key,observed('No obvious edge wear visible.')])),
    centering: notAssessed('Camera angle limits border comparison.'),
    surface: [],
    limitations: [],
  };
}

function output({ subjects, set, number, year, parallel, serial = null, foil = null, autograph = null, subset = null }) {
  const readings = subjects.map(text => ({field:'subject',text,certainty:'clear',side:'front',area:'name'}));
  readings.push({field:'cardNumber',text:number,certainty:'clear',side:'front',area:'collector_line'});
  if (serial) readings.push({field:'serialNumber',text:serial,certainty:'clear',side:'back',area:'body_text'});
  return {
    identity: {
      identifiedSubject: subjects.join(' / '), identifiedManufacturer:null, identifiedSport:null,
      identifiedFranchise:null, identifiedBrandSet:set, identifiedYear:year, identifiedCardNumber:number,
      identifiedLanguage:'English', identifiedRarity:null, identifiedTeam:null,
      identifiedSerialNumber:serial, identifiedParallel:parallel, subset, printedTitle:null,
      autographType:autograph, foilTreatment:foil, identityNotes:'Proposed identity awaiting catalog reconciliation.',
      subjects, alternatives:[], readings,
    },
    photos: {front:photo(),back:photo()},
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
    payload.photos.back.corners.bottomRight = observed('Corner whitening along the outline.');
    if(card.number === '155/236') {
      payload.photos.front.edges.right = observed('Edge chipping near the bottom.');
      payload.photos.front.surface.push({location:'lower foil',status:'possible',evidence:'Fine surface scratches.'});
    }
    if (card.subjects.length > 1) {
      payload.photos.front.limitations.push('sleeve');
      payload.photos.front.surface.push({location:'center surface', ...notAssessed('Holder reflection obscures surface.')});
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
  payload.photos.back.sideStatus='mismatch';
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
        data.photos.back.limitations.push('glare');
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
  delete payload.photos.front.corners.topLeft;
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
  delete data.photos.back;
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
