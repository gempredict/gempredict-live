// Server-adapter boundary. No endpoint, provider SDK, credentials or live implementation is registered.
import {qualifyCompletedSales} from './completedSales.mjs';
export async function readLiveCompletedSales(){
 return Object.freeze({enabled:false,status:'provider_disabled',reason:'No commercially approved completed-sales provider or reviewed live mapping',requests:0});
}
// Adapter.read({target,cohorts,maxRequests,maxRows,windowDays}) returns normalized records + coverage.
// Policies/mappings are independent reviewed server configuration, never adapter-response rights flags.
// Offline adapters must be deterministic; no implicit retries or pagination at this boundary.
export async function evaluateOfflineSalesAdapter(adapter,context){
 if(adapter?.mode!=='offline_fixture'||typeof adapter.read!=='function')throw new TypeError('Only offline fixture adapters are enabled');
 const result=await adapter.read({target:context.target,cohorts:['Raw','PSA 8','PSA 9','PSA 10'],maxRequests:0,maxRows:75,windowDays:context.windowDays??30});
 return qualifyCompletedSales(result.records,{...context,coverage:result.coverage,maxRows:75});
}
