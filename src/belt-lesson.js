import {BELT_STEPS,BELT_SOURCE,beltPose,beltAnchor,drawGhostBelt} from './belt-geometry.js';
import {drawOpponent} from './opponent.js';
const $=id=>document.getElementById(id);
let open=false,step=0,progress=0,playing=true,last=0,raf=0,stream=null,cameraPending=false,generation=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function select(index,animate=false){step=Math.max(0,Math.min(BELT_STEPS.length-1,index));progress=animate?0:1;playing=animate;update()}
function update(){
 const item=BELT_STEPS[step];$('belt-step-number').textContent=`${String(step+1).padStart(2,'0')} / 07`;$('belt-step-title').textContent=item.title;$('belt-cue').textContent=item.cue;$('belt-focus').textContent=item.focus;
 $('belt-play').textContent=playing?'일시 정지 Ⅱ':'이 단계 시연 ▶';$('belt-prev').disabled=step===0;$('belt-next').disabled=step===BELT_STEPS.length-1;
 document.querySelectorAll('[data-belt-step]').forEach((b,i)=>{b.classList.toggle('selected',i===step);b.setAttribute('aria-current',i===step?'step':'false')});
 $('belt-camera').textContent=cameraPending?'카메라 연결 중…':stream?'카메라 끄기':'카메라로 따라 하기';$('belt-camera').disabled=cameraPending;
 $('belt-alignment').hidden=!stream;$('belt-view-label').textContent=stream?'CAMERA · GHOST BELT':'DEMONSTRATION · GHOST BELT';
}
function stopCamera(){generation++;cameraPending=false;stream?.getTracks().forEach(t=>t.stop());stream=null;$('belt-video').srcObject=null;$('belt-video').hidden=true;update()}
async function toggleCamera(){
 if(stream||cameraPending){stopCamera();return}
 const token=++generation;cameraPending=true;update();$('belt-notice').textContent='카메라 권한을 허용해 주세요.';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unavailable');
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
  if(token!==generation||!open){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;const video=$('belt-video');video.srcObject=stream;await video.play();
  if(token!==generation||!open)return;
  video.hidden=false;cameraPending=false;stream.getVideoTracks()[0].addEventListener('ended',()=>{if(token===generation){stopCamera();$('belt-notice').textContent='카메라 연결이 끝났습니다. 시연은 계속 볼 수 있습니다.'}});
  $('belt-notice').textContent='가이드가 배꼽 높이에 오도록 높이와 크기를 맞추세요. 단계는 직접 넘길 수 있습니다.';update();
 }catch(error){if(token!==generation)return;stopCamera();$('belt-notice').textContent=error.name==='NotAllowedError'?'카메라 권한이 거부됐습니다. 시연을 보거나 권한 허용 후 다시 연결하세요.':'카메라를 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.'}
}
function surface(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr)}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);return {ctx,w:rect.width,h:rect.height}}
function draw(now){
 if(!open)return;
 const dt=Math.min(.08,(now-last)/1000||0);last=now;
 if(playing){progress+=dt/4;if(progress>=1.4){if(step<BELT_STEPS.length-1){step++;progress=0}else{progress=1;playing=false}update()}}
 const pose=beltPose(step,progress),{ctx,w,h}=surface($('belt-canvas'));let anchor;
 if(stream){anchor=beltAnchor(w,h,Number($('belt-height').value),Number($('belt-width').value));$('belt-video').style.transform=$('belt-mirror').checked?'scaleX(-1)':'none'}
 else{const frame={origin:{x:w/2,y:h*.24},scale:Math.min(w/2.7,h/2.75),x:{x:1,y:0},y:{x:0,y:1}};drawOpponent(ctx,frame,null,{belt:false});anchor={x:w/2,y:frame.origin.y+frame.scale*1.13,scale:frame.scale}}
 drawGhostBelt(ctx,anchor,pose,{mirror:!stream||$('belt-mirror').checked});
 $('belt-canvas').dataset.step=String(step);$('belt-canvas').dataset.mode=stream?'camera':'demo';$('belt-canvas').dataset.anchor=JSON.stringify(anchor);
 const detail=surface($('belt-detail'));drawGhostBelt(detail.ctx,{x:detail.w/2,y:detail.h*.44,scale:Math.min(detail.w/2.2,detail.h/1.5)},pose,{opacity:1});
 $('belt-progress').value=Math.min(1,progress);raf=requestAnimationFrame(draw);
}
BELT_STEPS.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.dataset.beltStep=String(i);b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${item.title}`;b.onclick=()=>select(i);$('belt-steps').append(b)});
$('belt-source').href=BELT_SOURCE;$('belt-play').onclick=()=>{if(playing)playing=false;else{progress=0;playing=true}update()};
$('belt-prev').onclick=()=>select(step-1);$('belt-next').onclick=()=>select(step+1);$('belt-restart').onclick=()=>select(0,!reduced.matches);$('belt-camera').onclick=()=>void toggleCamera();
$('belt-align-reset').onclick=()=>{$('belt-height').value='58';$('belt-width').value='32'};
export function openBeltLesson(){cancelAnimationFrame(raf);open=true;step=0;progress=reduced.matches?1:0;playing=!reduced.matches;last=performance.now();$('belt-notice').textContent='A·B는 양끝을 구분하는 표시입니다. 점선은 몸 뒤쪽 경로를 나타냅니다.';update();raf=requestAnimationFrame(draw)}
export function closeBeltLesson(){open=false;cancelAnimationFrame(raf);stopCamera()}
document.addEventListener('judo-exit',closeBeltLesson);window.addEventListener('pagehide',closeBeltLesson);
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;if(open)update()}});
