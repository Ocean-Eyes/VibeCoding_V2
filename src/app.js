import {CollarInteraction,GRIP_PASS_SCORE,GRIP_HOLD_SECONDS} from './collar-interaction.js';
import {LandmarkStream,HandStream,HandIdentityTracker,GripProjection,projectHand,palmFacing,poseConfirmsHand} from './live-hands.js';
import {drawLiveGlove} from './live-glove.js';
import {selectGlove,hideCollarThumb,gloveElbow} from './glove-display.js';
import {prepareHands} from './hand-renderer.js';
import {drawOpponent,drawGripStudy,drawGripGuides,drawCollarTargets} from './opponent.js';
import {GRIP_STEPS,opponentFrame,demonstrationAt,practiceGuide,finishAt} from './demonstration.js';
import {TECHNIQUES} from './curriculum.js';
import {POSES,BONES,HAND_BONES,bodyFrame} from './pose.js';
await prepareHands();
const collar=new CollarInteraction();
let gripState=collar.update([null,null],performance.now());
const gripProjection=new GripProjection();
const poseStream=new LandmarkStream(),handStreams=[new HandStream(),new HandStream()];
const handIdentity=new HandIdentityTracker();
let consumedRecovery=[0,0];
function resetTrackingDisplay(){consumedRecovery=[0,0];gripProjection.reset();collar.reset();gripState=collar.update([null,null],performance.now());poseStream.reset();handStreams.forEach(s=>s.reset());handIdentity.reset()}
const pixel=p=>p?{...p,x:p.x*video.videoWidth,y:p.y*video.videoHeight,z:(p.z??0)*video.videoWidth}:null;
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const cyan='#80baff',partner=$('partner'),partnerCtx=partner.getContext('2d');
let demonstrating=true,demoStarted=performance.now(),demoStep=-1,guideStarted=performance.now();
let mode='idle',worker=null,stream=null,ready=false,busy=false,generation=0,lastVideo=-1,lastSent=0,lastResult=0,lastTick=performance.now();
let selected=0,running=false,countdown=0,elapsed=0,hold=0,completed=new Set(),score=null;
let armScore=null,fps=0,viewWidth=0,viewHeight=0,initTimer=null,frameTimer=null;
let trackerGeneration=0,activeTechnique=TECHNIQUES[0],autoStart=false,tapUntil=0;
const notify=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error)};
function line(context,a,b,color,width=3,dash=[]){if(!a||!b)return;context.beginPath();context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.setLineDash(dash);context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();context.setLineDash([])}
function circle(context,p,r,color,fill=true){if(!p)return;context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fillStyle=color;context.strokeStyle=color;context.lineWidth=2;fill?context.fill():context.stroke()}
function skeleton(context,p,color,width=3){for(const[a,b]of BONES){if(p[a]&&p[b]&&(p[a].visibility??1)>=.65&&(p[b].visibility??1)>=.65)line(context,p[a],p[b],color,width)}for(const i of[11,12,13,14,15,16,23,24])if(p[i]&&(p[i].visibility??1)>=.65)circle(context,p[i],width*1.25,color)}
function preview(canvas,index){const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;context.clearRect(0,0,w,h);const frame=opponentFrame(w,h);drawOpponent(context,frame);drawGripGuides(context,frame,GRIP_STEPS[index],activeTechnique.directions,true,null,{finish:index===2?1:0})}
function updatePose(index=selected){
  const p=POSES[index];$('step-label').textContent=`0${index+1} / 03`;$('pose-number').textContent=`0${index+1}`;$('pose-name').textContent=p.name;$('pose-description').textContent=activeTechnique.cues[index];$('gesture-label').textContent=['왼손으로 반대편 위쪽 깃 잡기','오른손도 교차해 반대편 깃 잡기','그립 유지 · 교차한 양 전완 비틀기'][index];preview($('preview'),index);
  document.querySelectorAll('.pose-card').forEach((button,i)=>{preview(button.querySelector('canvas'),i);button.classList.toggle('selected',i===index);button.setAttribute('aria-pressed',String(i===index));button.querySelector('.completion').textContent=completed.has(i)?'✓':''});
}
POSES.forEach((p,i)=>{const button=document.createElement('button');button.className='pose-card';button.innerHTML=`<canvas width="140" height="110" aria-hidden="true"></canvas><span class="card-copy"><small>STEP 0${i+1}</small><strong>${p.name}</strong><span>${p.short}</span></span><span class="completion" aria-label="완료 여부"></span>`;button.onclick=()=>choose(i);$('pose-list').append(button);preview(button.querySelector('canvas'),i)});
function choose(index){collar.reset();demonstrating=false;guideStarted=performance.now();tapUntil=0;selected=(index+POSES.length)%POSES.length;hold=0;score=armScore=null;updatePose();controls()}
function controls(){const active=mode==='live';$('welcome').hidden=mode!=='idle';$('start').disabled=mode==='loading';$('play').disabled=mode==='loading'||mode==='preview';$('reset').disabled=!active;$('stop').disabled=mode==='idle';$('play').innerHTML=running?'일시 정지 <span>Ⅱ</span>':'내 동작 연습 <span>▶</span>';$('stop').textContent='카메라 끄기';$('status-dot').classList.toggle('active',!!stream);$('status').textContent={idle:demonstrating?'동작 시연 중':'카메라 대기 중',loading:'자세 추적 준비 중',preview:'카메라 켜짐 · 자세 추적 중단',live:'카메라 연결됨'}[mode];$('mode-label').textContent=demonstrating?'동작 시연 · 12초 반복':{idle:'카메라 대기',loading:'CONNECTING',preview:'추적 재연결 필요',live:'LIVE · 깃 위치 · 교차 동작'}[mode];$('demo').setAttribute('aria-pressed',String(demonstrating));}
function clearScore(){
  score=armScore=null;
  for(const id of ['score','arm-score','hand-score','live-score-value'])$(id).textContent='—';
  $('live-score').dataset.level='waiting';$('live-hold').textContent='몸을 인식하면 점수가 표시됩니다';
}
function stop(){
  resetTrackingDisplay();
  clearScore();
  tapUntil=0;autoStart=false;
  generation++;trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.hidden=true;ready=busy=running=false;mode='idle';lastResult=0;lastVideo=-1;elapsed=hold=countdown=0;score=armScore=null;$('countdown').hidden=true;$('retry-tracking').hidden=true;ctx.clearRect(0,0,canvas.width,canvas.height);controls();updatePose();
}
function fail(message){stop();notify(message,true)}
function trackingFailed(message){resetTrackingDisplay();clearScore();autoStart=false;tapUntil=0;
  trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;
  ready=busy=running=false;lastResult=0;hold=countdown=0;score=armScore=null;
  mode=stream?'preview':'idle';$('countdown').hidden=true;$('retry-tracking').hidden=!stream;controls();
  notify(`${message} 카메라 영상은 유지됩니다. 아래 버튼으로 자세 추적을 다시 연결해 주세요.`,true);
}
function connectTracker(){
  resetTrackingDisplay();
  const session=generation,attempt=++trackerGeneration;
  clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();ready=busy=false;lastVideo=-1;lastResult=0;
  mode='loading';$('retry-tracking').hidden=true;controls();notify('카메라가 연결되었습니다. 자세 추적 모델을 준비하고 있습니다.');
  initTimer=setTimeout(()=>{if(session===generation&&attempt===trackerGeneration)trackingFailed('추적 모델 연결 시간이 초과되었습니다.')},90000);
  try{
    worker=new Worker(new URL('./tracker.js',import.meta.url));
    worker.onerror=e=>{if(session===generation&&attempt===trackerGeneration)trackingFailed(`추적 모듈 오류: ${e.message||'Worker 실행 실패'}`)};
    worker.onmessage=({data})=>{
      if(session!==generation||attempt!==trackerGeneration)return;
      if(data.type==='ready'){clearTimeout(initTimer);ready=true;mode='live';if(autoStart){autoStart=false;running=true;countdown=3;$('countdown').hidden=false;}controls();notify('손가락을 굽힌 채 손목을 교차해 반대편 깃을 잡으세요. 목 가까운 깃을 잡고 교차한 손목과 전완을 함께 비틀어 보세요. 손가락이 가려져도 손목이 보이면 추적을 이어갑니다.');}
      if(data.type==='error')trackingFailed(data.message);
      if(data.type==='result'){
        clearTimeout(frameTimer);busy=false;const now=performance.now();fps=lastResult?1000/(now-lastResult):0;lastResult=now;
        poseStream.update(data.points,now);
        const assignedHands=handIdentity.update(data.hands,data.points,now,{held:collar.hands.map(h=>!!h.grip),stalled:handStreams.map(s=>s.lastSeen!==null&&now-s.lastSeen>450)});
        assignedHands.forEach((h,i)=>handStreams[i].update(h,now,{reacquire:!collar.hands[i].grip,held:!!collar.hands[i].grip,poseConfirmed:poseConfirmsHand(h,data.points,i)}));
        canvas.dataset.detectedHands=String(data.hands?.length??0);canvas.dataset.assignedHands=String(assignedHands.filter(Boolean).length);
      }
    };worker.postMessage({type:'init'});
  }catch(e){trackingFailed(`추적 모듈을 시작하지 못했습니다: ${e.message}`)}
}
async function start(){
  demonstrating=false;guideStarted=performance.now();stop();autoStart=true;const session=generation;mode='loading';controls();notify('카메라 권한을 허용해 주세요. 첫 연결 시 추적 모델을 다운로드합니다.');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){fail('카메라는 HTTPS 또는 localhost에서 사용할 수 있습니다. 로컬 실행 안내를 확인해 주세요.');return}
  initTimer=setTimeout(()=>{if(session===generation)fail('연결 시간이 초과되었습니다. 카메라 권한과 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')},90000);
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user',frameRate:{ideal:30,max:30}},audio:false});
    if(session!==generation){acquired.getTracks().forEach(t=>t.stop());return}
    stream=acquired;stream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===generation)fail('카메라 연결이 끊겼습니다. 카메라를 확인하고 다시 연결해 주세요.')});video.srcObject=stream;await video.play();if(session!==generation)return;video.hidden=false;
    connectTracker();
  }catch(e){if(session!==generation)return;const message={NotAllowedError:'카메라 권한이 거부되었습니다. 브라우저 주소창의 사이트 권한에서 카메라를 허용해 주세요.',NotFoundError:'연결된 웹캠이 없습니다. 웹캠을 연결한 뒤 다시 시도해 주세요.',NotReadableError:'카메라를 사용할 수 없습니다. 다른 앱의 카메라 사용을 종료하고 다시 시도해 주세요.'}[e.name]??`카메라 연결에 실패했습니다: ${e.message}`;fail(message)}
}
async function sendFrame(now){
  if(!ready||busy||video.readyState<2||video.currentTime===lastVideo||now-lastSent<65)return;
  busy=true;lastVideo=video.currentTime;lastSent=now;const session=generation,attempt=trackerGeneration;
  try{const bitmap=await createImageBitmap(video);if(session!==generation||attempt!==trackerGeneration){bitmap.close();return}worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);frameTimer=setTimeout(()=>{if(session===generation&&attempt===trackerGeneration)trackingFailed('추적 응답이 지연되었습니다.')},15000)}catch(e){if(session===generation&&attempt===trackerGeneration)trackingFailed(`영상 프레임을 처리하지 못했습니다: ${e.message}`)}
}
function draw(now){
  const box=$('viewport').getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),scene=opponentFrame(box.width,box.height);
  if(viewWidth!==box.width||viewHeight!==box.height||canvas.width!==Math.round(box.width*dpr)){
    viewWidth=box.width;viewHeight=box.height;canvas.width=partner.width=Math.round(box.width*dpr);canvas.height=partner.height=Math.round(box.height*dpr);
    partner.dataset.frame=JSON.stringify(scene);
  }
  const mirrored=$('mirror').checked,fresh=mode==='live'&&now-lastResult<250;
  const shown=fresh?poseStream.at(now)?.map(pixel):null,body=bodyFrame(shown),frame=gripProjection.resolve(body,collar.hands.some(h=>h.grip)),unit={origin:{x:0,y:0},scale:1};
  const projectedHands=method=>handStreams.map(s=>{
    const raw=fresh&&frame?s[method](now)?.map(pixel):null;return raw?projectHand(raw,frame,unit,mirrored):null;
  });
  const observations=projectedHands('trackedAt'),displayHands=projectedHands('at');
  const recoveredHands=observations.map((h,i)=>{if(!h||consumedRecovery[i]===handStreams[i].recoveryRevision)return false;consumedRecovery[i]=handStreams[i].recoveryRevision;return true});
  const arms=[0,1].map(i=>{
    if(!frame)return null;
    const joint=k=>{const p=shown?.[k];return p&&(k>=15||(p.visibility??1)>=.65)?{...projectHand([p],frame,unit,mirrored)[0],visibility:p.visibility??1}:null};
    return {shoulder:joint(11+i),elbow:joint(13+i),wrist:joint(15+i)};
  });
  if(mode==='live'&&!demonstrating){
    gripState=collar.update(observations,now,{active:running&&countdown===0,mirrored,directions:activeTechnique.directions,arms,bodyVisible:!!body,continuousHands:observations.map(Boolean),recoveredHands,poseSampleTime:poseStream.time});
    const phase=Math.min(2,gripState.count);
    if(selected!==phase){selected=phase;updatePose()}
  }
  const state=mode==='live'&&!demonstrating?{...gripState,time:now}:null;
  const gloves=displayHands.map((hand,i)=>selectGlove(observations[i],hand,state?.wristHands[i]));
  gloves.forEach((glove,i)=>displayHands[i]=glove.hand);
  canvas.dataset.gloveSources=JSON.stringify(gloves.map(g=>g.source));
  canvas.dataset.wristHands=String(state?.wristHands.filter(Boolean).length??0);canvas.dataset.wristStatus=JSON.stringify(state?.wristStatus??[]);
  partnerCtx.setTransform(dpr,0,0,dpr,0,0);partnerCtx.clearRect(0,0,box.width,box.height);drawOpponent(partnerCtx,scene,state);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
  canvas.dataset.aligned=String(!!frame);canvas.dataset.skeleton=String($('show-skeleton').checked);
  canvas.dataset.displayWrists=JSON.stringify(displayHands.map(h=>h?.[0]??null));
  canvas.dataset.liveHands=String(state?.visible??0);canvas.dataset.grabbed=String(state?.count??0);
  canvas.dataset.completion=String(state?.completion??0);canvas.dataset.elbows=JSON.stringify(state?.elbowLevels??[]);canvas.dataset.forearms=JSON.stringify(state?.forearmLevels??[]);canvas.dataset.grips=JSON.stringify(state?.grips??[]);
  score=state&&(state.visible||state.count)?state.score:null;armScore=state?.count===2&&!state.trackingPaused?Math.round(state.completion*100):null;
  hold=state?.hold??0;
  canvas.dataset.displayElbows=JSON.stringify(displayHands.map((h,i)=>gloveElbow(h,arms[i])));
  canvas.dataset.guideVisible=String(demonstrating||mode==='idle');
  let instruction;
  if(demonstrating){
    instruction=demonstrationAt((now-demoStarted)/1000,activeTechnique);
    if(demoStep!==instruction.step){demoStep=instruction.step;updatePose(demoStep)}
    drawGripGuides(ctx,scene,instruction.hands,activeTechnique.directions,mirrored,null,{actions:activeTechnique.actions,finish:instruction.finish});
  }else if(state){
    drawCollarTargets(ctx,scene,state);
    const live=displayHands.map((h,i)=>{
      if(!h)return null;
      const hand=h.map(p=>({...p,x:scene.origin.x+p.x*scene.scale,y:scene.origin.y+p.y*scene.scale}));
      const e=gloveElbow(h,arms[i]),elbow=e?{x:scene.origin.x+e.x*scene.scale,y:scene.origin.y+e.y*scene.scale}:null;
      return {hand,elbow,index:i,thumbInside:hideCollarThumb(h,!!state.grips[i]&&activeTechnique.directions[i]==='↓'),depth:shown?.[15+i]?.z??0};
    }).filter(Boolean).sort((a,b)=>b.depth-a.depth);
    for(const h of live)drawLiveGlove(ctx,h.hand,palmFacing(h.hand,h.index===0,mirrored),h.elbow,h.thumbInside,.78*(gloves[h.index].source==='wrist'?state.wristOpacity[h.index]:handStreams[h.index].opacityAt(now)));
    if($('show-skeleton').checked&&frame&&shown){
      const projected=shown.map(p=>p?projectHand([p],frame,scene,mirrored)[0]:null);skeleton(ctx,projected,cyan,1.5);
      for(const h of live)for(const [a,b]of HAND_BONES)line(ctx,h.hand[a],h.hand[b],cyan,1);
    }
  }else if(mode==='idle')drawGripGuides(ctx,scene,practiceGuide(selected,(now-guideStarted)/1000),activeTechnique.directions,mirrored,GRIP_STEPS[selected],{finish:selected===2?finishAt(((now-guideStarted)/1000)%4):0});
  const feedback=demonstrating?`깃 안쪽: ${activeTechnique.directions.map((d,i)=>`${i?'오른손':'왼손'} ${d==='↑'?'네 손가락':'엄지'}`).join(' · ')}`:
    state?.trackingPaused?(state.scoringWrists.every(Boolean)?'깃은 잡고 있습니다. 교차한 손목이나 팔꿈치의 움직임을 확인 중입니다.':`깃은 잡고 있습니다. ${state.wristStatus.map((s,i)=>s==='tracked'?null:`${i?'오른':'왼'} 손목 ${s==='recovering'||s==='ambiguous'?'다시 찾는 중':'인식 대기'}`).filter(Boolean).join(' · ')}. 손목을 카메라 안에 잠깐 보여 주세요.`):!state?.visible&&!state?.count?'양손과 어깨가 보이도록 서 주세요.':state.tapped?'TAP! 손을 펴서 깃을 놓으세요.':
    state.posture?.some(p=>p==='palm'||p==='turn')?`카메라에 왼손 ${activeTechnique.directions[0]==='↓'?'손바닥':'손등'}, 오른손 ${activeTechnique.directions[1]==='↓'?'손바닥':'손등'}이 보이게 해 주세요.`:state.posture?.some(Boolean)?'각 손으로 반대편 깃을 잡으세요.':
    state.count===0?'손가락을 굽히고 손목을 교차해 반대편 깃을 잡으세요.':state.count===1?'한쪽 깃이 잡혔습니다. 다른 손으로 반대쪽 깃을 잡으세요.':
    !state.crossed?'손을 교차해 각각 반대편 깃을 잡으세요.':state.issue==='height'?'가슴 아래쪽이 아닌 목 가까운 위쪽 깃을 잡으세요.':state.issue==='spread'?'손을 멀리 벌리지 말고 잡은 위치 가까이에 유지하세요.':state.issue==='lift'?'깃 가까이에서 교차한 양 손목과 전완을 함께 비틀어 보세요.':'교차한 양팔의 마무리 자세를 잠깐 유지하세요.';
  $('tracking-label').textContent=demonstrating?'시연 중':gloves.some(g=>g.source==='wrist')?`${state.count}개 깃 잡힘 · 손목으로 추적 중`:state?.visible?`${state.visible}개 손 인식 · ${state.count}개 깃 잡힘`:state?.count?`${state.count}개 그립 유지 · ${state.trackingPaused?'관절 인식 대기':'팔 동작 인식'}`:stream?'인식 대기':'대기';
  $('feedback').textContent=feedback;$('live-feedback').textContent=feedback;
  $('live-score-value').textContent=score??'—';$('live-score').dataset.level=score===null?'waiting':score>=GRIP_PASS_SCORE?'good':score>=25?'near':'adjust';
  $('live-score-label').textContent=demonstrating?'시연 · 채점 안 함':'깃 위치·교차 동작 / 100';
  $('live-hold').textContent=demonstrating?'연습 버튼을 누르면 채점합니다':state?.count===2?`왼 동작 ${Math.round(state.finishLevels[0]*100)}% · 오른 동작 ${Math.round(state.finishLevels[1]*100)}% · 유지 ${hold.toFixed(1)} / ${GRIP_HOLD_SECONDS}초`:'목 가까운 깃 잡기 → 교차한 손목·전완 비틀기';
  $('opponent-status').dataset.tap=String(!!tapUntil||!!state?.tapped);
  $('opponent-status').textContent=tapUntil||state?.tapped?'TAP! · 손을 펴서 놓기':demonstrating?instruction.label:state?.trackingPaused?'깃 잡기 유지 · 관절 인식 대기':state?.count===2?`양쪽 깃 잡힘 · 동작 일치 ${Math.round(state.completion*100)}%`:state?.count===1?'한쪽 깃 잡힘':'깃 위에서 손을 쥐세요';
}

