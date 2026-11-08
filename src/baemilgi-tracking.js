import {createPoseModel} from './baemilgi-model.js';
import {createVisionTracker} from './vision-tracking.js';
export function createPoseTracker(){
 return createVisionTracker({workerURL:new URL('./baemilgi-tracker.js',import.meta.url),createModel:createPoseModel,
  detect:(pose,bitmap,time)=>({points:pose.detectForVideo(bitmap,time).landmarks[0]??null})});
}
