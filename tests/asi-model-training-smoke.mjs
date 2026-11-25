import assert from "node:assert/strict";
import {trainChronologicalModel} from "../asi-core/model-training.mjs";
const rows=Array.from({length:80},(_,i)=>({verified:true,observedAt:new Date(Date.UTC(2020,0,i+1)).toISOString(),actual:Math.min(100,20+i*.6),baselinePrediction:Math.min(100,20+i*.5),features:{performance:30+i,tacticalFit:40+i*.5,potential:50+i*.2,physicalFit:45+i*.4}}));
const result=trainChronologicalModel(rows);
assert.equal(result.available,true);assert.equal(result.algorithm,"standardized-ridge-regression");assert.equal(result.requiresAdminApproval,true);assert.equal(result.autoActivation,false);assert.ok(result.trainSamples>=30);assert.ok(result.holdoutSamples>=10);
assert.equal(trainChronologicalModel(rows.slice(0,20)).available,false);
assert.equal(trainChronologicalModel(rows.map(r=>({...r,verified:false}))).available,false);
assert.equal(trainChronologicalModel(rows.map(r=>({...r,features:{performance:r.features.performance}}))).available,false);
console.log("myScoutingDatabase chronological model-training tests passed.");
