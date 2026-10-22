// Pose only: no hand model, no cloud inference and no video uploads.
const VERSION='0.10.22-rc.20250304';
let pose;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,PoseLandmarker}=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`);
      const vision=await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
      const create=delegate=>PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',delegate},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
      try{pose=await create('GPU')}catch{pose=await create('CPU')}
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      try{const result=pose.detectForVideo(data.bitmap,data.time);self.postMessage({type:'result',points:result.landmarks[0]??null,time:data.time});}
      finally{data.bitmap.close()}
    }
  }catch{self.postMessage({type:'error'});}
};
