const VERSION='0.10.22-rc.20250304';
export async function createPoseModel(canvas){
 const {FilesetResolver,PoseLandmarker}=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`);
 const vision=await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
 const create=delegate=>PoseLandmarker.createFromOptions(vision,{
  ...(canvas?{canvas}:{}),baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',delegate},
  runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6,
 });
 try{return await create('GPU')}catch{return await create('CPU')}
}
