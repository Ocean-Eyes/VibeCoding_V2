import {language} from './i18n.js';
import {BaemilgiCounter,COUNTER_VERSION,measureBaemilgi} from './baemilgi-counter.js';
import {readRecords,saveRecord,validNickname,leaderboardRequest} from './baemilgi-records.js';
const t=(ko,en)=>language==='en'?en:ko;
const $=id=>document.getElementById(id);
const counter=new BaemilgiCounter();
let mounted=false,active=false,generation=0,stream,worker,raf,timeout,frameTimeout,ready=false,busy=false,lastVideo=-1,lastSent=0;
let token=null,runID=null,result=null,board='public',publicEntries=[],publicError='',saving=false,recordSaved=false;
const copy={
 ready:t('옆으로 엎드려 가슴을 낮춰 주세요.','Lie face down, side-on to the camera, and lower your chest.'),
 preparing:t('낮은 자세 확인 중… 잠깐 유지하세요.','Checking the low position… hold briefly.'),
 low:t('낮은 자세 확인 중','Checking the low position'),
 rise:t('바닥을 밀어 상체를 올려 주세요.','Push against the floor and raise your chest.'),
 rising:t('팔을 펴고 상체를 올려 주세요.','Extend your arms and lift your chest.'),
 counted:t('1회 완료! 다시 낮춰 다음 동작을 시작하세요.','Rep complete! Lower your chest to start the next rep.'),
 lower:t('다시 가슴을 낮춰 주세요.','Lower your chest again.'),
 standing:t('일어선 자세 확인 중… 곧 기록을 마칩니다.','Checking standing position… finishing your run.'),
 finished:t('완전히 일어서서 도전을 마쳤습니다.','Standing detected. Your run is complete.'),
 visibility:t('집계 대기 · 어깨부터 발목까지 화면 안에 보여 주세요.','Counting paused · keep shoulders through ankles in frame.'),
 side:t('카메라에 몸의 옆면이 보이도록 돌아 주세요.','Turn sideways to the camera.'),
};
function guide(){return `<svg viewBox="0 0 640 260" role="img" aria-label="${t('바닥에 엎드린 옆모습과 카메라 배치 안내','Side view of a person lying on the floor')}"><path d="M70 213H570" stroke="#e8d6aa" stroke-width="2"/><g fill="none" stroke="#d4dfe1" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"><path d="M209 157L335 171L424 189L494 200"/><path d="M216 162L259 184L212 205"/></g><circle cx="175" cy="143" r="23" fill="#d4dfe1"/><path d="M318 52v45m-12-12 12 12 12-12" fill="none" stroke="#e8d6aa" stroke-width="3"/><text x="320" y="32" fill="#e8d6aa" text-anchor="middle" font-size="14">${t('몸 전체가 보이도록 카메라를 옆에 놓으세요','Place the camera beside you, with your whole body in view')}</text></svg>`;}
function mount(){
 if(mounted)return;mounted=true;
 $('baemilgi-screen').innerHTML=`
 <section class="heading"><div><div class="eyebrow">FOUNDATIONS / CHALLENGE</div><h1>${t('배밀기 도전','Hindu push-up challenge')}</h1><p>${t('한 번 더 밀어 올려, 나의 최고 기록에 도전하세요.','One more rep. Challenge your personal best.')}</p></div><div class="session-label"><span class="tiny">HIGH SCORE</span><strong>${t('옆모습으로 자동 집계','Side-view rep counter')}</strong><span>${t('완전히 일어서면 종료','Stand fully upright to finish')}</span></div></section>
 <div class="bm-layout"><section class="bm-main">
 <div class="bm-stage"><div class="bm-stage-top"><span>HINDU PUSH-UP / <span id="bm-mode">READY</span></span><span id="bm-time">00:00</span></div>
 <div class="bm-camera"><video id="bm-video" muted playsinline hidden></video><canvas id="bm-overlay" aria-hidden="true"></canvas><div id="bm-guide">${guide()}<p>${t('카메라를 켠 뒤 옆으로 엎드리면 준비가 시작됩니다.','Turn on your camera, then lie face down in side view to get ready.')}</p></div></div>
 <div class="bm-readout"><div><span>${t('현재 횟수','REPS')}</span><strong id="bm-count" aria-live="polite" aria-atomic="true">0</strong></div><p id="bm-cue" role="status">${copy.ready}</p></div></div>
 <div class="bm-controls"><button id="bm-start" class="primary">${t('카메라 켜고 도전','Start with camera')}</button><button id="bm-cancel" class="outline" hidden>${t('중단 · 기록 제외','Cancel · discard run')}</button><span>${t('소리 없이도 화면 안내로 진행됩니다.','Follow the on-screen cues; no sound required.')}</span></div>
 <p id="bm-notice" class="bm-notice" role="status">${t('카메라 영상은 이 기기에서만 분석하며 저장하거나 전송하지 않습니다.','Camera video is processed on this device. It is never saved or uploaded.')}</p>
 <ol class="bm-steps"><li><b>01</b><div><strong>${t('옆으로 엎드려 준비','Lie face down in side view')}</strong><p>${t('바닥과 수평으로 카메라를 놓고, 손과 발부터 일어선 머리까지 보일 공간을 확보하세요.','Keep the camera level. Leave room to see your hands, feet and your head when standing.')}</p></div></li><li><b>02</b><div><strong>${t('낮췄다가 밀어 올리면 +1','Lower, then push up: +1')}</strong><p>${t('가슴을 낮춘 뒤 팔을 펴며 상체를 올립니다. 올라온 자세를 유지해도 추가로 세지 않습니다.','Lower your chest, then extend your arms and lift your upper body. Holding the raised pose does not add reps.')}</p></div></li><li><b>03</b><div><strong>${t('완전히 일어서서 종료','Stand fully upright to finish')}</strong><p>${t('다리를 펴고 잠시 서 있으면 자동 종료됩니다. 마지막에 닉네임을 입력해 기록을 남기세요.','Straighten your legs and stand briefly to end automatically. Enter your nickname after the run.')}</p></div></li></ol>
 </section><aside class="bm-board" aria-label="${t('배밀기 리더보드','Hindu push-up leaderboard')}"><div class="eyebrow">HALL OF FAME</div><h2>${t('배밀기 최고 기록','Hindu push-up high scores')}</h2><div class="bm-tabs" role="group" aria-label="${t('순위 범위','Leaderboard scope')}"><button id="bm-public" aria-pressed="true">${t('공용 순위','Global')}</button><button id="bm-local" aria-pressed="false">${t('이 기기 기록','This device')}</button></div><p id="bm-board-note" role="status"></p><ol id="bm-entries"></ol><button id="bm-refresh" class="quiet">${t('순위 새로고침 ↻','Refresh scores ↻')}</button><p class="bm-board-foot">${t('공용 순위는 이 브라우저의 최고 기록 하나를 남깁니다. 닉네임이 같아도 다른 참가자일 수 있습니다. 카메라 자동 집계 기록이며 공식 심사 기록은 아닙니다.','Global scores retain one personal best per browser. Nicknames may be shared by different people. Camera-counted scores are not officially judged.')}</p></aside></div>
 <dialog id="bm-result" class="bm-result" aria-labelledby="bm-result-title"><div class="eyebrow">RUN COMPLETE</div><h2 id="bm-result-title">${t('도전 완료','Run complete')}</h2><div class="bm-final"><strong id="bm-final-count">0</strong><span>${t('회','REPS')}</span></div><p id="bm-result-reason"></p><form id="bm-save-form"><label for="bm-nickname">${t('기록에 남길 닉네임','Enter your nickname')}</label><input id="bm-nickname" name="nickname" minlength="2" maxlength="12" autocomplete="nickname" required placeholder="${t('닉네임 2–12자','Nickname, 2–12 characters')}"/><small>${t('한글·영문 등 문자, 숫자, 공백, - 또는 _','Letters, numbers, spaces, - or _')}</small><p id="bm-save-note" role="status"></p><button id="bm-save" class="primary" type="submit">${t('기록 저장','Save score')}</button></form><button id="bm-dismiss" class="quiet">${t('닫기','Close')}</button></dialog>`;
 $('bm-start').onclick=start;$('bm-cancel').onclick=()=>{stopCamera();counter.reset();paintCounter();notice(t('도전을 중단했습니다. 기록은 등록되지 않았습니다.','Run cancelled. No score was submitted.'));};
 $('bm-save-form').onsubmit=saveResult;$('bm-dismiss').onclick=()=>$('bm-result').close();
 $('bm-nickname').oninput=()=>$('bm-nickname').setCustomValidity('');
 $('bm-result').addEventListener('cancel',event=>{if(saving)event.preventDefault()});
 $('bm-public').onclick=()=>{board='public';renderBoard()};$('bm-local').onclick=()=>{board='local';renderBoard()};$('bm-refresh').onclick=()=>refreshBoard(true);
 document.addEventListener('judo-exit',()=>{active=false;stopCamera();$('bm-result').close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){counter.interrupt();if(ready)$('bm-cue').textContent=copy.visibility;}});
 window.addEventListener('pagehide',stopCamera);
}
function notice(message){$('bm-notice').textContent=message;}
function localRecords(){try{return readRecords(localStorage)}catch{return []}}
function renderBoard(){
 $('bm-public').setAttribute('aria-pressed',String(board==='public'));$('bm-local').setAttribute('aria-pressed',String(board==='local'));
 const entries=board==='public'?publicEntries:localRecords();
 $('bm-board-note').textContent=board==='public'?(publicError||t('최대 횟수 순 · 상위 50명 · 동점은 공동 순위','Most reps · top 50 · tied scores share a rank')):t('이 브라우저에 저장된 기록입니다. 다른 기기와 공유되지 않습니다.','Saved in this browser, not shared with other devices.');
 const list=$('bm-entries');list.replaceChildren();
 if(!entries.length){const li=document.createElement('li');li.className='bm-empty';li.textContent=publicError&&board==='public'?t('공용 순위 연결 대기','Waiting for shared storage'):t('첫 기록의 주인공이 되어 보세요.','Set the first score.');list.append(li);}
 let rank=0,previous=null;
 for(const [i,entry] of entries.entries()){
  if(entry.count!==previous)rank=i+1;previous=entry.count;
  const li=document.createElement('li'),place=document.createElement('span'),name=document.createElement('span'),score=document.createElement('strong');
  place.textContent=String(entry.rank??rank).padStart(2,'0');name.textContent=entry.nickname;score.textContent=String(entry.count);li.append(place,name,score);list.append(li);
 }
}
async function refreshBoard(fresh=false){
 $('bm-refresh').disabled=true;
 try{const data=await leaderboardRequest(undefined,{fresh});publicEntries=data.entries;publicError='';}
 catch{publicError=t('공용 순위에 연결할 수 없습니다. 지금은 이 기기에 기록을 남길 수 있습니다.','Shared scores are unavailable. You can save scores on this device.');}
 finally{$('bm-refresh').disabled=false;renderBoard();}
}
function stopCamera(){
 generation++;clearTimeout(timeout);clearTimeout(frameTimeout);cancelAnimationFrame(raf);worker?.terminate();worker=null;
 stream?.getTracks().forEach(track=>track.stop());stream=null;ready=busy=false;lastVideo=-1;
 if(!mounted)return;
 $('bm-video').srcObject=null;$('bm-video').hidden=true;$('bm-guide').hidden=false;
 const canvas=$('bm-overlay');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 $('bm-start').disabled=false;$('bm-cancel').hidden=true;
}
function fail(message){stopCamera();counter.interrupt();$('bm-mode').textContent='PAUSED';notice(message);}
function paintCounter(){
 const state=counter.snapshot();$('bm-count').textContent=String(state.count);$('bm-cue').textContent=copy[state.reason]??copy.ready;
 $('bm-mode').textContent=state.state==='running'?'LIVE':state.state==='finished'?'FINISHED':'READY';
 const elapsed=state.startedAt===null?0:Math.max(0,((state.finishedAt??performance.now())-state.startedAt)/1000);
 $('bm-time').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
}
function drawPose(points){
 const video=$('bm-video'),canvas=$('bm-overlay');
 if(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 const m=measureBaemilgi(points,{width:canvas.width,height:canvas.height});if(!m.valid)return;
 ctx.strokeStyle='#e8d6aa';ctx.lineWidth=Math.max(3,canvas.width/260);ctx.lineCap='round';
 const [s,e,w,h,k,a]=m.ids;
 for(const [i,j] of [[s,e],[e,w],[s,h],[h,k],[k,a]]){ctx.beginPath();ctx.moveTo(points[i].x*canvas.width,points[i].y*canvas.height);ctx.lineTo(points[j].x*canvas.width,points[j].y*canvas.height);ctx.stroke();}
}
async function tick(now){
 if(!active)return;
 raf=requestAnimationFrame(tick);if(document.hidden)return;
 paintCounter();const video=$('bm-video');
 if(!ready||busy||video.readyState<2||video.currentTime===lastVideo||now-lastSent<65)return;
 busy=true;lastVideo=video.currentTime;lastSent=now;const current=generation;
 try{
  const bitmap=await createImageBitmap(video);if(current!==generation){bitmap.close();return;}
  worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);
  frameTimeout=setTimeout(()=>{if(current===generation)fail(t('자세 추적이 응답하지 않습니다. 카메라를 다시 연결해 주세요.','Tracking stopped responding. Reconnect your camera.'));},8000);
 }catch{if(current===generation)fail(t('영상을 분석하지 못했습니다. 다시 연결해 주세요.','Could not read the camera. Please reconnect.'));}
}
async function start(){
 stopCamera();counter.reset();token=null;result=null;runID=crypto.randomUUID();recordSaved=false;saving=false;paintCounter();
 const current=generation;$('bm-start').disabled=true;$('bm-cancel').hidden=false;
 notice(t('카메라 권한을 허용해 주세요. 처음에는 자세 모델을 다운로드합니다.','Allow camera access. The pose model downloads on first use.'));
 if(!navigator.mediaDevices?.getUserMedia){fail(t('HTTPS 또는 localhost에서 카메라를 사용할 수 있습니다.','Camera access requires HTTPS or localhost.'));return;}
 timeout=setTimeout(()=>{if(current===generation)fail(t('연결 시간이 초과되었습니다. 다시 시도해 주세요.','Connection timed out. Please try again.'));},90000);
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});
  if(current!==generation){acquired.getTracks().forEach(track=>track.stop());return;}
  stream=acquired;stream.getVideoTracks()[0].addEventListener('ended',()=>{if(current===generation)fail(t('카메라 연결이 끊겼습니다. 다시 연결해 주세요.','Camera disconnected. Please reconnect.'));});
  const video=$('bm-video');video.srcObject=stream;await video.play();if(current!==generation)return;
  video.hidden=false;$('bm-guide').hidden=true;
  let player;try{player=localStorage.getItem('just-judo-baemilgi-player');if(!/^[a-f\d-]{36}$/i.test(player??'')){player=crypto.randomUUID();localStorage.setItem('just-judo-baemilgi-player',player);}}catch{player=crypto.randomUUID();}
  // Obtain a server-timed session before starting inference; failure still permits local play.
  try{const session=await leaderboardRequest({action:'start',player});if(current!==generation)return;token=session.token;}catch{}
  if(current!==generation)return;
  worker=new Worker(new URL('./baemilgi-tracker.js',import.meta.url));
  worker.onerror=()=>{if(current===generation)fail(t('자세 모델을 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.','Could not load the pose model. Check your connection and retry.'));};
  worker.onmessage=({data})=>{
   if(current!==generation)return;
   if(data.type==='ready'){clearTimeout(timeout);ready=true;notice(token?t('공용 도전 준비 완료 · 영상은 전송되지 않습니다.','Global challenge ready · video stays on your device.'):t('이 기기 기록 모드 · 공용 순위 연결이 없어도 횟수는 셀 수 있습니다.','Device records mode · you can count reps without shared storage.'));raf=requestAnimationFrame(tick);}
   if(data.type==='error')fail(t('자세 추적을 시작하지 못했습니다. 카메라를 다시 연결해 주세요.','Could not run pose tracking. Reconnect your camera.'));
   if(data.type==='result'){
    clearTimeout(frameTimeout);busy=false;if(document.hidden){counter.interrupt();return;}
    counter.update(data.points,data.time,{width:video.videoWidth,height:video.videoHeight});drawPose(data.points);paintCounter();
    if(counter.state==='finished')finish();
   }
  };worker.postMessage({type:'init'});
 }catch(error){if(current!==generation)return;fail(error.name==='NotAllowedError'?t('카메라 권한이 거부되었습니다. 주소창의 사이트 권한을 확인해 주세요.','Camera access denied. Check permissions in the address bar.'):t('카메라를 연결하지 못했습니다. 다른 앱에서 사용 중인지 확인해 주세요.','Could not connect the camera. Check whether another app is using it.'));}
}
function finish(){
 result=counter.snapshot();stopCamera();paintCounter();$('bm-final-count').textContent=String(result.count);
 $('bm-result-reason').textContent=result.count?copy.finished:t('집계된 동작이 없습니다. 낮은 자세부터 다시 시작해 보세요.','No reps counted. Try again from the low position.');
 $('bm-save-form').hidden=!result.count;$('bm-save').disabled=false;$('bm-dismiss').disabled=false;
 $('bm-save').textContent=token?t('공용 순위에 등록','Submit to global scores'):t('이 기기에 저장','Save on this device');
 $('bm-save-note').textContent=token?t('닉네임과 횟수가 공개됩니다.','Your nickname and rep count will be public.'):t('공용 순위 연결 전에는 이 브라우저에만 저장됩니다.','Until shared storage is connected, scores are saved only in this browser.');
 $('bm-nickname').value='';$('bm-nickname').setCustomValidity('');$('bm-result').showModal();if(result.count)$('bm-nickname').focus();
}
async function saveResult(event){
 event.preventDefault();if(saving||recordSaved||!result?.count)return;
 const input=$('bm-nickname'),nickname=input.value.normalize('NFC').trim();
 input.setCustomValidity(validNickname(nickname)?'':t('닉네임은 문자·숫자·공백·-·_로 2–12자를 입력하세요.','Use 2–12 letters, numbers, spaces, - or _.'));if(!input.reportValidity())return;
 const savingRun=runID;saving=true;$('bm-save').disabled=true;$('bm-dismiss').disabled=true;
 let localSaved=false;
 try{saveRecord(localStorage,{id:runID,nickname,count:result.count,date:new Date().toISOString()});localSaved=true;}catch{}
 try{
  if(token){
   const saved=await leaderboardRequest({action:'save',token,nickname,count:result.count,reps:result.reps,duration:Math.round(result.finishedAt-result.startedAt),version:COUNTER_VERSION,endedBy:'standing'});
   if(savingRun!==runID)return;
   $('bm-save-note').textContent=saved.improved?t(`공용 순위 등록 완료 · ${saved.rank}위 · 최고 ${saved.best}회`,`Global score saved · rank ${saved.rank} · best ${saved.best}`):t(`기존 최고 기록 ${saved.best}회를 유지합니다.`,`Your existing personal best of ${saved.best} is retained.`);board='public';void refreshBoard(true);
  }else if(localSaved){$('bm-save-note').textContent=t('이 기기에 저장했습니다. 공용 순위에는 등록되지 않았습니다.','Saved on this device. Not submitted to global scores.');board='local';}
  else throw new Error('local');
  recordSaved=true;$('bm-save').textContent=t('저장 완료','Saved');
 }catch{
  if(savingRun!==runID)return;
  $('bm-save-note').textContent=localSaved?t('이 기기에는 저장했습니다. 공용 등록에 실패했으니 다시 시도해 주세요.','Saved on this device. Global submission failed; please retry.'):t('저장하지 못했습니다. 저장 공간과 연결을 확인하고 다시 시도해 주세요.','Could not save. Check storage permissions and your connection, then retry.');
 }finally{if(savingRun===runID){saving=false;$('bm-save').disabled=recordSaved;$('bm-dismiss').disabled=false;renderBoard();}}
}
export function openBaemilgi(){mount();active=true;counter.reset();paintCounter();void refreshBoard();}
