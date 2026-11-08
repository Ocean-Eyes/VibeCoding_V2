export function createCameraPlayback(video,button,{onBlocked,onRetryFailed}={}){
 let pending,revision=0;
 function cancel(){revision++;pending?.(false);pending=null;button.hidden=true;button.disabled=false;button.onclick=null;}
 async function start(isCurrent=()=>true){
  cancel();const attempt=revision,current=()=>attempt===revision&&isCurrent();
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;video.hidden=false;
  try{await video.play();return current();}
  catch(error){
   if(!current())return false;
   if(error.name!=='NotAllowedError')throw error;
   onBlocked?.();button.hidden=false;
   return new Promise(resolve=>{
    pending=resolve;
    button.onclick=async()=>{
     button.disabled=true;
     // Keep play() in the tap handler for browsers requiring media activation.
     try{await video.play();if(!current())return;button.hidden=true;button.onclick=null;pending=null;resolve(true);}
     catch(error){if(current())onRetryFailed?.(error);}
     finally{if(current())button.disabled=false;}
    };
   });
  }
 }
 return {start,cancel};
}
