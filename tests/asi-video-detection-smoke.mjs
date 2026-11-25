import assert from "node:assert/strict";
import {normalizeVideoDetections} from "../asi-core/video-detection.mjs";
const result=normalizeVideoDetections({provider:"external-cv",modelVersion:"1.2",sourceUrl:"https://example.org/match.mp4",detections:[{id:"1",playerId:12,timeSeconds:900,eventType:"progressive pass",confidence:.92,boundingBox:{x:.1,y:.2,width:.2,height:.3}},{playerId:12,timeSeconds:910,eventType:"shot",confidence:.3},{playerId:12,timeSeconds:920,eventType:"unknown",confidence:.99}]});
assert.equal(result.accepted.length,1);assert.equal(result.accepted[0].eventType,"progressive_pass");assert.equal(result.accepted[0].minute,15);assert.equal(result.accepted[0].confidence,.92);assert.equal(result.requiresHumanVerification,true);assert.equal(result.rejected.length,2);
assert.throws(()=>normalizeVideoDetections({provider:"x",modelVersion:"1",detections:[{playerId:1,timeSeconds:1,eventType:"shot",confidence:.99,sourceUrl:"http://bad"}]}));
console.log("myScoutingDatabase external video-detection adapter tests passed.");
