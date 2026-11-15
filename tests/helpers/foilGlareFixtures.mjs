// Mock observations and annotations, not optical detection or physical-card truth.
// Every location, cue and support confidence is synthetic. No real photo is labeled.
const A=[.1,.1,.12,.12],B=[.75,.75,.1,.1],FULL=[0,0,1,1];
const cue={no_defect_observed:'clear_inspected_area',scratches:'surface_line',print_lines:'printed_line',off_center:'border_width_difference',whitening:'localized_color_loss'};
const finding=(code='scratches',side='front',region=A,certainty='suspected',attribute='surface')=>({attribute,code,certainty,evidence:{side,region:[...region],cue:cue[code],confidence:certainty==='confirmed'?.95:.6}});
const scope=(attribute='surface',side='front',limitations=[],region=FULL)=>({attribute,side,regions:[{region:[...region],status:'inspected'}],limitations});
const mask=code=>({code,region:[0,0,.4,.4]});
export function foilGlareCases(){
 const clean=(side='front')=>finding('no_defect_observed',side,A,'confirmed');
 const center=finding('off_center','front',A,'confirmed','centering');center.evidence.measurement={axis:'horizontal',ratio:[65,35]};
 return [
  {id:'foil_reflection_no_established_scratch',observations:[clean()],coverage:[scope('surface','front',[mask('glare')])],photoNotes:[{attribute:'surface',side:'front',text:'Foil reflections limit surface inspection.'}],expected:['unassessable'],reasons:[['scoped_photo_limitation']]},
  {id:'suspected_scratch_inside_glare',observations:[finding()],coverage:[scope('surface','front',[mask('glare')])],expected:['suspected'],reasons:[['scoped_photo_limitation']]},
  {id:'suspected_scratch_away_from_glare',observations:[finding('scratches','front',B)],coverage:[scope('surface','front',[mask('glare')])],expected:['suspected'],reasons:[[]]},
  {id:'two_suspected_scratches_only_one_masked',observations:[finding(),finding('scratches','front',B)],coverage:[scope('surface','front',[mask('glare')])],expected:['suspected','suspected'],reasons:[['scoped_photo_limitation'],[]]},
  {id:'clear_back_glare_obscured_front',observations:[clean(),clean('back')],coverage:[scope('surface','front',[mask('glare')]),scope('surface','back')],expected:['unassessable','confirmed'],reasons:[['scoped_photo_limitation'],[]]},
  {id:'sleeve_reflection_possible_print_line',observations:[finding('print_lines')],coverage:[scope('surface','front',[mask('sleeve')])],expected:['suspected'],reasons:[['scoped_photo_limitation']]},
  {id:'angled_uncertain_centering',observations:[center],coverage:[scope('centering')],global:['perspective'],expected:['suspected'],reasons:[['global_photo_limitation']]},
  {id:'cropped_corner',observations:[finding('whitening','front',A,'suspected','corners')],coverage:[scope('corners','front',[mask('cropped')])],expected:['suspected'],reasons:[['scoped_photo_limitation']]},
  {id:'obscured_corner_outside_visible_scope',observations:[finding('whitening','front',A,'suspected','corners')],coverage:[scope('corners','front',[mask('occluded')],B)],expected:['unassessable'],reasons:[['outside_inspection_scope','scoped_photo_limitation']]},
  {id:'missing_clean_inspection_coverage',observations:[clean()],coverage:undefined,expected:['unassessable'],reasons:[['inspection_coverage_missing']]},
  {id:'overlapping_clean_and_suspected_damage',observations:[clean(),finding()],coverage:[scope()],expected:['unassessable','suspected'],reasons:[['contradictory_observations'],['contradictory_observations']]}
 ];
}
export function foilCaseResponse(c){return {
 identifiedSubject:'Synthetic foil validation fixture',identifiedYear:'2026',identifiedBrandSet:'Synthetic product',identifiedCardNumber:'1',identifiedParallel:null,identifiedLanguage:'English',identityConfidence:50,
 visualObservations:structuredClone(c.observations),...(c.coverage?{inspectionCoverage:structuredClone(c.coverage)}:{}),imageLimitations:c.global||[],photoNotes:c.photoNotes||[],
 estimatedGrade:'PSA 10',overallScore:10,psa9Probability:99,psa10Probability:99,worthGrading:true,worthGradingReason:'Submit now for profit.'
};}
