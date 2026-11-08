// Inference stays off the UI thread. Version-pinned JS and WASM must match.
let pose,hand;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      // MediaPipe's WASM loader calls importScripts, so this must be a classic Worker.
      const {createPracticeModels}=await import('./practice-model.js');
      ({pose,hand}=await createPracticeModels());
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
