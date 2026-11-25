const dayMs=86400000;
const dateAt=time=>new Date(time).toISOString().slice(0,10);
export const LOOKBACK_BATCH_SIZE=2;
export const LOOKBACK_DATES=30;

export function planSalesWindows(now,days=LOOKBACK_DATES) {
 if(!Number.isFinite(now)||!Number.isInteger(days)||days<1||days>LOOKBACK_DATES)throw new TypeError('Invalid UTC lookback');
 return Array.from({length:Math.ceil(days/3)},(_,index)=>({
  dateFrom:dateAt(now-Math.min(days-1,index*3+2)*dayMs),
  dateTo:dateAt(now-index*3*dayMs),
 }));
}

export function describeLookback(windows,history,stopped) {
 const checked=history.filter(row=>row.status==='successful'||row.status==='empty');
 const dates=checked.flatMap(row=>[row.dateFrom,row.dateTo]).sort();
 return {
  requestedFrom:windows.at(-1).dateFrom,requestedTo:windows[0].dateTo,
  earliestChecked:dates[0]||null,latestChecked:dates.at(-1)||null,
  complete:checked.length===windows.length&&checked.every(row=>row.truncated===false),
  recordsRetrieved:checked.reduce((sum,row)=>sum+row.count,0),requestsAttempted:history.length,
  windows:windows.map((window,index)=>history[index]||{...window,status:'unsearched'}),
  missingPriceConfirmation:checked.reduce((sum,row)=>sum+(row.missingPriceConfirmation||0),0),
  stopped,
 };
}

export function mergeLookbackBatch(previous,batch) {
 const offset=(previous?.candidates?.length||0)+(previous?.rejected?.length||0);
 const shift=row=>({...row,index:row.index+offset});
 const candidates=[...(previous?.candidates||[]),...batch.candidates.map(shift)];
 const rejected=[...(previous?.rejected||[]),...batch.rejected.map(shift)];
 const rows=[...(previous?.comparableEvidence?.rows||[]),...batch.comparableEvidence.rows.map(shift)];
 const counts={...batch.comparableEvidence.counts};
 for(const key of Object.keys(counts)) counts[key]+=previous?.comparableEvidence?.counts?.[key]||0;
 const seen=new Map();
 for(const row of [...candidates,...rejected]){
  if(!row.platform||!row.id)continue;
  const key=JSON.stringify([row.platform,row.id]);
  const group=seen.get(key)||[];
  group.push(row.index);
  seen.set(key,group);
 }
 const repeated=[...seen.values()].filter(group=>group.length>1).flat();
 const mark=row=>repeated.includes(row.index)?{...row,suspectedDuplicate:true}:row;
 const crosswalk=batch.crosswalk?{...batch.crosswalk,rows:[...(previous?.crosswalk?.rows||[]),...batch.crosswalk.rows.map(shift)]}:null;
 return {...batch,...(crosswalk?{crosswalk}:{}),candidates:candidates.map(mark),rejected:rejected.map(mark),
  comparableEvidence:{...batch.comparableEvidence,rows:rows.map(mark),counts,
   coverage:{...batch.comparableEvidence.coverage,received:rows.length}}};
}
