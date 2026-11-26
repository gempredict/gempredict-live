import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { createSavedSnapshot, readSavedSnapshot, SAVED_REPORT_MODELS, SAVED_REPORT_SCHEMA_VERSION } from './savedReportSnapshot.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const columns = 'id,scan_id,created_at,card_name,card_number,category,model,model_version,analysis_revision,schema_version';
const pageSize = 25;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
function clientOptions(signal = AbortSignal.timeout(5000), headers) {
  return { ...options, global: { headers, fetch: (url, init) => fetch(url, {
    ...init, redirect: 'error',
    signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
  }) } };
}
function projectOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) &&
      !url.port && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function libraryConfiguration(env = process.env) {
  // Phase 5C is Preview-only. Production requires a separately deployed library
  // project and a reviewed activation path.
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview' ||
      env.GEMPREDICT_LIBRARY_ENABLED !== 'true') return null;
  const url = projectOrigin(env.GEMPREDICT_LIBRARY_PREVIEW_SUPABASE_URL);
  const publishableKey = env.GEMPREDICT_LIBRARY_PREVIEW_PUBLISHABLE_KEY;
  const writerKey = env.GEMPREDICT_LIBRARY_PREVIEW_SERVICE_ROLE_KEY;
  if (!url || url === projectOrigin(env.NEXT_PUBLIC_SUPABASE_URL) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '') ||
      !writerKey?.trim() || writerKey === publishableKey) return null;
  return { url, publishableKey, writerKey };
}

export async function libraryOwner(req, configuration, makeClient = createClient, signal) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || header.length > 8192) return null;
  const token = header.match(/^Bearer ([A-Za-z0-9._-]+)$/i)?.[1];
  if (!token) return null;
  const client = makeClient(configuration.url, configuration.publishableKey,
    clientOptions(signal, { Authorization: `Bearer ${token}` }));
  const { data, error } = await client.auth.getUser(token);
  if (error || !uuid.test(data?.user?.id || '')) return null;
  return { client, id: data.user.id };
}

export async function saveCompletedLibraryReport({ req, report, scanId, category, model, modelVersion, env = process.env, makeClient = createClient }) {
  if (!req.headers?.authorization || report?.success !== true || !report.imageAnalysis ||
      report.stage === 'identity' || !SAVED_REPORT_MODELS.has(model)) return null;
  const configuration = libraryConfiguration(env);
  if (!configuration) return { status: 'unavailable' };
  try {
    const signal = AbortSignal.timeout(4000);
    const owner = await libraryOwner(req, configuration, makeClient, signal);
    if (!owner) return { status: 'sign_in_required' };
    const payload = createSavedSnapshot(report);
    if (!payload || !uuid.test(scanId)) return { status: 'unavailable' };
    const card = payload.canonicalCard || {};
    const writer = makeClient(configuration.url, configuration.writerKey, clientOptions(signal));
    // Conflict-ignore makes retried storage of the same completed scan immutable.
    const revision = /^[0-9a-f]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA : null;
    const { error } = await writer.rpc('store_completed_saved_report', {
      report_scan: scanId, report_owner: owner.id,
      report_card_name: (card.displayName || card.subject || payload.cardTitle || 'Unidentified card').slice(0, 160),
      report_card_number: (card.cardNumber || '').slice(0, 40) || null,
      report_category: category, report_model: model, report_revision: revision,
      report_model_version: typeof modelVersion==='string'&&/^[a-z0-9._-]{1,80}$/i.test(modelVersion)?modelVersion:null,
      report_version: SAVED_REPORT_SCHEMA_VERSION, report_payload: payload,
    });
    if (error) return {status:'unavailable'};
    if (['feature/collector-dashboard-phase5i','feature/catalog-evidence-foundation-phase5j','feature/qualified-market-comparables-phase5k','feature/sales-lookback-phase5k1','feature/grading-economics-foundation-phase5l','fix/cardapi-price-confirmed-schema-phase5l2','feature/catalog-sales-crosswalk-phase5m','feature/live-catalog-integration-phase5n','feature/catalog-rest-adapter-phase5o','fix/catalog-response-contract-phase5o1','feature/provider-independent-sales-intelligence-phase5p','feature/identification-grading-calibration-phase5q','feature/owner-benchmark-review-phase5q1'].includes(env.VERCEL_GIT_COMMIT_REF)) {
      // Re-read through the analysis owner's RLS session. A lookup failure must
      // not turn a successful save into a failed analysis.
      try {
        const {data,error:lookupError}=await owner.client.from('saved_reports').select('id')
          .eq('owner_id',owner.id).eq('scan_id',scanId).maybeSingle();
        if (!lookupError && uuid.test(data?.id || '')) return {status:'saved',reportId:data.id};
      } catch {}
    }
    return {status:'saved'};
  } catch { return { status: 'unavailable' }; }
}

export function createLibraryScanId(diagnosticId) {
  return uuid.test(diagnosticId || '') ? diagnosticId : randomUUID();
}

export async function readOwnedSavedReport(owner,id) {
  if (typeof id!=='string'||!uuid.test(id)) return {status:400,error:'invalid_report_id'};
  const {data,error}=await owner.client.from('saved_reports').select(columns+',payload')
    .eq('owner_id',owner.id).eq('id',id).maybeSingle();
  if(error) throw Error('storage');
  if(!data) return {status:404,error:'report_not_found'};
  const payload=readSavedSnapshot(data);
  return payload?{status:200,report:{...data,payload}}:{status:422,error:'unsupported_report_version'};
}

export function createSavedReportsHandler({ env = process.env, makeClient = createClient } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const configuration = libraryConfiguration(env);
    if (!configuration) return res.status(404).json({ error: 'library_unavailable' });
    if (req.method === 'GET' && req.query?.config === '1') {
      return res.status(200).json({ url: configuration.url, publishableKey: configuration.publishableKey });
    }
    if (!['GET', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' });
    try {
      const owner = await libraryOwner(req, configuration, makeClient);
      if (!owner) return res.status(401).json({ error: 'sign_in_required' });
      const { id, search = '', sort = 'newest', page = '0' } = req.query || {};
      if (id !== undefined && (typeof id !== 'string' || !uuid.test(id))) {
        return res.status(400).json({ error: 'invalid_report_id' });
      }
      const table = owner.client.from('saved_reports');
      if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ error: 'invalid_report_id' });
        const { data, error } = await table.delete().eq('owner_id', owner.id).eq('id', id).select('id').maybeSingle();
        if (error) throw Error('storage');
        return data ? res.status(200).json({ deleted: true }) : res.status(404).json({ error: 'report_not_found' });
      }
      if (id) {
        const selected=await readOwnedSavedReport(owner,id);
        return res.status(selected.status).json(selected.report?{report:selected.report}:{error:selected.error});
      }
      if (typeof search !== 'string' || search.length > 80 || typeof page !== 'string' ||
          !/^\d{1,4}$/.test(page) || !['newest', 'oldest', 'name'].includes(sort)) {
        return res.status(400).json({ error: 'invalid_library_query' });
      }
      let query = table.select(columns).eq('owner_id', owner.id);
      if (search.trim()) query = query.ilike('search_text', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
      const offset = Number(page) * pageSize;
      const { data, error } = await query.order(sort === 'name' ? 'card_name' : 'created_at', { ascending: sort !== 'newest' })
        .order('id', { ascending: false }).range(offset, offset + pageSize);
      if (error) throw Error('storage');
      return res.status(200).json({ reports: data.slice(0, pageSize), hasMore: data.length > pageSize });
    } catch { return res.status(503).json({ error: 'library_unavailable' }); }
  };
}
