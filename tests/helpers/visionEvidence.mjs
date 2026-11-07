// Synthetic evidence for contract tests only, never observations of a real card.
export function supportedObservation(attribute='corners',code='whitening',patch={}) {
 const cues={whitening:'localized_color_loss',scratches:'surface_line',softening:'rounded_corner_outline',crease:'surface_deformation',bend:'surface_deformation',dent:'surface_depression',off_center:'border_width_difference',no_defect_observed:'clear_inspected_area'};
 return {attribute,code,certainty:'confirmed',evidence:{side:'front',region:[0,.02,.15,.15],cue:cues[code],confidence:.9,...(code==='off_center'?{measurement:{axis:'horizontal',ratio:[65,35]}}:{})},...patch};
}
