import {hostedCatalogEvidence,reviewedSourceReceipt} from './reviewedCatalogSource.mjs';
import {resolveReviewedSetCode} from './reviewedSetCodes.mjs';
import { reconcileHostedPrinting } from './tcgdexSnapshot.mjs';
import { catalogNameKey } from './catalogNormalization.mjs';
// Server-only V2 REST catalog lookup. Ignore bundled pricing; never use it as identity or valuation evidence.
import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const ORIGIN = 'https://api.tcgdex.net/v2';
const collectorId = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? String(value) : typeof value === 'string' ? value.trim() : '';
const clean = value => typeof value === 'string' ? value.trim() : '';
const key = catalogNameKey;
const numberKey = value => clean(value).replace(/^#\s*/, '').toUpperCase().split('/').map(part => /^\d+$/.test(part.trim()) ? String(Number(part)) : part.trim()).join('/');
const languages = { english: 'en', en: 'en', french: 'fr', fr: 'fr', german: 'de', de: 'de', spanish: 'es', es: 'es', italian: 'it', it: 'it', portuguese: 'pt', pt: 'pt', japanese: 'ja', ja: 'ja', chinese: 'zh-tw', 'traditional chinese': 'zh-tw', 'zh-tw': 'zh-tw', indonesian: 'id', id: 'id', thai: 'th', th: 'th' };
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(value);

function publicJson(url, { signal }) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  return new Promise((resolve, reject) => {
    const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
    const request = https.get(url, { signal, agent, headers: { Accept: 'application/json' } }, response => {
      let body = ''; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) response.destroy(new Error('catalog_response_too_large'));
        else body += chunk;
      });
      response.on('error', reject);
      response.on('end', () => resolve({ ok: response.statusCode === 200, status: response.statusCode, json: async () => JSON.parse(body) }));
    });
    request.on('error', reject);
    request.on('close', () => agent?.destroy());
  });
}

