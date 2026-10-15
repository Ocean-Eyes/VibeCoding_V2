// Inference stays off the UI thread. Version-pinned JS and WASM must match.
const VERSION='0.10.22-rc.20250304';
let pose,hand;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      // MediaPipe's WASM loader calls importScripts, so this must be a classic Worker.
      const {FilesetResolver,PoseLandmarker,HandLandmarker}=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`);
      const vision=await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
      const create=async(delegate)=>{
        try{
          pose=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
          hand=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minTrackingConfidence:.5});
        }catch(e){pose?.close();hand?.close();pose=hand=null;throw e;}
      };
      try{await create('GPU')}catch{await create('CPU')}
      self.postMessage({type:'ready'});
    }catch(e){self.postMessage({type:'error',code:'model',detail:e.message,message:`모델을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 연결해 주세요. (${e.message})`})}
  }
  if(data.type==='frame'){
    const {bitmap,time}=data;
    try{
      const p=pose.detectForVideo(bitmap,time),h=hand.detectForVideo(bitmap,time);
      self.postMessage({type:'result',points:p.landmarks[0]??null,hands:h.landmarks,time});
    }catch(e){self.postMessage({type:'error',code:'tracking',detail:e.message,message:`자세 추적이 중단되었습니다. 다시 연결해 주세요. (${e.message})`})}
    finally{bitmap.close()}
  }
};
