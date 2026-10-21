const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const DETAIL_CAMERA={yaw:.72,pitch:-.38,panX:0,panY:0,zoom:1};
// Camera is above the waist on the wearer's side, looking down and forward.
// The wearer's right appears on screen-right, opposite the external front view.
export const FIRST_PERSON_CAMERA={yaw:Math.PI,pitch:-2,target:[0,.03,.04],distance:1.55};
export function cameraRotation(yaw=0,pitch=0){
 const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);
 return [c,b*s,-a*s,0,a,b,s,-b*c,a*c];
}
export function cameraPoint(point,{yaw=0,pitch=0,target=[0,0,0],distance=0}={}){
 const m=cameraRotation(yaw,pitch),p=point.map((v,i)=>v-target[i]);
 const q=[0,1,2].map(i=>m[i]*p[0]+m[i+3]*p[1]+m[i+6]*p[2]),depth=distance-q[2];
 return {position:distance?[q[0]*distance/depth,q[1]*distance/depth,q[2]]:q,visible:!distance||depth>.05,depth};
}

export function createDetailCamera(canvas,isEnabled,touchRotates=()=>false){
 const state={...DETAIL_CAMERA};let drag=null;
 const end=()=>{const old=drag;drag=null;canvas.removeAttribute('data-dragging');if(old&&canvas.hasPointerCapture(old.id))canvas.releasePointerCapture(old.id)};
 canvas.addEventListener('pointerdown',e=>{
  if(!isEnabled()||drag||![0,2].includes(e.button))return;
  const button=e.pointerType==='touch'&&touchRotates()?2:e.button;
  e.preventDefault();drag={id:e.pointerId,button,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.dataset.dragging=button===2?'rotate':'pan';canvas.focus({preventScroll:true});
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;if(!isEnabled()){end();return}
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.button===2){state.yaw=(state.yaw+dx*.012)%(Math.PI*2);state.pitch=clamp(state.pitch+dy*.012,-Math.PI/2,Math.PI/2)}
  else{const r=canvas.getBoundingClientRect();state.panX+=dx/Math.max(1,r.width);state.panY+=dy/Math.max(1,r.height)}
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)end()});
 canvas.addEventListener('contextmenu',e=>{if(isEnabled())e.preventDefault()});
 canvas.addEventListener('wheel',e=>{
  if(!isEnabled())return;
  e.preventDefault();
  const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;
  // Requested direction: wheel down enlarges, wheel up reduces.
  state.zoom=clamp(state.zoom*Math.exp(clamp(e.deltaY*unit*.0015,-4,4)),.25,4);
 },{passive:false});
 canvas.addEventListener('keydown',e=>{
  if(!isEnabled())return;
  if(e.key==='Home'){e.preventDefault();reset();return}
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction)return;e.preventDefault();
  if(e.shiftKey){state.panX+=direction[0]*.04;state.panY+=direction[1]*.04}
  else{state.yaw+=direction[0]*.12;state.pitch=clamp(state.pitch+direction[1]*.12,-Math.PI/2,Math.PI/2)}
 });
 window.addEventListener('blur',end);
 function reset(){end();Object.assign(state,DETAIL_CAMERA)}
 return {state,reset,cancel:end};
}