async function bounded(operation, signal) {
  let abort;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => {
        abort = () => reject(new Error('catalog_timeout'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally { signal.removeEventListener('abort', abort); }
}

export function createTcgDexCatalog({ fetchImpl = publicJson, now = Date.now, timeoutMs = 2500, deadlineMs = 8000, ttlMs = 300000, maxCacheEntries = 128, resolveSetCode = resolveReviewedSetCode } = {}) {
  const cache = new Map();
  async function catalogLookup({ subject, cardNumber, language, candidateQueries,printedSetCode,printedLanguage }) {
    const diagnostics = [];
    const discovery={strategy:'not_started',mappingStatus:'not_requested',mappingCandidates:0,requests:0,cacheHits:0,pageItemCounts:[],setListComplete:false,recordCandidates:0};
    diagnostics.push({source:'catalog_discovery',discovery});
    const selectedLanguage=printedLanguage||language;
    const lang = selectedLanguage ? languages[clean(selectedLanguage).toLowerCase()] : 'en';
    const resolution=resolveSetCode(printedSetCode,lang),reviewed=resolution.set;
    Object.assign(discovery,{mappingStatus:resolution.status,mappingCandidates:resolution.candidateCount});
    if(reviewed)discovery.mapping={code:reviewed.code,id:reviewed.id,language:lang,officialCount:reviewed.officialCount,revision:reviewed.provenance.revision,blob:reviewed.provenance.blob};
    if(resolution.status==='ambiguous')return {complete:false,status:'ambiguous',outcome:'ambiguous',reasonCode:'catalog_candidates_ambiguous',records:[],diagnostics:[...diagnostics,{reasonCode:'reviewed_set_code_ambiguous'}]};
    if(['unavailable','language_mismatch'].includes(resolution.status))return {complete:false,status:'insufficient_evidence',outcome:'incomplete',reasonCode:resolution.status==='unavailable'?'reviewed_set_source_unavailable':'printed_language_conflict',records:[],diagnostics};
    const combinations = Array.isArray(candidateQueries) && candidateQueries.length ? candidateQueries.slice(0,4) : [{ subject, cardNumber }];
    const expected = numberKey(cardNumber || combinations[0]?.cardNumber);
    if (!lang || !key(subject || combinations[0]?.subject) || !/^[A-Z0-9-]+(?:\/[A-Z0-9-]+)?$/.test(expected)) return { complete: false, status: 'insufficient_evidence', outcome:'incomplete',reasonCode:'catalog_evidence_incomplete',reason: 'Unsupported language or collector number', records: [], diagnostics };
    let requests = 0;
    const deadline = AbortSignal.timeout(deadlineMs);
    const pending = new Map();
    async function get(path) {
      const url = `${ORIGIN}/${lang}/${path}`;
      const hit = cache.get(url);
      if (hit && hit.expires > now()) { discovery.cacheHits++;diagnostics.push({ endpoint: url, status: 'cached' }); return structuredClone(hit.data); }
      if (pending.has(url)) return pending.get(url);
      if (requests >= 9) throw new Error('catalog_request_budget');
      discovery.requests=++requests;
      const task = (async () => {
        const signal = AbortSignal.any([deadline, AbortSignal.timeout(timeoutMs)]);
        try {
          const data = await bounded(async () => {
            const response = await fetchImpl(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('catalog_http_' + response.status);
            return response.json();
          }, signal);
          diagnostics.push({ endpoint: url, status: 'retrieved' });
          return data;
        } catch (error) {
          diagnostics.push({ endpoint: url, status: 'rejected', reason: signal.aborted ? 'catalog_timeout' : /^catalog_/.test(error.message) ? error.message : 'catalog_transport_or_json_error' });
          throw error;
        }
      })();
      pending.set(url, task);
      return task;
    }
    function remember(path, data) {
      const url = `${ORIGIN}/${lang}/${path}`;
      cache.delete(url);
      cache.set(url, { data: structuredClone(data), expires: now() + ttlMs });
      while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
    }
    try {
      // Contains filters are documented; exact matches are rechecked locally.
      // Ignore the proposed year, set and variant to avoid circular confirmation.
      const records = [];
      for (const combination of combinations) {
        const targetSubject = clean(combination.subject);
        const [targetLocalId, targetDenominator] = numberKey(combination.cardNumber).split('/');
        if (!targetSubject || !/^[A-Z0-9-]+$/.test(targetLocalId || '')) throw new Error('catalog_invalid_candidate_query');
        let items,searchPath=null;
        if(reviewed){
          discovery.strategy='reviewed_set';
          const reviewedSet=await get(`sets/${encodeURIComponent(reviewed.id)}`);
          diagnostics.push({source:'reviewed_set_metadata',reasonCode:'reviewed_set_code_lookup'});
          if(reviewedSet?.id!==reviewed.id||key(reviewedSet.name)!==key(reviewed.names[lang])||reviewedSet.cardCount?.official!==reviewed.officialCount||reviewedSet.releaseDate!==reviewed.releaseDate)throw Error('catalog_set_mapping_mismatch');
          if(targetDenominator&&String(reviewed.officialCount)!==targetDenominator){diagnostics.push({accepted:false,reason:'official_count_mismatch'});continue;}
          if(Array.isArray(reviewedSet.cards)){
            if(reviewedSet.cards.length>10000||new Set(reviewedSet.cards.map(c=>c?.id)).size!==reviewedSet.cards.length||reviewedSet.cardCount.total!=null&&(!Number.isInteger(reviewedSet.cardCount.total)||reviewedSet.cardCount.total<reviewed.officialCount)||reviewedSet.cards.some(item=>!safeId(item?.id)||!clean(item?.name)||!collectorId(item?.localId))||reviewedSet.cards.length<(reviewedSet.cardCount.total??reviewed.officialCount))throw Error('catalog_set_list_incomplete');
            discovery.setListComplete=true;
            items=reviewedSet.cards.filter(item=>key(item.name)===key(targetSubject)&&numberKey(collectorId(item.localId))===targetLocalId);
          }
        }
        if(!items){
          discovery.strategy=reviewed?'reviewed_set_global_fallback':'bounded_global';
          const query=new URLSearchParams({name:targetSubject.replace(/[-\s]+ex$/i,'').trim(),localId:targetLocalId,'pagination:page':'1','pagination:itemsPerPage':'5'});
          searchPath=`cards?${query}`;items=await get(searchPath);
        }
        if(!Array.isArray(items)||items.some(item=>!safeId(item?.id)||!clean(item?.name)||!collectorId(item?.localId)))throw Error('catalog_invalid_search_schema');
        discovery.pageItemCounts.push(items.length);
        if(items.length>=5){diagnostics.push({reasonCode:discovery.setListComplete?'catalog_multiple_set_candidates':'catalog_search_page_limit'});return {complete:false,status:'ambiguous',outcome:'ambiguous',reasonCode:'catalog_candidates_ambiguous',reason:discovery.setListComplete?'Multiple exact set candidates exceed bounded comparison limit':'Candidate page limit reached; results may be truncated',records:[],diagnostics};}
        for (const item of items) {
          if (key(item.name) !== key(targetSubject) || numberKey(collectorId(item.localId)) !== targetLocalId) { diagnostics.push({ id: item.id, accepted: false, reason: 'different_name_or_collector_number' }); continue; }
          const cardPath = `cards/${encodeURIComponent(item.id)}`;
          const card = await get(cardPath);
          if (card?.id !== item.id || numberKey(collectorId(card?.localId)) !== numberKey(collectorId(item.localId)) || key(card?.name) !== key(item.name) || !safeId(card?.set?.id)) throw new Error('catalog_invalid_card_schema');
          if(card.language&&languages[clean(card.language).toLowerCase()]!==lang){diagnostics.push({id:item.id,accepted:false,reason:'printed_language_conflict'});continue;}
          if(reviewed&&card.set.id!==reviewed.id){diagnostics.push({id:item.id,accepted:false,reason:'printed_set_code_conflict'});continue;}
          const setPath = `sets/${encodeURIComponent(card.set.id)}`;
          const set = await get(setPath);
          if (set?.id !== card.set.id || !clean(set.name) || key(set.name) !== key(card.set.name) || !Number.isInteger(set.cardCount?.official) || set.cardCount.official < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(set.releaseDate) || !Number.isFinite(Date.parse(set.releaseDate)) || new Date(set.releaseDate).toISOString().slice(0, 10) !== set.releaseDate || card.set.cardCount?.official != null && card.set.cardCount.official !== set.cardCount.official) throw new Error('catalog_invalid_set_schema');
          if(set.language&&languages[clean(set.language).toLowerCase()]!==lang)throw Error('catalog_set_mapping_mismatch');
          const { pricing: ignoredPricing, ...identityCard } = card;
          remember(cardPath, identityCard); remember(setPath, set);
          if (targetDenominator && numberKey(String(set.cardCount.official)) !== targetDenominator) { diagnostics.push({ id: item.id, accepted: false, reason: 'official_count_mismatch', officialCount: set.cardCount.official }); continue; }
          const rarity = clean(card.rarity);
          const parallel = ['special illustration rare', 'sir', 'special art'].includes(key(rarity)) ? 'Special Art' : null;
          records.push(reconcileHostedPrinting({ id: card.id, provider: 'tcgdex', subject: card.name, localId: collectorId(card.localId), cardNumber: `${collectorId(card.localId)}/${set.cardCount.official}`, brandSet: set.name, setId: set.id, setCode: clean(set.tcgOnline) || clean(set.abbreviation) || clean(set.abbreviations?.official) || reviewed?.code || null, officialCount: set.cardCount.official, releaseDate: set.releaseDate, year: set.releaseDate.slice(0, 4), language: lang, rarity, parallel, variants: card.variants || null, hostedEvidence:hostedCatalogEvidence(card,{language:lang,set}), reviewedSource:reviewedSourceReceipt(card.id) }, card, diagnostics));
          discovery.recordCandidates++;
          diagnostics.push({ id: card.id, accepted: true, setId: set.id, setName: set.name, collectorNumber: `${card.localId}/${set.cardCount.official}`, rarity });
        }
        if(searchPath)remember(searchPath, items);
      }
      return { records, complete: true, diagnostics };
    } catch (error) {
      diagnostics.push({ status: 'rejected', reason: /^catalog_/.test(error?.message || '') ? error.message : 'catalog_lookup_failed' });
      const incomplete=/^catalog_(?:invalid|set_|request_budget)/.test(error?.message||'');
      return { records: [], complete: false, status: 'unavailable',outcome:incomplete?'incomplete':'unavailable',reasonCode:incomplete?'catalog_evidence_incomplete':'catalog_service_unavailable',reason: 'TCGdex lookup failed or returned invalid data', diagnostics };
    }
  }
  return { catalogLookup, catalogSource: 'tcgdex', allowCatalogCorrection: true };
}

// Per-process bounded cache; no credential or user image data is stored.
export const tcgdexCatalog = createTcgDexCatalog();
