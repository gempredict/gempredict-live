import * as collector from '../../lib/collectorPresentation.mjs';
import {safeScanFailure} from '../../lib/scanFailures.mjs';
import {conditionAssessmentLabels} from '../../lib/photoConditionLabels.mjs';
// Exercise the actual JSX components with React SSR, no DOM or provider calls.
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'next/dist/build/swc/index.js';
import * as financial from '../../lib/financialSafety.mjs';
import {identitySummary} from '../../lib/pokemonReportIdentity.mjs';
import {reportTitle,verificationRows} from '../../lib/reportVerification.mjs';
import {buildGemPredictScore} from '../../lib/gemPredictScore.js';
const require=createRequire(import.meta.url);
function components(file,bindings={}){
 const source=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\s*$/gm,'');
 const {code}=transformSync(source,{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const exports={};vm.runInNewContext(code,{exports,require,React,...bindings});return exports;
}
const {default:AtlasPanel}=components('src/components/AtlasPanel.jsx');
const {ResultCard,ImageAnalysisCard}=components('src/App.jsx',{...collector,safeScanFailure,conditionAssessmentLabels,...financial,identitySummary,reportTitle,verificationRows,buildGemPredictScore,AtlasPanel,useState:React.useState});
export function renderReports(report){
 return {upper:renderToStaticMarkup(React.createElement(ResultCard,{data:report,index:0,onSave(){},isSaved:false})),lower:renderToStaticMarkup(React.createElement(ImageAnalysisCard,{report}))};
}
// Isolate server authorization states without starting a browser or network.
export async function renderDiagnosticControl(authorization,report=null){
 const {scanDiagnosticAccess}=await import('../../lib/scanDiagnosticClient.mjs');
 let calls=0;
 const {default:Control}=components('src/components/ScanDiagnostics.jsx',{scanDiagnosticAccess,useEffect(){},useState(initial){return [calls++===0?authorization:initial,()=>{}];}});
 return renderToStaticMarkup(React.createElement(Control,{report}));
}

export function renderIdentityResult(report){
 const {default:View}=components('src/components/IdentityResult.jsx',{...financial,reportTitle,verificationRows,ScanDiagnostics:()=>null});
 return renderToStaticMarkup(React.createElement(View,{report}));
}

// Drive actual App callbacks with deterministic hook storage, no browser/AI calls.
export function appInteraction(bindings={}){
 const slots=[];let index=0;
 const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const {default:App}=components('src/App.jsx',{...collector,...financial,identitySummary,reportTitle,verificationRows,safeScanFailure,conditionAssessmentLabels,buildGemPredictScore,AtlasPanel,IdentityResult:()=>null,ScanDiagnostics:()=>null,ControlledValidation:()=>null,useState:hook,useRef:initial=>hook({current:initial})[0],useEffect(){},track(){},...bindings});
 function render(){index=0;return App();}
 function nodes(root,predicate){const found=[];function walk(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}if(predicate(node))found.push(node);walk(node.props?.children);}walk(root);return found;}
 return {render,nodes};
}

// Actual controlled-export component, with deterministic effects and no browser.
export function controlledValidationInteraction(props,bindings){
 const slots=[];let index=0,queued=[];
 const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {default:Control}=components('src/components/ControlledValidation.jsx',{setTimeout:(...args)=>{const t=setTimeout(...args);t.unref();return t;},clearTimeout,useState:hook,useRef:initial=>hook({current:initial})[0],useEffect(effect,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){queued.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()};});}},...bindings});
 const nodes=(root,predicate)=>{const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))out.push(n);walk(n.props?.children);};walk(root);return out;};
 return {render(){index=0;const tree=Control(props);const effects=queued;queued=[];effects.forEach(fn=>fn());return tree;},nodes,props};
}

// Local-only economics UI: drive real input callbacks without a browser/provider.
export async function scenarioCalculatorInteraction(){
 const economics=await import('../../lib/gradingScenarios.mjs');
 const slots=[];let index=0;
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {default:View}=components('src/components/GradingScenarioCalculator.jsx',{...economics,useState});
 const nodes=(root,predicate)=>{const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))out.push(n);walk(n.props?.children);};walk(root);return out;};
 return {render(){index=0;return View();},nodes,html(tree){return renderToStaticMarkup(tree);}};
}
