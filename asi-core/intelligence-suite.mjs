/**
 * myScoutingDatabase Intelligence Suite
 * Seven explainable, evidence-gated capabilities. No autonomous production model updates.
 */
const finite = v => Number.isFinite(v);
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const round = (v,n=2) => Math.round(v*10**n)/10**n;
const validScore = v => finite(v)&&v>=0&&v<=100;
const dated = v => Number.isFinite(Date.parse(v));

export function proposeLearningUpdate(records,currentWeights,options={}) {
 if(!Array.isArray(records)||!currentWeights||typeof currentWeights!=="object") throw new TypeError("records and currentWeights are required");
 const minimum=Number.isInteger(options.minimumSample)?Math.max(10,options.minimumSample):30;
 const rows=records.filter(r=>r&&r.outcomeObserved===true&&r.features&&validScore(r.actualOutcome)&&validScore(r.predictedOutcome));
 const features=Object.keys(currentWeights).filter(k=>finite(currentWeights[k])&&currentWeights[k]>=0);
 if(rows.length<minimum||!features.length) return {available:false,sampleSize:rows.length,minimumSample:minimum,proposedWeights:null,reason:"Insufficient verified outcome records; no learning update proposed."};
 const usableByFeature=Object.fromEntries(features.map(key=>[key,rows.filter(r=>validScore(r.features[key]))]));
 const eligibleFeatures=features.filter(key=>usableByFeature[key].length>=minimum);
 if(!eligibleFeatures.length) return {available:false,sampleSize:rows.length,minimumSample:minimum,proposedWeights:null,reason:"Verified outcomes exist, but no model feature has enough paired values for a defensible update."};
 const proposals={};
 for(const key of features) {
  const usable=usableByFeature[key];
  if(usable.length<minimum){proposals[key]=currentWeights[key];continue;}
  const centered=usable.reduce((s,r)=>s+(r.features[key]-50)*(r.actualOutcome-r.predictedOutcome),0)/usable.length;
  const delta=clamp(centered/2500,-0.05,0.05);
  proposals[key]=round(Math.max(0,currentWeights[key]*(1+delta)),4);
 }
 const total=Object.values(proposals).reduce((a,b)=>a+b,0);
 if(total>0) for(const key of Object.keys(proposals)) proposals[key]=round(proposals[key]/total,4);
 return {available:true,sampleSize:rows.length,meanOutcomeError:round(rows.reduce((s,r)=>s+r.actualOutcome-r.predictedOutcome,0)/rows.length),proposedWeights:proposals,requiresHumanApproval:true,validation:"Use chronological holdout and cohort checks before activation.",modelVersion:"myscouting-learning-proposal-v1"};
}

export function comparePlayers(a,b,dimensions=["performance","tacticalFit","potential","physicalFit","economicFit"]) {
 if(!a||!b) throw new TypeError("two players are required");
 const comparisons=dimensions.map(key=>({dimension:key,left:validScore(a.dimensions?.[key])?a.dimensions[key]:null,right:validScore(b.dimensions?.[key])?b.dimensions[key]:null})).map(x=>({...x,difference:x.left===null||x.right===null?null:round(x.left-x.right)}));
 const usable=comparisons.filter(x=>x.difference!==null), sum=usable.reduce((s,x)=>s+x.difference,0);
 return {players:[a.id??null,b.id??null],comparisons,coverage:round(usable.length/Math.max(1,dimensions.length)*100),winnerByAvailableDimensions:sum>0?(a.id??"left"):sum<0?(b.id??"right"):"tie",limitations:usable.length<dimensions.length?["Some dimensions are missing; comparison is partial."]:[]};
}

export function forecastTalent(observations,options={}) {
 if(!Array.isArray(observations)) throw new TypeError("observations must be an array");
 const min=Number.isInteger(options.minimumObservations)?Math.max(4,options.minimumObservations):6, horizon=clamp(finite(options.horizonMonths)?options.horizonMonths:12,1,24);
 const rows=observations.filter(x=>validScore(x?.score)&&dated(x?.observedAt)).map(x=>({x:Date.parse(x.observedAt),y:x.score})).sort((a,b)=>a.x-b.x);
 if(rows.length<min) return {available:false,reason:"Insufficient dated observations.",sampleSize:rows.length,minimumSample:min};
 const start=rows[0].x, end=rows.at(-1).x, months=(end-start)/(30.4375*86400000);
 if(months<6) return {available:false,reason:"Observation window must span at least six months.",sampleSize:rows.length};
 const mx=rows.reduce((s,r)=>s+r.x,0)/rows.length, my=rows.reduce((s,r)=>s+r.y,0)/rows.length;
 const den=rows.reduce((s,r)=>s+(r.x-mx)**2,0);
 if(!den) return {available:false,reason:"Observation dates are not distributed."};
 const slope=rows.reduce((s,r)=>s+(r.x-mx)*(r.y-my),0)/den;
 const residual=Math.sqrt(rows.reduce((s,r)=>s+(r.y-(my+slope*(r.x-mx)))**2,0)/rows.length);
 const perMonth=slope*30.4375*86400000, predicted=clamp(rows.at(-1).y+perMonth*horizon,0,100);
 return {available:true,currentScore:round(rows.at(-1).y),projectedScore:round(predicted),horizonMonths:horizon,trendPerMonth:round(perMonth,3),confidence:rows.length>=10&&residual<8?"moderate":"low",sampleSize:rows.length,periodMonths:round(months),errorBand:round(Math.min(35,residual*1.5+5)),notAGuarantee:true,method:"bounded linear trend; no causal or career guarantee"};
}

