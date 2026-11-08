// Prefer a Worker, with the same models on DOM canvases if worker graphics fail.
export function createVisionTracker({workerURL,createModel,detect}){
 let worker,model,stopped=false,fallback=false,ready=false;
 const emit=data=>{if(!stopped)tracker.onmessage?.({data});};
 const error=(reason,code='tracking')=>emit({type:'error',code,detail:reason?.message||String(reason)});
 async function useCanvas(){
  if(stopped||fallback)return;fallback=true;worker?.terminate();worker=null;
  try{
   const acquired=await createModel(document.createElement('canvas'));
   if(stopped){acquired.close();return;}
   model=acquired;ready=true;emit({type:'ready'});
  }catch(reason){error(reason,'model');}
 }
 const tracker={
  onmessage:null,onerror:null,
  postMessage(data,transfer){
   if(stopped){data.bitmap?.close();return;}
   if(data.type==='init'){
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'){void useCanvas();return;}
    try{
     worker=new Worker(workerURL);
     worker.onmessage=({data})=>{
      if(stopped||fallback)return;
      if(data.type==='error'&&!ready){void useCanvas();return;}
      if(data.type==='ready')ready=true;
      emit(data);
     };
     worker.onerror=event=>{event.preventDefault?.();if(stopped||fallback)return;if(!ready){void useCanvas();return;}tracker.onerror?.(event);};
     worker.postMessage(data);
    }catch{void useCanvas();}
   }else if(data.type==='frame'){
    if(worker){worker.postMessage(data,transfer);return;}
    setTimeout(()=>{
     try{if(!stopped&&model)emit({type:'result',...detect(model,data.bitmap,data.time),time:data.time});}
     catch(reason){error(reason);}
     finally{data.bitmap.close();}
    },0);
   }
  },
  terminate(){stopped=true;worker?.terminate();model?.close();worker=model=null;},
 };
 return tracker;
}
