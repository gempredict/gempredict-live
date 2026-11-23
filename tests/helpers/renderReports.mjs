import {identityClaimLabels,reportCatalogIdentityEvidence} from '../../lib/catalogIdentityEvidence.mjs';
import {extractScanSalesIdentity,scanSalesFields} from '../../lib/scanToSalesIdentity.mjs';
import {providerFinalPrice,summarizeRecentSales} from '../../lib/marketEvidenceSummary.mjs';
import { openLibraryRecovery, readLibraryRecovery, saveLibraryPassword } from '../../lib/libraryPasswordRecovery.mjs';
import {checkStructuredPreflight} from '../../lib/structuredExperimentClient.mjs';
import {safeVisionValidation} from '../../lib/visionResponsePolicy.mjs';
import {CONTROLLED_CATEGORIES,validControlledCategory,controlledCategorySubmission} from '../../lib/controlledCategories.mjs';
import {completedSalesView,SALES_COHORTS} from '../../lib/completedSales.mjs';
import {attachReportPhotos,reportPhotos} from '../../lib/reportPhotos.mjs';
import {reportListings} from '../../lib/reportListings.mjs';
import {reportHero,conditionSnapshot,unifiedReportPresentation} from '../../lib/unifiedReportPresentation.mjs';
import * as economics from '../../lib/gradingScenarios.mjs';
import * as feeReference from '../../lib/gradingFeeReference.mjs';
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
function components(file,bindings={},extra=''){
 const source=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\s*$/gm,'')+'\n'+extra;
 const {code}=transformSync(source,{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const exports={};vm.runInNewContext(code,{exports,require,React,...bindings});return exports;
}
const {default:CompletedSalesSection}=components('src/components/CompletedSalesSection.jsx',{completedSalesView,SALES_COHORTS});
const {default:ReportStyle}=components('src/components/ReportStyle.jsx');
const {default:ConditionSnapshot}=components('src/components/ConditionSnapshot.jsx',{...collector,conditionSnapshot});
const {default:ReportPhotos}=components('src/components/ReportPhotos.jsx',{useState:React.useState,useEffect:React.useEffect});
const {default:GradingScenarioCalculator}=components('src/components/GradingScenarioCalculator.jsx',{...economics,...feeReference,useState:React.useState});
const {default:AtlasPanel}=components('src/components/AtlasPanel.jsx');
const {default:ReportIdentityResult}=components('src/components/IdentityResult.jsx',{...financial,reportTitle,verificationRows,ScanDiagnostics:()=>null});
const marketPanels=components('src/components/MarketEvidencePanels.jsx',{providerFinalPrice,summarizeRecentSales,scanSalesFields});
const marketBindings={...marketPanels,MarketEvidenceStyles:()=>null,extractScanSalesIdentity,SALES_COHORTS,summarizeRecentSales};
const {default:MarketDashboard}=components('src/components/MarketDashboard.jsx',{
 ...marketBindings,useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,
});
const {default:CatalogIdentityEvidence}=components('src/components/CatalogIdentityEvidence.jsx',{identityClaimLabels,reportCatalogIdentityEvidence});
const {ResultCard,ImageAnalysisCard}=components('src/App.jsx',{MarketDashboard,CatalogIdentityEvidence,controlledCategorySubmission,IdentityResult:ReportIdentityResult,attachReportPhotos,reportPhotos,reportListings,ReportPhotos,CompletedSalesSection,ConditionSnapshot,ReportStyle,reportHero,unifiedReportPresentation,GradingScenarioCalculator,...collector,safeScanFailure,conditionAssessmentLabels,...financial,identitySummary,reportTitle,verificationRows,buildGemPredictScore,AtlasPanel,useState:React.useState});
export function renderReports(report,completedSalesEvidence=null,props={}){
 return {upper:renderToStaticMarkup(React.createElement(ResultCard,{data:report,index:0,onSave(){},isSaved:false,completedSalesEvidence,...props})),lower:renderToStaticMarkup(React.createElement(ImageAnalysisCard,{report}))};
}
// Isolate server authorization states without starting a browser or network.
export async function renderDiagnosticControl(authorization,report=null,props={}){
 const {scanDiagnosticAccess}=await import('../../lib/scanDiagnosticClient.mjs');
 let calls=0;
 const {default:Control}=components('src/components/ScanDiagnostics.jsx',{safeVisionValidation,scanDiagnosticAccess,useRef:React.useRef,useEffect(){},useState(initial){return [calls++===0?authorization:typeof initial==='function'?initial():initial,()=>{}];}});
 return renderToStaticMarkup(React.createElement(Control,{report,...props}));
}

export function renderIdentityResult(report){
 const {default:View}=components('src/components/IdentityResult.jsx',{...financial,reportTitle,verificationRows,ScanDiagnostics:()=>null});
 return renderToStaticMarkup(React.createElement(View,{report}));
}

// Drive actual App callbacks with deterministic hook storage, no browser/AI calls.
export function appInteraction(bindings={}){
 const slots=[];let index=0;
 const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const {default:App}=components('src/App.jsx',{requireOwnerDiagnosticAccess:async()=>({enabled:true,authorized:true,conditionValidationAvailable:true,expiresAt:Date.now()+60000}),controlledCategorySubmission,attachReportPhotos,reportPhotos,reportListings,ReportPhotos,CompletedSalesSection,ConditionSnapshot,ReportStyle,reportHero,unifiedReportPresentation,GradingScenarioCalculator,...collector,...financial,identitySummary,reportTitle,verificationRows,safeScanFailure,conditionAssessmentLabels,buildGemPredictScore,AtlasPanel,IdentityResult:()=>null,ScanDiagnostics:()=>null,ControlledValidation:()=>null,DemoReportAction:()=>null,MyCardLibrary:()=>null,useState:hook,useRef:initial=>hook({current:initial})[0],useEffect(){},track(){},...bindings});
 function render(){index=0;return App();}
 function nodes(root,predicate){const found=[];function walk(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}if(predicate(node))found.push(node);walk(node.props?.children);}walk(root);return found;}
 return {render,nodes};
}