export function assessTransferOpportunity(player,brief={}) {
 const score=player?.suitabilityScore,cost=player?.estimatedCost;
 if(!validScore(score)||!finite(cost)||cost<=0) return {available:false,reason:"A valid suitability score and positive estimated cost are required."};
 const budget=finite(brief.budget)?brief.budget:null, confidence=validScore(player.evidenceConfidence)?player.evidenceConfidence:0, risk=validScore(player.riskScore)?player.riskScore:50;
 const valuePerMillion=score/(cost/1000000),budgetFit=budget===null?null:cost<=budget,opportunityScore=round(clamp(score*.55+confidence*.25+(100-risk)*.2,0,100));
 return {available:true,opportunityScore,valuePerMillion:round(valuePerMillion,2),budgetFit,estimatedCost:cost,currency:brief.currency??"EUR",confidence,riskScore:risk,recommendation:budgetFit===false?"Over budget":opportunityScore>=75?"Prioritise review":opportunityScore>=55?"Further scouting":"Low priority",warnings:[...(confidence<60?["Evidence confidence is limited."]:[]),...(risk>=70?["Elevated risk score; verify underlying risks."]:[]),"Opportunity score is a screening aid, not a valuation or transfer recommendation."]};
}

export function generateScoutingReport(player,context={}) {
 if(!player||typeof player.name!=="string"||!player.name.trim()) throw new TypeError("player.name is required");
 const strengths=Object.entries(player.dimensions??{}).filter(([,v])=>validScore(v)&&v>=75).map(([dimension,score])=>({dimension,score}));
 const development=Array.isArray(context.development)?context.development:[], evidence=Array.isArray(context.evidence)?context.evidence:[];
 return {title:"Scouting Report — "+player.name,generatedAt:context.generatedAt??null,player:{id:player.id??null,name:player.name,age:player.age??null,positions:player.positions??[]},executiveSummary:strengths.length?"Documented strengths in "+strengths.map(x=>x.dimension).join(", ")+".":"No dimension currently meets the strength threshold.",strengths,developmentSignals:development,assessment:player.suitabilityScore??null,evidence:evidence.map(e=>({title:e.title??null,sourceUrl:e.sourceUrl??null,status:e.status??"unverified",claim:e.claim??null})),risks:[...(player.risks??[])],limitations:["Only supplied data is evaluated; missing data is not inferred.","Unverified sources remain visibly unverified.","This report is decision support, not an automatic signing recommendation."],reportVersion:"myscouting-report-v1"};
}

export function analyzeVideoEvents(events) {
 if(!Array.isArray(events)) throw new TypeError("events must be an array");
 const valid=events.filter(e=>e&&typeof e.type==="string"&&finite(e.minute)&&e.minute>=0&&e.minute<=150),counts={};
 for(const e of valid) counts[e.type]=(counts[e.type]??0)+1;
 const phases={firstHalf:valid.filter(e=>e.minute<45).length,secondHalf:valid.filter(e=>e.minute>=45&&e.minute<90).length,extraTime:valid.filter(e=>e.minute>=90).length};
 const quality=valid.length?round(valid.filter(e=>e.source==="verified"||e.verified===true).length/valid.length*100):0;
 return {available:valid.length>0,eventCount:valid.length,invalidEventCount:events.length-valid.length,eventCounts:counts,phaseCounts:phases,verifiedEventCoverage:quality,timeline:valid.sort((a,b)=>a.minute-b.minute).map(e=>({minute:e.minute,type:e.type,playerId:e.playerId??null,zone:e.zone??null,outcome:e.outcome??null,verified:e.verified===true||e.source==="verified"})),capability:"Structured event/tag analysis only; no computer-vision inference from raw video.",limitations:["Requires manually or externally tagged events.","No player tracking, pose estimation, or automatic video recognition is performed."]};
}

export function evaluateScoutCalibration(records,options={}) {
 if(!Array.isArray(records)) throw new TypeError("records must be an array");
 const min=Number.isInteger(options.minimumSample)?Math.max(5,options.minimumSample):8,grouped=new Map();
 for(const r of records) if(r&&typeof r.scoutId==="string"&&validScore(r.rating)&&validScore(r.verifiedOutcome)&&r.outcomeVerified===true){if(!grouped.has(r.scoutId))grouped.set(r.scoutId,[]);grouped.get(r.scoutId).push(r);}
 return [...grouped.entries()].map(([scoutId,rows])=>{
  if(rows.length<min)return {scoutId,evaluable:false,sampleSize:rows.length,minimumSample:min,reason:"Insufficient verified paired outcomes."};
  const errors=rows.map(r=>r.rating-r.verifiedOutcome),bias=errors.reduce((s,x)=>s+x,0)/errors.length,mae=errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length;
  return {scoutId,evaluable:true,sampleSize:rows.length,bias:round(bias),meanAbsoluteError:round(mae),calibrationScore:round(clamp(100-mae,0,100)),tendency:bias>3?"optimistic":bias< -3?"conservative":"balanced",reviewRequired:mae>20,warning:"Calibration describes historical agreement, not scout quality or personal worth."};
 });
}
