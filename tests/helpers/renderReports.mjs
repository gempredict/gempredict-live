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
const {ResultCard,ImageAnalysisCard}=components('src/App.jsx',{...financial,identitySummary,reportTitle,verificationRows,buildGemPredictScore,AtlasPanel,useState:React.useState});
export function renderReports(report){
 return {upper:renderToStaticMarkup(React.createElement(ResultCard,{data:report,index:0,onSave(){},isSaved:false})),lower:renderToStaticMarkup(React.createElement(ImageAnalysisCard,{report}))};
}
