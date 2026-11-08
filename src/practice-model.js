const VERSION='0.10.22-rc.20250304';
export async function createPracticeModels(canvas){
 const {FilesetResolver,PoseLandmarker,HandLandmarker}=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`);
 const vision=await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
 const handCanvas=canvas?.ownerDocument.createElement('canvas');let pose,hand;
 const create=async delegate=>{
  try{
   pose=await PoseLandmarker.createFromOptions(vision,{...(canvas?{canvas}:{}),baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
   hand=await HandLandmarker.createFromOptions(vision,{...(handCanvas?{canvas:handCanvas}:{}),baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minTrackingConfidence:.5});
  }catch(error){pose?.close();hand?.close();pose=hand=null;throw error;}
 };
 try{await create('GPU')}catch{await create('CPU')}
 return {pose,hand,close(){pose.close();hand.close();}};
}
