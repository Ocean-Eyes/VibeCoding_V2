// Copy camera pixels unchanged. Framing and screen angle never rotate the image.
export function createOrientedCamera(video,canvas,{frameRate=30}={}){
 if(!canvas.captureStream)throw new DOMException('Canvas camera capture is unavailable','NotSupportedError');
 const ctx=canvas.getContext('2d',{alpha:false});
 let stopped=false,frame,previousTime=-Infinity;
 function draw(){
  const width=video.videoWidth,height=video.videoHeight;
  if(video.readyState<2||!width||!height)return;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(video,0,0,width,height);
 }
 function tick(time){
  if(stopped)return;
  if(time-previousTime>=1000/frameRate){draw();previousTime=time;}
  frame=requestAnimationFrame(tick);
 }
 draw();
 const stream=canvas.captureStream(frameRate);
 frame=requestAnimationFrame(tick);
 return {stream,setOrientation(){draw();},reset(){if(!stopped)draw();},
  stop(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);stream.getTracks().forEach(track=>track.stop());},
 };
}
