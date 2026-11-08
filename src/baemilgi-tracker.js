// Pose only: no hand model, no cloud inference and no video uploads.
let pose;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {createPoseModel}=await import('./baemilgi-model.js');
      pose=await createPoseModel();
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      try{const result=pose.detectForVideo(data.bitmap,data.time);self.postMessage({type:'result',points:result.landmarks[0]??null,time:data.time});}
      finally{data.bitmap.close()}
    }
  }catch(error){self.postMessage({type:'error',detail:error?.message});}
};