// Actual controlled-export component, with deterministic effects and no browser.
export function controlledValidationInteraction(props,bindings){
 const slots=[];let index=0,queued=[];
 const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {default:Control}=components('src/components/ControlledValidation.jsx',{checkStructuredPreflight,Date,CONTROLLED_CATEGORIES,validControlledCategory,setTimeout:(...args)=>{const t=setTimeout(...args);t.unref();return t;},clearTimeout,useState:hook,useRef:initial=>hook({current:initial})[0],useEffect(effect,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){queued.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()};});}},...bindings});
 const nodes=(root,predicate)=>{const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))out.push(n);walk(n.props?.children);};walk(root);return out;};
 return {render(){index=0;const tree=Control(props);const effects=queued;queued=[];effects.forEach(fn=>fn());return tree;},nodes,props,unmount(){slots.forEach(slot=>{if(typeof slot?.cleanup==='function')slot.cleanup();});}};
}

// Local-only economics UI: drive real input callbacks without a browser/provider.
export async function scenarioCalculatorInteraction(bindings={}){
 const economics=await import('../../lib/gradingScenarios.mjs');
 const feeReference=await import('../../lib/gradingFeeReference.mjs');
 const slots=[];let index=0;
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {default:View}=components('src/components/GradingScenarioCalculator.jsx',{...economics,...feeReference,useState,...bindings});
 const nodes=(root,predicate)=>{const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))out.push(n);walk(n.props?.children);};walk(root);return out;};
 return {render(){index=0;return View();},nodes,html(tree){return renderToStaticMarkup(tree);}};
}

export function unifiedReportInteraction(report,bindings={}){
 const slots=[];let index=0;const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {ResultCard:View}=components('src/App.jsx',{controlledCategorySubmission,IdentityResult:ReportIdentityResult,...collector,...financial,attachReportPhotos,reportPhotos,reportListings,ReportPhotos,CompletedSalesSection,ConditionSnapshot,ReportStyle,reportHero,unifiedReportPresentation,GradingScenarioCalculator,safeScanFailure,conditionAssessmentLabels,identitySummary,reportTitle,verificationRows,buildGemPredictScore,AtlasPanel,useState:hook,setTimeout(){},...bindings});
 const nodes=(root,predicate)=>{const found=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))found.push(n);walk(n.props?.children);}walk(root);return found;};
 return {render(props={}){index=0;return View({data:report,index:0,onSave(){},isSaved:false,...props});},nodes};
}

export function photoInteraction(photos,bindings={}){
 const slots=[];let index=0,effect;const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {default:View}=components('src/components/ReportPhotos.jsx',{useState,useEffect:fn=>{effect=fn;},...bindings});
 const nodes=(root,p)=>{const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(p(n))out.push(n);walk(n.props?.children);};walk(root);return out;};
 return {render(){index=0;return View({photos});},effect(){return effect();},nodes};
}

