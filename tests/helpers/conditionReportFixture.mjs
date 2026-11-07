// Entirely synthetic: coordinates, cues, confidence and placeholder unassessable
// codes are invented test inputs, NEVER recovered Yamask scan observations.
// No inspectionCoverage is supplied because historical coverage was not retained.
export function conditionReportStateFixture(){
 const row=(attribute,code,side,region,certainty='suspected',cue='localized_color_loss')=>({attribute,code,certainty,evidence:{side,region,cue,confidence:certainty==='suspected'?.6:.2}});
 return {
  identifiedSubject:'Synthetic condition fixture',identifiedYear:'2026',identifiedBrandSet:'Synthetic test product',identifiedCardNumber:'1',identifiedParallel:null,identifiedLanguage:'English',identityConfidence:50,
  visualObservations:[
   row('corners','whitening','back',[.01,.01,.08,.08]),
   row('corners','whitening','back',[.9,.01,.08,.08]),
   row('corners','whitening','back',[.01,.9,.08,.08]),
   row('edges','whitening','back',[.01,.4,.03,.1]),
   // No actual historical surface/centering defect subtype is known. These
   // placeholders exercise unassessable rendering, not scratches or a miscut.
   row('surface','scratches','front',[.4,.4,.1,.1],'unassessable','surface_line'),
   row('surface','scratches','back',[.4,.4,.1,.1],'unassessable','surface_line'),
   row('centering','miscut','front',[0,0,.1,.1],'unassessable','truncated_print_border')
  ],
  imageLimitations:['limited_resolution','perspective'],
  // Hostile legacy outputs test suppression, not proposed real grades/prices.
  estimatedGrade:'PSA 10',overallScore:10,gradeCeiling:'PSA 10',psa9Probability:99,psa10Probability:99,worthGrading:true,worthGradingReason:'Submit now for profit.'
 };
}