function tick(now){
  const dt=Math.min((now-lastTick)/1000,.2);lastTick=now;
  if(mode==='live')void sendFrame(now);
  if($('practice-screen').hidden){requestAnimationFrame(tick);return}
  video.style.transform=$('mirror').checked?'scaleX(-1)':'none';draw(now);
  if(running&&countdown>0){countdown=Math.max(0,countdown-dt);$('countdown').textContent=Math.ceil(countdown)||'GO';$('countdown').hidden=countdown===0}
  else if(running){
    elapsed+=dt;
    if(gripState.tapped&&!tapUntil){
      completed=new Set([0,1,2]);running=false;tapUntil=now+1500;controls();updatePose();notify('깃 위치와 손목·팔꿈치 동작 미션을 완료해 가상 상대가 탭했습니다. 손을 펴서 놓으세요.');
    }
  }
  if(tapUntil&&now>=tapUntil){tapUntil=0;hold=0;document.dispatchEvent(new CustomEvent('judo-complete',{detail:{demo:false}}));}
  $('score').textContent=score??'—';$('arm-score').textContent=armScore===null?'—':`${armScore}%`;$('hand-score').textContent=mode==='live'?`${gripState.count} / 2`:'—';
  $('score-verdict').textContent=score===null?'측정 가능한 자세를 기다려요':score>=GRIP_PASS_SCORE?'깃 위치·교차 유지':score>=25?'위쪽 깃을 잡고 교차한 양팔을 비트세요':'깃 위에서 손을 쥐세요';
  $('hold-text').textContent=`${hold.toFixed(1)} / ${GRIP_HOLD_SECONDS}초`;$('hold-progress').style.width=`${hold/GRIP_HOLD_SECONDS*100}%`;
  $('timer').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('fps').textContent=mode==='live'?`${Math.round(fps)} FPS · RGB CAMERA / 2D`:'RGB CAMERA / 2D';
  $('stage-hint').textContent=demonstrating?'흰색 손: 시연 · 상대는 고정됩니다':countdown?'잠시 후 시작합니다':mode==='live'?'흰색 장갑: 내 손 · 쥐면 잡기 · 펴면 놓기':'내 동작 연습을 누르세요';requestAnimationFrame(tick);
}
$('start').onclick=start;
$('demo').onclick=()=>{stop();demonstrating=true;demoStarted=performance.now();demoStep=-1;controls();notify('흰색 손이 첫 깃 잡기 → 반대 깃 잡기 → 교차한 팔 비틀기 → 풀기를 반복합니다.')};
$('retry-tracking').onclick=()=>{if(stream)connectTracker()};
$('stop').onclick=()=>{stop();notify('연결을 종료했습니다. 카메라는 꺼져 있습니다.')};
function openVideo(){autoStart=false;running=false;hold=countdown=0;tapUntil=0;$('countdown').hidden=true;controls();$('video-title').textContent=activeTechnique.name;$('video-external').href=`https://www.youtube.com/watch?v=${activeTechnique.video}`;$('kodokan-player').src=`https://www.youtube-nocookie.com/embed/${activeTechnique.video}?rel=0`;$('video-dialog').showModal()}
$('video-shortcut').onclick=openVideo;
$('close-video').onclick=()=>$('video-dialog').close();$('video-dialog').addEventListener('close',()=>$('kodokan-player').removeAttribute('src'));
$('play').onclick=()=>{if(mode==='idle'){void start();return}demonstrating=false;updatePose();tapUntil=0;collar.reset();running=!running;hold=0;if(running){const done=completed;if(done.size===POSES.length){done.clear();updatePose()}countdown=3;$('countdown').hidden=false;notify('3초 뒤 시작합니다. 목 가까운 깃을 잡고 교차한 손목과 전완을 함께 비틀어 보세요.')}else{countdown=0;$('countdown').hidden=true;notify('일시 정지했습니다. 카메라 추적은 계속되며 유지 시간은 누적하지 않습니다.')}controls()};
$('reset').onclick=()=>{collar.reset();tapUntil=0;hold=0;elapsed=0;countdown=running?3:0;notify('현재 동작의 유지 시간과 연습 타이머를 초기화했습니다.')};
$('previous').onclick=()=>choose(selected-1);$('next').onclick=()=>choose(selected+1);
document.addEventListener('visibilitychange',()=>{if(document.hidden){collar.reset();autoStart=false;tapUntil=0;running=false;countdown=hold=0;$('countdown').hidden=true;controls()}});
window.addEventListener('pagehide',stop);updatePose();controls();requestAnimationFrame(tick);

document.addEventListener('judo-exit',stop);
document.addEventListener('judo-lesson',({detail})=>{activeTechnique=detail;const gripCanvas=$('grip-preview'),gripContext=gripCanvas.getContext('2d');drawGripStudy(gripContext,gripCanvas.width,gripCanvas.height,detail.directions);gripCanvas.setAttribute('aria-label',`${detail.name}: ${detail.detail}`);stop();completed.clear();selected=0;demonstrating=true;demoStarted=performance.now();demoStep=-1;updatePose();controls();notify('흰색 손의 시연을 확인한 뒤 내 동작 연습을 눌러 카메라를 연결하세요.');});