export function renderDemoAction(access){
 let n=0;const {default:View}=components('src/components/DemoReportAction.jsx',{useState:initial=>[n++===0?access:initial,()=>{}],useEffect(){}});
 return renderToStaticMarkup(React.createElement(View));
}

// Exercise the actual controlled diagnostic capture hooks without real network or scans.
export function controlledDiagnosticInteraction(handle,bindings={}){
 const slots=[];let index=0,queued=[];
 const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const {ControlledCapture}=components('src/components/ScanDiagnostics.jsx',{safeVisionValidation,useState:hook,useRef:initial=>hook({current:initial})[0],useEffect(effect,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))queued.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()};});},...bindings},'export {ControlledCapture};');
 function nodes(root,predicate){const out=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(predicate(n))out.push(n);walk(n.props?.children);};walk(root);return out;}
 return {render(){index=0;const tree=ControlledCapture({handle});const effects=queued;queued=[];effects.forEach(fn=>fn());return tree;},nodes,unmount(){slots.forEach(s=>s?.cleanup?.());}};
}

export function renderLibraryMobile(report) {
 const values=[{},true,{access_token:'offline'},[report]];
 let state=0;
 const {default:Library}=components('src/components/MyCardLibrary.jsx',{
  useEffect(){},useRef:initial=>({current:initial}),
  useState:initial=>[state<values.length?values[state++]:initial,()=>{}],
 });
 return renderToStaticMarkup(React.createElement(Library,{onSession(){},renderReport(){return null;}}));
}

export function mountLibrary({ href, auth, fetch, onSession, renderReport=()=>null }) {
 const state=[],refs=[];
 let stateIndex,refIndex,effects;
 const navigations=[];
 const {default:Library}=components('src/components/MyCardLibrary.jsx',{
  openLibraryRecovery,readLibraryRecovery,saveLibraryPassword,fetch,AbortController,AbortSignal,URLSearchParams,setTimeout,clearTimeout,
  window:{location:{href},history:{state:{},replaceState(_state,_title,url){navigations.push(url);}}},
  require:name=>name==='@supabase/supabase-js'?{createClient:()=>({auth})}:require(name),
  FormData:class{constructor(form){this.form=form;}get(name){return this.form.fields[name];}},
  useEffect:fn=>effects.push(fn),
  useState(initial){const index=stateIndex++;if(!Object.hasOwn(state,index))state[index]=initial;
   return [state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];},
  useRef(initial){const index=refIndex++;return refs[index]??=( {current:initial} );},
 });
 function render(){
  stateIndex=0;refIndex=0;effects=[];
  return Library({onSession,renderReport});
 }
 render();
 const cleanups=effects.map(effect=>effect()).filter(Boolean);
 return {render,navigations,loadList(){
  render();
  const cleanup=effects[2]();
  if(cleanup) cleanups.push(cleanup);
 },close:()=>cleanups.forEach(cleanup=>cleanup())};
}

export async function renderMarketEvidence(active,sales) {
 const {providerFinalPrice,summarizeRecentSales}=await import('../../lib/marketEvidenceSummary.mjs');
 const {ActiveListings,RecentSales}=components('src/components/MarketEvidencePanels.jsx',{providerFinalPrice,summarizeRecentSales});
 return renderToStaticMarkup(React.createElement(React.Fragment,null,
  React.createElement(ActiveListings,{result:active}),
  React.createElement(RecentSales,{result:sales,unified:true})));
}

export function marketDashboardInteraction(props,fetch) {
 const slots=[],refs=[];
 let stateIndex=0,refIndex=0;
 const {default:View}=components('src/components/MarketDashboard.jsx',{
  ...marketBindings,fetch,AbortController,setTimeout,clearTimeout,
  FormData:class{constructor(form){this.form=form;}*[Symbol.iterator](){yield* Object.entries(this.form);}},
  window:{prompt(){throw Error('Unexpected authorization prompt');}},
  useState(initial){const index=stateIndex++;if(!Object.hasOwn(slots,index))slots[index]=initial;
   return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
  useRef(initial){return refs[refIndex++]??=({current:initial});},
  useEffect(){},
 });
 return {render(){stateIndex=0;refIndex=0;return View(props);},html:renderToStaticMarkup};
}
