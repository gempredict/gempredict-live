const normalize = value => String(value || '').toLowerCase().replace(/[-–—]/g,' ').trim();
const factorySet = /\bfactory\s+(?:complete\s+)?set\b|\bcomplete\s+set\s+(?:variation|version|exclusive)\b/;
const photoVariation = /\b(?:photo|image|picture)\s+(?:variation|variant)\b|\b(?:alternate|different)\s+(?:photo|image|picture)\b/;
const shortPrint = /\bshort\s+print(?:ed)?\b|\bssp\b/;
const basePrinting = /^(?:base|regular|normal|standard|none)(?: (?:card|print(?:ing)?|version))?$|\b(?:regular base|base (?:card|rookie|print(?:ing)?|version)|standard photo)\b/;
const photoSubject = /\b(pitching|batting)\s+(?:photo|image|picture|pose)\b/g;
const graders = 'PSA|BGS|SGC|CGC|TAG|Beckett|CSG|HGA|ACE|GMA|KSA';
const gradeNumber = '(?:10(?:\\.0)?|[1-9](?:\\.\\d)?)';
const graderKey = value => /^(?:Beckett|BGS)$/i.test(value) ? 'BGS' : value.toUpperCase();

export function compareMarketPrinting(target,row,variant) {
  const expected=normalize(target.parallel);
  const title=normalize(row.title);
  const printingTitle=title.replace(/\b(?:not (?:a |an |from (?:a |the )?)?|non )(?:(?:factory (?:complete )?set|short print|(?:photo|image|picture) variation)(?: variation| version)?)/g,'');
  const matches=[], unknown=[], conflicts=[];
  const copyNumbers=[...title.matchAll(/\b(\d{1,6})\s*\/\s*(\d{1,6})\b/g)]
    .filter(([,copy,run])=>copy+'/'+run!==String(target.number||'').replace(/^#\s*/,'').replace(/\s/g,''));
  const labeledRun=title.match(/\b(?:serial\s+numbered|numbered|print run)\s*(?:to|of|\/)?\s*(\d{1,6})\b/)?.[1];
  const bareRun=title.match(/(?:^|\s)\/\s*(\d{1,6})\b/)?.[1];
  const runs=[row.printRun,copyNumbers.length?null:labeledRun,bareRun,...copyNumbers.map(match=>match[2])].filter(Boolean).map(String);
  if (runs.length && ((target.printRun&&runs.some(run=>run!==target.printRun)) ||
      (basePrinting.test(expected)&&!target.printRun))) conflicts.push('print_run');
  if (target.serial) {
    if(copyNumbers.some(([,copy,run])=>copy+'/'+run!==target.serial)) conflicts.push('copy_serial');
    else (copyNumbers.length?matches:unknown).push('copy_serial');
  }
  const kinds=[['factory_set',factorySet],['photo_variation',photoVariation],['short_print',shortPrint]];
  const expectedKinds=kinds.filter(([,pattern])=>pattern.test(expected)).map(([kind])=>kind);
  const listedKinds=kinds.filter(([,pattern])=>pattern.test(printingTitle)).map(([kind])=>kind);
  const expectsBase=basePrinting.test(expected)&&expectedKinds.length===0;
  for (const kind of listedKinds) {
    if (expectsBase || expectedKinds.length&&!expectedKinds.includes(kind) &&
        // A factory-set printing can also describe its photo as a variation.
        (kind==='factory_set'||expectedKinds.includes('short_print'))) conflicts.push(kind);
    else if (expectedKinds.includes(kind)) matches.push(kind);
  }
  if (expectedKinds.length && basePrinting.test(title)) conflicts.push(expectedKinds[0]);
  const observedPhotos=[...new Set([...title.matchAll(photoSubject)].map(match=>match[1]))];
  if (target.photoPose) {
    if(observedPhotos.some(pose=>pose!==target.photoPose)) conflicts.push('photo_variation');
    else (observedPhotos.length?matches:unknown).push('photo_pose');
  }
  if (!conflicts.length && !variant.conflict) {
    const explicitPrinting=(!target.photoPose||matches.includes('photo_pose')) && ((expectsBase&&!listedKinds.length&&basePrinting.test(title)) ||
      (expectedKinds.length&&expectedKinds.every(kind=>listedKinds.includes(kind))) ||
      (variant.match&&!expectsBase&&!expectedKinds.length&&!listedKinds.length));
    (explicitPrinting?matches:unknown).push('exact_printing');
  }
  return {matches,unknown,conflicts};
}

export function assessMarketGrade(row,cohort) {
  const title=String(row.title||'');
  const condition=normalize(row.condition);
  const titleGrades=[...title.matchAll(new RegExp(`\\b(${graders})\\s*(?:grade\\s*)?(${gradeNumber})(?![\\d.])\\b`,'gi'))]
    .map(([,grader,number])=>graderKey(grader)+' '+Number(number));
  const structuredGrader=String(row.grader||'').trim();
  const structuredGrade=String(row.grade||'').trim();
  const exactGrades=new Set(titleGrades);
  if (new RegExp(`^(?:${graders})$`,'i').test(structuredGrader) && new RegExp(`^${gradeNumber}$`).test(structuredGrade)) {
    exactGrades.add(graderKey(structuredGrader)+' '+Number(structuredGrade));
  }
  const raw= /^(?:raw|ungraded)(?: card)?$/.test(condition) ||
    /\b(?:raw card|ungraded(?: card)?)\b/i.test(title) || /(?:^|[|,–—]\s*|\s)raw\s*$/i.test(title);
  const graded=!!(structuredGrader||structuredGrade) || exactGrades.size>0 ||
    /^(?:graded|slabbed)(?: card)?$/.test(condition) ||
    /\b(?:professionally graded|slabbed)\b/i.test(title) ||
    new RegExp(`\\b(?:${graders})[ -]+graded\\b`,'i').test(title);
  const contradictsStructuredGrade=titleGrades.some(label=>{
    const [company,number]=label.split(' ');
    return (structuredGrader&&graderKey(structuredGrader)!==company) ||
      (new RegExp(`^${gradeNumber}$`).test(structuredGrade)&&Number(structuredGrade)!==Number(number));
  });
  if (exactGrades.size>1 || contradictsStructuredGrade || raw&&graded) return {label:'Conflicting grading evidence',status:'mismatch'};
  if (graded) {
    const exact=[...exactGrades][0];
    const label=exact||'Graded · exact grade unknown';
    return {label,status:cohort==='Raw'||exact&&exact!==cohort?'mismatch':exact?'matched':'unknown'};
  }
  if (raw) return {label:'Listed as Raw',status:cohort==='Raw'?'matched':'mismatch'};
  return {label:'Grade status unknown',status:'unknown'};
}
