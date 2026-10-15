import {tr} from './i18n.js';
import {BELT_STEPS,BELT_SOURCE,BELT_REFERENCE_2,sourcePTS,trackedPlacement} from './belt-sequence.js';
import {beltAnchor} from './belt-geometry.js';
import {loadBeltSource} from './belt-source.js';
import {sampleRenderFrame} from './belt-interpolation.js';
import {paperMotion} from './paper-motion.js';
import {drawPaperMotion} from './paper-scene.js';
import {drawPaperOpeningCue} from './paper-inspection.js';
import {sampleMarker,markerCandidates,newBeltTrack,updateBeltTrack,videoRect,videoToScreen,screenToVideo} from './belt-tracker.js';
import {createBeltTimeline} from './belt-timeline.js';

const $=id=>document.getElementById(id);
const setText=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text};
let open=false,step=0,progress=0,playing=true,raf=0,stream=null,cameraPending=false,generation=0;
let animation=null,animationToken=0,inspecting=false;
let source=null,sourceState='idle',sourceController=null,sourceToken=0,poseCache=null;
let detailView='front',mode='virtual',picking=null,colors=[null,null],tracks=[newBeltTrack(),newBeltTrack()],lastDetection=0;
const capture=document.createElement('canvas'),captureContext=capture.getContext('2d',{willReadFrequently:true});
function resetTracks(){tracks=[newBeltTrack(),newBeltTrack()];lastDetection=0}
function modeNotice(){return mode==='real'?tr('색 표시가 가려져도 단계는 유지됩니다. 매듭 안쪽과 등 뒤는 직접 확인한 뒤 다음을 누르세요.'):tr('시연을 보며 순서대로 따라 하세요. 띠를 넣는 틈은 아래 확대 화면에서 확인하세요.')}
function setMode(value){
 mode=value;picking=null;resetTracks();select(step,mode==='virtual'&&!reduced.matches);
 $('belt-notice').textContent=modeNotice();update();
}
function trackingUI(){
 const status={unregistered:tr('미등록'),searching:tr('찾는 중'),tracked:tr('추적 중'),occluded:tr('가림 · 잠시 유지')};
 for(let i=0;i<2;i++){
  const key=i?'b':'a';setText('belt-track-'+key,colors[i]?status[tracks[i].state==='unregistered'?'searching':tracks[i].state]:tr('미등록'));
  $('belt-swatch-'+key).style.background=colors[i]?`hsl(${colors[i].h} 75% 55%)`:'';
  $('belt-register-'+key).disabled=!stream;$('belt-register-'+key).setAttribute('aria-pressed',String(picking===i));
 }
 $('belt-pick-controls').hidden=picking===null;$('belt-canvas').dataset.picking=String(picking!==null);
 if(picking!==null)setText('belt-pick-prompt',tr`${picking?'B':'A'} 끝의 색 테이프를 영상에서 누르세요. 또는 화면 중앙의 십자에 맞추고 아래 버튼을 누르세요.`);
 const states=tracks.map(t=>t.state);
 setText('belt-tracking-status',!stream?tr('카메라를 켜면 색을 등록할 수 있습니다.'):colors.some(c=>!c)?tr('A·B 색을 등록하면 실제 양끝에 표시가 따라갑니다.'):states.every(s=>s==='tracked')?tr('양끝 추적 중 · 화살표는 현재 단계의 참고 경로입니다. 동작 후 다음을 눌러 주세요.'):states.includes('occluded')?tr('색 표시가 잠시 가려졌습니다. 단계를 유지하고 다시 보이면 이어갑니다.'):tr('색 표시를 찾고 있습니다. 양끝을 보여 주세요. 같은 색 물건이 배경에 있으면 치워 주세요.'));
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function select(index,animate=false){
 if(!source){step=Math.max(0,Math.min(6,index));update();return}
 animation?.timeline.cancel();const token=++animationToken;step=Math.max(0,Math.min(BELT_STEPS.length-1,index));progress=animate?0:1;playing=animate;inspecting=false;
 animation=createBeltTimeline({step,caption:document.querySelector('.belt-current'),reduced:reduced.matches,
  onUpdate:(value,hold)=>{if(token!==animationToken)return;progress=value;inspecting=hold},
  onComplete:()=>{if(token!==animationToken||!open)return;progress=1;playing=false;inspecting=false;if(mode==='virtual'&&step<6)select(step+1,true);else update()}});
 animation.timeline.speed=Number($('belt-speed').value);
 if(animate)animation.timeline.play();else animation.timeline.seek(animation.timeline.duration,true);
 update();
}
function pause(){playing=false;animation?.timeline.pause();update()}

function update(){
 const item=BELT_STEPS[step];$('belt-move').textContent=item.move;$('belt-source').href=`${BELT_SOURCE}&t=${item.reference[0]}s`;$('belt-source-2').href=`${BELT_REFERENCE_2}&t=${item.reference[1]}s`;
 $('belt-source').textContent=tr`참고 영상 1 · ${item.reference[0]}초 ↗`;$('belt-source-2').textContent=tr`참고 영상 2 · ${item.reference[1]}초 ↗`;$('belt-step-number').textContent=`${String(step+1).padStart(2,'0')} / 07`;$('belt-step-title').textContent=item.title;$('belt-cue').textContent=item.cue;$('belt-focus').textContent=(step>=3?tr('매듭 부분 확대 · '):'')+item.focus;
 $('belt-play').textContent=playing?tr('일시 정지 Ⅱ'):tr('이 단계 시연 ▶');$('belt-prev').disabled=step===0;$('belt-next').disabled=step===BELT_STEPS.length-1;
 document.querySelectorAll('[data-belt-step]').forEach((b,i)=>{b.classList.toggle('selected',i===step);b.setAttribute('aria-current',i===step?'step':'false')});
 $('belt-camera').textContent=cameraPending?tr('카메라 연결 중…'):stream?tr('카메라 끄기'):tr('카메라로 따라 하기');$('belt-camera').disabled=cameraPending||sourceState!=='ready';
 $('belt-alignment').hidden=!stream;$('belt-view-label').textContent=mode==='real'?tr('REAL BELT · 색 표시 추적'):stream?'CAMERA · GHOST BELT':'DEMONSTRATION · GHOST BELT';
 $('belt-mode-virtual').setAttribute('aria-pressed',String(mode==='virtual'));$('belt-mode-real').setAttribute('aria-pressed',String(mode==='real'));
 $('belt-tracking').hidden=mode!=='real';$('belt-real-empty').hidden=mode!=='real'||!!stream;
 $('belt-mode-description').textContent=mode==='real'?tr('실제 띠 양끝에 서로 다른 색 표시를 붙여 추적합니다. 옆 시연을 보고 한 단계씩 따라 하세요.'):tr('반투명 띠의 움직임을 보거나 카메라 위 가이드를 따라 해 보세요.');
 $('belt-mode-note').textContent=mode==='real'?tr('원은 실제 색 표시 위치, 옅은 띠는 목표 경로입니다. 가이드 높이·크기를 내 허리에 맞추세요. 등 뒤와 매듭 안쪽은 카메라로 확인할 수 없어 단계는 직접 넘깁니다.'):tr('카메라에서는 높이·크기를 조절해 가이드를 내 허리에 맞추세요. 매듭의 조임은 직접 확인하고, 단계는 버튼으로 넘깁니다.');
 trackingUI();
 const unavailable=sourceState!=='ready';
 for(const id of ['belt-play','belt-prev','belt-next','belt-restart','belt-scrub','belt-speed'])if(unavailable)$(id).disabled=true;
 if(!unavailable){for(const id of ['belt-play','belt-restart','belt-scrub','belt-speed'])$(id).disabled=false}
 document.querySelectorAll('[data-belt-step]').forEach(b=>b.disabled=unavailable);
 $('belt-retry').hidden=sourceState!=='error';
}
function stopCamera(){generation++;cameraPending=false;stream?.getTracks().forEach(t=>t.stop());stream=null;picking=null;resetTracks();$('belt-video').srcObject=null;$('belt-video').hidden=true;update()}
async function toggleCamera(){
 if(stream||cameraPending){stopCamera();return}
 const token=++generation;cameraPending=true;update();$('belt-notice').textContent=tr('카메라 권한을 허용해 주세요.');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unavailable');
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
  if(token!==generation||!open){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;const video=$('belt-video');video.srcObject=stream;await video.play();
  if(token!==generation||!open)return;
  video.hidden=false;cameraPending=false;stream.getVideoTracks()[0].addEventListener('ended',()=>{if(token===generation){stopCamera();$('belt-notice').textContent=tr('카메라 연결이 끝났습니다. 시연은 계속 볼 수 있습니다.')}});
  $('belt-notice').textContent=mode==='real'?tr('A 색 등록과 B 색 등록을 눌러 실제 띠 끝의 색 표시를 선택하세요.'):tr('가이드가 배꼽 높이에 오도록 높이와 크기를 맞추세요. 단계는 직접 넘길 수 있습니다.');update();
 }catch(error){if(token!==generation)return;stopCamera();$('belt-notice').textContent=error.name==='NotAllowedError'?tr('카메라 권한이 거부됐습니다. 시연을 보거나 권한 허용 후 다시 연결하세요.'):tr('카메라를 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.')}
}
function cameraFrame(){
 const video=$('belt-video');if(!stream||video.readyState<2||!video.videoWidth)return null;
 const width=320,height=Math.round(320*video.videoHeight/video.videoWidth);
 if(capture.width!==width||capture.height!==height){capture.width=width;capture.height=height}
 captureContext.drawImage(video,0,0,width,height);return captureContext.getImageData(0,0,width,height);
}
function registerAt(point){
 if(picking===null||!stream)return;
 const frame=cameraFrame();if(!frame)return;
 const result=sampleMarker(frame,point.x,point.y,colors[1-picking]);
 if(result.error){$('belt-notice').textContent=result.error;return}
 colors[picking]=result.color;tracks[picking]=newBeltTrack();picking=null;$('belt-notice').textContent=modeNotice();trackingUI();
}
function realOverlay(ctx,w,h,pose,anchor,now){
 const video=$('belt-video'),mirror=$('belt-mirror').checked,rect=videoRect(w,h,video.videoWidth||4,video.videoHeight||3);
 if(now-lastDetection>=80){
  const frame=cameraFrame();if(frame){const candidates=markerCandidates(frame,colors);tracks=tracks.map((t,i)=>updateBeltTrack(t,candidates[i],now,!!colors[i]));trackingUI()}
  lastDetection=now;
 }
 drawCharacter(ctx,anchor,pose,{mirror,opacity:.22,body:false,labels:false});
 for(let i=0;i<2;i++){
  const t=tracks[i];if(!t.point||!['tracked','occluded'].includes(t.state))continue;
  const p=videoToScreen(t.point,rect,mirror),key=i?'b':'a',end=pose.guideEnds[key.toUpperCase()]?.position,target=end?{x:anchor.x+end[0]*anchor.scale*(mirror?-1:1),y:anchor.y+end[1]*anchor.scale}:null;
  ctx.save();ctx.globalAlpha=t.state==='occluded'?.4:1;ctx.strokeStyle=i?'#ebcb93':'#a7dcef';ctx.fillStyle='#1b303be8';ctx.lineWidth=2;
  if(target&&t.state==='tracked'&&Math.hypot(target.x-p.x,target.y-p.y)>30){
   ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
   const a=Math.atan2(target.y-p.y,target.x-p.x);ctx.beginPath();ctx.moveTo(target.x-10*Math.cos(a-.45),target.y-10*Math.sin(a-.45));ctx.lineTo(target.x,target.y);ctx.lineTo(target.x-10*Math.cos(a+.45),target.y-10*Math.sin(a+.45));ctx.stroke();
  }
  ctx.beginPath();ctx.arc(p.x,p.y,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=i?'#ebcb93':'#a7dcef';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 14px sans-serif';ctx.fillText(i?'B':'A',p.x,p.y);ctx.restore();
 }
 if(picking!==null){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(w/2-14,h/2-14,28,28);ctx.beginPath();ctx.moveTo(w/2-22,h/2);ctx.lineTo(w/2+22,h/2);ctx.moveTo(w/2,h/2-22);ctx.lineTo(w/2,h/2+22);ctx.stroke();ctx.restore()}
 $('belt-canvas').dataset.tracks=tracks.map(t=>t.state).join(',');
}
function surface(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr)}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);return {ctx,w:rect.width,h:rect.height}}
// The paper renderer owns body/arm/panel occlusion and mirroring.
// The UI does not mirror a second time or add folds/clearance routes.
function drawCharacter(ctx,anchor,pose,{mirror=false,opacity=1,body=true,labels=true}={}){
 ctx.save();ctx.globalAlpha=opacity;drawPaperMotion(ctx,anchor,pose,{body,diagnostic:false,mirror,labels});ctx.restore();
}
function currentPose(){
 const time=sourcePTS(step,progress);if(poseCache?.requestedPTS===time)return poseCache;
 const sample=sampleRenderFrame(source,time);
 poseCache={...paperMotion(sample.frame),requestedPTS:time,frameIndex:sample.sourceFrame.frameIndex,originalPTS:sample.renderPTS,sourceOriginalPTS:sample.sourceFrame.originalPTS,nextSourcePTS:sample.nextFrame.originalPTS,interpolationAlpha:sample.alpha};return poseCache;
}
function draw(now){
 if(!open)return;
 const {ctx,w,h}=surface($('belt-canvas')),detail=surface($('belt-detail'));
 $('belt-canvas').dataset.sourceState=sourceState;
 if(!source){
  setText('belt-film-status',sourceState==='error'?tr('시연 불러오기 실패'):tr('시연 불러오는 중'));
  ctx.fillStyle='#e6e9e7';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText(sourceState==='error'?tr('다시 불러오기를 눌러 주세요.'):tr('띠와 손의 움직임을 불러오고 있습니다.'),w/2,h/2);
  raf=requestAnimationFrame(draw);return;
 }
 setText('belt-film-status',playing?(inspecting?tr('통과 지점 확인'):tr('동작 시연')):progress>=1?tr('단계 완료'):tr('동작 정지'));
 const pose=currentPose(),mirror=!!stream&&$('belt-mirror').checked;let anchor;
 document.querySelector('.belt-legend').hidden=true;
 if(stream){anchor=beltAnchor(w,h,Number($('belt-height').value),Number($('belt-width').value));$('belt-video').style.transform=mirror?'scaleX(-1)':'none'}
 else anchor=trackedPlacement(w,h,step,progress);
 const beltTransform=anchor;
 if(mode==='real'){if(stream)realOverlay(ctx,w,h,pose,beltTransform,now)}else drawCharacter(ctx,beltTransform,pose,{mirror,opacity:stream?.94:1,body:!stream});
 const canvas=$('belt-canvas');canvas.dataset.phase=String(Math.max(0,step-1)+progress*(step?1:0));canvas.dataset.pts=String(pose.originalPTS);canvas.dataset.frame=String(pose.frameIndex);canvas.dataset.sourcePts=String(pose.sourceOriginalPTS);canvas.dataset.nextSourcePts=String(pose.nextSourcePTS);canvas.dataset.interpolationAlpha=String(pose.interpolationAlpha);canvas.dataset.renderSource='paper-flat';canvas.dataset.lessonMode=mode;canvas.dataset.step=String(step);canvas.dataset.mode=stream?'camera':'demo';canvas.dataset.anchor=JSON.stringify(anchor);canvas.dataset.paperStrips=String(pose.strips.length);canvas.dataset.paperPanels=String(pose.strips.reduce((n,s)=>n+s.panels.length,0));canvas.dataset.rigHands=String(pose.rig.hands.length);canvas.dataset.guideEnds=JSON.stringify(pose.guideEnds);
 $('belt-detail').dataset.view='front';$('belt-detail').dataset.pts=String(pose.originalPTS);
 const knotCloseup=step>=3,detailScale=knotCloseup?Math.min(detail.w/.92,detail.h/.62):Math.min(detail.w/1.8,detail.h/1.05);
 const detailAnchor={x:detail.w/2-(knotCloseup?.035:0)*detailScale*(mirror?-1:1),y:knotCloseup?detail.h*.42:detail.h*.10,scale:detailScale};
 $('belt-detail').dataset.anchor=JSON.stringify(detailAnchor);$('belt-detail').dataset.crop=knotCloseup?'knot':'waist-and-ends';
 drawCharacter(detail.ctx,detailAnchor,pose,{opacity:1,mirror,body:false});
 drawPaperOpeningCue(detail.ctx,detailAnchor,pose,{mirror,step});
 $('belt-progress').value=Math.min(1,progress);$('belt-scrub').value=String(Math.round((animation?.timeline.progress??1)*100));raf=requestAnimationFrame(draw);
}
async function ensureSource(){
 const token=++sourceToken;sourceController?.abort();sourceController=new AbortController();sourceState='loading';playing=false;update();$('belt-notice').textContent=tr('시연을 불러오고 있습니다.');
 try{
  const loaded=await loadBeltSource({signal:sourceController.signal});if(token!==sourceToken||!open)return;
  source=loaded;sourceState='ready';poseCache=null;select(step,mode==='virtual'&&!reduced.matches);$('belt-notice').textContent=modeNotice();
 }catch(error){if(token!==sourceToken||!open||error.name==='AbortError')return;sourceState='error';$('belt-notice').textContent=tr('시연을 불러오지 못했습니다. 연결을 확인한 뒤 다시 불러오기를 눌러 주세요.');update()}
}
BELT_STEPS.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.dataset.beltStep=String(i);b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${item.title}`;b.onclick=()=>select(i);$('belt-steps').append(b)});
$('belt-play').onclick=()=>{if(playing)pause();else if(progress>=1)select(step,true);else{playing=true;animation.timeline.play();update()}};
$('belt-prev').onclick=()=>select(step-1);$('belt-next').onclick=()=>select(step+1);$('belt-restart').onclick=()=>select(0,mode==='virtual'&&!reduced.matches);$('belt-camera').onclick=()=>void toggleCamera();
$('belt-align-reset').onclick=()=>{$('belt-height').value='36';$('belt-width').value='14'};
$('belt-scrub').oninput=()=>{if(!animation)return;pause();animation.timeline.seek(animation.timeline.duration*Number($('belt-scrub').value)/100,true);progress=animation.head.value;inspecting=false;};
$('belt-retry').onclick=()=>void ensureSource();
$('belt-speed').onchange=()=>{if(animation)animation.timeline.speed=Number($('belt-speed').value)};
document.querySelectorAll('[data-belt-view]').forEach(b=>b.onclick=()=>{detailView=b.dataset.beltView;document.querySelectorAll('[data-belt-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
$('belt-mode-virtual').onclick=()=>setMode('virtual');$('belt-mode-real').onclick=()=>setMode('real');
for(const [i,key]of ['a','b'].entries())$('belt-register-'+key).onclick=()=>{picking=i;trackingUI()};
$('belt-pick-cancel').onclick=()=>{picking=null;trackingUI()};$('belt-sample-center').onclick=()=>registerAt({x:.5,y:.5});
$('belt-clear-colors').onclick=()=>{colors=[null,null];picking=null;resetTracks();trackingUI()};
$('belt-canvas').onclick=e=>{
 if(mode!=='real'||picking===null||!stream)return;
 const canvas=$('belt-canvas'),r=canvas.getBoundingClientRect(),video=$('belt-video'),rect=videoRect(r.width,r.height,video.videoWidth||4,video.videoHeight||3);
 const point=screenToVideo({x:e.clientX-r.left,y:e.clientY-r.top},rect,$('belt-mirror').checked);
 if(point)registerAt(point);else $('belt-notice').textContent=tr('검은 여백이 아닌 영상 속 색 표시를 선택하세요.');
};
export function openBeltLesson(){mode='virtual';picking=null;colors=[null,null];resetTracks();cancelAnimationFrame(raf);open=true;step=0;progress=reduced.matches?1:0;playing=false;poseCache=null;if(source){sourceState='ready';select(0,!reduced.matches);$('belt-notice').textContent=modeNotice()}else void ensureSource();update();raf=requestAnimationFrame(draw)}
export function closeBeltLesson(){open=false;sourceToken++;sourceController?.abort();animationToken++;animation?.timeline.cancel();cancelAnimationFrame(raf);stopCamera()}
document.addEventListener('judo-exit',closeBeltLesson);window.addEventListener('pagehide',closeBeltLesson);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&open)pause()});
