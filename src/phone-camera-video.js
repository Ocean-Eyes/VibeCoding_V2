// Camera tracks can carry rotation metadata that the receiving browser applies
// differently. Send upright pixels with the selected frame orientation instead.
export function cameraFrameRotation(width,height,angle=0,orientation='landscape'){
 if(orientation==='portrait'?height>=width:width>=height)return 0;
 const screenAngle=((angle%360)+360)%360;
 return screenAngle===90?270:90;
}
export function cameraScreenAngle(){
 const angle=globalThis.screen?.orientation?.angle;
 return Number.isFinite(angle)?angle:Number.isFinite(globalThis.orientation)?globalThis.orientation:0;
}
export function createOrientedCamera(video,canvas,{orientation='landscape',getAngle=cameraScreenAngle,frameRate=30}={}){
 if(!canvas.captureStream)throw new DOMException('Canvas camera capture is unavailable','NotSupportedError');
 const ctx=canvas.getContext('2d',{alpha:false});
 let stopped=false,frame,previousTime=-Infinity,manual=null,lastAngle=getAngle(),rotation=0;
 function draw(){
  const angle=getAngle();if(angle!==lastAngle){manual=null;lastAngle=angle;}
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#203039';ctx.fillRect(0,0,canvas.width,canvas.height);
  const width=video.videoWidth,height=video.videoHeight;if(video.readyState<2||!width||!height)return;
  rotation=manual??cameraFrameRotation(width,height,angle,orientation);
  const sideways=rotation%180!==0;
  const scale=Math.min(canvas.width/(sideways?height:width),canvas.height/(sideways?width:height));
  ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.scale(scale,scale);
  ctx.drawImage(video,-width/2,-height/2,width,height);ctx.setTransform(1,0,0,1,0,0);
 }
 function tick(time){
  if(stopped)return;
  if(time-previousTime>=1000/frameRate){draw();previousTime=time;}
  frame=requestAnimationFrame(tick);
 }
 function setOrientation(value){
  orientation=value==='portrait'?'portrait':'landscape';manual=null;
  canvas.width=orientation==='portrait'?720:1280;canvas.height=orientation==='portrait'?1280:720;draw();
 }
 setOrientation(orientation);
 const stream=canvas.captureStream(frameRate);
 frame=requestAnimationFrame(tick);
 return {stream,setOrientation,
  rotate(){if(stopped)return;manual=(rotation+90)%360;draw();},
  reset(){if(stopped)return;manual=null;draw();},
  stop(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);stream.getTracks().forEach(track=>track.stop());},
 };
}
