// Privacy-safe taxonomy shared by reports and authorized diagnostics. Never grants trust.
export const catalogReasonCodes=new Set(['unsupported_printed_collector_format','catalog_verification_runtime_failed','reviewed_set_code_lookup','catalog_not_configured','catalog_service_unavailable','catalog_evidence_incomplete','catalog_candidate_not_found','catalog_candidates_ambiguous','catalog_candidate_conflict','catalog_identity_supported','runtime_catalog_assets_unavailable','catalog_request_budget','catalog_timeout','catalog_invalid_search_schema','catalog_invalid_card_schema','catalog_invalid_set_schema','catalog_invalid_candidate_query','catalog_set_mapping_mismatch','catalog_set_list_incomplete','different_name_or_collector_number','official_count_mismatch','printed_language_conflict','printed_set_code_conflict','missing_catalog_reference','different_subject','different_or_partial_collector_number','incomplete_catalog_identity','contradictory_clear_printed_readings','contradictory_clear_collector_readings','contradictory_clear_set_codes','candidate_combination_limit','protected_collector_conflict']);
export function safeCatalogReasons(catalog){
 return [...new Set([catalog?.reasonCode,...(Array.isArray(catalog?.reasonCodes)?catalog.reasonCodes:[]),...(Array.isArray(catalog?.diagnostics)?catalog.diagnostics:[]).map(d=>d?.reasonCode||d?.reason)].filter(r=>typeof r==='string'&&catalogReasonCodes.has(r)))].slice(0,24);
}
export function catalogOutcome(catalog){
 if(!catalog)return 'unavailable';
 if(catalog.status==='conflict')return 'conflict';
 if(['verified','corrected'].includes(catalog.status))return catalog.requiresConfirmation||catalog.requiresLanguageConfirmation||catalog.conflicts?.length?'incomplete':'supported';
 if(catalog.status==='ambiguous')return 'ambiguous';
 if(['not_found','incomplete'].includes(catalog.outcome))return catalog.outcome;
 return catalog.status==='insufficient_evidence'?'incomplete':'unavailable';
}
