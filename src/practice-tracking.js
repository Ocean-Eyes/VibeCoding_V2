import {createPracticeModels} from './practice-model.js';
import {createVisionTracker} from './vision-tracking.js';
export function createPracticeTracker(){
 return createVisionTracker({workerURL:new URL('./tracker.js',import.meta.url),createModel:createPracticeModels,
  detect:({pose,hand},bitmap,time)=>({points:pose.detectForVideo(bitmap,time).landmarks[0]??null,hands:hand.detectForVideo(bitmap,time).landmarks})});
}
