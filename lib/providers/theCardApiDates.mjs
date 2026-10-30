// Pure provider-boundary validation. Fixed reason codes only; no date repair.
export function completionDateCheck(record,now=Date.now()){
 const d=record?.sale_date,t=record?.sold_at;
 if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)return {valid:false,reason:'sale_date_missing_or_invalid'};
 if(typeof t!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(t)||!Number.isFinite(Date.parse(t)))return {valid:false,reason:'sold_at_missing_or_invalid'};
 // Reject calendar rollover before comparing the provider's two supplied dates.
 const localDay=t.slice(0,10);
 if(!Number.isFinite(Date.parse(localDay))||new Date(localDay).toISOString().slice(0,10)!==localDay)return {valid:false,reason:'sold_at_calendar_invalid'};
 if(Date.parse(d)>now||Date.parse(t)>now)return {valid:false,reason:'completion_in_future'};
 if(d!==localDay)return {valid:false,reason:'sale_date_sold_at_conflict'};
 return {valid:true,reason:null};
}
