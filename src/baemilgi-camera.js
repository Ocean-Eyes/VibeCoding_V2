export function cameraConstraints(camera='auto',orientation='landscape'){
 const source=camera==='auto'?{facingMode:{ideal:'environment'}}:camera==='user'?{facingMode:{ideal:'user'}}:{deviceId:{exact:camera}};
 const portrait=orientation==='portrait';
 return {video:{...source,width:{ideal:portrait?720:1280},height:{ideal:portrait?1280:720},aspectRatio:{ideal:portrait?9/16:16/9},frameRate:{ideal:30,max:30},resizeMode:{ideal:'none'}},audio:false};
}
export async function listCameras(mediaDevices=navigator.mediaDevices){
 try{return (await mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput'&&device.deviceId);}catch{return [];}
}
export function preferredWideCamera(devices){
 // Labels are hints, not a portable lens API. Unknown lenses remain selectable.
 const rank=device=>{
  if(device.kind!=='videoinput'||!device.deviceId||/front|facetime|user|전면|앞면|前置|前面/i.test(device.label))return 0;
  if(/ultra[\s_-]*wide|초\s*광각|超広角|超广角|0[.,]5\s*[x×배]/i.test(device.label))return 2;
  return /\bwide\b|광각|広角|广角/i.test(device.label)?1:0;
 };
 return devices.filter(device=>rank(device)>0).sort((a,b)=>rank(b)-rank(a))[0]??null;
}
export async function minimizeCameraZoom(track){
 try{
  const min=track.getCapabilities?.().zoom?.min;
  if(!Number.isFinite(min)||min<0||!track.applyConstraints)return;
  const constraints=track.getConstraints?.()??{};
  await track.applyConstraints({...constraints,advanced:[...(constraints.advanced??[]),{zoom:min}]});
 }catch{/* Optional zoom control must not prevent a camera challenge. */}
}
