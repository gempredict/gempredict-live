import test from 'node:test';
import assert from 'node:assert/strict';
import { qualitativeConditionOutlook, conditionPresentation } from '../lib/visualEvidence.mjs';

const observation = (attribute, code, cue, confidence=0.92) => ({
 attribute, code, certainty:'confirmed',
 evidence:{ side:'front', region:[0.05,0.05,0.08,0.08], cue, confidence }
});
test('supported visible defect yields condition concern independent of finances', () => {
 const analysis={inspectedSides:['front','back'],visualObservations:[observation('corners','whitening','localized_color_loss')]};
 const outlook=qualitativeConditionOutlook(analysis);
 assert.equal(outlook.status,'visible_concerns');
 assert.equal(conditionPresentation(analysis,{trusted:false}).conditionOutlook.status,outlook.status);
 assert.equal(conditionPresentation(analysis,{trusted:true}).conditionOutlook.status,outlook.status);
 assert.equal(conditionPresentation(analysis).estimatedGrade,null);
});
test('unsupported model defect is not described as confirmed', () => {
 const outlook=qualitativeConditionOutlook({inspectedSides:['front'],visualObservations:[{attribute:'surface',code:'scratches',certainty:'confirmed'}]});
 assert.equal(outlook.status,'inspect_further');
});
test('glare cannot produce confident clean outlook',()=>{
 const analysis={inspectedSides:['front'],imageLimitations:['glare'],visualObservations:[observation('corners','no_defect_observed','clear_inspected_area')]};
 assert.equal(qualitativeConditionOutlook(analysis).status,'inspect_further');
});
test('absence of evidence is not a positive grading prediction',()=>{
 assert.equal(qualitativeConditionOutlook({}).status,'insufficient_evidence');
});
